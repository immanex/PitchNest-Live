import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Gift, Loader2 } from 'lucide-react';
import { useBilling } from '../../contexts/BillingContext';
import { formatDate, formatMoney, freeMonthsLabel, hasPaidPlan, planName } from '../../lib/billing';
import { CONTACT_EMAIL } from '../../lib/legal';
import { getPlans } from '../../lib/plans';
import { PRICING_PATH } from '../../lib/routes';
import { accentButton, dangerButton, primaryButton, SectionHeader, secondaryButton, SettingsGroup } from './shared';

const PLAN_CARD_ID: Record<string, 'free' | 'founder' | 'pro'> = { free: 'free', prep: 'founder', pro: 'pro' };

export default function BillingSection() {
  const { info, loaded, cancelSubscription } = useBilling();
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const paid = hasPaidPlan(info);
  const sub = info.subscription;
  const renewing = paid && sub?.autoRenew === true;
  const showOffer = !paid && info.offer.eligible && info.offer.freeMonths > 0;
  const displayPlan = paid ? info.plan : info.isTrial ? 'pro' : 'free';
  const features = useMemo(
    () => getPlans({ amount: null, currency: null, days: null }).find((p) => p.id === PLAN_CARD_ID[displayPlan])?.features ?? [],
    [displayPlan],
  );

  const confirmCancel = async () => {
    setCancelling(true);
    const result = await cancelSubscription();
    setCancelling(false);
    setConfirming(false);
    setNotice(
      result.ok
        ? { tone: 'ok', text: `Auto-renew is off. You keep ${planName(info.plan)} until ${formatDate(info.expiresAt)}.` }
        : { tone: 'error', text: result.message || "Couldn't cancel right now. Please try again." },
    );
  };

  if (!loaded) {
    return (
      <>
        <SectionHeader title="Billing" description="Your plan and payments." />
        <div className="flex min-h-[30vh] items-center justify-center" role="status" aria-label="Loading">
          <Loader2 size={20} className="animate-spin text-slate-400" />
        </div>
      </>
    );
  }

  let status: string;
  if (paid && sub && sub.autoRenew) {
    const price = `${formatMoney(sub.amount, sub.currency)} a ${sub.term === 'annual' ? 'year' : 'month'}`;
    status = `Renews automatically at ${price}.${sub.nextChargeAt ? ` Next payment around ${formatDate(sub.nextChargeAt)}.` : ''}`;
  } else if (paid && sub && !sub.autoRenew) {
    status = `Auto-renew is off. You keep this plan until ${formatDate(info.expiresAt)}, then move to Free.`;
  } else if (paid) {
    status = info.expiresAt ? `Active until ${formatDate(info.expiresAt)}. This plan doesn't renew.` : "Your plan doesn't expire.";
  } else if (info.isTrial) {
    status = `Full Pro access during your free trial. ${info.trialDaysRemaining} day${info.trialDaysRemaining === 1 ? '' : 's'} left.`;
  } else {
    status = '2 live sessions a week, 10 minutes each.';
  }

  const badge = renewing ? 'Active' : paid && sub ? 'Ends soon' : paid ? 'Active' : info.isTrial ? 'Trial' : null;

  return (
    <>
      <SectionHeader title="Billing" description="Your plan and payments." />

      {showOffer && (
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-accent/70 bg-accent-soft p-5 dark:border-accent/25 dark:bg-accent/5 sm:flex-row sm:items-center">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink">
            <Gift size={20} />
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
              Your first subscription comes with {freeMonthsLabel(info.offer.freeMonths)}
            </p>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-zinc-400">
              Pay for any plan and we add the extra time on top. It renews at the normal price after that, and you can cancel any time.
            </p>
          </div>
          <Link to={PRICING_PATH} className={accentButton}>See plans</Link>
        </div>
      )}

      <SettingsGroup title="Current plan">
        <div className="p-5">
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">
              {paid ? planName(info.plan) : info.isTrial ? 'Pro trial' : 'Free'}
            </h2>
            {badge && (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                {badge}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">{status}</p>
          {paid && info.expiresAt && renewing && (
            <p className="mt-1 text-xs text-slate-400 dark:text-zinc-500">Paid through {formatDate(info.expiresAt)}.</p>
          )}

          {features.length > 0 && (
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-slate-600 dark:text-zinc-400">
                  <Check size={15} className="mt-0.5 shrink-0 text-emerald-500" /> {feature}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            {!info.billingEnabled ? (
              <a href={`mailto:${CONTACT_EMAIL}?subject=Upgrade%20my%20PitchNest%20plan`} className={primaryButton}>
                Contact us to upgrade
              </a>
            ) : paid ? (
              <Link to={PRICING_PATH} className={secondaryButton}>Change plan</Link>
            ) : (
              <Link to={PRICING_PATH} className={primaryButton}>{showOffer ? 'Claim offer' : 'Upgrade'}</Link>
            )}
            {renewing && info.billingEnabled && (
              <button type="button" onClick={() => setConfirming(true)} className={dangerButton}>
                Cancel subscription
              </button>
            )}
          </div>
          {notice && (
            <p className={notice.tone === 'ok' ? 'mt-3 text-sm text-emerald-600 dark:text-emerald-400' : 'mt-3 text-sm text-rose-600'}>
              {notice.text}
            </p>
          )}
        </div>
      </SettingsGroup>

      <p className="px-1 text-xs leading-relaxed text-slate-400 dark:text-zinc-500">
        Payments are handled by Flutterwave. Plans renew automatically until you cancel; cancelling stops future
        payments and you keep what you've paid for.
      </p>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="cancel-title">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <h2 id="cancel-title" className="text-lg font-semibold text-slate-900 dark:text-zinc-100">Cancel your subscription?</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
              You won't be charged again. You keep {planName(info.plan)} until {formatDate(info.expiresAt)}, then your account
              moves to Free. Your reports stay readable.
            </p>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setConfirming(false)} className={`${secondaryButton} flex-1`}>
                Keep plan
              </button>
              <button
                type="button"
                onClick={confirmCancel}
                disabled={cancelling}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
              >
                {cancelling ? <Loader2 size={16} className="animate-spin" /> : 'Cancel subscription'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
