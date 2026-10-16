import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { FirstTimeTour } from "../components/FirstTimeTour";
import {
  Search,
  Filter,
  MoreVertical,
  Play,
  BarChart3,
  Calendar,
  Clock,
  Download,
  Trash2,
  Share2,
  Link2Off,
  Globe,
  AlertCircle,
  Loader2,
  RotateCcw,
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cn } from "../lib/utils";
import {
  getSessionMode,
  MODE_LABELS,
  MODE_BADGE_CLASSES,
  type SessionMode,
} from "../lib/sessionMode";
import { buildRepitchState } from "../lib/repitch";
import { useAuth } from "../contexts/AuthContext";
import { Skeleton } from "../components/Skeleton";
import { LogoMark } from "../components/Logo";

/**
 * Copies the public link, or falls back to showing it if the clipboard is
 * unavailable (insecure origin, denied permission, or Safari's activation
 * window having closed while the share request was in flight). A share button
 * that silently copies nothing is worse than no button at all — the founder
 * walks away believing a link exists.
 */
async function copyShareUrl(url: string): Promise<void> {
  const note =
    "Anyone with this link sees the score, the strengths and the fixes — not the transcript, and not the rest of the report. Turn it off any time from the same menu.";
  try {
    await navigator.clipboard.writeText(url);
    alert(`Public link copied.\n\n${url}\n\n${note}`);
  } catch {
    window.prompt("Copy your public link:", url);
  }
}

const PitchRow = ({
  id,
  shareId,
  shareEnabled,
  shareBusy,
  name,
  date,
  duration,
  score,
  mode,
  attemptsUsed,
  maxAttempts,
  attemptsExhausted,
  canPitchAgain,
  scoreDelta,
  onPitchAgain,
  onDelete,
  onToggleShare,
  isSelected,
  onSelectToggle,
}: {
  id: number;
  shareId?: string;
  /** Server truth: this session is currently readable at /share/<share_id>. */
  shareEnabled?: boolean;
  /** A share request for this row is in flight — the menu item is disabled. */
  shareBusy?: boolean;
  name: string;
  date: string;
  duration: string;
  score: number;
  mode: SessionMode;
  /** Attempt state comes from the server (session.attempts) — the same numbers
   *  the session-start gate enforces. The frontend never counts attempts. */
  attemptsUsed: number;
  maxAttempts: number;
  attemptsExhausted: boolean;
  canPitchAgain: boolean;
  scoreDelta: number | null;
  onPitchAgain: () => void;
  onDelete: (id: number) => void;
  onToggleShare: () => void;
  isSelected: boolean;
  onSelectToggle: (id: number) => void;
  key?: React.Key;
}) => {
  const isIncomplete = score === 0;

  return (
    <div className="group flex items-center gap-3 p-4 sm:p-6 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-2xl hover:border-sky-200 dark:hover:border-sky-500/50 hover:shadow-lg hover:shadow-sky-50 dark:hover:shadow-none transition-all">
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => onSelectToggle(id)}
        className="w-4 h-4 rounded border-slate-300 dark:border-zinc-700 text-sky-500 focus:ring-sky-500/25 cursor-pointer accent-sky-500 shrink-0"
      />

      {/* Play button */}
      <Link
        to={`/report?session=${id}`}
        className="w-10 h-10 shrink-0 bg-slate-50 dark:bg-zinc-800 rounded-xl flex items-center justify-center text-slate-400 dark:text-zinc-500 group-hover:bg-sky-50 dark:group-hover:bg-sky-900/20 group-hover:text-sky-500 transition-colors"
      >
        <Play size={20} fill="currentColor" />
      </Link>

      {/* Main content */}
      {/* Columns only side by side at xl — below that the name column gets too
          narrow for the badges and they spill over the date. */}
      <div className="flex-1 min-w-0 flex flex-col xl:flex-row xl:items-center gap-2 xl:gap-6">
        {/* Name + type */}
        <div className="min-w-0 xl:flex-1">
          <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 truncate">
            {name}
          </h3>
          {/* Each badge stays on one line; when space runs out a whole badge
              wraps to the next row instead of its text breaking inside it. */}
          <span className="flex flex-wrap items-center gap-1.5 mt-0.5">
            <span
              className={cn(
                "inline-block whitespace-nowrap px-2 py-0.5 border rounded-full text-[10px] font-bold uppercase tracking-widest",
                MODE_BADGE_CLASSES[mode],
              )}
            >
              {MODE_LABELS[mode]}
            </span>
            {/*
              Req 16: the attempt status is visible BEFORE clicking in. The
              exhausted state is unmistakable — and a pitch that has used all its
              attempts stays readable/replayable, never deletable-by-limit.
            */}
            <span
              className={cn(
                "inline-block whitespace-nowrap px-2 py-0.5 border rounded-full text-[10px] font-bold uppercase tracking-widest tabular-nums",
                attemptsExhausted
                  ? "bg-rose-500/10 text-rose-600 border-rose-500/25 dark:text-rose-400 dark:border-rose-500/30"
                  : "bg-slate-500/10 text-slate-500 border-slate-500/20 dark:text-zinc-400",
              )}
            >
              {attemptsUsed} of {maxAttempts} attempts used
            </span>
            {/*
              A founder should never have to open a menu to discover that one of
              their pitch reports is readable by anyone with the link. The badge
              is the standing answer to "which of these are public?".
            */}
            {shareEnabled && (
              <span className="inline-flex items-center gap-1 whitespace-nowrap px-2 py-0.5 border border-sky-500/20 rounded-full text-[10px] font-bold uppercase tracking-widest bg-sky-500/10 text-sky-600 dark:text-sky-400">
                <Globe size={10} /> Link shared
              </span>
            )}
          </span>
        </div>

        {/* Date + duration row on mobile, separate cols on desktop */}
        <div className="flex items-center gap-4 xl:gap-6">
          <div className="flex items-center gap-1.5">
            <Calendar
              size={13}
              className="text-slate-300 dark:text-zinc-600 shrink-0"
            />
            <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium whitespace-nowrap">
              {date}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock
              size={13}
              className="text-slate-300 dark:text-zinc-600 shrink-0"
            />
            <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
              {duration}
            </span>
          </div>
        </div>

        {/* Score bar */}
        <div className="flex items-center gap-2 xl:w-28">
          <div className="flex-1 h-1.5 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-1000",
                score >= 80
                  ? "bg-emerald-500"
                  : score >= 60
                    ? "bg-sky-500"
                    : score > 0
                      ? "bg-amber-500"
                      : "bg-slate-200 dark:bg-zinc-700",
              )}
              style={{ width: `${score}%` }}
            />
          </div>
          <span className="text-sm font-bold text-slate-900 dark:text-zinc-100 shrink-0">
            {isIncomplete ? "N/A" : score}
          </span>
          {scoreDelta !== null && !isIncomplete && (
            <span
              className={cn(
                "text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0",
                scoreDelta >= 0
                  ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
                  : "bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400",
              )}
            >
              {scoreDelta >= 0 ? `+${scoreDelta}` : scoreDelta}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0 ml-1">
        <Link
          to={`/report?session=${id}`}
          className="hidden sm:block px-4 py-2 bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-bold rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors"
        >
          View Report
        </Link>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="p-2 text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors">
              <MoreVertical size={20} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="min-w-40 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-slate-100 dark:border-zinc-800 p-2 z-50">
              <DropdownMenu.Item asChild className="outline-none">
                <Link
                  to={`/report?session=${id}`}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-lg cursor-pointer"
                >
                  <BarChart3 size={14} /> View Report
                </Link>
              </DropdownMenu.Item>
              {/* Req 4: replay is live — audio + transcript. */}
              <DropdownMenu.Item asChild className="outline-none">
                <Link
                  to={`/replay?session=${id}`}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-lg cursor-pointer"
                >
                  <Play size={14} /> View Replay
                </Link>
              </DropdownMenu.Item>
              {/*
                Share is a toggle, not a one-shot. The first click publishes the
                highlights and copies the link; the second takes it back down.
                Publishing a report and then having no way to unpublish it would
                be a trap, so the revoke path is the same menu item.
              */}
              <DropdownMenu.Item
                disabled={shareBusy || isIncomplete}
                onSelect={shareBusy || isIncomplete ? undefined : onToggleShare}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-lg outline-none select-none",
                  shareBusy || isIncomplete
                    ? "text-slate-400 dark:text-zinc-600 opacity-40 cursor-default"
                    : "text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer",
                )}
              >
                {shareBusy ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : shareEnabled ? (
                  <Link2Off size={14} />
                ) : (
                  <Share2 size={14} />
                )}
                {isIncomplete ? "Share Pitch" : shareEnabled ? "Stop sharing" : "Share Pitch"}
              </DropdownMenu.Item>
              {/* Req 14: after the 5th attempt (or past the practice window) the
                  pitch is read/replay/report-only. The server's
                  `canStartNewAttempt` is authoritative; a disabled item is
                  honest UI that keeps the limit visible. */}
              <DropdownMenu.Item
                disabled={!canPitchAgain}
                onSelect={canPitchAgain ? onPitchAgain : undefined}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-xs font-bold text-sky-600 dark:text-sky-400 rounded-lg outline-none select-none",
                  canPitchAgain
                    ? "hover:bg-sky-50 dark:hover:bg-sky-900/20 cursor-pointer"
                    : "opacity-40 cursor-default",
                )}
              >
                <RotateCcw size={14} />{" "}
                {canPitchAgain ? "Pitch Again" : "No attempts left"}
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="h-px bg-slate-100 dark:bg-zinc-800 my-1" />
              <DropdownMenu.Item
                onSelect={() => onDelete(id)}
                className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg cursor-pointer outline-none"
              >
                <Trash2 size={14} /> Delete
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </div>
  );
};
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

// Helper to format duration
function formatDuration(seconds: number): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

// Walk parent_session_id links to number the attempts in a re-pitch chain and
// surface the score change vs the immediately previous attempt. Bounded so a
// cyclic or very deep chain can never hang the page.
function computeAttemptInfo(
  sessions: any[],
): Map<number, { attemptNumber: number; scoreDelta: number | null }> {
  const byId = new Map<number, any>(sessions.map((s) => [s.id, s]));
  const overall = (s: any) => {
    const sc = s?.evaluation_report?.scores || {};
    return Math.round(
      ((Number(sc.delivery) || 0) +
        (Number(sc.clarity) || 0) +
        (Number(sc.scalability) || 0) +
        (Number(sc.readiness) || 0)) /
        4,
    );
  };
  const info = new Map<number, { attemptNumber: number; scoreDelta: number | null }>();
  for (const s of sessions) {
    let attemptNumber = 1;
    let cursor = s;
    for (let i = 0; i < 20; i++) {
      const parentId = cursor?.parent_session_id;
      if (!parentId || !byId.has(parentId)) break;
      attemptNumber++;
      cursor = byId.get(parentId);
    }
    let scoreDelta: number | null = null;
    const parent = s.parent_session_id ? byId.get(s.parent_session_id) : null;
    if (parent) {
      scoreDelta = overall(s) - overall(parent);
    } else if (s.evaluation_report?.previous_attempt?.overallScore !== undefined) {
      // Parent row was deleted — fall back to the snapshot stored in the report.
      scoreDelta =
        overall(s) - (Number(s.evaluation_report.previous_attempt.overallScore) || 0);
    }
    info.set(s.id, { attemptNumber, scoreDelta });
  }
  return info;
}

export default function MyPitchesArchive() {
  const { authFetch } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Seeded from ?q= so the global header search hands off to the one place that
  // actually filters real session data, instead of a second search surface.
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") ?? "");
  const [modeFilter, setModeFilter] = useState<"all" | SessionMode>("all");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  // Which row has a share request in flight, so the menu item can spin and
  // can't be double-clicked into two POSTs.
  const [shareBusyId, setShareBusyId] = useState<number | null>(null);

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

  const handleDelete = async (idToRemove: number) => {
    if (!window.confirm("Are you sure you want to delete this pitch session?"))
      return;

    try {
      const res = await authFetch(`/api/sessions/${idToRemove}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== idToRemove));
        setSelectedIds((prev) => prev.filter((x) => x !== idToRemove));
      }
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
  };

  const handleSelectToggle = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  /**
   * Publish or withdraw the public link for one session.
   *
   * The server owns both halves: POST /api/sessions/:id/share flips
   * share_enabled on and returns the share id (reusing the one already on the
   * row so a founder who re-shares gets back the same URL they already sent
   * someone), DELETE flips it back off. Nothing here decides what a recipient
   * sees — that projection is built server-side.
   *
   * Note the local state update: it reflects the server's answer rather than
   * assuming the request worked, so a failed revoke leaves the badge on and the
   * founder still knows the link is live.
   */
  const handleToggleShare = async (session: any) => {
    const id = session.id;
    setShareBusyId(id);
    try {
      if (session.share_enabled) {
        // Revoking breaks a link someone may already have been sent, and it does
        // it instantly. Ask first.
        const confirmed = window.confirm(
          "Turn off the public link?\n\nAnyone you have sent it to will stop being able to open it. The same link starts working again if you share this pitch later.",
        );
        if (!confirmed) return;

        const res = await authFetch(`/api/sessions/${id}/share`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error(`revoke failed (${res.status})`);
        setSessions((prev) =>
          prev.map((s) => (s.id === id ? { ...s, share_enabled: false } : s)),
        );
        return;
      }

      const res = await authFetch(`/api/sessions/${id}/share`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`share failed (${res.status})`);
      const data = await res.json().catch(() => ({}));
      const shareId = data?.shareId || session.share_id;
      if (!shareId) throw new Error("no share id returned");

      setSessions((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, share_id: shareId, share_enabled: true } : s,
        ),
      );
      // Composed client-side so the link matches the origin the founder is
      // actually on — the server deliberately returns a bare id, not a URL.
      await copyShareUrl(`${window.location.origin}/share/${shareId}`);
    } catch (err) {
      console.error("Share toggle failed:", err);
      alert("Couldn't update the share link. Please try again.");
    } finally {
      setShareBusyId(null);
    }
  };

  const filteredSessions = sessions.filter((session) => {
    const name = session.business_name || "Untitled Pitch";
    if (!name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return modeFilter === "all" || getSessionMode(session) === modeFilter;
  });

  const handleSelectAllToggle = () => {
    if (filteredSessions.length === 0) return;
    if (selectedIds.length === filteredSessions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredSessions.map((s) => s.id));
    }
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

  const sessionScores = sessions
    .map((s) => getOverallScore(s.evaluation_report))
    .filter((s) => s > 0);
  const avgScore =
    sessionScores.length > 0
      ? Math.round(
          sessionScores.reduce((a, b) => a + b, 0) / sessionScores.length,
        )
      : 0;

  return (
    <div className="space-y-10">
      <FirstTimeTour
        tourKey="my-pitches"
        steps={[
          { title: "Your pitch history", body: "Every session you run is saved here with its score, so you can see how you're improving over time.", target: '[data-tour="pitches-list"]' },
          { title: "Open any report", body: "Tap a pitch to reopen its full report, or jump into the replay to revisit how the conversation went." },
          { title: "Keep it tidy", body: "Select pitches to delete ones you no longer need — your best runs stay one tap away." },
        ]}
      />
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-6">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-zinc-100 mb-2">
            My Pitches
          </h1>
          <p className="text-slate-500 dark:text-zinc-500">
            Your complete history of AI-powered pitch sessions and analysis.
          </p>
        </div>
        <div className="flex gap-4 items-center">
          {selectedIds.length > 0 && (
            <button
              onClick={handleDeleteSelected}
              disabled={isDeleting}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
            >
              {isDeleting ? (
                <Loader2 className="animate-spin" size={14} />
              ) : (
                <Trash2 size={14} />
              )}
              Delete Selected ({selectedIds.length})
            </button>
          )}
          <div className="relative flex-1 sm:flex-initial">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500"
              size={18}
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search pitches..."
              className="pl-10 pr-4 py-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:text-zinc-100 min-w-full sm:min-w-75"
            />
          </div>
        </div>
      </div>

      {/* Mode filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {(
          [
            ["all", "All"],
            ["panel", MODE_LABELS.panel],
            ["coach", MODE_LABELS.coach],
            ["solo", MODE_LABELS.solo],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setModeFilter(value)}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all border",
              modeFilter === value
                ? "bg-sky-500 text-white border-sky-500 shadow-md shadow-sky-500/25"
                : "bg-white dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-800 hover:border-sky-300 dark:hover:border-sky-500/50",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div data-tour="pitches-list" className="lg:col-span-3 space-y-4">
          <div className="hidden sm:flex items-center justify-between px-6 text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
            <div className="flex items-center gap-6 flex-1">
              <input
                type="checkbox"
                checked={
                  filteredSessions.length > 0 &&
                  selectedIds.length === filteredSessions.length
                }
                onChange={handleSelectAllToggle}
                className="w-4 h-4 rounded border-slate-300 dark:border-zinc-700 text-sky-500 focus:ring-sky-500/25 cursor-pointer accent-sky-500 shrink-0"
              />
              <div className="w-12" />
              <div className="grid grid-cols-4 flex-1 gap-8">
                <span>Pitch Name</span>
                <span>Date</span>
                <span>Duration</span>
                <span>Score</span>
              </div>
            </div>
            <div className="w-30" />
          </div>

          <div className="space-y-4">
            {isLoading ? (
              <>
                <Skeleton className="h-20 w-full rounded-2xl" />
                <Skeleton className="h-20 w-full rounded-2xl" />
                <Skeleton className="h-20 w-full rounded-2xl" />
              </>
            ) : filteredSessions.length === 0 ? (
              <div className="p-16 text-center border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl">
                <LogoMark size="xl" className="mx-auto mb-4 opacity-40 animate-pulse" />
                <p className="text-slate-500 dark:text-zinc-500 font-medium mb-4">
                  No pitches found. Start a new boardroom session!
                </p>
                <Link
                  to="/setup"
                  className="px-6 py-2.5 bg-sky-500 text-white font-bold rounded-xl hover:bg-sky-600 transition-all inline-flex items-center gap-2 text-sm shadow-lg shadow-sky-500/25"
                >
                  <Play size={16} fill="currentColor" />
                  Start Pitching
                </Link>
              </div>
            ) : (
              (() => {
                const attemptInfo = computeAttemptInfo(sessions);
                return filteredSessions.map((session) => {
                  const score = getOverallScore(session.evaluation_report);
                  const name = session.business_name || "Untitled Pitch";
                  const date = formatDate(session.created_at);
                  const duration = formatDuration(
                    session.evaluation_report?.duration,
                  );
                  const chain = attemptInfo.get(session.id);
                  // Server-authoritative attempt state (req 17). The fallback
                  // keeps an old cached row from crashing the render; the
                  // session-start gate never consults any of this.
                  const att = session.attempts || {
                    attemptsUsed: chain?.attemptNumber ?? 1,
                    attemptsRemaining: 4,
                    maxAttempts: 5,
                    canStartNewAttempt: true,
                    attemptsExhausted: false,
                  };
                  return (
                    <PitchRow
                      key={session.id}
                      id={session.id}
                      shareId={session.share_id}
                      shareEnabled={!!session.share_enabled}
                      shareBusy={shareBusyId === session.id}
                      name={name}
                      date={date}
                      duration={duration}
                      score={score}
                      mode={getSessionMode(session)}
                      attemptsUsed={Number(att.attemptsUsed) || 1}
                      maxAttempts={Number(att.maxAttempts) || 5}
                      attemptsExhausted={!!att.attemptsExhausted}
                      canPitchAgain={!!att.canStartNewAttempt}
                      scoreDelta={chain?.scoreDelta ?? null}
                      onPitchAgain={() =>
                        navigate("/setup", {
                          state: { repitch: buildRepitchState(session) },
                        })
                      }
                      onDelete={handleDelete}
                      onToggleShare={() => handleToggleShare(session)}
                      isSelected={selectedIds.includes(session.id)}
                      onSelectToggle={handleSelectToggle}
                    />
                  );
                });
              })()
            )}
          </div>
        </div>

        <div className="space-y-8">
          <div className="card p-8 space-y-8 dark:bg-zinc-900 dark:border-zinc-800">
            <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-100">
              Archive Stats
            </h3>
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sky-500 bg-sky-50 dark:bg-sky-900/20">
                  <Clock size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
                    Total Pitches
                  </p>
                  <p className="text-lg font-bold text-slate-900 dark:text-zinc-100">
                    {isLoading
                      ? "—"
                      : `${sessions.length} Session${sessions.length !== 1 ? "s" : ""}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20">
                  <BarChart3 size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
                    Avg. Pitch Score
                  </p>
                  <p className="text-lg font-bold text-slate-900 dark:text-zinc-100">
                    {isLoading ? "—" : `${avgScore}/100`}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
