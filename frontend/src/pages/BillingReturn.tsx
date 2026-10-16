import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { CheckCircle2, Loader2, AlertTriangle, ArrowRight } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useBilling } from "../contexts/BillingContext";
import { getAuthToken } from "../lib/authStorage";
import { planName } from "../lib/billing";
import { PRICING_PATH, SUBSCRIPTION_TAB_PATH } from "../lib/routes";

/**
 * Where Flutterwave sends the user after the hosted checkout.
 *
 * ⚠️ THE QUERY PARAMS HERE ARE NOT PROOF OF PAYMENT. This is an ordinary
 * browser navigation — anyone can type ?status=successful. Nothing on this page
 * grants anything. Access is granted server-side by the verified webhook; this
 * screen only polls our own API until that lands and then reports what it sees.
 *
 * The webhook usually arrives within a second or two, but it is asynchronous and
 * Flutterwave retries on failure, so a short poll with an honest "still
 * processing" ending is better than either a spinner forever or a false success.
 */

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 8; // ~16 seconds, then hand over to the "processing" state.

type Outcome = "checking" | "success" | "processing" | "failed";

export default function BillingReturn() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const { refresh } = useBilling();

  // What Flutterwave *claims*. Used only to skip pointless polling on an
  // explicit cancel — never to show success.
  const claimedStatus = (params.get("status") || "").toLowerCase();

  const [outcome, setOutcome] = useState<Outcome>(
    claimedStatus === "cancelled" ? "failed" : "checking",
  );
  const [planLabel, setPlanLabel] = useState("your new plan");
  const pollsRef = useRef(0);

  useEffect(() => {
    if (outcome !== "checking") return;
    let cancelled = false;

    const tick = async () => {
      pollsRef.current += 1;
      try {
        await refreshUser();
        await refresh();

        // Read the authoritative answer straight from the API rather than
        // waiting for context state to settle.
        const token = getAuthToken();
        const res = await fetch("/api/billing/plan", {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const body = await res.json().catch(() => null);

        if (cancelled) return;

        // A paid plan with a live subscription. Plan alone is not enough: the
        // free trial also reports "pro".
        const paidPlan = body?.plan === "pro" || body?.plan === "prep";
        if (paidPlan && body?.expiresAt && body?.subscription?.autoRenew) {
          setPlanLabel(planName(body.plan));
          setOutcome("success");
          return;
        }
      } catch {
        // Network blip — just try again on the next tick.
      }

      if (cancelled) return;
      if (pollsRef.current >= MAX_POLLS) {
        setOutcome("processing");
        return;
      }
      window.setTimeout(tick, POLL_INTERVAL_MS);
    };

    tick();
    return () => {
      cancelled = true;
    };
  }, [outcome, refreshUser, refresh]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-bg-main dark:bg-[#09090B]">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {outcome === "checking" && (
          <>
            <Loader2 className="mx-auto mb-5 animate-spin text-sky-500" size={40} />
            <h1 className="mb-2 text-xl font-bold text-slate-900 dark:text-zinc-100">
              Confirming your payment
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              This usually takes a couple of seconds.
            </p>
          </>
        )}

        {outcome === "success" && (
          <>
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-500/10">
              <CheckCircle2 className="text-emerald-500" size={30} strokeWidth={1.8} />
            </div>
            <h1 className="mb-2 text-xl font-bold text-slate-900 dark:text-zinc-100">
              You're on {planLabel}
            </h1>
            <p className="mb-6 text-sm leading-relaxed text-slate-500 dark:text-zinc-400">
              Your plan renews automatically. You can see it or cancel any time in
              Settings, under Billing.
            </p>
            <button
              type="button"
              onClick={() => navigate("/setup", { replace: true })}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 py-3 text-sm font-bold text-white transition-colors hover:bg-sky-600"
            >
              Start a pitch <ArrowRight size={16} />
            </button>
          </>
        )}

        {outcome === "processing" && (
          <>
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-500/10">
              <Loader2 className="animate-spin text-amber-500" size={28} />
            </div>
            <h1 className="mb-2 text-xl font-bold text-slate-900 dark:text-zinc-100">
              Payment is still processing
            </h1>
            <p className="mb-6 text-sm leading-relaxed text-slate-500 dark:text-zinc-400">
              Your bank hasn't confirmed yet. If money left your account, your plan
              will activate automatically — you don't need to pay again. Check Billing
              in a few minutes, and contact us if it hasn't appeared.
            </p>
            <Link
              to={SUBSCRIPTION_TAB_PATH}
              className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Go to Settings
            </Link>
          </>
        )}

        {outcome === "failed" && (
          <>
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 dark:bg-rose-500/10">
              <AlertTriangle className="text-rose-500" size={28} />
            </div>
            <h1 className="mb-2 text-xl font-bold text-slate-900 dark:text-zinc-100">
              Payment wasn't completed
            </h1>
            <p className="mb-6 text-sm leading-relaxed text-slate-500 dark:text-zinc-400">
              Nothing has been charged. You're still on the free plan — 2 pitches a
              week, 10 minutes each.
            </p>
            <Link
              to={PRICING_PATH}
              className="inline-flex w-full items-center justify-center rounded-xl bg-sky-500 py-3 text-sm font-bold text-white transition-colors hover:bg-sky-600"
            >
              Try again
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
