const TOKEN_KEY = "token";
const USER_KEY = "user";

function storageAvailable(storage: Storage): boolean {
  try {
    const key = "__pn_storage_check__";
    storage.setItem(key, key);
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function getAuthToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredUser(): string | null {
  try {
    return sessionStorage.getItem(USER_KEY) || localStorage.getItem(USER_KEY);
  } catch {
    return null;
  }
}

/**
 * Keep ordinary sessions inside this browser tab. Only an explicit
 * "Keep me logged in" choice persists credentials after the browser closes.
 */
export function storeAuthSession(user: unknown, token: string, persistent = false): void {
  const target = persistent ? localStorage : sessionStorage;
  if (!storageAvailable(target)) throw new Error("Browser storage is unavailable");
  clearAuthSession();
  target.setItem(USER_KEY, JSON.stringify(user));
  target.setItem(TOKEN_KEY, token);
}

export function updateStoredToken(token: string): void {
  try {
    const target = localStorage.getItem(TOKEN_KEY) ? localStorage : sessionStorage;
    target.setItem(TOKEN_KEY, token);
  } catch {
    // The in-memory context retains the refreshed token for this page.
  }
}

export function updateStoredUser(user: unknown): void {
  try {
    const target = localStorage.getItem(TOKEN_KEY) ? localStorage : sessionStorage;
    target.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // The in-memory context remains authoritative for this page.
  }
}

export function clearAuthSession(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {}
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  } catch {}
}
