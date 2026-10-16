import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, Loader2, LogOut, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { GoogleSignInButton } from '../../components/GoogleSignInButton';
import { dangerButton, SectionHeader, secondaryButton, SettingRow, SettingsGroup, useStoredUser } from './shared';

export default function AccountSection() {
  const navigate = useNavigate();
  const { logout, authFetch, user: authUser } = useAuth();
  const user = useStoredUser();
  const isGoogle = (authUser?.authProvider ?? user.authProvider) === 'google';

  const [showDelete, setShowDelete] = useState(false);
  const [password, setPassword] = useState('');
  const [googleCredential, setGoogleCredential] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const openDelete = () => {
    setShowDelete(true);
    setPassword('');
    setGoogleCredential('');
    setConfirmed(false);
    setDeleteError('');
  };

  const deleteAccount = async () => {
    setDeleteError('');
    if (!confirmed) return setDeleteError('Please confirm you understand this is permanent.');
    if (isGoogle ? !googleCredential : !password) {
      return setDeleteError(isGoogle ? 'Confirm your Google account.' : 'Enter your password to confirm deletion.');
    }
    setDeleting(true);
    try {
      const res = await authFetch('/api/auth/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, googleCredential }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to delete account.');
      logout();
      navigate('/', { replace: true });
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Failed to delete account.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <SectionHeader title="Account" description="Sign-in details and your account." />

      <SettingsGroup title="Sign-in">
        <SettingRow label="Email" description="Your login. It can't be changed.">
          <span className="text-sm text-slate-600 dark:text-zinc-300">{user.email || authUser?.email}</span>
        </SettingRow>
        <SettingRow
          label="Sign-in method"
          description={isGoogle ? 'You sign in with your Google account.' : 'You sign in with your email and a password.'}
        >
          <span className="text-sm text-slate-600 dark:text-zinc-300">{isGoogle ? 'Google' : 'Email and password'}</span>
        </SettingRow>
        {!isGoogle && (
          <SettingRow label="Password" description="We'll email you a link to set a new one.">
            <Link to="/forgot-password" className={secondaryButton}>Change password</Link>
          </SettingRow>
        )}
      </SettingsGroup>

      <SettingsGroup title="Session">
        <SettingRow label="Log out" description="Signs you out here and on every other device.">
          <button type="button" onClick={handleLogout} className={secondaryButton}>
            <LogOut size={15} /> Log out
          </button>
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup title="Danger zone">
        <SettingRow
          label="Delete account"
          danger
          description="Permanently removes your profile, pitch sessions, decks and recordings. A plan that renews is cancelled first; paid time left is not refunded automatically."
        >
          <button type="button" onClick={openDelete} className={dangerButton}>
            <Trash2 size={15} /> Delete account
          </button>
        </SettingRow>
      </SettingsGroup>

      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="delete-title">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-3 flex items-center gap-2.5">
              <AlertTriangle size={20} className="text-rose-500" />
              <h2 id="delete-title" className="text-lg font-semibold text-slate-900 dark:text-zinc-100">Delete your account?</h2>
            </div>
            <p className="mb-4 text-sm text-slate-500 dark:text-zinc-400">This can't be undone. All your pitch data will be permanently removed.</p>
            {deleteError && <p className="mb-3 text-sm font-medium text-rose-600">{deleteError}</p>}
            {isGoogle ? (
              <div className="mb-4">
                {googleCredential ? (
                  <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
                    Google account confirmed.
                  </p>
                ) : (
                  <GoogleSignInButton
                    text="signin_with"
                    onCredential={(credential) => {
                      setGoogleCredential(credential);
                      setDeleteError('');
                    }}
                    onError={setDeleteError}
                  />
                )}
              </div>
            ) : (
              <label className="mb-4 block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                  placeholder="Confirm your password"
                  autoComplete="current-password"
                />
              </label>
            )}
            <label className="mb-6 flex cursor-pointer items-start gap-2">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5" />
              <span className="text-xs text-slate-600 dark:text-zinc-400">I understand this permanently deletes my account and data.</span>
            </label>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowDelete(false)} className={`${secondaryButton} flex-1`}>
                Cancel
              </button>
              <button
                type="button"
                onClick={deleteAccount}
                disabled={deleting}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
              >
                {deleting ? <Loader2 size={16} className="animate-spin" /> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
