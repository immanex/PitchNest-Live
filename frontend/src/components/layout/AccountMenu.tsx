import { Link, useNavigate } from 'react-router-dom';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  ChevronRight,
  ChevronsUpDown,
  CreditCard,
  FileText,
  Gift,
  LifeBuoy,
  LogOut,
  MessageCircleQuestion,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { useBilling } from '../../contexts/BillingContext';
import { freeMonthsLabel, hasPaidPlan, planStatusLine } from '../../lib/billing';
import { PRICING_PATH, PROFILE_PATH, SETTINGS_PATH, SUBSCRIPTION_TAB_PATH } from '../../lib/routes';
import { cn } from '../../lib/utils';
import { UserAvatar } from '../ui/UserAvatar';

const itemClass =
  'flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-slate-700 outline-none transition-colors data-[highlighted]:bg-indigo-50 data-[highlighted]:text-indigo-700 dark:text-zinc-200 dark:data-[highlighted]:bg-indigo-950/40 dark:data-[highlighted]:text-indigo-200';

/**
 * The account block at the foot of the sidebar: who is signed in and on which
 * plan, a menu for profile, settings, help and sign-out, and the
 * first-subscription offer while it applies.
 */
export function AccountMenu({
  name,
  email,
  avatarUrl,
  onNavigate,
  onLogout,
}: {
  name: string;
  email?: string;
  avatarUrl?: string | null;
  onNavigate: () => void;
  onLogout: () => void;
}) {
  const navigate = useNavigate();
  const { info, loaded } = useBilling();
  const paid = hasPaidPlan(info);
  const showOffer = loaded && !paid && info.offer.eligible && info.offer.freeMonths > 0;
  const go = (path: string) => {
    onNavigate();
    navigate(path);
  };

  const planItem = paid
    ? { icon: CreditCard, label: 'Manage plan', path: SUBSCRIPTION_TAB_PATH }
    : showOffer
      ? { icon: Gift, label: `Claim ${freeMonthsLabel(info.offer.freeMonths)}`, path: PRICING_PATH }
      : { icon: Sparkles, label: 'Upgrade plan', path: PRICING_PATH };

  return (
    <div className="mt-3 shrink-0 space-y-2">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2 py-2 text-left outline-none transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-indigo-500/40 data-[state=open]:bg-indigo-50 dark:hover:bg-zinc-800/50 dark:data-[state=open]:bg-indigo-950/40"
            aria-label={`Account menu for ${name}`}
          >
            <UserAvatar name={name} avatarUrl={avatarUrl} size={34} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-slate-900 dark:text-zinc-100">{name}</span>
              <span className="block truncate text-xs text-slate-500 dark:text-zinc-400">
                {loaded ? planStatusLine(info) : ' '}
              </span>
            </span>
            <ChevronsUpDown size={15} className="shrink-0 text-slate-400 dark:text-zinc-500" />
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            side="top"
            align="start"
            sideOffset={8}
            className="z-[60] w-[var(--radix-dropdown-menu-trigger-width)] min-w-60 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl outline-none dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-center gap-2.5 px-2.5 pb-2.5 pt-2">
              <UserAvatar name={name} avatarUrl={avatarUrl} size={36} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-zinc-100">{name}</p>
                {email && <p className="truncate text-xs text-slate-500 dark:text-zinc-400">{email}</p>}
              </div>
            </div>
            <DropdownMenu.Separator className="my-1 h-px bg-slate-100 dark:bg-zinc-800" />

            <DropdownMenu.Item className={itemClass} onSelect={() => go(planItem.path)}>
              <planItem.icon size={17} className={cn(!paid && 'text-accent-strong')} />
              {planItem.label}
            </DropdownMenu.Item>
            <DropdownMenu.Item className={itemClass} onSelect={() => go(PROFILE_PATH)}>
              <UserRound size={17} /> Profile
            </DropdownMenu.Item>
            <DropdownMenu.Item className={itemClass} onSelect={() => go(SETTINGS_PATH)}>
              <Settings size={17} /> Settings
            </DropdownMenu.Item>

            <DropdownMenu.Separator className="my-1 h-px bg-slate-100 dark:bg-zinc-800" />

            <DropdownMenu.Sub>
              <DropdownMenu.SubTrigger className={cn(itemClass, 'data-[state=open]:bg-indigo-50 data-[state=open]:text-indigo-700 dark:data-[state=open]:bg-indigo-950/40 dark:data-[state=open]:text-indigo-200')}>
                <LifeBuoy size={17} /> Help
                <ChevronRight size={15} className="ml-auto text-slate-400" />
              </DropdownMenu.SubTrigger>
              <DropdownMenu.Portal>
                <DropdownMenu.SubContent
                  sideOffset={6}
                  className="z-[60] min-w-52 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl outline-none dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <DropdownMenu.Item className={itemClass} onSelect={() => go('/support')}>
                    <MessageCircleQuestion size={17} /> Help & support
                  </DropdownMenu.Item>
                  <DropdownMenu.Item className={itemClass} onSelect={() => go('/privacy')}>
                    <ShieldCheck size={17} /> Privacy policy
                  </DropdownMenu.Item>
                  <DropdownMenu.Item className={itemClass} onSelect={() => go('/terms')}>
                    <FileText size={17} /> Terms of service
                  </DropdownMenu.Item>
                </DropdownMenu.SubContent>
              </DropdownMenu.Portal>
            </DropdownMenu.Sub>

            <DropdownMenu.Item className={itemClass} onSelect={onLogout}>
              <LogOut size={17} /> Log out
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {showOffer && (
        <Link
          to={PRICING_PATH}
          onClick={onNavigate}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-accent bg-accent-soft py-2 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent dark:border-accent/40 dark:bg-accent/10 dark:text-accent dark:hover:bg-accent/20"
        >
          <Gift size={16} /> Claim offer
        </Link>
      )}
    </div>
  );
}
