import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ChevronDown,
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
import { clearAuthSession } from "../lib/authStorage";
import { GoogleSignInButton } from "../components/GoogleSignInButton";
import Cookies from "js-cookie";

const signupSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(10, "Password must be at least 10 characters").max(72),
    confirmPassword: z
      .string()
      .min(10, "Confirm password must be at least 10 characters")
      .max(72),
    role: z.enum(["Founder", "Investor", "Advisor"]),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type SignupFormValues = z.infer<typeof signupSchema>;

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

// ─── Reusable Email Not Verified Popup ──────────────────────────────────────
function EmailNotVerifiedPopup({
  email,
  onClose,
  onResend,
}: {
  email: string;
  onClose: () => void;
  onResend: () => Promise<void>;
}) {
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [timer, setTimer] = useState(0);

  const handleResend = async () => {
    setResending(true);
    await onResend();
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
    <motion.div
      key="backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="w-full max-w-105 card rounded-3xl shadow-2xl shadow-slate-200/50 dark:shadow-black/40 p-8 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center mx-auto mb-5">
          <MailCheck className="text-amber-500" size={30} strokeWidth={1.5} />
        </div>

        <h3 className="text-xl font-semibold text-slate-900 dark:text-zinc-100 mb-2 tracking-tight">
          Account already exists
        </h3>
        <p className="text-sm text-slate-500 dark:text-zinc-400 leading-relaxed mb-1">
          This email is registered but not verified yet
        </p>
        <p className="text-sky-500 font-bold text-sm mb-6">{email}</p>

        <p className="text-xs text-slate-400 dark:text-zinc-500 leading-relaxed mb-7">
          Check your inbox for the original link, or click below to get a fresh
          one and verify your account.
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

        {/* Go to login instead */}
        <Link
          to="/login"
          className="w-full flex items-center justify-center py-3 text-sm text-slate-500 dark:text-zinc-400 hover:text-sky-500 dark:hover:text-sky-400 font-semibold transition-colors"
          onClick={onClose}
        >
          Already verified? Log in instead
        </Link>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2 text-xs text-slate-400 dark:text-zinc-600 hover:text-slate-500 transition-colors mt-1"
        >
          Dismiss
        </button>
      </motion.div>
    </motion.div>
  );
}

// ─── Signup Page ─────────────────────────────────────────────────────────────
export default function SignupPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const [currentSlide, setCurrentSlide] = useState(0);

  // Unverified popup state
  const [showUnverifiedPopup, setShowUnverifiedPopup] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState("");

  const { signup, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const params = new URLSearchParams(window.location.search);

  const referralCode = params.get("referralCode");
  const organizationInvite =
    (referralCode && /^\d{1,18}$/.test(referralCode) ? referralCode : "") ||
    (Cookies.get("code")?.match(/^\d{1,18}$/)?.[0] ?? "");

  useEffect(() => {
    if (!referralCode || !/^\d{1,18}$/.test(referralCode)) return;
    Cookies.set("code", referralCode, {
      sameSite: "lax",
      secure: window.location.protocol === "https:",
      expires: 7,
    });
  }, [referralCode]);

  useEffect(() => {
    const timer = setInterval(
      () => setCurrentSlide((prev) => (prev + 1) % SLIDES.length),
      4000,
    );
    return () => clearInterval(timer);
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { role: "Founder" },
  });

  const onSubmit = async (data: SignupFormValues) => {
    setIsSubmitting(true);
    setServerError("");
    try {
      // Clear only auth-related keys — preserve tour flags (pn_tour_*)
      clearAuthSession();
      localStorage.removeItem("pitchnest_onboarding_complete");
      localStorage.removeItem("pitchnest_startup_name");
      localStorage.removeItem("pitchnest_funding_stage");

      await signup(data.name, data.email, data.password, data.role);

      // Persist the email (like the login flow does) so the /verify OTP path
      // still knows which account to check even after a hard refresh — the
      // scoped verify-email-otp endpoint needs it. Then route to the verify
      // screen so the founder can enter the code / click the email link.
      sessionStorage.setItem("verifyEmail", data.email);
      navigate("/verify", { state: { email: data.email } });
    } catch (error: any) {
      // Already registered but email not verified → show popup
      if (error.message?.toLowerCase().includes("not verified")) {
        setUnverifiedEmail(data.email);
        setShowUnverifiedPopup(true);
      } else {
        setServerError(error.message || "Signup failed");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Resend then redirect to /verify
  const handleResend = async (email: string) => {
    await fetch("/api/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify({ email }),
      headers: {
        "Content-Type": "application/json",
      },
    });
  };

  return (
    <>
      {/* ── Google sign-up loading overlay ── */}
      <AnimatePresence>
        {googleLoading && (
          <motion.div
            key="google-loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-60 flex flex-col items-center justify-center bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm"
          >
            <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
            <p className="mt-4 text-sm font-semibold text-slate-600 dark:text-zinc-400">
              Signing up with Google…
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Unverified popup ── */}
      <AnimatePresence>
        {showUnverifiedPopup && (
          <EmailNotVerifiedPopup
            email={unverifiedEmail}
            onClose={() => setShowUnverifiedPopup(false)}
            onResend={() => handleResend(unverifiedEmail)}
          />
        )}
      </AnimatePresence>

      <div className="min-h-screen bg-bg-main dark:bg-[#09090B] flex items-center justify-center p-6 font-sans transition-colors duration-300">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-250 card rounded-3xl shadow-2xl shadow-slate-200/50 dark:shadow-black/20 overflow-hidden flex flex-col lg:flex-row transition-colors"
        >
          <div className="flex-1 p-8 md:p-12">
            <LogoLink showText size="md" className="mb-10" />

            <h2 className="text-4xl font-semibold text-slate-900 dark:text-zinc-100 mb-8 tracking-tight">
              Join PitchNest
            </h2>

            <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
              {organizationInvite && (
                <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs leading-relaxed text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-200">
                  You are joining an organization workspace. After you verify your email,
                  that organization can see your membership and the scores, progress, and
                  feedback from pitch sessions you run while enrolled. Transcripts, decks,
                  and recordings are not included in its dashboard.
                </div>
              )}
              {serverError && (
                <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 rounded-xl text-sm font-semibold flex items-center justify-between gap-3">
                  <span>{serverError}</span>
                  {(serverError.toLowerCase().includes("log in") || serverError.toLowerCase().includes("already exists")) && (
                    <Link
                      to="/login"
                      className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 transition-colors shrink-0"
                    >
                      Log in →
                    </Link>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <input
                  {...register("name")}
                  type="text"
                  placeholder="Name"
                  className={cn(
                    "w-full px-4 py-3.5 bg-white dark:bg-zinc-900 border rounded-lg focus:outline-none focus:ring-2 transition-all dark:text-zinc-100 placeholder:text-slate-500 dark:placeholder:text-zinc-500",
                    errors.name
                      ? "border-rose-500 focus:ring-rose-500/20"
                      : "border-slate-400 dark:border-zinc-600 focus:border-sky-500 focus:ring-sky-500/20",
                  )}
                />
                {errors.name && (
                  <p className="text-xs font-bold text-rose-500">
                    {errors.name.message}
                  </p>
                )}
              </div>

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
                    placeholder="Create password"
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
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 outline-none"
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

              <div className="space-y-1.5">
                <div className="relative">
                  <input
                    {...register("confirmPassword")}
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm password"
                    className={cn(
                      "w-full pl-4 pr-12 py-3.5 bg-white dark:bg-zinc-900 border rounded-lg focus:outline-none focus:ring-2 transition-all dark:text-zinc-100 placeholder:text-slate-500 dark:placeholder:text-zinc-500",
                      errors.confirmPassword
                        ? "border-rose-500 focus:ring-rose-500/20"
                        : "border-slate-400 dark:border-zinc-600 focus:border-sky-500 focus:ring-sky-500/20",
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 outline-none"
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-xs font-bold text-rose-500">
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                  I am a...
                </label>
                <div className="relative">
                  <select
                    {...register("role")}
                    className="w-full pl-4 pr-10 py-3.5 bg-white dark:bg-zinc-900 border border-slate-400 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:border-sky-500 focus:ring-sky-500/20 transition-all appearance-none cursor-pointer dark:text-zinc-100"
                  >
                    <option value="Founder">Founder</option>
                    <option value="Investor">Investor</option>
                    <option value="Advisor">Advisor</option>
                  </select>
                  <ChevronDown
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                    size={16}
                  />
                </div>
              </div>

              <p className="text-xs text-slate-500 dark:text-zinc-500 leading-relaxed pt-2">
                By clicking Sign up or Sign up with Google, you agree to
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

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-full bg-sky-600 hover:bg-sky-700 text-white text-base font-semibold flex items-center justify-center transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  "Sign up"
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
              text="signup_with"
              onCredential={async (credential) => {
                setServerError("");
                setGoogleLoading(true);
                try {
                  // Clear only auth-related keys — preserve tour flags
                  clearAuthSession();
                  localStorage.removeItem("pitchnest_onboarding_complete");
                  localStorage.removeItem("pitchnest_startup_name");
                  localStorage.removeItem("pitchnest_funding_stage");
                  const data = await loginWithGoogle(credential);
                  // New Google users land on onboarding (server decides via
                  // redirectTo); returning users go to the dashboard.
                  navigate(data?.redirectTo || "/dashboard", { replace: true });
                } catch (error: any) {
                  setServerError(error.message || "Google sign-up failed.");
                } finally {
                  setGoogleLoading(false);
                }
              }}
              onError={(message) => setServerError(message)}
            />

            <p className="text-center mt-6 text-sm text-slate-500 dark:text-zinc-500">
              Already on PitchNest?{" "}
              <Link
                to="/login"
                className="text-sky-600 dark:text-sky-400 font-semibold hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>

          {/* Right Side Carousel */}
          <div className="hidden lg:flex flex-1 bg-sky-50 dark:bg-zinc-800 flex-col items-center justify-center p-12 relative overflow-hidden">
            <div className="relative z-10 w-full max-w-sm">
              <div className="rounded-4xl overflow-hidden shadow-2xl border-8 border-white dark:border-zinc-900 mb-8 relative aspect-4/5 bg-slate-100">
                <div
                  className="flex w-full h-full transition-transform duration-700 ease-in-out"
                  style={{ transform: `translateX(-${currentSlide * 100}%)` }}
                >
                  {SLIDES.map((slide, i) => (
                    <div key={i} className="min-w-full h-full shrink-0">
                      <img
                        src={slide.image}
                        alt={slide.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="h-24 text-center">
                <h3 className="text-xl font-bold text-slate-900 dark:text-zinc-100 mb-2 transition-all duration-300">
                  {SLIDES[currentSlide].title}
                </h3>
                <p className="text-slate-500 dark:text-zinc-400 text-sm leading-relaxed transition-all duration-300">
                  {SLIDES[currentSlide].desc}
                </p>
              </div>

              <div className="mt-4 flex justify-center gap-2">
                {SLIDES.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setCurrentSlide(i)}
                    className={cn(
                      "h-2 rounded-full transition-all duration-300 outline-none",
                      i === currentSlide
                        ? "w-8 bg-sky-500"
                        : "w-2 bg-sky-200 dark:bg-zinc-700 hover:bg-sky-300",
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
