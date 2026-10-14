import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Hammer, Minus, Sparkles } from "lucide-react";
import { cn } from "../lib/utils";
import { ThemeToggle } from "../components/ThemeToggle";
import { LogoLink } from "../components/Logo";
import { getPlans, IN_DEVELOPMENT } from "../lib/plans";
import { usePublicPrice } from "../hooks/usePublicPrice";

/**
 * Standalone pricing page.
 *
 * The landing page carries a condensed three-card summary; this is the detail
 * view it links into. Both read the same catalogue (lib/plans.ts) and the same
 * server-provided price, so they cannot drift apart.
 *
 * Public by design — someone deciding whether to sign up must be able to read
 * the full plan comparison without an account.
 */

/**
 * Rows are explicit rather than derived so the matrix reads like a spec.
 *
 * Every row is verified against what the product actually does today:
 * backend/src/services/entitlementService.ts for the four plan-level gates
 * (weekly session count, session length, the PDF, live market research), and the
 * paywall boundary in pages/PostPitchReport.tsx for the fifth.
 *
 * THE FIFTH DELTA IS EASY TO MISS. On the report, everything down to the score
 * radar, sentiment, strengths and risks is readable on every plan. The
 * prescriptive half — "Reading the Room" and "Actionable Next Steps" — is blurred
 * for anyone without live research, i.e. for Free AND for a paying Founder. So
 * that row is Pro-only, and the score row above it is genuinely open to all.
 * An earlier version of this table claimed prioritised fixes were included
 * everywhere, which was simply not what the screen showed.
 *
 * That is a deliberate correction, not the only one. The matrix previously sold
 * "2 Personas" on Free against "3" on Founder and held the multi-VC panel back for
 * Pro, while nothing in the code gated either one; and the "Basic" vs "Detailed"
 * score split was fiction. Rows for unbuilt features are gone from this table
 * entirely and live in the roadmap section below, where they are not printed in
 * the same column as a price.
 */
type Cellv = string | boolean;
const MATRIX: { label: string; free: Cellv; founder: Cellv; pro: Cellv; enterprise: Cellv }[] = [
  { label: "Practice sessions", free: "2 / week", founder: "Unlimited", pro: "Unlimited", enterprise: "Unlimited" },
  { label: "Session length", free: "10 min", founder: "10–20 min", pro: "10–40 min", enterprise: "10–40 min" },
  { label: "AI investor personas", free: "All 10", founder: "All 10", pro: "All 10", enterprise: "All 10" },
  { label: "Multi-VC panel simulation", free: true, founder: true, pro: true, enterprise: true },
  { label: "1-on-1 coach mode", free: true, founder: true, pro: true, enterprise: true },
  { label: "Deck-aware questioning", free: true, founder: true, pro: true, enterprise: true },
  { label: "Readiness score, radar, strengths & risks", free: true, founder: true, pro: true, enterprise: true },
  { label: "Downloadable PDF report", free: "Trial only", founder: true, pro: true, enterprise: true },
  { label: "Prioritised next steps & reading the room", free: false, founder: false, pro: true, enterprise: true },
  { label: "Live market research in panel", free: false, founder: false, pro: true, enterprise: true },
  { label: "Organisation account & cohort seats", free: false, founder: false, pro: false, enterprise: true },
  { label: "Cohort dashboard & founder drill-down", free: false, founder: false, pro: false, enterprise: true },
  { label: "Weekly & monthly cohort reports", free: false, founder: false, pro: false, enterprise: true },
  { label: "Enrolment link & QR for your founders", free: false, founder: false, pro: false, enterprise: true },
];

function Cell({ value }: { value: string | boolean }) {
  if (value === true) return <Check size={16} className="mx-auto text-emerald-500" aria-label="Included" />;
  if (value === false) return <Minus size={16} className="mx-auto text-slate-300 dark:text-zinc-700" aria-label="Not included" />;
  return <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">{value}</span>;
}

export default function PricingPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const publicPrice = usePublicPrice();
  const plans = useMemo(() => getPlans(publicPrice), [publicPrice]);
  // Per-tier monthly prices, straight from the server catalog. When the catalog
  // has not answered, these are null and the page shows a neutral "—" rather
  // than a hardcoded amount that could disagree with what checkout charges.
  const founderAmt =
    publicPrice.catalog.find((c) => c.plan === "prep" && c.term === "monthly")?.amount ?? null;
  const proAmt =
    publicPrice.catalog.find((c) => c.plan === "pro" && c.term === "monthly")?.amount ??
    publicPrice.amount ??
    null;
  /** "$9.99" or "—". Never a number the server did not send. */
  const money = (n: number | null) => (n === null ? "—" : `$${n}`);
  /** "Founder ($9.99)", or just "Founder" while the price is unknown. */
  const tier = (name: string, n: number | null) => (n === null ? name : `${name} ($${n})`);

  useEffect(() => {
    if (localStorage.getItem("user")) setIsLoggedIn(true);
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-[#09090B] font-sans text-slate-900 dark:text-zinc-100">
      <header className="border-b border-slate-100 dark:border-zinc-800/60">
        <nav className="max-w-295 mx-auto px-5 sm:px-7 h-16 flex justify-between items-center">
          <LogoLink showText size="md" />
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {isLoggedIn ? (
              <Link to="/dashboard" className="btn-primary text-sm px-5 py-2.5">Dashboard</Link>
            ) : (
              <>
                <Link to="/login" className="btn-ghost hidden sm:inline-flex">Log in</Link>
                <Link to="/signup" className="btn-primary text-sm px-5 py-2.5">Start free</Link>
              </>
            )}
          </div>
        </nav>
      </header>

      <main className="max-w-295 mx-auto px-5 sm:px-7 py-10 sm:py-14">
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 mb-6">
          <ArrowLeft size={14} /> Back to home
        </Link>

        <div className="text-center mb-10">
          <p className="text-xs sm:text-sm font-bold uppercase tracking-wider text-amber-600 dark:text-amber-500 mb-2">BUSINESS MODEL</p>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-zinc-100 mb-3 tracking-tight">
            A freemium ladder that scales from solo founder to full cohort.
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-zinc-400 max-w-2xl mx-auto">
            Everything is unlocked for free during our 30-day testing access. Choose the plan that fits your fundraising stage.
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-14 items-stretch">
          {plans.map((plan) => {
            const isPro = plan.id === "pro";
            return (
              <div
                key={plan.id}
                className={cn(
                  "rounded-2xl p-6 flex flex-col transition-all",
                  isPro
                    ? "bg-[#131B38] text-white border-2 border-amber-500/70 shadow-2xl shadow-amber-500/10 sm:-translate-y-2"
                    : "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm",
                )}
              >
                {isPro && (
                  <div className="w-full text-center -mt-2 mb-2">
                    <span className="inline-block bg-[#E89234] text-slate-950 font-black tracking-widest text-[9px] uppercase py-1 px-3.5 rounded-full shadow-sm">
                      MOST POPULAR
                    </span>
                  </div>
                )}
                
                <h2 className={cn("text-base font-extrabold mb-1", isPro ? "text-white" : "text-slate-900 dark:text-zinc-100")}>
                  {plan.name}
                </h2>

                <div className="mb-4 flex items-baseline gap-1">
                  {plan.id === "free" ? (
                    <>
                      <span className="text-3xl font-extrabold text-amber-600 dark:text-amber-500">$0</span>
                      <span className={cn("text-xs font-medium", isPro ? "text-slate-300" : "text-slate-500 dark:text-zinc-400")}>/mo</span>
                    </>
                  ) : plan.id === "founder" ? (
                    <>
                      <span className="text-3xl font-extrabold text-amber-600 dark:text-amber-500">{money(founderAmt)}</span>
                      {founderAmt !== null && <span className={cn("text-xs font-medium", isPro ? "text-slate-300" : "text-slate-500 dark:text-zinc-400")}>/mo</span>}
                    </>
                  ) : plan.id === "pro" ? (
                    <>
                      <span className="text-3xl font-extrabold text-[#F59E0B]">{money(proAmt)}</span>
                      {proAmt !== null && <span className="text-xs font-medium text-slate-300">/mo</span>}
                    </>
                  ) : (
                    <>
                      <span className="text-2xl font-extrabold text-amber-600 dark:text-amber-500">Custom</span>
                      <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">per seat</span>
                    </>
                  )}
                </div>

                <ul className={cn("space-y-2.5 text-xs sm:text-sm mb-6 flex-1", isPro ? "text-slate-200" : "text-slate-600 dark:text-zinc-400")}>
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check size={15} className={cn("shrink-0 mt-0.5", isPro ? "text-[#F59E0B]" : "text-amber-500")} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <div className="mb-4">
                  {!plan.available ? (
                    <span className={cn(
                      "block w-full py-2.5 rounded-xl border text-center text-xs font-bold cursor-default",
                      isPro ? "border-slate-700 text-slate-400" : "border-slate-200 dark:border-zinc-700 text-slate-400 dark:text-zinc-500"
                    )}>
                      {plan.cta.label}
                    </span>
                  ) : (
                    <Link
                      to={plan.cta.href}
                      className={cn(
                        "flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl text-xs font-bold transition-all",
                        isPro
                          ? "bg-amber-500 text-slate-950 hover:bg-amber-400 font-black shadow-md shadow-amber-500/20"
                          : "border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800",
                      )}
                    >
                      {plan.cta.label} <ArrowRight size={14} />
                    </Link>
                  )}
                </div>

                <p className={cn(
                  "text-[11px] italic text-center pt-3 border-t",
                  isPro
                    ? "text-amber-400/90 border-white/10"
                    : "text-amber-700/80 dark:text-amber-400/80 border-slate-100 dark:border-zinc-800"
                )}>
                  {plan.tagline}
                </p>
              </div>
            );
          })}
        </div>

        {/* Full comparison */}
        <h2 className="text-base font-extrabold text-slate-900 dark:text-zinc-100 mb-3">Compare in detail</h2>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-zinc-800">
          <table className="w-full min-w-140 text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-zinc-900/60 border-b border-slate-200 dark:border-zinc-800">
                <th scope="col" className="text-left font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-zinc-400 px-4 py-3">Feature</th>
                <th scope="col" className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-zinc-400 px-4 py-3 w-28">Free ($0)</th>
                <th scope="col" className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-zinc-400 px-4 py-3 w-28">{tier("Founder", founderAmt)}</th>
                <th scope="col" className="font-bold text-xs uppercase tracking-wider text-amber-600 dark:text-amber-400 px-4 py-3 w-32">{tier("Pro Founder", proAmt)}</th>
                <th scope="col" className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-zinc-400 px-4 py-3 w-32">Hubs & Accelerators</th>
              </tr>
            </thead>
            <tbody>
              {MATRIX.map((row, i) => (
                <tr
                  key={row.label}
                  className={cn(
                    "border-b border-slate-100 dark:border-zinc-800/60 last:border-0",
                    i % 2 === 1 && "bg-slate-50/40 dark:bg-zinc-900/30",
                  )}
                >
                  <th scope="row" className="text-left font-medium text-slate-700 dark:text-zinc-300 px-4 py-3">{row.label}</th>
                  <td className="text-center px-4 py-3"><Cell value={row.free} /></td>
                  <td className="text-center px-4 py-3"><Cell value={row.founder} /></td>
                  <td className="text-center px-4 py-3 bg-amber-50/40 dark:bg-amber-500/5"><Cell value={row.pro} /></td>
                  <td className="text-center px-4 py-3"><Cell value={row.enterprise} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-slate-400 dark:text-zinc-500 mt-4">
          New accounts get 30 days of full Pro access, so every row above reads as included while you trial.
          When it ends you keep the Free plan and every report you already generated stays readable — you
          just stop being able to start new sessions beyond two a week. Hubs & Accelerators is priced custom
          per seat or cohort.
        </p>

        {/* Roadmap — deliberately OUTSIDE the comparison table, so nothing here
            sits in a column next to a price. */}
        <section className="mt-8 rounded-2xl border border-dashed border-slate-300 dark:border-zinc-700 p-6 sm:p-7">
          <div className="flex items-center gap-2 mb-2">
            <Hammer size={15} className="text-slate-400 dark:text-zinc-500" />
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              In development — not included in any plan
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mb-5 max-w-2xl">
            None of this is built yet, none of it is purchasable, and nothing on this page charges you for it.
            It is here because a roadmap is more useful than a mystery.
          </p>
          <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
            {IN_DEVELOPMENT.map((f) => (
              <li key={f.label} className="flex items-start gap-2.5">
                <Sparkles size={14} className="shrink-0 mt-0.5 text-slate-300 dark:text-zinc-600" />
                <div>
                  <p className="text-xs font-bold text-slate-700 dark:text-zinc-300">{f.label}</p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">{f.blurb}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-12 rounded-2xl gradient-brand p-8 text-center text-white relative overflow-hidden">
          <div className="relative z-10 max-w-xl mx-auto">
            <h2 className="font-display text-xl sm:text-2xl font-semibold mb-2">Still deciding?</h2>
            <p className="text-sm text-white/75 mb-5">
              Run two full pitch sessions this week on the free plan. No card required.
            </p>
            <Link
              to={isLoggedIn ? "/setup" : "/signup"}
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-indigo-600 font-semibold rounded-xl hover:bg-white/95 transition-all shadow-lg text-sm"
            >
              {isLoggedIn ? "Start a pitch" : "Start free"} <ArrowRight size={16} />
            </Link>
          </div>
          <div className="absolute -top-16 -right-16 w-52 h-52 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        </div>
      </main>

      <footer className="border-t border-slate-100 dark:border-zinc-800/60 mt-10">
        <div className="max-w-295 mx-auto px-5 sm:px-7 py-6 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-slate-400 dark:text-zinc-500">
          <span>© {new Date().getFullYear()} PitchNest</span>
          <div className="flex gap-4">
            <Link to="/privacy" className="hover:text-sky-600 dark:hover:text-sky-400">Privacy</Link>
            <Link to="/terms" className="hover:text-sky-600 dark:hover:text-sky-400">Terms</Link>
            <Link to="/support" className="hover:text-sky-600 dark:hover:text-sky-400">Support</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
