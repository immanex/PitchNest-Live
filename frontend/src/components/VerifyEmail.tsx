import React, { useState, useEffect } from "react";
import { Link, replace, useLocation, useNavigate } from "react-router-dom";
import {
  Mail,
  RefreshCw,
  Clock,
  CheckCircle,
  Loader2,
  XCircle,
} from "lucide-react";
import { LogoLink } from "../components/Logo";
import { motion, AnimatePresence } from "framer-motion";

// MUST match the backend's EMAIL_FROM / config.emailFrom (backend/src/config/env.ts).
// This previously read "pitchnestapp@gmail.com" — an address that has never sent
// anything: Resend delivers from the verified pitchnest.app domain, and a
// gmail.com sender is not something Resend can authenticate at all. Users
// searched their inbox for the wrong sender and concluded the email never
// arrived, which is exactly the bug this string caused.
const SENDER_ADDRESS = "hello@pitchnest.app";

const steps = [
  {
    num: 1,
    label: "Open the email",
    detail: (
      <>
        from <span className="text-sky-500 font-bold">{SENDER_ADDRESS}</span>{" "}
        — check spam/promotions if you don't see it
      </>
    ),
  },
  {
    num: 2,
    label: 'Enter the code above or click "Verify my email"',
    detail: "in the email to confirm your address",
  },
  {
    num: 3,
    label: "You'll be logged in",
    detail: "and taken straight to your dashboard",
  },
];

// Full screen loader shown while verifying token
function TokenVerifyingScreen() {
  return (
    <motion.div
      key="verifying"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-bg-main dark:bg-[#09090B] flex flex-col items-center justify-center gap-5 transition-colors duration-300"
    >
      <div className="w-16 h-16 rounded-2xl bg-sky-50 dark:bg-sky-500/10 flex items-center justify-center mb-2">
        <Loader2 className="text-sky-500 animate-spin" size={32} />
      </div>
      <h2 className="text-xl font-semibold text-slate-800 dark:text-zinc-100">
        Verifying your email…
      </h2>
      <p className="text-sm text-slate-400 dark:text-zinc-500">
        Hang tight, this takes just a second.
      </p>
    </motion.div>
  );
}

// Shown if token is invalid or expired
function TokenErrorScreen({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const navigate = useNavigate();
  return (
    <motion.div
      key="error"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-bg-main dark:bg-[#09090B] flex items-center justify-center p-6 transition-colors duration-300"
    >
      <div className="w-full max-w-105 card rounded-3xl shadow-2xl shadow-slate-200/50 dark:shadow-black/20 p-8 md:p-10 text-center">
        <LogoLink showText size="md" className="mb-8 justify-center" />

        <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center mx-auto mb-5">
          <XCircle className="text-rose-500" size={32} strokeWidth={1.5} />
        </div>

        <h2 className="text-2xl font-semibold text-slate-900 dark:text-zinc-100 mb-2 tracking-tight">
          Link{" "}
          {message.toLowerCase().includes("expire") ? "expired" : "invalid"}
        </h2>
        <p className="text-sm text-slate-500 dark:text-zinc-400 mb-8 leading-relaxed">
          {message}. Request a new verification link below.
        </p>

        <button
          type="button"
          onClick={onRetry}
          className="w-full flex items-center justify-center gap-2 py-3.5 btn-primary text-sm rounded-xl mb-4"
        >
          <RefreshCw size={15} />
          Resend verification email
        </button>

        <button
          type="button"
          onClick={() => navigate("/signup")}
          className="w-full flex items-center justify-center gap-2 py-3 border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 font-semibold text-sm rounded-xl transition-all duration-150"
        >
          Back to sign up
        </button>
      </div>
    </motion.div>
  );
}

export default function VerifyEmailPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const email =
    location.state?.email || sessionStorage.getItem("verifyEmail") || "";

  // "idle"      → no token in URL, show email sent/code entry screen
  // "verifying" → token found/submitted, API call in progress
  // "error"     → URL token invalid or expired (manually entered code failures stay inline)
  const [status, setStatus] = useState<"idle" | "verifying" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [timer, setTimer] = useState(0);
  const [otp, setOtp] = useState<string[]>(new Array(6).fill(""));

  const verifyToken = (token: string, isManual: boolean = false) => {
    setStatus("verifying");
    setErrorMessage("");
    fetch(`/api/auth/verify-email?token=${token}`)
      .then((r) => {
        if (!r.ok) {
          return r.json().then((data) => {
            throw new Error(data.message || data.error || "Invalid code");
          });
        }
        return r.json();
      })
      .then((data) => {
        if (data.token) {
          // The emailed-link path proves ownership via the high-entropy token,
          // so the server returns a session token on both "verified" and
          // "already verified" — store it and route via the server's redirectTo.
          localStorage.setItem("user", JSON.stringify(data.user));
          localStorage.setItem("token", data.token);
          navigate(data.redirectTo || "/onboarding", { replace: true });
        } else if (data.alreadyVerified) {
          navigate("/login", { replace: true });
        } else {
          if (isManual) {
            setErrorMessage(data.message || "Invalid code");
            setStatus("idle");
          } else {
            setErrorMessage(data.message || "Failed to verify");
            setStatus("error");
          }
        }
      })
      .catch((err: any) => {
        if (isManual) {
          setErrorMessage(err.message || "Something went wrong");
          setStatus("idle");
        } else {
          setErrorMessage(err.message || "Something went wrong");
          setStatus("error");
        }
      });
  };

  // Manual 6-digit code entry → the SCOPED, attempt-locked endpoint. Unlike the
  // emailed link (a long high-entropy token verified by verifyToken), the code
  // is low-entropy, so it is checked server-side only against THIS email's token
  // row with a per-account lockout. Requires the email (from signup/login
  // redirect state); without it the server returns a generic error and the user
  // falls back to the email link.
  const verifyOtp = (code: string) => {
    setStatus("verifying");
    setErrorMessage("");
    fetch("/api/auth/verify-email-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    })
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (ok && data.message === "Email verified successfully" && data.token) {
          localStorage.setItem("user", JSON.stringify(data.user));
          localStorage.setItem("token", data.token);
          navigate(data.redirectTo || "/onboarding", { replace: true });
        } else if (ok && data.alreadyVerified) {
          // Account is already verified (e.g. verified on another device). No
          // token is issued without a matching code — send them to log in.
          navigate("/login", { replace: true });
        } else {
          setErrorMessage(data.message || "Invalid code");
          setStatus("idle");
        }
      })
      .catch((err: any) => {
        setErrorMessage(err.message || "Something went wrong");
        setStatus("idle");
      });
  };

  // 1. Initial URL Token verification
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (token) {
      window.history.replaceState(window.history.state, "", "/verify");
      verifyToken(token, false);
    }
  }, []);

  // 2. Poll for cross-device verification status
  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    if (!storedToken || status === "verifying") return;

    const interval = setInterval(() => {
      fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${storedToken}` },
      })
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error("Me query failed");
        })
        .then((data) => {
          if (data.isEmailVerified) {
            clearInterval(interval);
            const storedUser = localStorage.getItem("user");
            if (storedUser) {
              try {
                const userObj = JSON.parse(storedUser);
                userObj.isEmailVerified = true;
                localStorage.setItem("user", JSON.stringify(userObj));
              } catch (e) {}
            }
            if (data.onboardingCompleted) {
              navigate("/dashboard", { replace: true });
            } else {
              navigate("/onboarding", { replace: true });
            }
          }
        })
        .catch(() => {});
    }, 3000);

    return () => clearInterval(interval);
  }, [navigate, status]);

  // 3. Resend timer countdown ticking
  useEffect(() => {
    if (timer <= 0) {
      setResent(false);
      return;
    }

    const interval = setInterval(() => {
      setTimer((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [timer]);

  const handleResend = async () => {
    setResending(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email }),
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setResent(true);
        setTimer(60);
        setErrorMessage("");
        setStatus("idle"); // reset back to verification input page if error was showing
      } else {
        setErrorMessage(
          data.error || "We couldn't send the email just now. Please try again in a moment.",
        );
        setStatus("idle");
        if (data.isEmailVerified) {
          setTimeout(() => navigate("/login", { replace: true }), 2500);
        }
      }
    } catch {
      setErrorMessage(
        "We couldn't reach the server. Check your connection and try again.",
      );
      setStatus("idle");
    } finally {
      setResending(false);
    }
  };

  const handleOtpChange = (value: string, index: number) => {
    if (isNaN(Number(value))) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Clear inline error when typing
    setErrorMessage("");

    // Shift focus to next input field
    if (value !== "") {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      if (nextInput) {
        (nextInput as HTMLInputElement).focus();
      }
    }

    // Auto-verify if all 6 digits are typed
    const otpCode = newOtp.join("");
    if (otpCode.length === 6) {
      verifyOtp(otpCode);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace") {
      const newOtp = [...otp];
      if (otp[index] === "") {
        // Shift focus to previous field and clear it
        const prevInput = document.getElementById(`otp-${index - 1}`);
        if (prevInput) {
          (prevInput as HTMLInputElement).focus();
          newOtp[index - 1] = "";
        }
      } else {
        newOtp[index] = "";
      }
      setOtp(newOtp);
    }
  };

  return (
    <AnimatePresence mode="wait">
      {status === "verifying" && <TokenVerifyingScreen key="verifying" />}

      {status === "error" && (
        <TokenErrorScreen
          key="error"
          message={errorMessage}
          onRetry={handleResend}
        />
      )}

      {status === "idle" && (
        <motion.div
          key="idle"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="min-h-[80vh] bg-bg-main dark:bg-[#09090B] flex items-center justify-center p-6 font-sans transition-colors duration-300"
        >
          <div className="w-full max-w-120 card rounded-3xl shadow-2xl shadow-slate-200/50 dark:shadow-black/20 overflow-hidden transition-colors">
            <div className="px-8 md:p-12">
              <LogoLink showText size="md" className="mb-10" />

              {/* Sent badge */}
              <div className="flex justify-center mb-5">
                <span className="inline-flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-full px-3.5 py-1.5">
                  <CheckCircle size={13} />
                  Email sent
                </span>
              </div>

              {/* Heading */}
              <h2 className="text-3xl font-semibold text-slate-900 dark:text-zinc-100 mb-2 tracking-tight text-center">
                Check your inbox
              </h2>
              <p className="text-slate-500 dark:text-zinc-500 text-sm text-center mb-1">
                We sent a verification code to
              </p>
              <p className="text-sky-500 font-bold text-sm text-center mb-8">
                {email}
              </p>

              {/* 6-Digit OTP Box UI */}
              <div className="flex justify-center gap-2 mb-6">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    id={`otp-${index}`}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(e.target.value, index)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    onFocus={(e) => e.target.select()}
                    className="w-12 h-12 text-center text-xl font-bold border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-xl focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none text-slate-800 dark:text-zinc-100 transition-all duration-150"
                  />
                ))}
              </div>

              {/* Inline Error Message */}
              {errorMessage && (
                <p className="text-xs text-rose-500 text-center font-semibold mb-6">
                  {errorMessage}
                </p>
              )}

              {/* Steps */}
              <div className="bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl p-5 mb-6 space-y-4">
                {steps.map((s) => (
                  <div key={s.num} className="flex items-start gap-3">
                    <span className="w-6 h-6 min-w-6 rounded-full bg-sky-500 text-white text-[11px] font-bold flex items-center justify-center mt-0.5">
                      {s.num}
                    </span>
                    <p className="text-sm text-slate-500 dark:text-zinc-400 leading-relaxed">
                      <span className="font-bold text-slate-700 dark:text-zinc-200">
                        {s.label}
                      </span>{" "}
                      {s.detail}
                    </p>
                  </div>
                ))}
              </div>

              {/* Open Gmail */}
              <a
                href="https://mail.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-3.5 btn-primary text-sm mb-4 rounded-xl"
              >
                <Mail size={15} />
                Open Gmail
              </a>

              {/* Divider */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-slate-200 dark:bg-zinc-700" />
                <span className="text-[11px] text-slate-400 dark:text-zinc-600">
                  or
                </span>
                <div className="flex-1 h-px bg-slate-200 dark:bg-zinc-700" />
              </div>

              {/* Resend */}
              <button
                type="button"
                onClick={handleResend}
                disabled={resending || timer > 0}
                className="w-full flex items-center justify-center gap-2 py-3 border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 font-semibold text-sm rounded-xl transition-all duration-150 disabled:opacity-60 mb-5"
              >
                {resending ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Sending…
                  </>
                ) : timer > 0 ? (
                  <>
                    <CheckCircle size={15} className="text-emerald-500" />
                    <span className="text-slate-500">
                      Resend in {timer}s
                    </span>
                  </>
                ) : (
                  <>
                    <RefreshCw size={15} />
                    Resend verification email
                  </>
                )}
              </button>

              {/* Footer */}
              <p className="text-center text-xs text-slate-500 dark:text-zinc-500 mb-3">
                Wrong email?{" "}
                <Link
                  to="/signup"
                  className="text-sky-500 font-bold hover:text-sky-600"
                >
                  Change email address
                </Link>
              </p>
              <p className="flex items-center justify-center gap-1 text-[11px] text-slate-400 dark:text-zinc-600 pb-2">
                <Clock size={12} />
                Link and code expire in 24 hours
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
