import React, { useCallback, useEffect, useState } from "react";
import { BarChart3, Loader2, Lock, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { cn } from "../../lib/utils";

interface EventRow {
  name: string;
  total: number;
  uniqueUsers: number;
  anonymous: number;
  lastSeen: string | null;
}

/** Plain-language names, grouped in the order of the founder journey. */
const EVENT_GROUPS: Array<{ title: string; events: Array<[string, string]> }> = [
  {
    title: "Discovery",
    events: [
      ["discover_viewed", "Discover page views"],
      ["business_search_performed", "Searches and filters used"],
      ["business_profile_opened", "Business profiles opened"],
      ["opportunity_link_opened", "Official opportunity links opened"],
    ],
  },
  {
    title: "Businesses",
    events: [
      ["business_draft_created", "Business drafts created"],
      ["business_published", "Businesses published"],
      ["business_unpublished", "Businesses unpublished"],
      ["business_update_posted", "Updates and milestones posted"],
    ],
  },
  {
    title: "Engagement",
    events: [
      ["business_supported", "Supports"],
      ["business_followed", "Follows"],
      ["business_comment_posted", "Comments and questions"],
      ["community_thread_started", "Community discussions started"],
      ["community_reply_posted", "Community replies"],
    ],
  },
  {
    title: "Practice bridge",
    events: [
      ["practice_setup_opened", "Pre-pitch room opened"],
      ["question_sent_to_practice", "Questions sent to practice"],
      ["practice_started_from_business", "Sessions started from a business"],
    ],
  },
];

const RANGES = [7, 30, 90];

/**
 * Staff-only aggregate counts from privacy-safe product events. No individual
 * activity is shown, and the events never contain text people typed.
 */
export default function AnalyticsPage() {
  const { authFetch } = useAuth();
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState<Map<string, EventRow>>(new Map());
  const [status, setStatus] = useState<"loading" | "ready" | "forbidden" | "error">("loading");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const response = await authFetch(`/api/staff/analytics/summary?days=${days}`);
      if (response.status === 404) {
        setStatus("forbidden");
        return;
      }
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "Failed to load analytics.");
      const events: EventRow[] = Array.isArray(body?.data?.events) ? body.data.events : [];
      setRows(new Map(events.map((event) => [event.name, event])));
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [authFetch, days]);

  useEffect(() => {
    void load();
  }, [load]);

  if (status === "forbidden") {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <ShieldAlert size={32} className="mx-auto text-slate-300" />
        <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-zinc-100">This area isn't available</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">Analytics are restricted to PitchNest staff.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Staff</p>
          <h1 className="mt-1 text-2xl font-extrabold text-slate-950 dark:text-white">Ecosystem analytics</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500 dark:text-zinc-400">
            <Lock size={13} /> Aggregate counts only. Events never contain anything people typed.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/staff/moderation" className="btn-secondary px-4 py-2 text-sm">Moderation</Link>
          <Link to="/staff/opportunities" className="btn-secondary px-4 py-2 text-sm">Opportunities</Link>
        </div>
      </div>

      <div className="mt-6 flex gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900 sm:inline-flex" role="radiogroup" aria-label="Date range">
        {RANGES.map((range) => (
          <button
            key={range}
            type="button"
            role="radio"
            aria-checked={days === range}
            onClick={() => setDays(range)}
            className={cn(
              "flex-1 rounded-lg px-4 py-1.5 text-xs font-bold transition sm:flex-none",
              days === range ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-800 dark:text-zinc-400",
            )}
          >
            Last {range} days
          </button>
        ))}
      </div>

      {status === "loading" && (
        <p className="flex items-center gap-2 py-10 text-sm text-slate-400"><Loader2 size={16} className="animate-spin" /> Loading…</p>
      )}
      {status === "error" && <p className="py-10 text-sm text-rose-600">Analytics couldn't load.</p>}

      {status === "ready" && (
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {EVENT_GROUPS.map((group) => (
            <section key={group.title} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-950 dark:text-white">
                <BarChart3 size={15} className="text-indigo-500" /> {group.title}
              </h2>
              <table className="mt-3 w-full text-left text-xs">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-slate-400">
                    <th className="py-1.5 font-semibold">Event</th>
                    <th className="py-1.5 text-right font-semibold">Total</th>
                    <th className="py-1.5 text-right font-semibold">People</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {group.events.map(([name, label]) => {
                    const row = rows.get(name);
                    return (
                      <tr key={name}>
                        <td className="py-2 pr-2 font-medium text-slate-700 dark:text-zinc-300">{label}</td>
                        <td className="py-2 text-right font-bold tabular-nums text-slate-950 dark:text-white">{row?.total ?? 0}</td>
                        <td className="py-2 text-right tabular-nums text-slate-500 dark:text-zinc-400" title="Distinct signed-in accounts">
                          {row?.uniqueUsers ?? 0}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
      <p className="mt-6 text-[11px] text-slate-400">
        "People" counts distinct signed-in accounts. Visitors who are signed out, or whose browser sends Do Not Track,
        are counted only in totals or not at all.
      </p>
    </div>
  );
}
