/**
 * Display helpers for plans and prices. Amounts always come from the server;
 * these only decide how to print them.
 */

export type PlanId = "free" | "prep" | "pro";

/** The customer-facing name of a plan as the server reports it. */
export function planName(plan: string | null | undefined): string {
  if (plan === "pro") return "Pro Founder";
  if (plan === "prep" || plan === "founder") return "Founder";
  if (plan === "enterprise") return "Hubs & Accelerators";
  return "Free";
}

/** "$15", "$9.99", "₦5,000". Whole amounts drop the decimals. */
export function formatMoney(amount: number, currency: string): string {
  const whole = Number.isInteger(amount);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

/** "1 month free", "2 months free". */
export function freeMonthsLabel(months: number): string {
  return `${months} month${months === 1 ? "" : "s"} free`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/**
 * True for a plan someone pays for (or was given), as opposed to the free
 * trial: during the trial the server reports plan "pro" with no expiry.
 */
export function hasPaidPlan(info: { plan: string; isTrial: boolean; expiresAt: string | null }): boolean {
  if (info.plan !== "pro" && info.plan !== "prep") return false;
  return Boolean(info.expiresAt) || !info.isTrial;
}

/**
 * The one-line plan status under a name: "Free", "Pro trial · 12 days left",
 * "Pro Founder". A paid plan wins over the trial.
 */
export function planStatusLine(info: {
  plan: string;
  isTrial: boolean;
  trialDaysRemaining: number;
  expiresAt: string | null;
}): string {
  if (!hasPaidPlan(info) && info.isTrial) {
    const days = Math.max(0, info.trialDaysRemaining);
    return `Pro trial · ${days} day${days === 1 ? "" : "s"} left`;
  }
  return planName(info.plan);
}
