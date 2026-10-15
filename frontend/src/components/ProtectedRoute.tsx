import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Inside AppLayout: show a small spinner in the content area, not a full screen. */
  inline?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, inline = false }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading && inline) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-label="Checking your session">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-sky-500 dark:border-zinc-800 dark:border-t-sky-400" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Authenticating...</p>
        </div>
      </div>
    );
  }

  if (!isLoading && !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user?.accountType === "organization") {
    return <Navigate to="/organization" replace />;
  }

  return <>{children}</>;
};
