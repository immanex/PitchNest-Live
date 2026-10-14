import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Play,
  BarChart3,
  Target,
  Sparkles,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Loader2,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "../lib/utils";
import { Skeleton } from "../components/Skeleton";
import { useAuth } from "../contexts/AuthContext";
import { LogoMark } from "../components/Logo";
import { FirstTimeTour } from "../components/FirstTimeTour";
import { TrialEndedNotice } from "../components/TrialEndedNotice";
import { getSessionMode, MODE_LABELS } from "../lib/sessionMode";

const DASHBOARD_TOUR_STEPS = [
  {
    title: "Welcome to PitchNest 👋",
    body: "This is your home base. Quick 30-second tour of where everything lives — you can skip any time.",
  },
  {
    title: "Start a pitch here",
    body: "Click this to set up a session and pitch live to the AI panel — Panel, Coach, or Solo practice modes.",
    target: '[data-tour="dashboard-start"]',
  },
  {
    title: "Track your progress",
    body: "Your scores roll up here — average, best, and total pitches — so you can see yourself improving over time.",
    target: '[data-tour="dashboard-stats"]',
  },
  {
    title: "Revisit past pitches",
    body: "Every session lands here with its score. Open one to read the full report or replay the conversation.",
    target: '[data-tour="dashboard-recent"]',
  },
];

// --- Components ---
const RecentPitchItem = ({
  id,
  name,
  date,
  modeLabel,
  score,
  status,
  attemptsUsed,
  maxAttempts,
  attemptsExhausted,
  isSelected,
  onSelectToggle,
}: {
  id: number;
  name: string;
  date: string;
  modeLabel: string;
  score: number;
  status: string;
  /** Server-attached attempt state — same numbers the session-start gate uses. */
  attemptsUsed: number;
  maxAttempts: number;
  attemptsExhausted: boolean;
  isSelected: boolean;
  onSelectToggle: (id: number) => void;
  key?: React.Key;
}) => {
  const isIncomplete = score === 0;

  return (
    <div className="flex items-center gap-3 p-4 card-hover group">
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => onSelectToggle(id)}
        className="w-4 h-4 rounded border-slate-300 dark:border-zinc-700 text-sky-500 focus:ring-sky-500/25 cursor-pointer accent-sky-500 shrink-0"
      />

      {/* Play icon */}
      <Link
        to={`/report?session=${id}`}
        className="w-10 h-10 shrink-0 bg-slate-50 dark:bg-zinc-800 rounded-xl flex items-center justify-center text-slate-400 dark:text-zinc-500 group-hover:bg-sky-50 dark:group-hover:bg-sky-900/20 group-hover:text-sky-500 transition-colors"
      >
        <Play size={18} fill="currentColor" />
      </Link>

      {/* Name + date — grows to fill space */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-900 dark:text-zinc-100 truncate">
          {name}
        </p>
        {/* Req 13: attempt status visible at a glance on the dashboard too. */}
        <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">
          {date} · {modeLabel} · {attemptsUsed} of {maxAttempts} attempts used
        </p>
      </div>

      {/* Score bar — hidden on smallest screens */}
      <div className="hidden sm:flex flex-col items-end shrink-0">
        {isIncomplete ? (
          <div className="flex items-center gap-1.5 text-slate-400">
            <AlertCircle size={14} />
            <span className="text-[10px] font-bold uppercase tracking-widest">
              N/A
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-14 h-1.5 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-1000",
                  score >= 80
                    ? "bg-emerald-500"
                    : score >= 60
                      ? "bg-sky-500"
                      : "bg-amber-500",
                )}
                style={{ width: `${score}%` }}
              />
            </div>
            <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">
              {score}
            </span>
          </div>
        )}
      </div>

      {/*
        Req 16: unavailability is obvious before clicking in. An exhausted pitch
        swaps its status badge for the "Replay Report" affordance — the pitch is
        read/replay/report-only now, so that is its real status.
      */}
      {attemptsExhausted ? (
        <Link
          to={`/replay?session=${id}`}
          className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-[10px] font-bold whitespace-nowrap hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
        >
          <Play size={10} fill="currentColor" /> Replay Report
        </Link>
      ) : (
        <span
          className={cn(
            "shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap",
            status === "Investor Ready"
              ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
              : status === "Good Progress"
                ? "bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400"
                : status === "Incomplete"
                  ? "bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400"
                  : "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400",
          )}
        >
          {status}
        </span>
      )}

      {/* Arrow link */}
      <Link
        to={`/report?session=${id}`}
        className="shrink-0 p-1.5 text-slate-300 dark:text-zinc-600 hover:text-sky-500 dark:hover:text-sky-400 transition-colors"
      >
        <ChevronRight size={16} />
      </Link>
    </div>
  );
};

const InsightCard = ({
  title,
  content,
  icon: Icon,
  color,
  darkColor,
}: {
  title: string;
  content: string;
  icon: any;
  color: string;
  darkColor: string;
  key?: React.Key;
}) => (
  <div
    className={cn(
      "p-6 rounded-2xl border-l-4 transition-colors",
      color,
      darkColor,
    )}
  >
    <div className="flex items-center gap-2 mb-3">
      <Icon size={18} className="dark:text-zinc-400" />
      <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
        {title}
      </h4>
    </div>
    <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
      "{content}"
    </p>
  </div>
);

// Helper to compute session status from score
function getStatus(score: number): string {
  if (score === 0) return "Incomplete";
  if (score >= 80) return "Investor Ready";
  if (score >= 60) return "Good Progress";
  return "Needs Work";
}

// Helper to compute overall score from evaluation_report
function getOverallScore(report: any): number {
  if (!report || !report.scores) return 0;
  const s = report.scores;
  const total =
    (Number(s.delivery) || 0) +
    (Number(s.clarity) || 0) +
    (Number(s.scalability) || 0) +
    (Number(s.readiness) || 0);
  return Math.round(total / 4);
}

// Helper to format date
function formatDate(timestamp: string): string {
  try {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "Unknown";
  }
}

// --- Main Dashboard Component ---
export default function Dashboard() {
  const { user, authFetch } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSelectToggle = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (
      !window.confirm(
        `Are you sure you want to delete the ${selectedIds.length} selected pitch sessions?`,
      )
    )
      return;

    setIsDeleting(true);
    try {
      await Promise.all(
        selectedIds.map((id) =>
          authFetch(`/api/sessions/${id}`, { method: "DELETE" }),
        ),
      );
      setSessions((prev) => prev.filter((s) => !selectedIds.includes(s.id)));
      setSelectedIds([]);
    } catch (err) {
      console.error("Failed to delete sessions:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const res = await authFetch("/api/sessions");
        if (res.ok) {
          const data = await res.json();
          setSessions(data);
        }
      } catch (err) {
        console.error("Failed to fetch sessions:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSessions();
  }, []);

  // Compute stats from real data
  const recentSessions = sessions.slice(0, 4);
  const sessionScores = sessions
    .map((s) => getOverallScore(s.evaluation_report))
    .filter((s) => s > 0);
  const avgScore =
    sessionScores.length > 0
      ? Math.round(
          sessionScores.reduce((a, b) => a + b, 0) / sessionScores.length,
        )
      : 0;
  const bestScore = sessionScores.length > 0 ? Math.max(...sessionScores) : 0;
  const totalPitches = sessions.length;

  // Derive insights from the latest session's evaluation report
  const latestSession = sessions[0];
  const latestReport = latestSession?.evaluation_report;
  const insights = [];
  if (latestReport?.summary) {
    insights.push({
      title: "Latest AI Feedback",
      content: latestReport.summary,
      icon: Sparkles,
      color: "border-sky-500 bg-sky-50/30",
      darkColor: "dark:border-sky-500 dark:bg-sky-500/5",
    });
  }
  if (latestReport?.strengths?.[0]) {
    insights.push({
      title: "Key Strength",
      content: latestReport.strengths[0],
      icon: Target,
      color: "border-indigo-500 bg-indigo-50/30",
      darkColor: "dark:border-indigo-500 dark:bg-indigo-500/5",
    });
  }

  const userName = user?.name || "Founder";

  return (
    <div className="space-y-8 pb-20">
      <FirstTimeTour tourKey="dashboard" steps={DASHBOARD_TOUR_STEPS} />

      {/* Welcome Hero */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="app-hero-banner"
      >
        <div className="relative z-10 max-w-2xl">
          <h2 className="text-xl sm:text-2xl font-semibold mb-1.5 tracking-tight">
            Welcome back, {userName}
          </h2>
          <p className="text-white/75 text-sm mb-4 leading-relaxed">
            {totalPitches > 0
              ? `You've completed ${totalPitches} pitch${totalPitches !== 1 ? "es" : ""}. Ready to refine your next big idea with our AI panel?`
              : "Ready to practice your first pitch with our AI investor panel?"}
          </p>
          <Link
            to="/setup"
            data-tour="dashboard-start"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-indigo-600 text-sm font-semibold rounded-xl shadow-lg hover:bg-white/95 transition-all"
          >
            <LogoMark size="xs" className="w-4 h-4" />
            Start New Pitch
          </Link>
        </div>
        <div className="absolute right-8 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none">
          <LogoMark className="w-32 h-32" />
        </div>
      </motion.div>

      {/* Says what happened when the trial lapses. Renders nothing at any other
          time — see the component for why it is a card and not a modal. */}
      <TrialEndedNotice />

      {/* Dynamic Stats Overview */}
      <div
        data-tour="dashboard-stats"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        {[
          {
            label: "Average Pitch Score",
            value: totalPitches > 0 ? avgScore.toString() : "—",
            suffix: totalPitches > 0 ? "/100" : "",
            trend: "",
            icon: BarChart3,
            color: "text-sky-500",
          },
          {
            label: "Total Pitches",
            value: totalPitches.toString(),
            suffix: "Sessions",
            trend: "",
            icon: Target,
            color: "text-indigo-500",
          },
          {
            label: "Best Score",
            value: totalPitches > 0 ? bestScore.toString() : "—",
            suffix: "",
            trend: "",
            icon: CheckCircle2,
            color: "text-emerald-500",
          },
          {
            label: "AI Improvements",
            value: totalPitches > 0 ? "Ready" : "Start",
            suffix: totalPitches > 0 ? "Pending Action" : "Your first pitch",
            trend: "",
            icon: Sparkles,
            color: "text-amber-500",
          },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="app-stat-card"
          >
            {isLoading ? (
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="w-5 h-5 rounded" />
                </div>
                <div className="flex items-baseline gap-2">
                  <Skeleton className="h-8 w-12" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-start mb-4">
                  <span className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                    {stat.label}
                  </span>
                  <stat.icon className={stat.color} size={20} />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold text-slate-900 dark:text-zinc-100">
                    {stat.value}
                  </span>
                  <span className="text-xs font-bold text-slate-400 dark:text-zinc-500">
                    {stat.suffix}
                  </span>
                  {stat.trend && (
                    <span className="text-[10px] font-bold text-emerald-500 ml-auto">
                      {stat.trend}
                    </span>
                  )}
                </div>
              </>
            )}
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Pitches List */}
        <div data-tour="dashboard-recent" className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <h3 className="text-xl font-semibold text-slate-900 dark:text-zinc-100 tracking-tight">
                Recent Pitches
              </h3>
              {selectedIds.length > 0 && (
                <button
                  onClick={handleDeleteSelected}
                  disabled={isDeleting}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  {isDeleting ? (
                    <Loader2 className="animate-spin" size={12} />
                  ) : (
                    <Trash2 size={12} />
                  )}
                  Delete Selected ({selectedIds.length})
                </button>
              )}
            </div>
            <Link
              to="/archive"
              className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center gap-1"
            >
              View All
              <ChevronRight size={16} />
            </Link>
          </div>
          <div className="space-y-3">
            {isLoading ? (
              <>
                <Skeleton className="h-20 w-full rounded-2xl" />
                <Skeleton className="h-20 w-full rounded-2xl" />
              </>
            ) : recentSessions.length === 0 ? (
              <div className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl">
                <LogoMark size="xl" className="mx-auto mb-4 opacity-40" />
                <p className="text-slate-500 dark:text-zinc-500 font-medium mb-4">
                  No pitches yet. Start your first session!
                </p>
                <Link
                  to="/setup"
                  className="btn-primary text-sm px-6 py-2.5"
                >
                  <LogoMark size="xs" className="w-4 h-4" />
                  Start Pitching
                </Link>
              </div>
            ) : (
              recentSessions.map((session: any) => {
                const score = getOverallScore(session.evaluation_report);
                // Server-attached attempt state; fallback keeps old cached rows
                // rendering. The limit itself is enforced server-side.
                const att = session.attempts || {
                  attemptsUsed: 1,
                  maxAttempts: 5,
                  attemptsExhausted: false,
                };
                return (
                  <RecentPitchItem
                    key={session.id}
                    id={session.id}
                    name={session.business_name || "Untitled Pitch"}
                    date={formatDate(session.created_at)}
                    modeLabel={MODE_LABELS[getSessionMode(session)]}
                    score={score}
                    status={getStatus(score)}
                    attemptsUsed={Number(att.attemptsUsed) || 1}
                    maxAttempts={Number(att.maxAttempts) || 5}
                    attemptsExhausted={!!att.attemptsExhausted}
                    isSelected={selectedIds.includes(session.id)}
                    onSelectToggle={handleSelectToggle}
                  />
                );
              })
            )}
          </div>
        </div>

        {/* Dynamic AI Insights */}
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Sparkles className="text-sky-500" size={20} />
            <h3 className="text-xl font-semibold text-slate-900 dark:text-zinc-100 tracking-tight">
              AI Insights
            </h3>
          </div>
          <div className="space-y-4">
            {isLoading ? (
              <>
                <Skeleton className="h-32 w-full rounded-2xl" />
                <Skeleton className="h-32 w-full rounded-2xl" />
              </>
            ) : insights.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl">
                <Sparkles
                  size={32}
                  className="mx-auto text-slate-300 dark:text-zinc-700 mb-3"
                />
                <p className="text-slate-500 dark:text-zinc-500 text-sm font-medium">
                  Complete your first pitch to see AI insights here.
                </p>
              </div>
            ) : (
              <>
                {insights.map((insight, i) => (
                  <InsightCard
                    key={i}
                    title={insight.title}
                    content={insight.content}
                    icon={insight.icon}
                    color={insight.color}
                    darkColor={insight.darkColor}
                  />
                ))}
              </>
            )}

            {/* MVP: analytics coming soon — restore Link to /analytics when re-enabled */}
            <div className="w-full py-4 bg-slate-50 dark:bg-zinc-800/30 text-slate-400 dark:text-zinc-500 font-semibold rounded-2xl flex items-center justify-between px-6 select-none cursor-default">
              <span className="flex items-center gap-2">
                <BarChart3 size={16} />
                Deep analytics — coming soon
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
