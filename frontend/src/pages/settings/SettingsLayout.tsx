import React, { useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation, useMatch, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  ChevronRight,
  CreditCard,
  ExternalLink,
  FileText,
  LifeBuoy,
  Mic,
  Palette,
  ShieldCheck,
  UserRound,
  KeyRound,
} from 'lucide-react';
import { useBilling } from '../../contexts/BillingContext';
import { planStatusLine } from '../../lib/billing';
import { LEGACY_SETTINGS_TABS, SETTINGS_SECTIONS, settingsPath, type SettingsSection } from '../../lib/routes';
import { cn } from '../../lib/utils';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { useStoredUser } from './shared';

type IconType = React.ComponentType<{ size?: number; className?: string }>;

const GROUPS: { label: string; items: { id: SettingsSection; label: string; icon: IconType }[] }[] = [
  {
    label: 'Personal',
    items: [
      { id: 'profile', label: 'Profile', icon: UserRound },
      { id: 'account', label: 'Account', icon: KeyRound },
      { id: 'appearance', label: 'Appearance', icon: Palette },
      { id: 'notifications', label: 'Notifications', icon: Bell },
      { id: 'voice', label: 'Voice & language', icon: Mic },
    ],
  },
  {
    label: 'Plan',
    items: [{ id: 'billing', label: 'Billing', icon: CreditCard }],
  },
];

const HELP_LINKS: { to: string; label: string; icon: IconType }[] = [
  { to: '/support', label: 'Help & support', icon: LifeBuoy },
  { to: '/privacy', label: 'Privacy policy', icon: ShieldCheck },
  { to: '/terms', label: 'Terms of service', icon: FileText },
];

export const SECTION_TITLES: Record<SettingsSection, string> = {
  profile: 'Profile',
  account: 'Account',
  appearance: 'Appearance',
  notifications: 'Notifications',
  voice: 'Voice & language',
  billing: 'Billing',
};

const DESKTOP_QUERY = '(min-width: 1024px)';

function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(() => window.matchMedia?.(DESKTOP_QUERY).matches ?? true);
  useEffect(() => {
    const media = window.matchMedia?.(DESKTOP_QUERY);
    if (!media) return;
    const update = () => setDesktop(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return desktop;
}

/**
 * Settings has its own frame, like a separate app: a section menu with a way
 * back on the left, the chosen section on the right. On a phone the menu is
 * its own screen and each section opens full width with a back arrow.
 */
export default function SettingsLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const isDesktop = useIsDesktop();
  const match = useMatch('/settings/:section');
  const section = match?.params.section as SettingsSection | undefined;
  const known = section && (SETTINGS_SECTIONS as readonly string[]).includes(section);
  const user = useStoredUser();
  const { info, loaded } = useBilling();

  // Leave settings for wherever the user came from, not for the previous
  // section (sections replace each other in history).
  const backToApp = () => {
    const from = (location.state as { from?: string } | null)?.from;
    if (from) return navigate(from);
    if ((window.history.state?.idx ?? 0) > 0) return navigate(-1);
    navigate('/home');
  };

  if (!section) {
    const legacy = LEGACY_SETTINGS_TABS[params.get('tab') ?? ''];
    if (legacy) return <Navigate to={settingsPath(legacy)} replace />;
    if (isDesktop) return <Navigate to={settingsPath('profile')} replace />;
  } else if (!known) {
    return <Navigate to="/settings" replace />;
  }

  const showMenu = !section;
  const menu = (
    <nav aria-label="Settings sections" className="space-y-5">
      {GROUPS.map((group) => (
        <div key={group.label}>
          <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
            {group.label}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <li key={item.id}>
                <NavLink
                  to={settingsPath(item.id)}
                  replace
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 lg:py-2',
                      // Same active look as the app sidebar: indigo with the yellow edge.
                      isActive && isDesktop
                        ? 'bg-indigo-50 font-semibold text-indigo-700 shadow-[inset_3px_0_0_#F5B82E] dark:bg-indigo-950/40 dark:text-indigo-200 dark:shadow-[inset_3px_0_0_#FFD268]'
                        : 'font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100',
                    )
                  }
                >
                  <item.icon size={17} />
                  <span className="flex-1">{item.label}</span>
                  <ChevronRight size={15} className="text-slate-300 dark:text-zinc-600 lg:hidden" />
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div>
        <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Help</p>
        <ul className="space-y-0.5">
          {HELP_LINKS.map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100 lg:py-2"
              >
                <item.icon size={17} />
                <span className="flex-1">{item.label}</span>
                <ExternalLink size={13} className="text-slate-300 dark:text-zinc-600" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );

  const backButton = (
    <button
      type="button"
      onClick={backToApp}
      className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100"
    >
      <ArrowLeft size={17} /> Back to app
    </button>
  );

  return (
    <div className="min-h-screen bg-bg-main font-sans text-slate-900 dark:bg-[#09090B] dark:text-zinc-100">
      {/* Desktop: the section menu replaces the app sidebar. */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-slate-200/80 bg-white px-3 py-4 dark:border-zinc-800/80 dark:bg-zinc-900 lg:flex">
        {backButton}
        <div className="custom-scrollbar mt-4 flex-1 overflow-y-auto">{menu}</div>
      </aside>

      <div className="lg:pl-64">
        {/* Phone: the menu is its own screen. */}
        {showMenu ? (
          <div className="mx-auto max-w-xl px-4 pb-16 pt-4 lg:hidden">
            {backButton}
            <h1 className="mt-3 px-1 font-display text-2xl font-semibold tracking-tight">Settings</h1>
            <Link
              to={settingsPath('profile')}
              className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{user.name}</p>
                <p className="truncate text-xs text-slate-500 dark:text-zinc-400">{loaded ? planStatusLine(info) : user.email}</p>
              </div>
              <ChevronRight size={16} className="text-slate-300 dark:text-zinc-600" />
            </Link>
            <div className="mt-6">{menu}</div>
          </div>
        ) : (
          <>
            <div className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/90 px-2 py-2 backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/90 lg:hidden">
              <Link
                to="/settings"
                replace
                className="inline-flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-medium text-slate-600 dark:text-zinc-300"
              >
                <ArrowLeft size={17} /> Settings
              </Link>
            </div>
            <main className="mx-auto w-full max-w-3xl px-4 pb-20 pt-6 sm:px-8 lg:pt-12">
              <React.Suspense
                fallback={
                  <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-label="Loading">
                    <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-sky-500 dark:border-zinc-800 dark:border-t-sky-400" />
                  </div>
                }
              >
                <Outlet />
              </React.Suspense>
            </main>
          </>
        )}
      </div>
    </div>
  );
}
