import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  Loader2,
  Eye,
  EyeOff,
  MailCheck,
  RefreshCw,
  CheckCircle,
} from "lucide-react";
import { LogoLink } from "../components/Logo";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { cn } from "../lib/utils";
import { useAuth } from "../contexts/AuthContext";
import { GoogleSignInButton } from "../components/GoogleSignInButton";
import { clearAuthSession } from "../lib/authStorage";
import Cookies from "js-cookie";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const SLIDES = [
  {
    image:
      "/assets/heroImage.jpeg",
    title: "The AI Pitch Deck Evolution",
    desc: "Join 500+ founders using PitchNest to refine their narratives with real-time AI feedback.",
  },
  {
    image:
      "/assets/heroImage.jpeg",
    title: "Nail Your Delivery",
    desc: "Practice with multimodal AI investors that simulate high-pressure venture capital environments.",
  },
  {
    image:
      "/assets/heroImage.jpeg",
    title: "Actionable Insights",
    desc: "Get deep analytics on your pacing, clarity, and scalability after every single session.",
  },
];

// ─── Email Not Verified Popup ───────────────────────────────────────────────
function EmailNotVerifiedPopup({
  email,
  onClose,
  onResendAndRedirect,
}: {
  email: string;
  onClose: () => void;
  onResendAndRedirect: () => Promise<void>;
}) {
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [timer, setTimer] = useState(0);

  const handleResend = async () => {
    setResending(true);
    await onResendAndRedirect();
    setResending(false);
    setResent(true);
    setTimer(60);
  };
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

  return (
    // Backdrop
    <motion.div
      key="backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
    >
      {/* Card — stop click propagation so clicking inside doesn't close */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="w-full max-w-[420px] card rounded-3xl shadow-2xl shadow-slate-200/50 dark:shadow-black/40 p-8 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center mx-auto mb-5">
          <MailCheck className="text-amber-500" size={30} strokeWidth={1.5} />
        </div>

        {/* Text */}
        <h3 className="text-xl font-semibold text-slate-900 dark:text-zinc-100 mb-2 tracking-tight">
          Verify your email first
        </h3>
        <p className="text-sm text-slate-500 dark:text-zinc-400 leading-relaxed mb-1">
          We sent a verification link to
        </p>
        <p className="text-sky-500 font-bold text-sm mb-6">{email}</p>

        <p className="text-xs text-slate-400 dark:text-zinc-500 leading-relaxed mb-7">
          Check your inbox (and spam folder) for the link. Click below to resend
          it and we'll take you straight to the verify screen.
        </p>

        {/* Resend + redirect CTA */}
        <button
          type="button"
          onClick={handleResend}
          disabled={resending || resent}
          className="w-full flex items-center justify-center gap-2 py-3.5 btn-primary text-sm rounded-xl mb-3 disabled:opacity-60"
        >
          {resending ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              Sending...
            </>
          ) : timer > 0 ? (
            <>
              <CheckCircle size={15} />
              Resend in {timer}s
            </>
          ) : (
            <>
              <RefreshCw size={15} />
              Resend verification email
            </>
          )}
        </button>

        {/* Dismiss */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 text-sm text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
        >
          I'll do it later
        </button>
      </motion.div>
    </motion.div>
  );
}

// ─── Login Page ──────────────────────────────────────────────────────────────
export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const [currentSlide, setCurrentSlide] = useState(0);

  // Unverified popup state
  const [showUnverifiedPopup, setShowUnverifiedPopup] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState("");

  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(window.location.search);
  const referralCode = params.get("referralCode");
  useEffect(() => {
    if (!referralCode || !/^\d{1,18}$/.test(referralCode)) return;
    Cookies.set("code", referralCode, {
      sameSite: "lax",
      secure: window.location.protocol === "https:",
      expires: 7,
    });
  }, [referralCode]);
  



  const from = location.state?.from?.pathname || "/dashboard";

  useEffect(() => {
    const timer = setInterval(
      () => setCurrentSlide((prev) => (prev + 1) % SLIDES.length),
      5000,
    );
    return () => clearInterval(timer);
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsSubmitting(true);
    setServerError("");
    try {
      // Clear only auth-related keys — preserve tour flags (pn_tour_*) so
      // returning users don't get re-shown the walkthrough on every login.
      clearAuthSession();
      localStorage.removeItem("pitchnest_onboarding_complete");
      localStorage.removeItem("pitchnest_startup_name");
      localStorage.removeItem("pitchnest_funding_stage");
      await login(data.email, data.password, rememberMe);
      navigate(from, { replace: true });
    } catch (error: any) {
      // Check if the error is about email not being verified
      if (
        error.message?.toLowerCase().includes("not verified") ||
        error.isEmailVerified === false
      ) {
        setUnverifiedEmail(data.email);
        setShowUnverifiedPopup(true);
      } else {
        setServerError(error.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Resend verification email then redirect to /verify
  const handleResendAndRedirect = async () => {
    try {
      await fetch("/api/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email: unverifiedEmail }),
        headers: {
          "Content-Type": "application/json",
        },
      });
      sessionStorage.setItem("verifyEmail", unverifiedEmail);
      navigate("/verify", { state: { email: unverifiedEmail } });
    } catch (error) {
      console.error("Failed to resend verification email:", error);
    }
  };
  return (
    <>
      {/* ── Google sign-in loading overlay ── */}
      <AnimatePresence>
        {googleLoading && (
          <motion.div
            key="google-loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm"
          >
            <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
            <p className="mt-4 text-sm font-semibold text-slate-600 dark:text-zinc-400">Signing in with Google…</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Email not verified popup ── */}
      <AnimatePresence>
        {showUnverifiedPopup && (
          <EmailNotVerifiedPopup
            email={unverifiedEmail}
            onClose={() => setShowUnverifiedPopup(false)}
            onResendAndRedirect={handleResendAndRedirect}
          />
        )}
      </AnimatePresence>

      <div className="min-h-screen bg-[#FAFBFC] dark:bg-[#09090B] flex items-center justify-center p-6 font-sans transition-colors duration-300">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-[1000px] card rounded-3xl shadow-2xl shadow-slate-200/50 dark:shadow-black/20 overflow-hidden flex flex-col lg:flex-row transition-colors"
        >
          <div className="flex-1 p-8 md:p-16">
            <LogoLink showText size="md" className="mb-12" />

            <h2 className="text-4xl font-semibold text-slate-900 dark:text-zinc-100 mb-1 tracking-tight">
              Sign in
            </h2>
            <p className="text-sm text-slate-500 dark:text-zinc-500 mb-8">
              or{" "}
              <Link
                to="/signup"
                className="text-sky-600 dark:text-sky-400 font-semibold hover:underline"
              >
                Join PitchNest
              </Link>
            </p>

            <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
              {serverError && (
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-600 rounded-lg text-sm font-bold">
                  {serverError}
                </div>
              )}

              <div className="space-y-1.5">
                <input
                  {...register("email")}
                  type="email"
                  placeholder="Email"
                  className={cn(
                    "w-full px-4 py-3.5 bg-white dark:bg-zinc-900 border rounded-lg focus:outline-none focus:ring-2 transition-all dark:text-zinc-100 placeholder:text-slate-500 dark:placeholder:text-zinc-500",
                    errors.email
                      ? "border-rose-500 focus:ring-rose-500/20"
                      : "border-slate-400 dark:border-zinc-600 focus:border-sky-500 focus:ring-sky-500/20",
                  )}
                />
                {errors.email && (
                  <p className="text-xs font-bold text-rose-500">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="relative">
                  <input
                    {...register("password")}
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    className={cn(
                      "w-full pl-4 pr-12 py-3.5 bg-white dark:bg-zinc-900 border rounded-lg focus:outline-none focus:ring-2 transition-all dark:text-zinc-100 placeholder:text-slate-500 dark:placeholder:text-zinc-500",
                      errors.password
                        ? "border-rose-500 focus:ring-rose-500/20"
                        : "border-slate-400 dark:border-zinc-600 focus:border-sky-500 focus:ring-sky-500/20",
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors outline-none"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs font-bold text-rose-500">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 accent-sky-600 cursor-pointer"
                  />
                  Keep me logged in
                </label>
                <Link
                  to="/forgot-password"
                  className="text-sm font-bold text-sky-600 dark:text-sky-400 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-full bg-sky-600 hover:bg-sky-700 text-white text-base font-semibold flex items-center justify-center transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  "Sign in"
                )}
              </button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-zinc-800"></div>
              </div>
              <div className="relative flex justify-center text-sm text-slate-500 dark:text-zinc-500">
                <span className="bg-white dark:bg-zinc-900 px-4">or</span>
              </div>
            </div>

            <GoogleSignInButton
              text="signin_with"
              onCredential={async (credential) => {
                setServerError("");
                setGoogleLoading(true);
                try {
                  // Clear only auth-related keys — preserve tour flags
                  clearAuthSession();
                  localStorage.removeItem("pitchnest_onboarding_complete");
                  localStorage.removeItem("pitchnest_startup_name");
                  localStorage.removeItem("pitchnest_funding_stage");
                  const data = await loginWithGoogle(credential, rememberMe);
                  // New Google users land on onboarding (server decides via
                  // redirectTo); returning users go to their intended page.
                  navigate(data?.redirectTo || from, { replace: true });
                } catch (error: any) {
                  setServerError(error.message || "Google sign-in failed.");
                } finally {
                  setGoogleLoading(false);
                }
              }}
              onError={(message) => setServerError(message)}
            />

            <p className="text-center mt-6 text-xs text-slate-500 dark:text-zinc-500 leading-relaxed px-2">
              By clicking Sign in or Sign in with Google, you agree to
              PitchNest's{" "}
              <Link
                to="/terms"
                className="text-sky-600 dark:text-sky-400 font-semibold hover:underline"
              >
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link
                to="/privacy"
                className="text-sky-600 dark:text-sky-400 font-semibold hover:underline"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </div>

          {/* Right Side: Image Carousel */}
          <div className="hidden lg:flex flex-1 gradient-mesh dark:from-zinc-800 dark:to-zinc-900 items-center justify-center p-16 relative overflow-hidden border-l border-slate-100 dark:border-zinc-800">
            <div className="relative z-10 text-center max-w-sm">
              <div className="rounded-[40px] overflow-hidden shadow-2xl shadow-sky-200 dark:shadow-black/20 border-8 border-white dark:border-zinc-900 mb-8 relative aspect-[3/4]">
                {SLIDES.map((slide, i) => (
                  <img
                    key={i}
                    src={slide.image}
                    alt="Slide"
                    referrerPolicy="no-referrer"
                    className={cn(
                      "absolute inset-0 w-full h-full object-cover transition-opacity duration-1000",
                      i === currentSlide ? "opacity-100 z-10" : "opacity-0 z-0",
                    )}
                  />
                ))}
              </div>
              <div className="h-24">
                <h3 className="text-2xl font-bold text-slate-900 dark:text-zinc-100 mb-3">
                  {SLIDES[currentSlide].title}
                </h3>
                <p className="text-slate-500 dark:text-zinc-400 text-sm leading-relaxed">
                  {SLIDES[currentSlide].desc}
                </p>
              </div>
              <div className="mt-8 flex justify-center gap-2">
                {SLIDES.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setCurrentSlide(i)}
                    className={cn(
                      "h-2 rounded-full transition-all outline-none",
                      i === currentSlide
                        ? "w-6 gradient-brand"
                        : "w-2 bg-slate-200 dark:bg-zinc-700",
                    )}
                  />
                ))}
              </div>
            </div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -ml-32 -mb-32 pointer-events-none" />
          </div>
        </motion.div>
      </div>
    </>
  );
}
