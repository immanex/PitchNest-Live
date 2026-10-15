import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import LegalLayout from '../../components/LegalLayout';
import { useAuth } from '../../contexts/AuthContext';
import { CONTACT_EMAIL, LEGAL_LAST_UPDATED } from '../../lib/legal';
import { GoogleSignInButton } from '../../components/GoogleSignInButton';

export default function DeleteAccount() {
  const { user, token, logout, authFetch } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [googleCredential, setGoogleCredential] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!confirmed) {
      setError('Please confirm that you understand this action is permanent.');
      return;
    }
    const googleAccount = user?.authProvider === 'google';
    if (googleAccount ? !googleCredential : (!password && !googleCredential)) {
      setError(googleAccount ? 'Confirm your Google account first.' : 'Confirm your password or Google account.');
      return;
    }

    setIsSubmitting(true);
    try {
      let res: Response;
      if (token) {
        res = await authFetch('/api/auth/account', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password, googleCredential }),
        });
      } else {
        if (!email) {
          setError('Email is required.');
          setIsSubmitting(false);
          return;
        }
        res = await fetch('/api/auth/delete-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, googleCredential }),
        });
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete account.');
      }

      setSuccess(true);
      logout();
      setTimeout(() => navigate('/', { replace: true }), 2500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <LegalLayout title="Delete Account" lastUpdated={LEGAL_LAST_UPDATED}>
      <p>
        You can permanently delete your PitchNest account and associated personal data. This page satisfies Apple App
        Store Guideline 5.1.1(v) and Google Play&apos;s account deletion requirements — it works in a web browser without
        reinstalling the app.
      </p>

      <h2>What gets deleted</h2>
      <ul>
        <li>Your account (name, email, password)</li>
        <li>Profile and onboarding data</li>
        <li>Pitch sessions, transcripts, and AI evaluation reports</li>
        <li>Uploaded pitch decks and session video recordings stored for your account</li>
      </ul>

      <h2>What may be retained</h2>
      <ul>
        <li>Minimal server logs for security and abuse prevention (short retention)</li>
        <li>Data we must keep for legal compliance, if applicable</li>
        <li>Waitlist email if you signed up before creating an account (contact us to remove)</li>
      </ul>
      <p>
        Deletion is typically completed within <strong>30 days</strong>. You will be signed out immediately after
        confirmation.
      </p>

      <h2>Before you delete</h2>
      <p>
        If you have an active paid subscription through Apple or Google, cancel it in your device&apos;s subscription
        settings. Deleting your PitchNest account does not automatically cancel store billing.
      </p>

      {success ? (
        <div className="mt-8 p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300">
          <p className="font-bold">Your account has been deleted.</p>
          <p className="text-sm mt-2">Redirecting you to the home page…</p>
        </div>
      ) : (
        <form onSubmit={handleDelete} className="mt-8 space-y-5 not-prose">
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex gap-3">
            <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
            <p className="text-sm text-amber-900 dark:text-amber-200">
              This action is <strong>permanent</strong> and cannot be undone.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 text-rose-700 dark:text-rose-300 text-sm font-medium">
              {error}
            </div>
          )}

          {token && user ? (
            <p className="text-sm text-slate-600 dark:text-zinc-400">
              Signed in as <strong>{user.email}</strong>
            </p>
          ) : (
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
                placeholder="you@startup.com"
                required
              />
            </div>
          )}

          {user?.authProvider !== 'google' && <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
              placeholder="Your account password"
              required={!googleCredential}
              autoComplete="current-password"
            />
          </div>}

          {(user?.authProvider === 'google' || !token) && (
            <div className="space-y-2">
              <p className="text-sm font-bold text-slate-700 dark:text-zinc-300">
                {googleCredential ? 'Google account confirmed' : 'Confirm with Google'}
              </p>
              {googleCredential ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  Identity confirmed. Submit below to permanently delete the account.
                </div>
              ) : (
                <GoogleSignInButton
                  text="signin_with"
                  onCredential={(credential) => {
                    setGoogleCredential(credential);
                    setError('');
                  }}
                  onError={setError}
                />
              )}
            </div>
          )}

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-1 rounded border-slate-300"
            />
            <span className="text-sm text-slate-600 dark:text-zinc-400">
              I understand that my account and associated data will be permanently deleted.
            </span>
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            {isSubmitting ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <>
                <Trash2 size={18} /> Delete my account
              </>
            )}
          </button>

          {!token && (
            <p className="text-xs text-slate-500 text-center">
              Or{' '}
              <Link to="/login" className="text-sky-600 font-bold hover:underline">
                sign in
              </Link>{' '}
              and use Settings → Account → Delete Account.
            </p>
          )}
        </form>
      )}

      <h2 className="mt-10">Need help?</h2>
      <p>
        Email{' '}
        <a href={`mailto:${CONTACT_EMAIL}?subject=Account%20Deletion%20Request`}>{CONTACT_EMAIL}</a>{' '}
        if you cannot access your account. See also our{' '}
        <Link to="/privacy">Privacy Policy</Link>.
      </p>
    </LegalLayout>
  );
}
