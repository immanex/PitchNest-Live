import React, { useEffect, useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { patchStoredUser, primaryButton, secondaryButton, SectionHeader, SettingsGroup, useStoredUser } from './shared';

const ROLE_OPTIONS = ['Founder', 'Investor', 'Advisor'] as const;
type Role = (typeof ROLE_OPTIONS)[number];

const fieldClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-500/15 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100';

export default function ProfileSection() {
  const { authFetch } = useAuth();
  const user = useStoredUser();
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState<Role>((ROLE_OPTIONS as readonly string[]).includes(user.role ?? '') ? (user.role as Role) : 'Founder');
  const [bio, setBio] = useState(user.bio ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  // Adopt fresh values when another tab or the server updates the cache, but
  // never overwrite what the user is typing.
  const [baseline, setBaseline] = useState({ name: user.name, role: user.role ?? 'Founder', bio: user.bio ?? '' });
  useEffect(() => {
    const next = { name: user.name, role: user.role ?? 'Founder', bio: user.bio ?? '' };
    if (name === baseline.name && role === baseline.role && bio === baseline.bio) {
      setName(next.name);
      setRole((ROLE_OPTIONS as readonly string[]).includes(next.role) ? (next.role as Role) : 'Founder');
      setBio(next.bio);
    }
    setBaseline(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.name, user.role, user.bio]);

  const dirty = name.trim() !== baseline.name || role !== baseline.role || bio.trim() !== baseline.bio;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    if (name.trim().length < 2) {
      setMessage({ tone: 'error', text: 'Name must be at least 2 characters.' });
      return;
    }
    setSaving(true);
    try {
      const res = await authFetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), bio: bio.trim(), role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to update profile.');
      patchStoredUser({
        name: data.user?.name ?? name.trim(),
        bio: data.user?.bio ?? bio.trim(),
        role: data.user?.role || role,
      });
      setMessage({ tone: 'ok', text: 'Saved.' });
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Failed to update profile.' });
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (fileInput.current) fileInput.current.value = '';
    if (!file) return;
    setAvatarError('');
    if (!file.type.startsWith('image/')) return setAvatarError('Please choose an image file.');
    if (file.size > 5 * 1024 * 1024) return setAvatarError('Image must be under 5MB.');

    setUploading(true);
    try {
      const form = new FormData();
      form.append('avatar', file);
      const res = await authFetch('/api/upload-avatar', { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.avatarUrl) throw new Error(data.error || 'Failed to upload image.');
      patchStoredUser({ avatarUrl: data.avatarUrl });
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : 'Failed to upload image.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <SectionHeader title="Profile" description="How you appear across PitchNest." />

      <div className="mb-6 flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="relative">
          <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size={72} />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            aria-label="Change profile photo"
            className="absolute -bottom-1 -right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:text-sky-600 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
          </button>
          <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-slate-900 dark:text-zinc-100">{user.name}</p>
          <p className="truncate text-sm text-slate-500 dark:text-zinc-400">{user.email}</p>
          {avatarError && <p className="mt-1 text-xs text-rose-600">{avatarError}</p>}
        </div>
      </div>

      <form onSubmit={save}>
        <SettingsGroup>
          <div className="space-y-4 p-5">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-900 dark:text-zinc-100">Full name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className={fieldClass} autoComplete="name" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-900 dark:text-zinc-100">Role</span>
              <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={`${fieldClass} cursor-pointer`}>
                {ROLE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-900 dark:text-zinc-100">Bio</span>
              <textarea
                rows={4}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={600}
                placeholder="Tell investors about yourself..."
                className={`${fieldClass} resize-none leading-relaxed`}
              />
            </label>
          </div>
        </SettingsGroup>
        <div className="flex items-center justify-end gap-3">
          {message && (
            <span className={message.tone === 'ok' ? 'text-sm text-emerald-600 dark:text-emerald-400' : 'text-sm text-rose-600'}>
              {message.text}
            </span>
          )}
          {dirty && (
            <button
              type="button"
              className={secondaryButton}
              onClick={() => {
                setName(baseline.name);
                setRole((ROLE_OPTIONS as readonly string[]).includes(baseline.role) ? (baseline.role as Role) : 'Founder');
                setBio(baseline.bio);
                setMessage(null);
              }}
            >
              Cancel
            </button>
          )}
          <button type="submit" disabled={!dirty || saving} className={primaryButton}>
            {saving && <Loader2 size={14} className="animate-spin" />} Save
          </button>
        </div>
      </form>
    </>
  );
}
