import React, { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FirstTimeTour } from "../components/FirstTimeTour";
import {
  Play,
  Film,
  ChevronLeft,
  MessageSquare,
  Sparkles,
  Target,
  Clock,
  FileText,
  Download,
  Share2,
  Loader2,
  RotateCcw,
  Mic,
} from "lucide-react";
import { cn } from "../lib/utils";
import { useAuth } from "../contexts/AuthContext";
import { downloadPdf } from "../lib/downloadFile";

const TimelineEvent = ({
  type,
  time,
  content,
  active = false,
}: {
  type: string;
  time: string;
  content: string;
  active?: boolean;
  key?: React.Key;
}) => (
  <div
    className={cn(
      "relative pl-8 pb-8 last:pb-0 border-l-2 transition-all",
      active ? "border-sky-500" : "border-slate-100 dark:border-zinc-800",
    )}
  >
    <div
      className={cn(
        "absolute -left-2.25 top-0 w-4 h-4 rounded-full border-2 bg-white dark:bg-zinc-900 transition-all",
        active
          ? "border-sky-500 scale-110"
          : "border-slate-200 dark:border-zinc-700",
      )}
    />
    <div className="flex justify-between items-start mb-2">
      <span
        className={cn(
          "text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded",
          type.includes("INVESTOR")
            ? "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400"
            : type.includes("FOUNDER")
              ? "bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400"
              : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400",
        )}
      >
        {type}
      </span>
      <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500">
        {time}
      </span>
    </div>
    <p
      className={cn(
        "text-sm leading-relaxed",
        active
          ? "text-slate-900 dark:text-zinc-100 font-medium"
          : "text-slate-500 dark:text-zinc-400",
      )}
    >
      {content}
    </p>
  </div>
);

export default function PitchReplayScreen() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session");
  const { authFetch } = useAuth();
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  /** { url, available } for the AUDIO replay — see GET /api/sessions/:id/recording. */
  const [recording, setRecording] = useState<{
    url: string;
    available: boolean;
  } | null>(null);

  const handleDownloadPDF = useCallback(async () => {
    if (!session?.id || isDownloading) return;
    setIsDownloading(true);
    try {
      await downloadPdf(
        () => authFetch(`/api/sessions/${session.id}/pdf`),
        `PitchNest_Report_${(session.business_name || "Pitch").replace(/\s+/g, "_")}.pdf`,
      );
    } catch (err) {
      console.error("PDF download error:", err);
      alert("Failed to download PDF report. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  }, [session, authFetch, isDownloading]);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        let url = "/api/sessions";
        if (sessionId) {
          url = `/api/sessions/${sessionId}`;
        }
        const res = await authFetch(url);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            const latest = data[0];
            if (!latest?.id) {
              setSession(null);
            } else {
              const detail = await authFetch(`/api/sessions/${latest.id}`);
              setSession(detail.ok ? await detail.json() : null);
            }
          } else {
            setSession(data);
          }
        }
      } catch (err) {
        console.error("Failed to fetch session:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSession();
  }, [sessionId]);

  // Audio replay is the primary replay experience (req 4). The recording lives
  // in a private bucket and needs a short-lived signed URL; `available: false`
  // is a normal answer for sessions that predate audio capture, so the player
  // simply degrades to the transcript, exactly like the report page does.
  const activeSessionId = sessionId || session?.id;
  useEffect(() => {
    if (!activeSessionId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch(`/api/sessions/${activeSessionId}/recording`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            setRecording({
              url: typeof data.url === "string" ? data.url : "",
              available: !!data.available,
            });
          }
        }
      } catch (err) {
        console.error("Failed to load session recording:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeSessionId, authFetch]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <Loader2 className="animate-spin text-sky-500" size={48} />
        <p className="text-slate-500 font-medium">Loading session replay...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="p-16 text-center border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl max-w-2xl mx-auto my-12">
        <Play
          size={48}
          className="mx-auto text-slate-300 dark:text-zinc-700 mb-4 animate-pulse"
        />
        <h3 className="text-xl font-bold mb-2">No Session Replay Found</h3>
        <p className="text-slate-500 dark:text-zinc-500 font-medium mb-6">
          Complete your first pitch session to view your timeline replay and
          transcript!
        </p>
        <Link
          to="/setup"
          className="px-6 py-2.5 bg-sky-500 text-white font-bold rounded-xl hover:bg-sky-600 transition-all inline-flex items-center gap-2 text-sm shadow-lg shadow-sky-500/25"
        >
          <Play size={16} fill="currentColor" />
          Start Pitching
        </Link>
      </div>
    );
  }

  const report = session.evaluation_report || {};
  const rawScores = report.scores || {};

  // Match PostPitchReport + the PDF: the server now authoritatively marks a
  // too-short/empty pitch with evaluationStatus "insufficient_data" (or "failed").
  // Fall back to the all-zero-scores heuristic for older rows that predate the flag.
  const evaluationStatus = report.evaluationStatus as string | undefined;
  const isInsufficientData =
    evaluationStatus === "insufficient_data" ||
    evaluationStatus === "failed" ||
    !rawScores ||
    Object.keys(rawScores).length === 0 ||
    Object.values(rawScores).every((v) => v === 0);

  const scores = {
    delivery: Number(rawScores.delivery) || 0,
    clarity: Number(rawScores.clarity) || 0,
    scalability: Number(rawScores.scalability) || 0,
    readiness: Number(rawScores.readiness) || 0,
  };

  const overallScore = isInsufficientData
    ? 0
    : Math.round(
        (scores.delivery +
          scores.clarity +
          scores.scalability +
          scores.readiness) /
          4,
      );
  const transcript = Array.isArray(report.transcript) ? report.transcript : [];
  const businessName = session.business_name || "Untitled Pitch";

  const stats = [
    {
      label: "Overall Score",
      value: isInsufficientData ? "N/A" : `${overallScore}%`,
      icon: Target,
      color: "text-sky-500",
    },
    {
      label: "Delivery",
      value: isInsufficientData ? "N/A" : `${scores.delivery}/100`,
      icon: Sparkles,
      color: "text-indigo-500",
    },
    {
      label: "Clarity",
      value: isInsufficientData ? "N/A" : `${scores.clarity}/100`,
      icon: MessageSquare,
      color: "text-purple-500",
    },
    {
      label: "Scalability",
      value: isInsufficientData ? "N/A" : `${scores.scalability}/100`,
      icon: Clock,
      color: "text-amber-500",
    },
  ];

  return (
    <div className="space-y-8 pb-20">
      <FirstTimeTour
        tourKey="replay"
        steps={[
          { title: "Read back the conversation", body: "The full transcript of your session — every question from the panel and how you answered, exactly as it happened.", target: '[data-tour="replay-transcript"]' },
          { title: "Open the full report", body: "Jump to the scored report for your verdicts, metrics, and actionable next steps.", target: '[data-tour="replay-report"]' },
        ]}
      />
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Link
            to="/archive"
            className="p-2 text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
          >
            <ChevronLeft size={20} />
          </Link>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest min-w-0">
            <Link
              to="/archive"
              className="hover:text-slate-600 dark:hover:text-zinc-300 shrink-0"
            >
              My Pitches
            </Link>
            <ChevronLeft size={12} className="rotate-180 shrink-0" />
            <span className="text-slate-900 dark:text-zinc-100 truncate">
              {businessName}
            </span>
          </div>
        </div>

        <div className="flex gap-3 sm:shrink-0">
          <button
            onClick={handleDownloadPDF}
            disabled={isDownloading}
            className="flex-1 sm:flex-initial px-4 py-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDownloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} {isDownloading ? "Generating..." : "Download"}
          </button>
          <Link
            to={`/report?session=${session.id}`}
            data-tour="replay-report"
            className="flex-1 sm:flex-initial px-4 py-2.5 bg-sky-500 text-white font-bold rounded-xl hover:bg-sky-600 transition-all flex items-center justify-center gap-2 text-sm"
          >
            <Share2 size={16} /> View Full Report
          </Link>
        </div>
      </div>

      {/* Insufficient session — tell the same story as the report + PDF:
          too short to score, re-pitch to get the full breakdown. */}
      {isInsufficientData && (
        <div className="p-5 bg-sky-50 dark:bg-sky-900/10 border border-sky-200 dark:border-sky-900/40 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-extrabold text-slate-900 dark:text-zinc-100 mb-1">
              This pitch was too short to score
            </h3>
            <p className="text-sm text-slate-600 dark:text-zinc-400">
              There wasn't enough here to grade fairly, so scores and analytics were left out. Re-pitch to get your full report.
            </p>
          </div>
          <Link
            to="/setup"
            className="shrink-0 px-6 py-2.5 bg-sky-500 text-white font-bold rounded-xl hover:bg-sky-600 transition-all flex items-center gap-2 text-sm shadow-lg shadow-sky-500/25"
          >
            <RotateCcw size={16} /> Re-Pitch Now
          </Link>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* AUDIO REPLAY — the primary replay experience (req 4). Pitches are
              audio-only by design (req 1), so reliving a session means listening
              to it; the transcript below is its text mirror. Sessions that
              predate audio capture simply show the notice and fall back to the
              transcript. */}
          <div className="bg-slate-900 rounded-[28px] sm:rounded-[40px] p-6 sm:p-8 shadow-2xl border border-slate-800 flex flex-col items-center justify-center gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-sky-500/15 border border-sky-500/30 flex items-center justify-center">
              <Mic size={24} className="text-sky-400" />
            </div>
            <div>
              <p className="text-white/85 font-bold text-sm sm:text-base">
                Audio Replay
              </p>
              <p className="text-white/40 text-xs max-w-md mt-1">
                Relisten to the session exactly as it happened — every question
                from the panel and how you answered.
              </p>
            </div>
            {recording?.available && recording.url ? (
              <audio
                controls
                preload="metadata"
                className="w-full max-w-lg h-12"
                src={recording.url}
              >
                Your browser does not support audio playback.
              </audio>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full">
                <FileText size={13} className="text-white/40" />
                <span className="text-white/45 text-xs font-medium">
                  No audio for this session — the transcript below is the full
                  replay.
                </span>
              </div>
            )}
          </div>

          {/* Video area. PitchNest never records founder video (req 1), so this
              placeholder says so plainly instead of implying a video exists. */}
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 py-4 bg-slate-50/50 dark:bg-zinc-900/30">
            <Film size={14} className="text-slate-300 dark:text-zinc-600" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
              Video not available yet.
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((stat, i) => (
              <div
                key={i}
                className="card p-4 sm:p-6 flex flex-col gap-2 dark:bg-zinc-900 dark:border-zinc-800 shadow-sm border border-slate-100"
              >
                <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest leading-tight">
                  {stat.label}
                </span>
                <div className="flex items-center gap-2">
                  <stat.icon className={stat.color} size={16} />
                  <span className="text-lg sm:text-xl font-bold text-slate-900 dark:text-zinc-100">
                    {stat.value}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Transcript — full width on mobile, sidebar on desktop */}
        <div data-tour="replay-transcript" className="card flex flex-col h-100 lg:h-125 overflow-hidden dark:bg-zinc-900 dark:border-zinc-800 shadow-lg border border-slate-100">
          <div className="p-6 sm:p-8 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="text-sky-500" size={20} />
              <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-100">
                Live Transcript
              </h3>
            </div>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 custom-scrollbar">
            {transcript.length === 0 ? (
              <div className="text-center text-slate-400 py-12">
                No transcript logs available for this session.
              </div>
            ) : (
              transcript.map((msg, i) => {
                const type =
                  msg.type === "user" ? "FOUNDER PITCH" : "INVESTOR RESPONSE";
                const time = msg.time || `Step ${i + 1}`;
                // Older sessions stored an AI summary in `text` and the raw
                // spoken words in `fullText` — replay the real words.
                const spoken = msg.fullText || msg.text;
                return (
                  <TimelineEvent
                    key={i}
                    type={type}
                    time={time}
                    content={`"${spoken}"`}
                    active={i === 0}
                  />
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="card p-10 space-y-10 dark:bg-zinc-900 dark:border-zinc-800 shadow-xl border border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/5 rounded-full blur-3xl -mr-32 -mt-32" />

        <div className="flex items-center gap-2 relative z-10">
          <Sparkles className="text-sky-500" size={24} />
          <h3 className="text-2xl font-bold text-slate-900 dark:text-zinc-100">
            AI Performance Summary
          </h3>
        </div>

        <div className="grid md:grid-cols-3 gap-12 relative z-10">
          <div className="md:col-span-2 space-y-4">
            <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
              Executive Overview
            </p>
            <p className="text-lg text-slate-700 dark:text-zinc-300 leading-relaxed font-medium">
              {report.summary ||
                "No performance summary available for this pitch."}
            </p>
          </div>
          <div className="space-y-4 bg-sky-50 dark:bg-sky-900/10 p-6 rounded-2xl border border-sky-100 dark:border-sky-900/30">
            <p className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-widest">
              Investor Readiness
            </p>
            <p className="text-sm text-slate-700 dark:text-zinc-300 leading-relaxed">
              Based on this session, your pitch readiness is evaluated at a{" "}
              <strong className="text-sky-600">{scores.readiness}/100</strong>.
              Focus on iterating your delivery and ensuring your market size
              arguments are defensible before presenting to live VC panels.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
