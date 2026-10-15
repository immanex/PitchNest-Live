import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff } from 'lucide-react';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [token] = useState(() => new URLSearchParams(window.location.search).get('token') || '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (token) window.history.replaceState(window.history.state, '', '/reset-password');
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setStatus('error'); setMessage('Passwords do not match.'); return; }
    setStatus('loading');
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (res.ok) { setStatus('success'); setTimeout(() => navigate('/login'), 2000); }
      else { setStatus('error'); setMessage(data.error || 'Something went wrong.'); }
    } catch {
      setStatus('error');
      setMessage('Connection error. Please try again.');
    }
  };

  if (!token) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-slate-500">Invalid reset link. <Link to="/forgot-password" className="text-sky-500 underline">Request a new one.</Link></p>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950 px-4">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-lg p-8 border border-slate-100 dark:border-zinc-800">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-sky-500 rounded-xl flex items-center justify-center">
            <Lock className="text-white w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Set new password</h1>
            <p className="text-sm text-slate-500">Choose a password between 10 and 72 characters.</p>
          </div>
        </div>
        {status === 'success' ? (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-sm text-green-700 dark:text-green-400">
            Password updated! Redirecting to login...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <input type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                placeholder="New password" minLength={10} maxLength={72}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:text-white pr-10" required />
              <button type="button" onClick={() => setShow(s => !s)} className="absolute right-3 top-3 text-slate-400">
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <input type={show ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)}
              placeholder="Confirm new password" minLength={10} maxLength={72}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:text-white" required />
            {status === 'error' && <p className="text-sm text-red-500">{message}</p>}
            <button type="submit" disabled={status === 'loading'}
              className="w-full py-3 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-50">
              {status === 'loading' ? 'Updating...' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
