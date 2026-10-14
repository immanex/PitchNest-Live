import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

/**
 * What a founder sees the first time they come back after their trial lapses.
 *
 * WHY THIS EXISTS. The trial ends silently today: on day 31 the PDF button and
 * the 30/40-minute durations simply stop working, with nothing anywhere saying
 * why. The probable reading of that, if you are the founder, is that something
 * broke. This says what happened instead.
 *
 * IT IS A CARD, NOT A MODAL. The constraint on this product is that quality
 * outranks conversion pressure, so this does not interrupt, does not count down,
 * and does not use the failure colour. It appears once, sits below the hero where
 * the real work is, and can be dismissed for good.
 *
 * IT DOES NOT ASK FOR ANYTHING THAT IS NOT TRUE. Every claim below is checked
 * against the actual entitlement matrix: free really is two sessions a week at
 * ten minutes each, the on-screen report really is unchanged, and nothing really
 * is deleted — the archive and any shared links keep working on the free tier.
 * If the matrix moves, this paragraph moves with it.
 */
const DISMISS_KEY_PREFIX = "pitchnest.trialEndedNoticeDismissedAt";

/**
 * How long after a trial lapses this is still news.
 *
 * The condition below cannot see whether the founder has ever paid — the user
 * payload carries the CURRENT effective plan and nothing about history — so a
 * lapsed Pro customer looks identical to an expired trial from here. The recency
 * window is what separates them: a former customer's trial ended at the very
 * start of their paid month, well over two weeks ago, so it falls outside this
 * window and they are not told their trial "has ended" a month late.
 */
const NOTICE_WINDOW_DAYS = 14;

export function TrialEndedNotice() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  const raw = user as any;
  const plan = raw?.plan;
  const trialExpiresAt = raw?.trialExpiresAt ? new Date(raw.trialExpiresAt) : null;
  const hasRealExpiry =
    trialExpiresAt !== null && Number.isFinite(trialExpiresAt.getTime());

  // "Ended" rather than "never started": the backend fabricates a trialExpiresAt
  // of now + 30 days for legacy rows that have none, so a real past date is the
  // only thing that means a trial genuinely ran out.
  const trialEnded =
    !dismissed &&
    raw?.isTrial !== true &&
    plan === "free" &&
    hasRealExpiry &&
    (trialExpiresAt as Date).getTime() < Date.now() &&
    (trialExpiresAt as Date).getTime() > Date.now() - NOTICE_WINDOW_DAYS * 86400000;

  // Keyed by the expiry date itself, so this is a one-time notice for THIS
  // trial. If the founder ever runs another trial and it lapses again, they are
  // told again rather than silently inheriting an old dismissal.
  const dismissKey = `${DISMISS_KEY_PREFIX}.${(trialExpiresAt as Date | null)?.toISOString() ?? ""}`;

  if (trialEnded && typeof localStorage !== "undefined" && localStorage.getItem(dismissKey)) {
    return null;
  }
  if (!trialEnded) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(dismissKey, "1");
    } catch {
      // Private mode or storage disabled — the notice just comes back next time,
      // which is an acceptable failure for a one-line explanation.
    }
    setDismissed(true);
  };

  return (
    <div className="relative bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6">
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute top-4 right-4 p-1.5 text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 rounded-lg transition-colors"
      >
        <X size={16} />
      </button>

      <div className="pr-8">
        <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 mb-1.5">
          Your free trial has ended
        </h3>
        <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed mb-3">
          Your account is on the free plan now: two live sessions a week, ten minutes each, with
          every readiness report readable on screen — the score, the radar, your strengths and your
          risks. The downloadable PDF, the 20-to-40-minute pitches, the written action plan, and live
          market research in the panel are the Pro features that have switched off.
        </p>
        <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed mb-4">
          Nothing was deleted. Every pitch you recorded is still in your archive with its transcript
          and report, and any link you shared still works.
        </p>
        <Link
          to="/pricing"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-sky-600 dark:text-sky-400 hover:underline"
        >
          See what Pro adds <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}

export default TrialEndedNotice;
