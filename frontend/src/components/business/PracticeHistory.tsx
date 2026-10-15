import React, { useEffect, useState } from "react";
import { History, Loader2, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { listBusinessPracticeSessions, type PracticeSessionSummary } from "../../api/practice";

const MODE_LABELS: Record<PracticeSessionSummary["mode"], string> = {
  panel: "AI Panel",
  coach: "Coach",
  solo: "Solo",
};

function formatDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

/**
 * The signed-in founder's OWN private sessions linked to this business. Other
 * members' sessions are never returned by the API, and nothing here is public.
 */
export function PracticeHistory({ businessId }: { businessId: string }) {
  const { authFetch } = useAuth();
  const [sessions, setSessions] = useState<PracticeSessionSummary[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    listBusinessPracticeSessions(authFetch, businessId)
      .then((result) => {
        if (cancelled) return;
        setSessions(result);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
    // authFetch changes with the token; the business id is what matters here.
  }, [businessId]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <History size={17} className="text-sky-500" />
          <h3 className="text-sm font-bold text-slate-950 dark:text-white">Your practice history</h3>
        </div>
        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-500 dark:bg-zinc-800 dark:text-zinc-400">
          <Lock size={10} /> Private
        </span>
      </div>

      <div className="mt-4">
        {status === "loading" && (
          <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-slate-400" /></div>
        )}
        {status === "error" && (
          <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-zinc-800/60 dark:text-zinc-400">
            Practice history isn't available right now.
          </p>
        )}
        {status === "ready" && sessions.length === 0 && (
          <p className="text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
            No sessions linked to this business yet. Practise from here and your private reports will collect in this list.
          </p>
        )}
        {status === "ready" && sessions.length > 0 && (
          <ul className="space-y-2">
            {sessions.slice(0, 6).map((session) => (
              <li key={session.id}>
                <Link
                  to={`/report?session=${session.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2.5 transition hover:border-indigo-200 hover:bg-indigo-50/50 dark:border-zinc-800 dark:hover:border-indigo-900 dark:hover:bg-indigo-950/20"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                      {MODE_LABELS[session.mode]}
                      {session.attemptNumber && session.attemptNumber > 1 ? ` · attempt ${session.attemptNumber}` : ""}
                    </p>
                    <p className="text-[10px] text-slate-400">{formatDate(session.createdAt)}</p>
                  </div>
                  <span className="text-sm font-extrabold tabular-nums text-slate-900 dark:text-white">
                    {session.overallScore ?? "–"}
                    {session.overallScore !== null && <span className="text-[10px] font-semibold text-slate-400">/100</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-slate-400">
        Only you can see these. Other members of this business never see your sessions.
      </p>
    </section>
  );
}
