import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function OrganizationProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
            Authenticating...
          </p>
        </div>
      </div>
    );
  }

  if (!user || user.accountType !== "organization") {
    return <Navigate to="/organization-login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
