import type { LucideIcon } from "lucide-react";
import { Sparkles, Rocket, Crown, Building2 } from "lucide-react";

/**
 * Single source of truth for the public pricing tiers.
 *
 * Feature rows are static; the Pro PRICE comes from the server at runtime
 * (BillingContext / usePublicPrice -> /api/billing -> PRO_PLAN_AMOUNT/CURRENCY/
 * DAYS env), so a price change is an env var, not a code deploy that can drift
 * from what the checkout actually charges. Until billing responds, the price
 * column falls back to a neutral placeholder rather than hardcoding a number
 * that could lie.
 *
 * TIER AVAILABILITY. `available` gates whether a tier can be transacted TODAY.
 * The billing backend grants two paid levels (Founder/"prep" and Pro/"pro"),
 * each sold monthly or annual, so Founder and Pro both have a live checkout
 * (settings → subscription); Free is signup and Hubs & Accelerators is a
 * "contact us" pathway. Per-tier PRICES come from the server catalog at runtime
 * (getPlans + usePublicPrice → /api/billing/price), so a displayed number can
 * never drift from what checkout actually charges.
 *
 * THE RULE FOR THIS FILE, which is the whole point of it:
 *
 *   If a feature is listed under a tier, it EXISTS in the codebase today and a
 *   customer on that tier can use it. Otherwise it belongs in IN_DEVELOPMENT.
 *
 * That rule is new and it is deliberate. This catalogue previously sold
 * "Grilling Session / Rapid Q&A", "AI Script generation", "Multilingual AI VCs",
 * "AI Virtual Co-Founder" and "10 AI-generated pitch decks" — five paid
 * differentiators with no implementation anywhere in the repo. A "(Coming Soon)"
 * sitting inside a plan column reads to a buyer as something they are paying
 * for, so the roadmap now lives in its own clearly-labelled list instead of
 * inside the thing they are being asked to buy.
 *
 * The personas row is also corrected rather than enforced. The matrix claimed
 * "2 Personas" on Free and "3" on Founder, but nothing anywhere enforced that —
 * every tier has always received all ten, plus the multi-VC panel that was sold
 * as Pro-only. Given the choice between restricting what users already have and
 * telling the truth about it, this file tells the truth: all ten, every tier.
 * The remaining paid deltas are the real ones — session count, session length,
 * the PDF, and live market research.
 */

export interface Plan {
  id: "free" | "founder" | "pro" | "enterprise";
  name: string;
  tagline: string;
  price: string;
  features: string[];
  featured: boolean;
  available: boolean;
  cta: { label: string; href: string };
  icon: LucideIcon;
}

/**
 * Planned, NOT BUILT — shown as a roadmap, never as an entitlement.
 *
 * Kept in one place so a feature can only ever be in one of two states: shipped
 * (a plan feature above) or upcoming (here). Nothing here is included in any
 * plan and nothing here is purchasable, and the pricing page says so out loud
 * rather than leaving a reader to infer it.
 */
export const IN_DEVELOPMENT: { label: string; blurb: string }[] = [
  {
    label: "Multilingual AI VCs",
    blurb: "Pitch in French, Portuguese or Kiswahili and be scored in that language.",
  },
  {
    label: "AI script generation",
    blurb: "Turn your deck and notes into a rehearsal script, with a structure to speak to.",
  },
  {
    label: "AI virtual co-founder",
    blurb: "A sparring partner for the questions that land after the pitch, not during it.",
  },
  {
    label: "AI pitch deck builder",
    blurb: "Draft a deck from your business details. Uploading and pitching an existing deck already works today.",
  },
  {
    label: "Direct VC intro pathway",
    blurb: "Warm introductions to funds matched to your stage and sector.",
  },
  {
    label: "Video replay",
    blurb: "Rewatch the session with the transcript and reactions in sync.",
  },
  {
    label: "Post-report follow-up",
    blurb: "Ask the panel why it said what it said, and get an answer.",
  },
];

const base: Omit<Plan, "price">[] = [
  {
    id: "free",
    name: "Free",
    tagline: "Try the panel — no card required.",
    features: [
      "All 10 AI investor personas",
      "Solo, 1-on-1 coach and 3-VC panel modes",
      "2 live sessions / week (10 min each)",
      "Readiness score, radar, strengths and risks on screen",
      "Deck-aware questioning",
    ],
    featured: false,
    available: true,
    cta: { label: "Start free", href: "/signup" },
    icon: Sparkles,
  },
  {
    id: "founder",
    name: "Founder",
    tagline: "Where founders get serious.",
    features: [
      "Everything in Free",
      "Unlimited live sessions",
      "Sessions up to 20 minutes",
      "Downloadable PDF report",
    ],
    featured: false,
    available: true,
    cta: { label: "Choose Founder", href: "/settings?tab=subscription" },
    icon: Rocket,
  },
  {
    id: "pro",
    name: "Pro Founder",
    tagline: "Deep prep for active fundraising.",
    features: [
      "Everything in Founder",
      "Sessions up to 40 minutes",
      "Prioritised next steps and room-read feedback on the report",
      "Live market research woven into the panel",
    ],
    featured: true,
    available: true,
    cta: { label: "Upgrade to Pro Founder", href: "/settings?tab=subscription" },
    icon: Crown,
  },
  {
    id: "enterprise",
    name: "Hubs & Accelerators",
    tagline: "One relationship, many founders.",
    features: [
      "Everything in Pro",
      "Organisation account and cohort seats",
      "Cohort dashboard with founder drill-down",
      "Weekly and monthly cohort reports",
      "Enrolment link and QR code for your founders",
    ],
    featured: false,
    available: true,
    cta: { label: "Contact us", href: "/support" },
    icon: Building2,
  },
];


/**
 * Renders a price line from a SERVER-supplied amount.
 *
 * Returns "" when the server has not supplied a usable one. This used to fall
 * back to a hardcoded "$15 /mo", which contradicted both this module's contract
 * and usePublicPrice's own doc comment ("falls back to nulls on failure — the
 * pricing UI renders a neutral placeholder rather than inventing an amount that
 * might not match checkout"). Callers now render their own neutral text for the
 * empty string, so a number can only ever come from the server that charges it.
 */
export function formatPrice(
  amount: number | null | undefined,
  currency: string | null | undefined,
  days: number | null | undefined,
): string {
  if (typeof amount === "number" && amount > 0 && currency) {
    const symbol = currency.toUpperCase() === "USD" ? "$" : `${currency} `;
    return `${symbol}${amount} /mo`;
  }
  return "";
}

/**
 * The plan catalogue, matching the PitchNest pricing deck. Per-tier prices come
 * from the SERVER catalog (usePublicPrice → /api/billing/price) so the displayed
 * number is exactly what checkout charges; fixed fallbacks are used only until
 * the price loads (or if billing is unconfigured).
 */
export function getPlans(price: {
  amount: number | null;
  currency: string | null;
  days: number | null;
  catalog?: { plan: string; term: string; amount: number; currency: string }[];
}): Plan[] {
  const cat = price?.catalog ?? [];
  const sku = (plan: string, term: string) =>
    cat.find((c) => c.plan === plan && c.term === term);

  const proMo = sku("pro", "monthly");
  const founderMo = sku("prep", "monthly");
  const currency = proMo?.currency ?? price?.currency ?? null;
  // No numeric defaults. An amount the server never sent is exactly the kind of
  // number that can silently disagree with checkout — the catalogue is the only
  // source that knows what a payment will cost.
  const proAmount = proMo?.amount ?? price?.amount ?? null; // Pro Founder
  const founderAmount = founderMo?.amount ?? null; // Founder (prep)

  return base.map((p) => {
    if (p.id === "pro") return { ...p, price: formatPrice(proAmount, currency, null) };
    if (p.id === "founder")
      return { ...p, price: formatPrice(founderAmount, founderMo?.currency ?? currency, null) };
    if (p.id === "enterprise") return { ...p, price: "Custom per seat" };
    return { ...p, price: "$0 /mo" };
  });
}
