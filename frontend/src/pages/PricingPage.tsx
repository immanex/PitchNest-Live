import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, Gift, Hammer, Loader2, Minus, Sparkles, Users, X } from "lucide-react";
import { cn } from "../lib/utils";
import { ThemeToggle } from "../components/ThemeToggle";
import { LogoLink } from "../components/Logo";
import { getPlans, IN_DEVELOPMENT, type Plan } from "../lib/plans";
import { usePublicPrice } from "../hooks/usePublicPrice";
import { useAuth } from "../contexts/AuthContext";
import { useBilling, type BillingTerm, type PaidPlan } from "../contexts/BillingContext";
import { formatMoney, freeMonthsLabel, hasPaidPlan } from "../lib/billing";
import { CONTACT_EMAIL } from "../lib/legal";

/**
 * Plans and the first-subscription offer.
 *
 * Public by design — someone deciding whether to sign up must be able to read
 * the full plan comparison without an account. Signed in, each card starts
 * checkout for its plan directly.
 *
 * Every price and the free-month offer come from the server (the public price
 * endpoint, or the signed-in user's plan endpoint, which also says whether
 * THIS user still qualifies). Nothing here can promise what checkout won't
 * record.
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

const DESCRIPTIONS: Record<"free" | "founder" | "pro", string> = {
  free: "Rehearse with the full AI investor panel and see where your pitch stands.",
  founder: "Practise as often as you need, with longer sessions and a report to keep.",
  pro: "Everything for an active raise: the longest sessions, live market research and prioritised next steps.",
};

const CARD_PLAN: Record<"founder" | "pro", PaidPlan> = { founder: "prep", pro: "pro" };
const RANK: Record<string, number> = { free: 0, prep: 1, pro: 2 };

function Cell({ value }: { value: string | boolean }) {
  if (value === true) return <Check size={16} className="mx-auto text-emerald-500" aria-label="Included" />;
  if (value === false) return <Minus size={16} className="mx-auto text-slate-300 dark:text-zinc-700" aria-label="Not included" />;
  return <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">{value}</span>;
}

export default function PricingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const signedIn = Boolean(user && user.accountType !== "organization");
  const publicPrice = usePublicPrice();
  const { info, loaded, upgrade } = useBilling();
  const [term, setTerm] = useState<BillingTerm>("monthly");
  const [starting, setStarting] = useState<PaidPlan | null>(null);

  const useAccount = signedIn && loaded;
  const catalog = useAccount && info.catalog.length > 0 ? info.catalog : publicPrice.catalog;
  const billingEnabled = useAccount ? info.billingEnabled : publicPrice.billingEnabled;
  // Visitors see the offer as it stands for new subscribers; a signed-in user
  // sees it only while they still qualify.
  const freeMonths = useAccount
    ? info.offer.eligible ? info.offer.freeMonths : 0
    : publicPrice.freeMonths;
  const paid = useAccount && hasPaidPlan(info);
  const currentPlan = paid ? info.plan : "free";
  const currentSub = useAccount && info.subscription?.autoRenew ? info.subscription : null;

  const plans = useMemo(() => getPlans({ amount: null, currency: null, days: null }), []);
  const sku = (plan: PaidPlan, t: BillingTerm) => catalog.find((c) => c.plan === plan && c.term === t) ?? null;

  const proMonthly = sku("pro", "monthly");
  const proAnnual = sku("pro", "annual");
  const annualSaving =
    proMonthly && proAnnual && proAnnual.amount < proMonthly.amount * 12
      ? Math.round((1 - proAnnual.amount / (proMonthly.amount * 12)) * 100)
      : 0;

  const close = () => {
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
    else navigate(signedIn ? "/home" : "/");
  };

  const startCheckout = async (plan: PaidPlan) => {
    setStarting(plan);
    // On success the browser leaves for Flutterwave, so only failure clears this.
    const ok = await upgrade({ plan, term });
    if (!ok) setStarting(null);
  };

  const ctaFor = (plan: Plan) => {
    const buttonBase =
      "flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold transition-colors";
    const quiet = cn(buttonBase, "border border-slate-200 text-slate-400 dark:border-zinc-700 dark:text-zinc-500 cursor-default");

    if (plan.id === "free") {
      if (!signedIn) {
        return <Link to="/signup" className={cn(buttonBase, "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-zinc-700 dark:bg-transparent dark:text-zinc-100 dark:hover:bg-zinc-800")}>Start free</Link>;
      }
      return <span className={quiet}>{currentPlan === "free" ? "Your current plan" : "Included"}</span>;
    }
    if (plan.id === "enterprise") return null;

    const target = CARD_PLAN[plan.id];
    const featured = plan.id === "pro";
    const action = cn(
      buttonBase,
      featured
        ? "bg-linear-to-r from-indigo-600 to-sky-600 text-white shadow-md shadow-sky-600/25 hover:brightness-110"
        : "border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 dark:border-indigo-500/40 dark:bg-transparent dark:text-indigo-200 dark:hover:bg-indigo-500/10",
    );
    const label = freeMonths > 0 ? `Claim ${freeMonthsLabel(freeMonths)}` : plan.id === "pro" ? "Upgrade to Pro Founder" : "Get Founder";

    if (!signedIn) return <Link to="/signup" className={action}>{label}</Link>;
    if (currentSub && currentSub.plan === target && currentSub.term === term) {
      return <span className={quiet}>Your current plan</span>;
    }
    if (paid && RANK[currentPlan] > RANK[target]) return <span className={quiet}>Included in your plan</span>;
    if (!billingEnabled) {
      return <a href={`mailto:${CONTACT_EMAIL}?subject=Upgrade%20my%20PitchNest%20plan`} className={action}>Contact us to upgrade</a>;
    }
    const switching = Boolean(currentSub && currentSub.plan === target);
    return (
      <button type="button" onClick={() => void startCheckout(target)} disabled={starting !== null} className={cn(action, "cursor-pointer disabled:opacity-60")}>
        {starting === target && <Loader2 size={15} className="animate-spin" />}
        {switching ? `Switch to ${term === "annual" ? "yearly" : "monthly"}` : label}
      </button>
    );
  };

  const priceFor = (plan: Plan) => {
    if (plan.id === "free") return { amount: "$0", unit: "/ month" };
    if (plan.id === "enterprise") return { amount: "Custom", unit: "per seat" };
    const item = sku(CARD_PLAN[plan.id], term);
    if (!item) return { amount: "—", unit: "" };
    return { amount: formatMoney(item.amount, item.currency), unit: term === "annual" ? "/ year" : "/ month" };
  };

  const cards = plans.filter((p) => p.id !== "enterprise");

  return (
    <div className="gradient-mesh min-h-screen font-sans text-slate-900 dark:text-zinc-100">
      <header className="border-b border-slate-100 dark:border-zinc-800/60">
        <nav className="mx-auto flex h-16 max-w-295 items-center justify-between px-5 sm:px-7">
          <LogoLink showText size="md" />
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {signedIn ? (
              <button
                type="button"
                onClick={close}
                aria-label="Close plans"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                <X size={20} />
              </button>
            ) : (
              <>
                <Link to="/login" className="btn-ghost hidden sm:inline-flex">Log in</Link>
                <Link to="/signup" className="btn-primary px-5 py-2.5 text-sm">Start free</Link>
              </>
            )}
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-295 px-5 py-10 sm:px-7 sm:py-14">
        <div className="mb-8 text-center">
          <p className="eyebrow mb-3">Plans & pricing</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            {freeMonths > 0 ? `Get your first ${freeMonths === 1 ? "month" : `${freeMonths} months`} free` : "Choose your plan"}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-slate-500 dark:text-zinc-400 sm:text-base">
            {freeMonths > 0
              ? `Subscribe to any plan and we add ${freeMonthsLabel(freeMonths).replace(" free", "")} on top. Plans renew automatically and you can cancel any time.`
              : "Plans renew automatically and you can cancel any time."}
          </p>
        </div>

        {/* Billing period */}
        <div className="mb-10 flex justify-center">
          <div role="radiogroup" aria-label="Billing period" className="inline-flex rounded-full border border-slate-200 bg-white/70 p-1 dark:border-zinc-800 dark:bg-zinc-900/70">
            {(["monthly", "annual"] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={term === option}
                onClick={() => setTerm(option)}
                className={cn(
                  "cursor-pointer rounded-full px-5 py-2 text-sm font-medium transition-colors",
                  term === option
                    ? "bg-indigo-50 font-semibold text-indigo-700 shadow-sm dark:bg-indigo-500/20 dark:text-indigo-100"
                    : "text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200",
                )}
              >
                {option === "monthly" ? "Monthly" : "Yearly"}
                {option === "annual" && annualSaving > 0 && (
                  <span className="ml-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">Save {annualSaving}%</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Plan cards */}
        <div className="mx-auto mb-10 grid max-w-5xl items-stretch gap-5 md:grid-cols-3">
          {cards.map((plan) => {
            const featured = plan.id === "pro";
            const price = priceFor(plan);
            const paidCard = plan.id === "founder" || plan.id === "pro";
            const recurring = paidCard ? sku(CARD_PLAN[plan.id as "founder" | "pro"], term) : null;
            return (
              <div
                key={plan.id}
                className={cn(
                  "flex flex-col rounded-3xl border p-6 sm:p-7",
                  // On a phone the offer card leads; side by side it sits last.
                  featured && "order-first md:order-none",
                  featured
                    ? "border-indigo-300 bg-linear-to-b from-indigo-50 to-white shadow-xl shadow-indigo-500/10 dark:border-indigo-500/40 dark:from-indigo-950/60 dark:to-zinc-900/80 dark:shadow-none"
                    : "border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/60",
                )}
              >
                <div className="flex h-6 items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">{plan.name}</p>
                  {featured && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-ink">
                      {freeMonths > 0 ? <><Gift size={11} /> {freeMonthsLabel(freeMonths)}</> : "Most popular"}
                    </span>
                  )}
                </div>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight">{plan.headline}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-zinc-400 md:min-h-[4.5rem]">
                  {DESCRIPTIONS[plan.id as "free" | "founder" | "pro"]}
                </p>

                <div className="mt-5 flex items-baseline gap-1.5">
                  <span className="text-4xl font-semibold tracking-tight">{price.amount}</span>
                  <span className="text-sm text-slate-500 dark:text-zinc-400">{price.unit}</span>
                </div>
                <p className="mt-1 h-5 text-xs font-semibold text-accent-text dark:text-accent">
                  {paidCard && freeMonths > 0 ? `+ ${freeMonthsLabel(freeMonths)} on your first subscription` : ""}
                </p>

                <div className="mt-5">{ctaFor(plan)}</div>

                <ul className="mt-6 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-zinc-300">
                      <Check size={16} className={cn("mt-0.5 shrink-0", featured ? "text-indigo-600 dark:text-indigo-300" : "text-sky-600/70 dark:text-sky-400/70")} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <p className="mt-6 text-[11px] leading-relaxed text-slate-400 dark:text-zinc-500">
                  {plan.id === "free"
                    ? "No card needed. New accounts start with 30 days of full Pro access."
                    : recurring
                      ? `${freeMonths > 0 ? "The free month applies to your first subscription only. " : ""}Renews at ${formatMoney(recurring.amount, recurring.currency)} ${term === "annual" ? "a year" : "a month"} until you cancel.`
                      : "Renews automatically until you cancel."}
                </p>
              </div>
            );
          })}
        </div>

        <p className="mb-16 flex flex-wrap items-center justify-center gap-1.5 text-center text-sm text-slate-500 dark:text-zinc-400">
          <Users size={16} className="text-slate-400" />
          Running an accelerator, hub or cohort?
          <Link to="/support" className="font-semibold text-slate-900 underline underline-offset-4 hover:text-indigo-700 dark:text-zinc-100 dark:hover:text-indigo-300">
            See Hubs & Accelerators
          </Link>
        </p>

        {/* Full comparison */}
        <h2 className="mb-3 text-base font-semibold">Compare plans in detail</h2>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/60">
          <table className="w-full min-w-140 text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900/60">
                <th scope="col" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Feature</th>
                <th scope="col" className="w-28 px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Free</th>
                <th scope="col" className="w-28 px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Founder</th>
                <th scope="col" className="w-32 px-4 py-3 text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">Pro Founder</th>
                <th scope="col" className="w-32 px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Hubs & Accelerators</th>
              </tr>
            </thead>
            <tbody>
              {MATRIX.map((row, i) => (
                <tr
                  key={row.label}
                  className={cn(
                    "border-b border-slate-100 last:border-0 dark:border-zinc-800/60",
                    i % 2 === 1 && "bg-slate-50/40 dark:bg-zinc-900/30",
                  )}
                >
                  <th scope="row" className="px-4 py-3 text-left font-medium text-slate-700 dark:text-zinc-300">{row.label}</th>
                  <td className="px-4 py-3 text-center"><Cell value={row.free} /></td>
                  <td className="px-4 py-3 text-center"><Cell value={row.founder} /></td>
                  <td className="bg-indigo-50/40 px-4 py-3 text-center dark:bg-indigo-500/5"><Cell value={row.pro} /></td>
                  <td className="px-4 py-3 text-center"><Cell value={row.enterprise} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-slate-400 dark:text-zinc-500">
          New accounts get 30 days of full Pro access, so every row above reads as included while you trial.
          When it ends you keep the Free plan and every report you already generated stays readable — you
          just stop being able to start new sessions beyond two a week. Hubs & Accelerators is priced custom
          per seat or cohort.
        </p>

        {/* Roadmap — deliberately OUTSIDE the comparison table, so nothing here
            sits in a column next to a price. */}
        <section className="mt-8 rounded-2xl border border-dashed border-slate-300 p-6 dark:border-zinc-700 sm:p-7">
          <div className="mb-2 flex items-center gap-2">
            <Hammer size={15} className="text-slate-400 dark:text-zinc-500" />
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              In development — not included in any plan
            </h2>
          </div>
          <p className="mb-5 max-w-2xl text-xs text-slate-500 dark:text-zinc-400">
            None of this is built yet, none of it is purchasable, and nothing on this page charges you for it.
          </p>
          <ul className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {IN_DEVELOPMENT.map((f) => (
              <li key={f.label} className="flex items-start gap-2.5">
                <Sparkles size={14} className="mt-0.5 shrink-0 text-slate-300 dark:text-zinc-600" />
                <div>
                  <p className="text-xs font-bold text-slate-700 dark:text-zinc-300">{f.label}</p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">{f.blurb}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="mt-10 border-t border-slate-100 dark:border-zinc-800/60">
        <div className="mx-auto flex max-w-295 flex-col items-center justify-between gap-3 px-5 py-6 text-xs text-slate-400 dark:text-zinc-500 sm:flex-row sm:px-7">
          <span>© {new Date().getFullYear()} PitchNest · Payments by Flutterwave</span>
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
