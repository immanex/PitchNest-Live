import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Sparkles, Check, X, Loader2 } from "lucide-react";
import { useBilling } from "../../contexts/BillingContext";
import { CONTACT_EMAIL } from "../../lib/legal";

/**
 * The single upgrade prompt for the whole app.
 *
 * WHY A PROVIDER. Three unrelated surfaces need to raise this — a locked
 * duration in Pre-Pitch Setup, the PDF buttons on the report, and a 402 coming
 * back from the server. Threading modal state through each of them would mean
 * three copies of the same markup drifting apart. Callers just do
 * `const { showUpgrade } = useUpgrade()`.
 *
 * WHY RADIX. Every other modal in this codebase is a hand-rolled `fixed
 * inset-0` div — none of them trap focus, close on Escape, or set aria-modal.
 * @radix-ui/react-dialog was already a dependency and unused; this gets all of
 * that for free rather than adding a ninth inaccessible overlay.
 */

type UpgradeReason = "duration" | "sessions" | "pdf" | "generic";

interface UpgradeContextValue {
  showUpgrade: (reason?: UpgradeReason) => void;
}

const UpgradeContext = createContext<UpgradeContextValue>({
  showUpgrade: () => { },
});

export function useUpgrade() {
  return useContext(UpgradeContext);
}

/**
 * Headline and lead copy per trigger, so the prompt answers what was clicked.
 *
 * Every claim in here has to survive comparison with what the billing backend
 * will actually grant once the payment clears. This modal sells Pro, so the
 * honest delta against Free is exactly five things: unlimited sessions instead
 * of two a week, sessions up to 40 minutes instead of 10, the downloadable PDF,
 * the prescriptive half of the report (next steps + reading the room), and live
 * market research. Personas and the multi-VC panel were previously listed as
 * upgrade benefits — they are available on Free, so listing them misrepresented
 * what the money buys.
 */
const COPY: Record<UpgradeReason, { title: string; lead: string }> = {
  duration: {
    title: "Longer sessions are a Pro feature",
    lead: "The free plan runs 10-minute pitches. Upgrade for longer pitch durations and give the panel room to dig in.",
  },
  sessions: {
    title: "You've used your free sessions",
    lead: "The free plan includes 2 pitches per week. Upgrade for unlimited practice.",
  },
  pdf: {
    title: "The full report is a Pro feature",
    lead: "Your score, radar and risks stay on screen on every plan. Pro adds the downloadable PDF and the written action plan.",
  },
  generic: {
    title: "Upgrade to Pro",
    lead: "Unlimited sessions, longer pitch durations, the downloadable PDF report, your prioritised next steps, and live market research in the panel.",
  },
};

const BENEFITS = [
  "Unlimited sessions (Free gives you 2 a week)",
  "Sessions up to 40 minutes (Free is 10)",
  "Downloadable PDF of the full written report",
  "Your prioritised next steps and room-read feedback",
  "Live market research woven into the panel",
];

export const UpgradeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<UpgradeReason>("generic");
  const [starting, setStarting] = useState(false);
  const { info, upgrade } = useBilling();

  // No hardcoded fallback amount. If the server catalogue hasn't answered yet,
  // the button drops the price and just says "Upgrade to Pro" — naming a figure
  // the checkout might not match is worse than naming none. The checkout page
  // states the real amount before any money moves.
  const priceLabel = info.price ? `$${info.price.amount}/mo` : "";

  const showUpgrade = useCallback((r: UpgradeReason = "generic") => {
    setReason(r);
    setOpen(true);
  }, []);

  const value = useMemo(() => ({ showUpgrade }), [showUpgrade]);
  const copy = COPY[reason];

  return (
    <UpgradeContext.Provider value={value}>
      {children}

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          {/* z-50 matches the app's modal layer (scrim 40, modals 50). */}
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in" />
          <Dialog.Content
            className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl focus:outline-none dark:border-zinc-800 dark:bg-zinc-900"
            aria-describedby="upgrade-lead"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 dark:bg-sky-500/10">
              <Sparkles className="text-sky-500" size={24} strokeWidth={1.8} />
            </div>

            <Dialog.Title className="mb-2 text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
              {copy.title}
            </Dialog.Title>
            <Dialog.Description
              id="upgrade-lead"
              className="mb-5 text-sm leading-relaxed text-slate-500 dark:text-zinc-400"
            >
              {copy.lead}
            </Dialog.Description>

            <ul className="mb-6 space-y-2">
              {BENEFITS.map((b) => (
                <li key={b} className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-zinc-300">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-500/10">
                    <Check size={12} className="text-emerald-600 dark:text-emerald-400" strokeWidth={3} />
                  </span>
                  {b}
                </li>
              ))}
            </ul>

            <div className="flex gap-3">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Not now
                </button>
              </Dialog.Close>
              {info.billingEnabled ? (
                <button
                  type="button"
                  disabled={starting}
                  onClick={async () => {
                    setStarting(true);
                    // This prompt sells Pro specifically (it fires on Pro-gated
                    // walls); Prep is chosen from the Settings selector instead.
                    const ok = await upgrade({ plan: "pro", term: "monthly" });
                    if (!ok) setStarting(false);
                  }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-sky-500 py-3 text-sm font-bold text-white transition-colors hover:bg-sky-600 disabled:opacity-60"
                >
                  {starting ? <Loader2 size={16} className="animate-spin" /> : null}
                  {starting ? "Starting…" : priceLabel ? `Upgrade — ${priceLabel}` : "Upgrade to Pro"}
                </button>
              ) : (
                /* Billing keys aren't configured, so there is no checkout to
                   send anyone to. A mail link is honest; a dead button is not.
                   Address comes from lib/legal.ts, the same one the terms,
                   privacy and support pages publish — the previous
                   "surpport@pitchnest.app" was a typo'd address on a domain with
                   no inbound mailbox, so these upgrades went nowhere. */
                <a
                  href={`mailto:${CONTACT_EMAIL}?subject=Upgrade%20to%20PitchNest%20Pro`}
                  className="flex flex-1 items-center justify-center rounded-xl bg-sky-500 py-3 text-sm font-bold text-white transition-colors hover:bg-sky-600"
                >
                  Contact us to upgrade
                </a>
              )}
            </div>

            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-zinc-500 dark:hover:bg-zinc-800"
              >
                <X size={18} />
              </button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </UpgradeContext.Provider>
  );
};
