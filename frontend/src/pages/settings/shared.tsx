import React, { useCallback, useEffect, useState } from 'react';
import * as Switch from '@radix-ui/react-switch';
import { useAuth } from '../../contexts/AuthContext';
import { getStoredUser, updateStoredUser } from '../../lib/authStorage';
import { cn } from '../../lib/utils';

export interface StoredUser {
  name: string;
  email?: string;
  bio?: string;
  role?: string;
  avatarUrl?: string;
  authProvider?: 'form' | 'google';
  settings?: Record<string, any>;
}

function readStoredUser(): StoredUser {
  try {
    const parsed = JSON.parse(getStoredUser() || '{}');
    return { name: 'Founder', ...parsed };
  } catch {
    return { name: 'Founder' };
  }
}

/** The signed-in user as cached locally, kept fresh by the "userUpdate" event. */
export function useStoredUser(): StoredUser {
  const [user, setUser] = useState<StoredUser>(readStoredUser);
  useEffect(() => {
    const reload = () => setUser(readStoredUser());
    window.addEventListener('userUpdate', reload);
    return () => window.removeEventListener('userUpdate', reload);
  }, []);
  return user;
}

/** Writes fields onto the cached user and tells the rest of the app. */
export function patchStoredUser(patch: Partial<StoredUser>) {
  updateStoredUser({ ...readStoredUser(), ...patch });
  window.dispatchEvent(new Event('userUpdate'));
}

/** Saves part of the preferences bag (notifications, locale) to the server. */
export function usePersistSettings() {
  const { authFetch } = useAuth();
  return useCallback(
    async (partial: Record<string, unknown>) => {
      try {
        const res = await authFetch('/api/auth/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ settings: partial }),
        });
        if (!res.ok) return false;
        const data = await res.json().catch(() => ({}));
        const current = readStoredUser();
        patchStoredUser({ settings: { ...(current.settings || {}), ...(data.settings || partial) } });
        return true;
      } catch {
        return false;
      }
    },
    [authFetch],
  );
}

export function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-zinc-50">{title}</h1>
      {description && <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">{description}</p>}
    </div>
  );
}

/** A titled group of rows, divided by hairlines. */
export function SettingsGroup({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('mb-6', className)}>
      {title && (
        <h2 className="mb-2 px-1 font-sans text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">{title}</h2>
      )}
      <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/80 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
        {children}
      </div>
    </section>
  );
}

/** Label and description on the left, its control on the right. */
export function SettingRow({
  label,
  description,
  children,
  danger,
}: {
  label: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="min-w-0 sm:max-w-md">
        <p className={cn('text-sm font-semibold', danger ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-zinc-100')}>
          {label}
        </p>
        {description && <div className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-zinc-400">{description}</div>}
      </div>
      {children && <div className="shrink-0">{children}</div>}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <Switch.Root
      checked={checked}
      onCheckedChange={onChange}
      aria-label={label}
      className="relative h-6 w-11 cursor-pointer rounded-full bg-slate-200 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500/40 data-[state=checked]:bg-indigo-600 dark:bg-zinc-700 dark:data-[state=checked]:bg-indigo-500"
    >
      <Switch.Thumb className="block h-4 w-4 translate-x-1 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-6" />
    </Switch.Root>
  );
}

export const secondaryButton =
  'inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800';

/** The brand call to action: the indigo-to-sky gradient used by .btn-primary. */
export const primaryButton =
  'inline-flex items-center justify-center gap-2 rounded-full bg-linear-to-r from-indigo-600 to-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-sky-600/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none';

/** Offers only: the yellow accent. */
export const accentButton =
  'inline-flex items-center justify-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-bold text-accent-ink transition-colors hover:bg-[#FFE19C]';

export const dangerButton =
  'inline-flex items-center justify-center gap-2 rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-900/60 dark:bg-zinc-900 dark:text-rose-400 dark:hover:bg-rose-950/30';
