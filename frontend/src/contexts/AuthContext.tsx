import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import Cookies from "js-cookie";

export type UserRole = "Founder" | "Investor" | "Advisor";

/** Mirrors the backend entitlement tiers (see entitlementService.ts). */
export type UserPlan = "free" | "pro";

export interface User {
  id: number;
  name: string;
  email: string;
  role?: UserRole;
  bio?: string;
  avatarUrl?: string | null;
  settings?: Record<string, any>;
  /** Paywall tier. Drives UI affordances only — the server re-checks every gate. */
  plan?: UserPlan;
  /**
   * Trial state. These mirror exactly what the backend's toPublicUser() returns
   * (authController.ts) — they used to be missing from this interface, which is
   * why call sites read them through `as any`. The SERVER derives both the plan
   * and the trial from the row on every request, so these are a snapshot; never
   * treat them as the authority for anything that matters.
   */
  planExpiresAt?: string | null;
  isTrial?: boolean;
  trialDaysRemaining?: number;
  trialExpiresAt?: string | null;
  orgCode?: number | string;
  accountType?: "user" | "organization";
}

function safeParse<T = any>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (
    email: string,
    password: string,
    rememberMe?: boolean,
  ) => Promise<void>;
  orgLogin: (
    email: string,
    password: string,
    rememberMe?: boolean,
  ) => Promise<void>;
  loginWithGoogle: (credential: string, rememberMe?: boolean) => Promise<any>;
  signup: (
    name: string,
    email: string,
    password: string,
    role?: UserRole,
  ) => Promise<any>;
  logout: () => void;
  isLoading: boolean;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
  /** Re-reads /api/auth/me. Use after an out-of-band change like a payment. */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ── Sliding session ──
  // Tokens expire 24h after issue (30d with "Keep me logged in"). While the
  // user is actually using the app we swap the token for a fresh one, so the
  // session only ends after real inactivity — not mid-use.
  const lastActivityRef = useRef(Date.now());
  const lastRefreshRef = useRef(0);

  const refreshSession = useCallback(async (currentToken: string) => {
    try {
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      // An expired/invalid token is logged out by the /me and 401 paths.
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      if (data?.token) {
        lastRefreshRef.current = Date.now();
        localStorage.setItem("token", data.token);
        setToken(data.token);
      }
    } catch {
      // Network error — the next interval tick will retry
    }
  }, []);

  useEffect(() => {
    const markActivity = () => {
      lastActivityRef.current = Date.now();
    };
    window.addEventListener("click", markActivity);
    window.addEventListener("keydown", markActivity);
    document.addEventListener("visibilitychange", markActivity);

    const interval = setInterval(
      () => {
        const currentToken = localStorage.getItem("token");
        if (!currentToken) return;
        // Only slide the window if the user did something since last refresh
        if (lastActivityRef.current <= lastRefreshRef.current) return;
        refreshSession(currentToken);
      },
      30 * 60 * 1000,
    );

    return () => {
      window.removeEventListener("click", markActivity);
      window.removeEventListener("keydown", markActivity);
      document.removeEventListener("visibilitychange", markActivity);
      clearInterval(interval);
    };
  }, [refreshSession]);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const storedToken = localStorage.getItem("token");

    if (!storedUser || !storedToken) {
      setIsLoading(false);
      return;
    }

    fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${storedToken}` },
    })
      .then(async (res) => {
        if (res.ok) {
          const stored = safeParse<User>(storedUser);
          const fresh = await res.json().catch(() => null);
          const merged = { ...(stored || {}), ...(fresh || {}) } as User;
          if (!merged.id) {
            localStorage.removeItem("user");
            localStorage.removeItem("token");
            return;
          }
          setUser(merged);
          setToken(storedToken);
          localStorage.setItem("user", JSON.stringify(merged));
          window.dispatchEvent(new Event("userUpdate"));
          // Returning user is clearly active — restart their expiry window now
          refreshSession(storedToken);
        } else {
          // Token expired or invalid — clear everything
          localStorage.removeItem("user");
          localStorage.removeItem("token");
        }
      })
      .catch(() => {
        // Network error — trust local storage to avoid locking out offline users
        const stored = safeParse<User>(storedUser);
        if (stored) {
          setUser(stored);
          setToken(storedToken);
        }
      })
      .finally(() => setIsLoading(false));
  }, [refreshSession]);

  const login = async (email: string, password: string, rememberMe = false) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, rememberMe }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Login failed");

    setUser(data.user);
    setToken(data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    localStorage.setItem("token", data.token);
  };
  const orgLogin = async (
    email: string,
    password: string,
    rememberMe = false,
  ) => {
    const res = await fetch("/api/auth/organization-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, rememberMe }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Login failed");

    setUser(data.user);
    setToken(data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    localStorage.setItem("token", data.token);
  };

  const signup = async (
    name: string,
    email: string,
    password: string,
    role?: UserRole,
  ) => {
    const referralCode = Cookies.get("code")?.trim();
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        password,
        role,
        ...(referralCode ? { referralCode } : {}),
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || "Signup failed");

    // Signup no longer logs the user in: the backend requires email
    // verification first and returns NO token (requiresVerification: true).
    // Only establish a session if a token is actually present (defensive — keeps
    // this working if the contract ever changes back). Otherwise leave the user
    // logged out; SignupPage routes to /verify.
    if (data?.token) {
      setUser(data.user);
      setToken(data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("token", data.token);
    }
    return data;
  };

  const loginWithGoogle = async (credential: string, rememberMe = false) => {
    const res = await fetch("/api/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential, rememberMe }),
    });
    const data = await res.json();
    if (!res.ok)
      throw new Error(data.message || data.error || "Google sign-in failed");

    setUser(data.user);
    setToken(data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    localStorage.setItem("token", data.token);
    return data;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
  };

  /**
   * Authenticated fetch wrapper — automatically attaches the JWT Bearer token
   * to all API requests. Use this instead of raw fetch() for protected endpoints.
   */
  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      const currentToken = token || localStorage.getItem("token");

      const headers = new Headers(options.headers || {});
      if (currentToken) {
        headers.set("Authorization", `Bearer ${currentToken}`);
      }

      const res = await fetch(url, { ...options, headers });

      // If token expired or invalid, force logout
      if (res.status === 401) {
        setUser(null);
        setToken(null);
        localStorage.removeItem("user");
        localStorage.removeItem("token");
      }

      return res;
    },
    [token],
  );

  // Refetch user data when the window regains focus so pages show live data
  useEffect(() => {
    const onFocus = () => {
      const currentToken = localStorage.getItem("token");
      if (!currentToken) return;
      fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${currentToken}` },
      })
        .then(async (res) => {
          if (!res.ok) {
            setUser(null);
            setToken(null);
            localStorage.removeItem("user");
            localStorage.removeItem("token");
            return;
          }
          const fresh = await res.json().catch(() => null);
          if (!fresh?.id) return;
          const stored = safeParse<User>(localStorage.getItem("user"));
          const merged = { ...(stored || {}), ...fresh } as User;
          setUser(merged);
          localStorage.setItem("user", JSON.stringify(merged));
          window.dispatchEvent(new Event("userUpdate"));
        })
        .catch(() => {}); // Ignore network errors silently
    };

    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  /**
   * Re-reads the user from /api/auth/me on demand.
   *
   * Needed because the plan can change without any navigation or focus event —
   * a checkout return, or a webhook settling seconds after payment. Same
   * merge semantics as the focus refresh: fresh server fields win over the
   * stored copy.
   */
  const refreshUser = useCallback(async () => {
    const currentToken = localStorage.getItem("token");
    if (!currentToken) return;
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      if (!res.ok) return;
      const fresh = await res.json().catch(() => null);
      if (!fresh?.id) return;
      const stored = safeParse<User>(localStorage.getItem("user"));
      const merged = { ...(stored || {}), ...fresh } as User;
      setUser(merged);
      localStorage.setItem("user", JSON.stringify(merged));
      window.dispatchEvent(new Event("userUpdate"));
    } catch {
      // Network blip — keep the current user rather than logging them out.
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        loginWithGoogle,
        signup,
        logout,
        isLoading,
        authFetch,
        refreshUser,
        orgLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined)
    throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
