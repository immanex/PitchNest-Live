import React from "react";
import { Presentation } from "lucide-react";
import type { CommentCategory } from "../../api/discover";
import { FEEDBACK_LABELS } from "../../api/pitches";

/** "Pitch · Evidence" style label for structured feedback comments. */
export function FeedbackBadge({ category, onPitch }: { category?: CommentCategory | null; onPitch?: boolean }) {
  if (!category && !onPitch) return null;
  const parts = [onPitch ? "Pitch" : null, category ? FEEDBACK_LABELS[category] : null].filter(Boolean);
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
      {onPitch && <Presentation size={10} />}
      {parts.join(" · ")}
    </span>
  );
}
