import React, { useCallback, useEffect, useState } from "react";
import {
  Building2,
  CheckCircle2,
  EyeOff,
  Loader2,
  MessageSquare,
  MessagesSquare,
  Presentation,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  DiscoverApiError,
  fetchStaffReports,
  REPORT_REASON_LABELS,
  resolveStaffReport,
  restoreStaffContent,
  type ReportStatus,
  type StaffReport,
} from "../../api/discover";
import { cn } from "../../lib/utils";

const ENTITY_LABELS: Record<StaffReport["entityType"], string> = {
  business: "business",
  comment: "comment",
  thread: "discussion",
  reply: "reply",
  pitch: "pitch",
};

const TABS: Array<{ value: ReportStatus; label: string }> = [
  { value: "open", label: "Open" },
  { value: "actioned", label: "Actioned" },
  { value: "dismissed", label: "Dismissed" },
];

function formatDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

/**
 * Staff moderation queue for Discover reports. The API returns 404 to anyone
 * without users.is_staff, which this page shows as "not available".
 */
export default function ModerationPage() {
  const { authFetch } = useAuth();
  const [tab, setTab] = useState<ReportStatus>("open");
  const [reports, setReports] = useState<StaffReport[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "forbidden" | "error">("loading");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      setReports(await fetchStaffReports(authFetch, tab));
      setStatus("ready");
    } catch (requestError) {
      if (requestError instanceof DiscoverApiError && requestError.status === 404) {
        setStatus("forbidden");
        return;
      }
      setError(requestError instanceof Error ? requestError.message : "Failed to load reports.");
      setStatus("error");
    }
  }, [authFetch, tab]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (report: StaffReport, action: "hide" | "dismiss" | "restore") => {
    let note: string | undefined;
    if (action !== "restore") {
      const answer = window.prompt(
        action === "hide"
          ? `Hide this ${ENTITY_LABELS[report.entityType]}? Add an optional note for the audit log.`
          : "Dismiss this report? Add an optional note for the audit log.",
        "",
      );
      if (answer === null) return;
      note = answer.trim() || undefined;
    } else if (
      !window.confirm(
        report.entityType === "business"
          ? "Restore this business to draft? Its owner must review and republish it."
          : `Make this ${ENTITY_LABELS[report.entityType]} visible again?`,
      )
    ) {
      return;
    }

    setBusyId(report.id);
    try {
      if (action === "restore") {
        await restoreStaffContent(authFetch, report.entityType, report.entityId);
      } else {
        await resolveStaffReport(authFetch, report.id, action, note);
      }
      await load();
    } catch (requestError) {
      window.alert(requestError instanceof Error ? requestError.message : "That action failed.");
    } finally {
      setBusyId(null);
    }
  };

  if (status === "forbidden") {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <ShieldAlert size={32} className="mx-auto text-slate-300" />
        <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-zinc-100">Moderation isn't available</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">This area is restricted to PitchNest moderators.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Staff</p>
          <h1 className="mt-1 text-2xl font-extrabold text-slate-950 dark:text-white">Moderation</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
            Reports from Discover and Community. Every action is recorded in an audit log.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/staff/opportunities" className="btn-secondary px-4 py-2 text-sm">Opportunities</Link>
          <Link to="/staff/analytics" className="btn-secondary px-4 py-2 text-sm">Analytics</Link>
          <button
            type="button"
            onClick={() => void load()}
            className="btn-secondary inline-flex items-center gap-2 px-4 py-2 text-sm"
          >
            <RefreshCw size={15} className={status === "loading" ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      <div className="mt-6 flex gap-1 border-b border-slate-200 dark:border-zinc-800" role="tablist">
        {TABS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              "border-b-2 px-4 py-2.5 text-sm font-semibold transition",
              tab === value
                ? "border-indigo-600 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-4">
        {status === "loading" && (
          <p className="flex items-center gap-2 py-10 text-sm text-slate-400">
            <Loader2 size={16} className="animate-spin" /> Loading reports…
          </p>
        )}
        {status === "error" && (
          <p className="py-10 text-sm text-rose-600" role="alert">{error}</p>
        )}
        {status === "ready" && reports.length === 0 && (
          <p className="flex items-center gap-2 py-10 text-sm text-slate-500 dark:text-zinc-400">
            <CheckCircle2 size={16} className="text-emerald-500" /> Nothing here.
          </p>
        )}
        {status === "ready" &&
          reports.map((report) => {
            const hidden =
              report.entityType === "comment"
                ? report.comment?.status === "hidden"
                : report.entityType === "thread" || report.entityType === "reply"
                  ? report.community?.status === "hidden"
                  : report.entityType === "pitch"
                    ? report.pitch?.status === "hidden"
                    : report.business?.status === "hidden";
            const EntityIcon =
              report.entityType === "business" ? Building2 :
              report.entityType === "comment" ? MessageSquare :
              report.entityType === "pitch" ? Presentation :
              MessagesSquare;
            return (
              <article
                key={report.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                    <EntityIcon size={11} />
                    {report.entityType === "thread" ? "discussion" : report.entityType}
                  </span>
                  <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-bold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                    {REPORT_REASON_LABELS[report.reason] ?? report.reason}
                  </span>
                  {report.openReportsForEntity > 1 && (
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                      {report.openReportsForEntity} open reports on this item
                    </span>
                  )}
                  <span className="ml-auto text-[11px] text-slate-400">{formatDate(report.createdAt)}</span>
                </div>

                {report.business && (
                  <p className="mt-3 text-sm text-slate-600 dark:text-zinc-300">
                    Business:{" "}
                    {report.business.status === "published" ? (
                      <Link to={`/businesses/${report.business.slug}`} className="font-bold text-indigo-600 hover:underline dark:text-indigo-400" target="_blank" rel="noreferrer">
                        {report.business.name}
                      </Link>
                    ) : (
                      <span className="font-bold">{report.business.name}</span>
                    )}{" "}
                    <span className="text-xs text-slate-400">({report.business.status})</span>
                  </p>
                )}

                {report.community && (
                  <>
                    <p className="mt-3 text-sm text-slate-600 dark:text-zinc-300">
                      Discussion:{" "}
                      {report.community.threadId ? (
                        <Link to={`/community/${report.community.threadId}`} className="font-bold text-indigo-600 hover:underline dark:text-indigo-400" target="_blank" rel="noreferrer">
                          {report.community.threadTitle || "Untitled discussion"}
                        </Link>
                      ) : (
                        <span className="font-bold">{report.community.threadTitle || "Discussion no longer available"}</span>
                      )}
                    </p>
                    <blockquote className="mt-3 whitespace-pre-wrap break-words rounded-xl border-l-4 border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300">
                      {report.community.body || <em className="text-slate-400">Content no longer available</em>}
                      <span className="mt-1 block text-[11px] text-slate-400">
                        {report.entityType === "thread" ? "Discussion" : "Reply"} status: {report.community.status}
                      </span>
                    </blockquote>
                  </>
                )}

                {report.pitch && (
                  <blockquote className="mt-3 whitespace-pre-wrap break-words rounded-xl border-l-4 border-indigo-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-indigo-900 dark:bg-zinc-800/50 dark:text-zinc-300">
                    {report.pitch.headline && <strong className="block text-slate-900 dark:text-zinc-100">{report.pitch.headline}</strong>}
                    {report.pitch.body || <em className="text-slate-400">Pitch no longer available</em>}
                    <span className="mt-1 block text-[11px] text-slate-400">Pitch status: {report.pitch.status}</span>
                  </blockquote>
                )}

                {report.comment && (
                  <blockquote className="mt-3 whitespace-pre-wrap break-words rounded-xl border-l-4 border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300">
                    {report.comment.body || <em className="text-slate-400">Comment no longer available</em>}
                    <span className="mt-1 block text-[11px] text-slate-400">Comment status: {report.comment.status}</span>
                  </blockquote>
                )}

                {report.details && (
                  <p className="mt-3 text-sm text-slate-500 dark:text-zinc-400">
                    <span className="font-semibold text-slate-700 dark:text-zinc-300">Reporter's note:</span> {report.details}
                  </p>
                )}
                {report.resolutionNote && (
                  <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
                    <span className="font-semibold text-slate-700 dark:text-zinc-300">Moderator note:</span> {report.resolutionNote}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {report.status === "open" && (
                    <>
                      <button
                        type="button"
                        disabled={busyId === report.id}
                        onClick={() => void act(report, "hide")}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-rose-700 disabled:opacity-50"
                      >
                        <EyeOff size={14} /> Hide {ENTITY_LABELS[report.entityType]}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === report.id}
                        onClick={() => void act(report, "dismiss")}
                        className="btn-secondary inline-flex items-center gap-1.5 px-3.5 py-2 text-xs"
                      >
                        <XCircle size={14} /> Dismiss
                      </button>
                    </>
                  )}
                  {report.status !== "open" && hidden && (
                    <button
                      type="button"
                      disabled={busyId === report.id}
                      onClick={() => void act(report, "restore")}
                      className="btn-secondary inline-flex items-center gap-1.5 px-3.5 py-2 text-xs"
                    >
                      <RotateCcw size={14} /> Restore {ENTITY_LABELS[report.entityType]}
                    </button>
                  )}
                  {busyId === report.id && <Loader2 size={16} className="animate-spin self-center text-slate-400" />}
                </div>
              </article>
            );
          })}
      </div>
    </div>
  );
}
