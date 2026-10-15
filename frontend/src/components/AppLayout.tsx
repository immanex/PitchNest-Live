import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  PlusCircle,
  Megaphone,
  Activity,
  Layers,
  History,
  Settings,
  Bell,
  Search,
  LogOut,
  Menu,
  X,
  Download,
  Sparkles,
  MessageSquare,
  FileSearch,
  ShieldCheck,
  Compass,
  MessagesSquare,
  CalendarDays,
  Presentation,
  Home,
  Landmark,
  Handshake,
  Rocket,
  Briefcase,
} from 'lucide-react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { cn } from '../lib/utils';
import { isPaidPlan } from '../lib/entitlements';
import { ThemeToggle } from './ThemeToggle';
import { useAuth } from '../contexts/AuthContext';
import { LogoLink, LogoMark } from './Logo';
import { InstallPrompt } from './InstallPrompt';
import { NOTIFICATIONS_TAB_PATH, PROFILE_PATH, SUBSCRIPTION_TAB_PATH } from '../lib/routes';
import { useNotifications } from '../hooks/useNotifications';
import { useEcosystemFeatures } from '../hooks/useEcosystemFeatures';
import type { AppNotification } from '../api/notifications';

/**
 * The one frame every app page sits in, signed in or not: grouped sidebar,
 * sticky top bar with search and the "Showcase business" call to action, and
 * a bottom tab bar on phones. Public ecosystem pages render here for visitors
 * too; private pages are wrapped in ProtectedRoute inside this layout.
 */

type IconType = React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;

interface NavItem {
  icon: IconType;
  label: string;
  path: string;
  /** Not built yet: shown greyed out with a tag. */
  tag?: 'Soon' | 'Later';
}

function timeAgo(value: string): string {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '';
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d` : new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function isActivePath(pathname: string, path: string) {
  if (path === '/discover') return pathname === '/discover' || pathname.startsWith('/businesses/');
  return pathname === path || pathname.startsWith(`${path}/`);
}

const PRACTICE_AREA = /^\/(dashboard|setup|archive|replay|report)(\/|$)/;

const PAGE_INFO: Array<{ test: (pathname: string) => boolean; title: string; area: string }> = [
  { test: (p) => p === '/home', title: 'Home', area: 'Founder ecosystem' },
  { test: (p) => p === '/discover', title: 'Discover', area: 'Founder ecosystem' },
  { test: (p) => p.startsWith('/businesses/'), title: 'Business profile', area: 'Founder ecosystem' },
  { test: (p) => p.startsWith('/pitches'), title: 'Pitch Arena', area: 'Founder ecosystem' },
  { test: (p) => p.startsWith('/community'), title: 'Community', area: 'Founder ecosystem' },
  { test: (p) => p.startsWith('/opportunities'), title: 'Opportunities', area: 'Founder ecosystem' },
  { test: (p) => p.startsWith('/workspace'), title: 'My workspace', area: 'Your businesses' },
  { test: (p) => p.startsWith('/dashboard'), title: 'Practice dashboard', area: 'Private AI practice' },
  { test: (p) => p.startsWith('/setup'), title: 'Pre-Pitch Room', area: 'Private AI practice' },
  { test: (p) => p.startsWith('/archive'), title: 'My Pitches', area: 'Private AI practice' },
  { test: (p) => p.startsWith('/replay'), title: 'Pitch Replay', area: 'Private AI practice' },
  { test: (p) => p.startsWith('/report'), title: 'Pitch report', area: 'Private AI practice' },
  { test: (p) => p.startsWith('/settings'), title: 'Settings', area: 'Your account' },
  { test: (p) => p.startsWith('/staff'), title: 'Staff tools', area: 'PitchNest team' },
];

function pageInfo(pathname: string) {
  return PAGE_INFO.find((entry) => entry.test(pathname)) ?? { title: 'PitchNest', area: 'Founder ecosystem' };
}

const SidebarItem = ({ item, active, onClick }: { item: NavItem; active: boolean; onClick?: () => void }) => {
  const Icon = item.icon;
  if (item.tag) {
    return (
      <div className="flex cursor-default select-none items-center gap-3 rounded-xl px-3 py-2 text-slate-300 dark:text-zinc-600">
        <Icon size={17} strokeWidth={2} />
        <span className="text-[13px] font-medium">{item.label}</span>
        <span className="ml-auto rounded-md border border-slate-200 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-400 dark:border-zinc-700 dark:text-zinc-500">
          {item.tag}
        </span>
      </div>
    );
  }
  return (
    <Link
      to={item.path}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-xl px-3 py-2 transition-all duration-200',
        active
          ? 'bg-indigo-50 font-semibold text-indigo-700 shadow-[inset_3px_0_0_#F5B82E] dark:bg-indigo-950/40 dark:text-indigo-200 dark:shadow-[inset_3px_0_0_#FFD268]'
          : 'font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-200',
      )}
    >
      <Icon size={17} strokeWidth={active ? 2.25 : 2} />
      <span className="text-[13px]">{item.label}</span>
    </Link>
  );
};

function NavGroup({ label, items, pathname, onNavigate }: { label: string; items: NavItem[]; pathname: string; onNavigate: () => void }) {
  return (
    <div>
      <p className="mb-1.5 mt-5 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-zinc-500">{label}</p>
      <div className="flex flex-col gap-0.5">
        {items.map((item) => (
          <SidebarItem key={item.label} item={item} active={!item.tag && isActivePath(pathname, item.path)} onClick={onNavigate} />
        ))}
      </div>
    </div>
  );
}

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user, isLoading } = useAuth();
  // Organization accounts browse public pages like visitors: founder tools,
  // notifications and plans belong to user accounts.
  const founder = user && user.accountType !== 'organization' ? user : null;
  const signedIn = Boolean(founder);
  // From context, not the localStorage copy below — a cached user object would
  // keep showing the upsell to someone who just upgraded.
  const isPaid = isPaidPlan(founder?.plan);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstallable(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  const [userData, setUserData] = useState<{ name: string; email?: string; bio?: string; avatarUrl?: string; role?: string }>({ name: 'Founder' });

  const loadUserData = () => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try { setUserData(JSON.parse(storedUser)); } catch (e) {}
    }
  };

  useEffect(() => {
    loadUserData();
    window.addEventListener('userUpdate', loadUserData);
    return () => {
      window.removeEventListener('userUpdate', loadUserData);
    };
  }, []);

  // Server-backed notifications (questions on your businesses, updates from
  // businesses you follow). The hook does nothing for visitors.
  const {
    items: notifications,
    unreadCount,
    refresh: refreshNotifications,
    markRead,
    markAllRead,
  } = useNotifications();
  const ecosystemFeatures = useEcosystemFeatures();

  // The old placeholder stored fake items in the browser; clear the leftovers.
  useEffect(() => {
    try { localStorage.removeItem('notifications'); } catch {}
  }, []);

  const handleNotificationClick = (item: AppNotification) => {
    if (!item.read) void markRead(item.id);
    navigate(item.link);
  };

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const exploreItems: NavItem[] = [
    { icon: Home, label: 'Home', path: '/home' },
    { icon: Compass, label: 'Discover', path: '/discover' },
    ...(ecosystemFeatures.pitchArena ? [{ icon: Presentation, label: 'Pitch Arena', path: '/pitches' }] : []),
    ...(ecosystemFeatures.community ? [{ icon: MessagesSquare, label: 'Community', path: '/community' }] : []),
    { icon: CalendarDays, label: 'Opportunities', path: '/opportunities' },
  ];
  const toolItems: NavItem[] = [
    { icon: Briefcase, label: 'My Workspace', path: '/workspace/businesses' },
    { icon: LayoutDashboard, label: 'Practice dashboard', path: '/dashboard' },
    { icon: PlusCircle, label: 'Pre-Pitch Room', path: '/setup' },
    { icon: Megaphone, label: 'My Pitches', path: '/archive' },
    { icon: History, label: 'Pitch Replays', path: '/replay' },
    // MVP: coming soon — remove the tag to re-enable
    { icon: FileSearch, label: 'Deck Check', path: '/deck-check', tag: 'Soon' },
    { icon: Layers, label: 'Pitch Decks', path: '/decks', tag: 'Soon' },
    { icon: Activity, label: 'Analytics', path: '/analytics', tag: 'Soon' },
  ];
  const ecosystemItems: NavItem[] = [
    { icon: Landmark, label: 'Organizations', path: '/organizations', tag: 'Later' },
    { icon: Handshake, label: 'Investor discovery', path: '/investors', tag: 'Later' },
  ];

  const mobileTabs: NavItem[] = [
    { icon: Home, label: 'Home', path: '/home' },
    { icon: Compass, label: 'Discover', path: '/discover' },
    ...(ecosystemFeatures.pitchArena ? [{ icon: Presentation, label: 'Pitches', path: '/pitches' }] : []),
    ...(ecosystemFeatures.community ? [{ icon: MessagesSquare, label: 'Community', path: '/community' }] : []),
    { icon: Briefcase, label: 'Workspace', path: '/workspace/businesses' },
  ];

  const { title: pageTitle, area: pageArea } = pageInfo(location.pathname);
  const searchesPitches = signedIn && PRACTICE_AREA.test(location.pathname);
  const showcasePath = signedIn ? '/workspace/businesses?new=1' : '/signup';
  const closeMenu = () => setIsMobileMenuOpen(false);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    // On practice pages the search covers your own pitches (the archive owns
    // that filtering); everywhere else it searches public businesses.
    navigate(searchesPitches ? `/archive?q=${encodeURIComponent(q)}` : `/discover?q=${encodeURIComponent(q)}`);
    setSearchQuery('');
  };

  const notificationBell = signedIn && (
    <DropdownMenu.Root onOpenChange={(open) => { if (open) void refreshNotifications(); }}>
      <DropdownMenu.Trigger asChild>
        <button
          className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 outline-none transition-colors hover:text-slate-700 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        >
          <Bell size={17} />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 h-2 w-2 animate-pulse rounded-full border-2 border-white bg-rose-500 dark:border-zinc-950" />
          )}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={10}
          className="z-50 flex w-[min(340px,calc(100vw-1.5rem))] flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl outline-none dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-zinc-800">
            <span className="text-xs font-bold text-slate-900 dark:text-zinc-100">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={() => void markAllRead()} className="cursor-pointer text-[10px] font-bold text-sky-500 hover:text-sky-600">
                Mark all as read
              </button>
            )}
          </div>

          <div className="custom-scrollbar flex max-h-70 flex-col gap-2 overflow-y-auto pr-1">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-slate-400 dark:text-zinc-600">
                <Bell size={24} className="mx-auto mb-2 opacity-40" />
                <p className="text-xs font-medium">No notifications yet</p>
              </div>
            ) : (
              notifications.map((item) => {
                const Icon =
                  item.type === 'business_update' ? Megaphone :
                  item.type === 'community_reply' ? MessagesSquare :
                  MessageSquare;
                return (
                  <DropdownMenu.Item
                    key={item.id}
                    onSelect={() => handleNotificationClick(item)}
                    className={cn(
                      'relative flex cursor-pointer gap-3 rounded-xl border border-transparent p-2.5 outline-none transition-colors hover:bg-slate-50 focus:bg-slate-50 dark:hover:bg-zinc-800/50 dark:focus:bg-zinc-800/50',
                      !item.read && 'bg-sky-50/40 hover:border-sky-100 dark:bg-sky-500/5 dark:hover:border-sky-500/20',
                    )}
                  >
                    <div className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                      item.type === 'business_update'
                        ? 'bg-emerald-50 text-emerald-500 dark:bg-emerald-950/20'
                        : item.type === 'community_reply'
                          ? 'bg-violet-50 text-violet-500 dark:bg-violet-950/20'
                          : 'bg-sky-50 text-sky-500 dark:bg-sky-950/20',
                    )}>
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0 flex-1 pr-3 font-sans">
                      <div className="flex items-start justify-between gap-1">
                        <p className={cn('truncate text-xs font-bold text-slate-900 dark:text-zinc-100', !item.read && 'text-sky-600 dark:text-sky-400')}>{item.title}</p>
                        <span className="mt-0.5 shrink-0 text-[9px] text-slate-400 dark:text-zinc-500">{timeAgo(item.createdAt)}</span>
                      </div>
                      {item.excerpt && (
                        <p className="mt-0.5 line-clamp-2 break-words text-[10px] leading-relaxed text-slate-500 dark:text-zinc-400">{item.excerpt}</p>
                      )}
                    </div>
                    {!item.read && (
                      <span className="absolute right-2 top-1/2 h-1.5 w-1.5 shrink-0 -translate-y-1/2 rounded-full bg-sky-500" />
                    )}
                  </DropdownMenu.Item>
                );
              })
            )}
          </div>

          <div className="flex justify-end border-t border-slate-100 pt-2 dark:border-zinc-800">
            <Link
              to={NOTIFICATIONS_TAB_PATH}
              className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"
            >
              <Settings size={10} /> Notification settings
            </Link>
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );

  return (
    <div className="min-h-screen overflow-x-clip bg-bg-main font-sans transition-colors duration-300 dark:bg-[#09090B]">

      {/* Mobile drawer overlay */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden',
          isMobileMenuOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={closeMenu}
      />

      {/* Sidebar (a drawer below 1024px) */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200/80 bg-white/95 px-4 pb-4 pt-5 backdrop-blur-xl transition-transform duration-300 ease-in-out dark:border-zinc-800/80 dark:bg-zinc-900/95 lg:translate-x-0',
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Main navigation"
      >
        <div className="flex shrink-0 items-center justify-between px-1">
          <LogoLink to={signedIn ? '/home' : '/'} showText size="md" />
          <div className="flex items-center gap-1 lg:hidden">
            <ThemeToggle />
            <button
              onClick={closeMenu}
              className="cursor-pointer rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              aria-label="Close navigation"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <nav className="custom-scrollbar -mx-1 mt-1 flex-1 overflow-y-auto px-1 pb-2">
          <NavGroup label="Explore" items={exploreItems} pathname={location.pathname} onNavigate={closeMenu} />
          <NavGroup label="My founder tools" items={toolItems} pathname={location.pathname} onNavigate={closeMenu} />
          <NavGroup label="Ecosystem" items={ecosystemItems} pathname={location.pathname} onNavigate={closeMenu} />
        </nav>

        {isInstallable && (
          <button
            type="button"
            onClick={handleInstallClick}
            className="btn-primary mt-3 flex w-full shrink-0 cursor-pointer items-center justify-center gap-2 py-2 text-xs"
          >
            <Download size={14} /> Install App
          </button>
        )}

        {!isLoading && !signedIn && (
          <div className="mt-3 shrink-0 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-sky-50 p-4 dark:border-indigo-900/50 dark:from-indigo-950/40 dark:to-sky-950/20">
            <p className="eyebrow text-[10px]">Your AI edge</p>
            <p className="mt-1.5 text-sm font-bold text-slate-900 dark:text-zinc-100">Practice privately. Show up ready.</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-zinc-400">
              Rehearse with AI investors, then share your business when you choose.
            </p>
            <Link to="/signup" onClick={closeMenu} className="btn-accent mt-3 w-full py-2 text-xs">
              Create free account
            </Link>
            <Link to="/login" onClick={closeMenu} className="mt-2 block text-center text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200">
              Log in
            </Link>
          </div>
        )}

        {/* Upsell — free users only. Showing an "upgrade" card to someone who
            already pays reads as a billing error. */}
        {signedIn && !isPaid && (
          <div className="group relative mt-3 shrink-0 overflow-hidden rounded-xl p-3 text-white gradient-brand">
            <div className="relative z-10">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-accent">Free plan</span>
              <p className="mt-0.5 text-[11px] font-medium text-white">2 pitches a week, 10 min each</p>
              <Link to={SUBSCRIPTION_TAB_PATH} onClick={closeMenu} className="mt-2.5 block w-full rounded-lg bg-white py-1.5 text-center text-xs font-semibold text-indigo-600 transition-colors hover:bg-white/95">
                Upgrade to Pro
              </Link>
            </div>
            <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-white/10 blur-2xl transition-transform group-hover:scale-110" />
          </div>
        )}

        {signedIn && (
          <div className="mt-3 flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-100 bg-slate-50 p-1.5 dark:border-zinc-800 dark:bg-zinc-800/50">
            <Link
              to={PROFILE_PATH}
              onClick={closeMenu}
              className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1 py-0.5 transition-colors hover:bg-white dark:hover:bg-zinc-800"
              aria-label="View your profile"
            >
              <img
                src={userData.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userData.name}`}
                alt=""
                className="h-8 w-8 shrink-0 rounded-full border-2 border-white bg-sky-100 object-cover shadow-sm dark:border-zinc-700"
                referrerPolicy="no-referrer"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-slate-900 dark:text-zinc-100">{userData.name}</p>
                <p className="truncate text-[10px] font-medium text-slate-400 dark:text-zinc-500">{userData.role || 'Founder'}</p>
              </div>
            </Link>
            <Link
              to="/settings"
              onClick={closeMenu}
              className={cn(
                'shrink-0 rounded-lg p-1.5 transition-colors',
                location.pathname === '/settings' ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-400 hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-200',
              )}
              aria-label="Settings"
            >
              <Settings size={16} />
            </Link>
            <button type="button" onClick={handleLogout} className="shrink-0 cursor-pointer p-1.5 text-slate-400 transition-colors hover:text-rose-500 dark:text-zinc-500" aria-label="Log out">
              <LogOut size={16} />
            </button>
          </div>
        )}
      </aside>

      {/* Main column */}
      <div className="flex min-h-screen min-w-0 flex-col lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-950/85">
          <div className="flex h-16 items-center gap-3 px-4 md:px-8">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="flex shrink-0 cursor-pointer items-center justify-center rounded-xl border border-slate-200 p-2 text-slate-600 transition-colors hover:bg-slate-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900 lg:hidden"
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <LogoMark size="xs" className="hidden sm:block lg:hidden" />

            <div className="flex min-w-0 items-baseline gap-2">
              <span className="truncate font-display text-base font-semibold text-slate-950 dark:text-white sm:text-lg">{pageTitle}</span>
              <span className="hidden text-slate-300 dark:text-zinc-700 md:inline">/</span>
              <span className="hidden truncate text-xs font-medium text-slate-400 md:inline">{pageArea}</span>
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-2">
              <form onSubmit={submitSearch} className="relative hidden w-56 md:block xl:w-72" role="search">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" size={15} />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={searchesPitches ? 'Search your pitches...' : 'Search businesses...'}
                  aria-label={searchesPitches ? 'Search your pitches' : 'Search businesses'}
                  className="input-field py-2 pl-9 text-sm"
                />
              </form>

              <div className="hidden md:block"><ThemeToggle /></div>
              {notificationBell}

              {signedIn && (
                <Link
                  to={SUBSCRIPTION_TAB_PATH}
                  className={cn(
                    'hidden items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors xl:inline-flex',
                    isPaid
                      ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
                      : 'text-white gradient-brand hover:opacity-95',
                  )}
                >
                  {isPaid ? <ShieldCheck size={14} /> : <Sparkles size={14} />}
                  {isPaid ? 'View Plan' : 'Upgrade'}
                </Link>
              )}

              {!isLoading && !signedIn && (
                <Link to="/login" className="btn-ghost hidden px-3 py-2 text-xs sm:inline-flex">Log in</Link>
              )}

              <Link to={showcasePath} className="btn-accent px-3 py-2 text-xs sm:px-4">
                <Rocket size={14} className="hidden sm:block" />
                <span className="hidden sm:inline">Showcase business</span>
                <span className="sm:hidden">Showcase</span>
              </Link>
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
          {/* Pages load on demand; this boundary keeps the sidebar and header
              on screen while the next page's code downloads. */}
          <React.Suspense
            fallback={
              <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-label="Loading">
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-sky-500 dark:border-zinc-800 dark:border-t-sky-400" />
              </div>
            }
          >
            <Outlet />
          </React.Suspense>
        </main>

        <footer className="border-t border-slate-200/70 px-4 pb-24 pt-5 text-[11px] text-slate-400 dark:border-zinc-800/70 dark:text-zinc-600 md:px-8 lg:pb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>© {new Date().getFullYear()} PitchNest · Practise privately, share intentionally.</span>
            <nav className="flex flex-wrap gap-4" aria-label="Footer">
              <Link to="/pricing" className="hover:text-slate-600 dark:hover:text-zinc-300">Pricing</Link>
              <Link to="/privacy" className="hover:text-slate-600 dark:hover:text-zinc-300">Privacy</Link>
              <Link to="/terms" className="hover:text-slate-600 dark:hover:text-zinc-300">Terms</Link>
              <Link to="/support" className="hover:text-slate-600 dark:hover:text-zinc-300">Support</Link>
            </nav>
          </div>
        </footer>
      </div>

      {/* Phone tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-slate-200 bg-white/95 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/95 lg:hidden"
        aria-label="Quick navigation"
      >
        {mobileTabs.map((tab) => {
          const active = isActivePath(location.pathname, tab.path);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.path}
              to={tab.path}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex min-w-[56px] flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[10px] font-semibold transition-colors',
                active ? 'text-slate-950 dark:text-white' : 'text-slate-400 dark:text-zinc-500',
              )}
            >
              {active && <span className="absolute -top-1.5 h-1 w-8 rounded-full bg-accent-strong dark:bg-accent" />}
              <Icon size={20} strokeWidth={active ? 2.3 : 2} />
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {/* Phone install reminder (iOS + Android), dismissible */}
      <InstallPrompt />
    </div>
  );
}
