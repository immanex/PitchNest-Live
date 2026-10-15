import React from "react";
import { Flag, MessageSquarePlus, Presentation } from "lucide-react";
import { FEEDBACK_CATEGORIES, FEEDBACK_LABELS, type FeedbackCategory, type PublicPitch } from "../../api/pitches";

function formatDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(date);
}

/**
 * A founder's published text pitch. The feedback buttons hand off to the
 * discussion composer, which posts the comment against this pitch.
 */
export function PublicPitchSection({
  pitch,
  businessName,
  feedbackEnabled,
  onGiveFeedback,
  onReport,
}: {
  pitch: PublicPitch;
  businessName: string;
  /** False when comments are switched off; the pitch still shows. */
  feedbackEnabled: boolean;
  onGiveFeedback: (category: FeedbackCategory) => void;
  onReport: () => void;
}) {
  return (
    <section
      id="pitch"
      aria-labelledby="pitch-heading"
      className="scroll-mt-24 rounded-2xl border border-indigo-200 bg-white p-6 shadow-sm dark:border-indigo-900/50 dark:bg-zinc-900 sm:p-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="eyebrow">
          <Presentation size={15} />
          <span>Public pitch</span>
        </div>
        <span className="text-[11px] text-slate-400">
          {pitch.publishedAt ? `Published ${formatDate(pitch.publishedAt)}` : ""}
          {pitch.version > 1 ? ` · version ${pitch.version}` : ""}
        </span>
      </div>
      <h2 id="pitch-heading" className="mt-3 text-xl font-extrabold leading-snug text-slate-950 dark:text-white sm:text-2xl">
        {pitch.headline}
      </h2>
      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700 dark:text-zinc-300 sm:text-base">
        {pitch.body}
      </p>

      {pitch.feedbackAsk && (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
            {businessName} wants feedback on
          </p>
          <p className="mt-1 text-sm font-medium text-slate-800 dark:text-zinc-200">{pitch.feedbackAsk}</p>
        </div>
      )}

      {feedbackEnabled && (
        <div className="mt-5 border-t border-slate-100 pt-5 dark:border-zinc-800">
          <p className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-zinc-300">
            <MessageSquarePlus size={14} /> Give structured feedback
            <span className="font-normal text-slate-400">· {pitch.feedbackCount} so far</span>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {FEEDBACK_CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => onGiveFeedback(category)}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-indigo-950/30"
              >
                {FEEDBACK_LABELS[category]}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onReport}
            className="mt-4 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 transition hover:text-rose-600"
          >
            <Flag size={12} /> Report this pitch
          </button>
        </div>
      )}
    </section>
  );
}
