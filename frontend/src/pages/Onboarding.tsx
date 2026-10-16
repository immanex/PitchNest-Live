import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Rocket,
  Target,
  Users,
  TrendingUp,
  ChevronRight,
  CheckCircle2,
  Building2,
} from "lucide-react";
import { Logo } from "../components/Logo";
import { cn } from "../lib/utils";
import { useAuth } from "../contexts/AuthContext";
import { getAuthToken } from "../lib/authStorage";

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    startupName: "",
    industry: "",
    goal: "",
    fundingStage: "Pre-Seed",
  });
  // "Other" industry: a free-text escape hatch for founders outside the four
  // preset categories. When active, formData.industry mirrors the typed value.
  const [industryIsOther, setIndustryIsOther] = useState(false);
  const [customIndustry, setCustomIndustry] = useState("");

  const handleNext = () => {
    if (step < 4) setStep(step + 1);
  };

  const handleFinish = async () => {
    setIsSubmitting(true);

    // Persist onboarding data to the backend
    const token = getAuthToken();
    try {
      await fetch("/api/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          startup_name: formData.startupName || "My Startup",
          industry: formData.industry,
          goal: formData.goal,
          funding_stage: formData.fundingStage || "Pre-Seed",
        }),
      });
    } catch (err) {
      console.warn("Failed to save profile to backend:", err);
    }

    localStorage.setItem("pitchnest_onboarding_complete", "true");
    localStorage.setItem(
      "pitchnest_startup_name",
      formData.startupName || "My Startup",
    );
    localStorage.setItem(
      "pitchnest_funding_stage",
      formData.fundingStage || "Pre-Seed",
    );

    navigate("/dashboard");
  };

  // Skip onboarding — marks the user onboarded so they aren't sent back here.
  // The backend route is PUT /api/profile/skip-onboarding; using POST here meant
  // the request 404'd and the skip never persisted. Navigate regardless so a
  // mail/network hiccup can't trap the user on this screen.
  const handleSkip = async () => {
    localStorage.setItem("pitchnest_onboarding_complete", "true");
    localStorage.setItem("pitchnest_startup_name", "My Startup");
    localStorage.setItem("pitchnest_funding_stage", "Pre-Seed");
    try {
      const token = getAuthToken();
      await fetch("/api/profile/skip-onboarding", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (err) {
      console.warn("Failed to persist skip-onboarding:", err);
    }

    navigate("/dashboard");
  };

  // Switch statement so AnimatePresence can hook into the changing key.
  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="flex-1 flex flex-col justify-center h-full">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-zinc-100 mb-3">
              Welcome aboard, {user?.name?.split(" ")[0] || "Founder"}! 👋
            </h2>
            <p className="text-slate-500 dark:text-zinc-400 text-lg mb-8 leading-relaxed">
              Let's get your AI environment set up. What is the name of the
              startup or project you are pitching?
            </p>

            <div className="relative">
              <Building2
                className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400"
                size={20}
              />
              <input
                type="text"
                autoFocus
                value={formData.startupName}
                onChange={(e) =>
                  setFormData({ ...formData, startupName: e.target.value })
                }
                placeholder="e.g. EcoStream SaaS"
                className="w-full pl-14 pr-6 py-5 bg-slate-50 dark:bg-zinc-800/50 border-2 border-slate-100 dark:border-zinc-800 rounded-2xl focus:outline-none focus:border-sky-500 focus:bg-white dark:focus:bg-zinc-900 transition-all dark:text-zinc-100 text-lg font-medium"
              />
            </div>

            <div className="mt-8 flex justify-end mt-auto pt-8">
              <button
                onClick={handleNext}
                disabled={!formData.startupName.trim()}
                className="px-8 py-4 bg-sky-500 text-white font-bold rounded-2xl hover:bg-sky-600 transition-all flex items-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue{" "}
                <ChevronRight
                  size={18}
                  className="group-hover:translate-x-1 transition-transform"
                />
              </button>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="flex-1 flex flex-col justify-center h-full">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-zinc-100 mb-3">
              Select your Industry
            </h2>
            <p className="text-slate-500 dark:text-zinc-400 text-lg mb-8 leading-relaxed">
              This helps our AI Panel ask the right technical and market-sizing
              questions.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                "SaaS & Enterprise",
                "Fintech",
                "Healthtech",
                "Consumer & E-Commerce",
                "Other",
              ].map((ind) => {
                // "Other" is selected whenever the stored industry isn't one of
                // the fixed options (including the first time, when it's empty
                // and the custom box is open).
                const isOther = ind === "Other";
                const selected = isOther
                  ? industryIsOther
                  : formData.industry === ind;
                return (
                  <button
                    key={ind}
                    onClick={() => {
                      if (isOther) {
                        setIndustryIsOther(true);
                        setFormData({ ...formData, industry: customIndustry });
                      } else {
                        setIndustryIsOther(false);
                        setFormData({ ...formData, industry: ind });
                      }
                    }}
                    className={cn(
                      "p-5 rounded-2xl border-2 text-left transition-all font-bold",
                      selected
                        ? "border-sky-500 bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400"
                        : "border-slate-100 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 text-slate-600 dark:text-zinc-300",
                    )}
                  >
                    {ind}
                  </button>
                );
              })}
            </div>

            {industryIsOther && (
              <input
                type="text"
                autoFocus
                value={customIndustry}
                onChange={(e) => {
                  setCustomIndustry(e.target.value);
                  setFormData({ ...formData, industry: e.target.value });
                }}
                maxLength={80}
                placeholder="Type your industry (e.g. Climate Tech, EdTech, Logistics)"
                className="mt-4 w-full px-4 py-3 rounded-2xl border-2 border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-sky-500 transition-colors"
              />
            )}

            <div className="mt-8 flex justify-between mt-auto pt-8">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-4 text-slate-500 font-bold hover:text-slate-800 dark:hover:text-white transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleNext}
                disabled={!formData.industry}
                className="px-8 py-4 bg-sky-500 text-white font-bold rounded-2xl hover:bg-sky-600 transition-all flex items-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue{" "}
                <ChevronRight
                  size={18}
                  className="group-hover:translate-x-1 transition-transform"
                />
              </button>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="flex-1 flex flex-col justify-center h-full">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-zinc-100 mb-3">
              Select your Funding Stage
            </h2>
            <p className="text-slate-500 dark:text-zinc-400 text-lg mb-8 leading-relaxed">
              This guides the AI investors' expectations on traction, revenue,
              and scaling.
            </p>

            <div className="grid grid-cols-2 gap-4">
              {["Idea / Bootstrap", "Pre-Seed", "Seed", "Series A+"].map(
                (stage) => (
                  <button
                    key={stage}
                    onClick={() =>
                      setFormData({ ...formData, fundingStage: stage })
                    }
                    className={cn(
                      "p-5 rounded-2xl border-2 text-left transition-all font-bold text-sm",
                      formData.fundingStage === stage
                        ? "border-sky-500 bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400"
                        : "border-slate-100 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 text-slate-600 dark:text-zinc-300",
                    )}
                  >
                    {stage}
                  </button>
                ),
              )}
            </div>

            <div className="mt-8 flex justify-between mt-auto pt-8">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-4 text-slate-500 font-bold hover:text-slate-800 dark:hover:text-white transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleNext}
                disabled={!formData.fundingStage}
                className="px-8 py-4 bg-sky-500 text-white font-bold rounded-2xl hover:bg-sky-600 transition-all flex items-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue{" "}
                <ChevronRight
                  size={18}
                  className="group-hover:translate-x-1 transition-transform"
                />
              </button>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="flex-1 flex flex-col justify-center h-full">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-zinc-100 mb-3">
              What is your primary goal?
            </h2>
            <p className="text-slate-500 dark:text-zinc-400 text-lg mb-8 leading-relaxed">
              We'll tailor your dashboard analytics based on what matters most
              to you right now.
            </p>

            <div className="space-y-4">
              {[
                {
                  id: "funding",
                  title: "Raise Funding",
                  desc: "I am preparing for an upcoming Seed or Series A round.",
                  icon: Target,
                },
                {
                  id: "practice",
                  title: "General Practice",
                  desc: "I just want to improve my public speaking and delivery.",
                  icon: Users,
                },
                {
                  id: "deck",
                  title: "Refine Pitch Deck",
                  desc: "I need AI feedback on my slide structure and content.",
                  icon: TrendingUp,
                },
              ].map((goal) => (
                <button
                  key={goal.id}
                  onClick={() => setFormData({ ...formData, goal: goal.id })}
                  className={cn(
                    "w-full p-5 rounded-2xl border-2 flex items-center gap-5 transition-all text-left group",
                    formData.goal === goal.id
                      ? "border-sky-500 bg-sky-50 dark:bg-sky-500/10"
                      : "border-slate-100 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700",
                  )}
                >
                  <div
                    className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                      formData.goal === goal.id
                        ? "bg-sky-500 text-white"
                        : "bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400",
                    )}
                  >
                    <goal.icon size={20} />
                  </div>
                  <div>
                    <h4
                      className={cn(
                        "font-bold text-base mb-1",
                        formData.goal === goal.id
                          ? "text-sky-700 dark:text-sky-400"
                          : "text-slate-900 dark:text-zinc-100",
                      )}
                    >
                      {goal.title}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      {goal.desc}
                    </p>
                  </div>
                  {formData.goal === goal.id && (
                    <CheckCircle2 className="ml-auto text-sky-500" size={24} />
                  )}
                </button>
              ))}
            </div>

            <div className="mt-8 flex justify-between mt-auto pt-8">
              <button
                onClick={() => setStep(3)}
                className="px-6 py-4 text-slate-500 font-bold hover:text-slate-800 dark:hover:text-white transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleFinish}
                disabled={!formData.goal || isSubmitting}
                className="px-8 py-4 bg-sky-500 text-white font-bold rounded-2xl hover:bg-sky-600 transition-all flex items-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Setting up..." : "Enter Workspace"}
                {!isSubmitting && (
                  <Rocket
                    size={18}
                    className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform"
                  />
                )}
              </button>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center p-6 font-sans transition-colors duration-300 relative overflow-y-auto">
      {/* Background Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden flex items-center justify-center">
        <div className="w-[800px] h-[800px] bg-sky-500/10 rounded-full blur-[120px] opacity-50" />
      </div>

      {/* Skip button, tucked into the corner so it doesn't crowd the logo on mobile. */}
      <button
        onClick={handleSkip}
        className="absolute top-4 right-4 sm:top-8 sm:right-8 text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs sm:text-sm font-bold transition-colors z-20"
      >
        Skip Onboarding
      </button>

      {/* my-auto centers the wizard when it fits and lets the page scroll (via the
          parent's overflow-y-auto) when the viewport is shorter than the content,
          so the Continue/Back buttons are always reachable on small screens. */}
      <div className="w-full max-w-2xl relative z-10 flex flex-col h-auto min-h-[600px] sm:min-h-[700px] my-auto py-4">
        {/* Logo Header */}
        <div className="flex justify-center mb-10 shrink-0">
          <Logo showText size="lg" textClassName="text-2xl font-extrabold" />
        </div>

        {/* Progress Bar */}
        <div className="flex gap-2 mb-8 max-w-sm mx-auto w-full shrink-0">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-1.5 flex-1 rounded-full overflow-hidden bg-slate-200 dark:bg-zinc-800"
            >
              <div
                className={cn(
                  "h-full bg-sky-500 transition-all duration-500",
                  step >= i ? "w-full" : "w-0",
                )}
              />
            </div>
          ))}
        </div>

        {/* Main Card */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[40px] p-8 md:p-12 shadow-2xl shadow-slate-200 dark:shadow-none overflow-hidden relative flex-1 flex flex-col">
          <AnimatePresence mode="wait">
            <motion.div
              key={step} // key change replays Framer Motion's exit/initial animations
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="flex-1 flex flex-col"
            >
              {renderStepContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
