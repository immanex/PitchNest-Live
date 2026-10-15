import React, { useCallback, useEffect, useRef, useState } from "react";
import { BadgeCheck, Flag, Loader2, MessageSquare, Mic, Send, Trash2 } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  COMMENT_MAX_LENGTH,
  fetchBusinessComments,
  postBusinessComment,
  removeBusinessComment,
  type CommentCategory,
  type PublicComment,
} from "../../api/discover";
import { FEEDBACK_CATEGORIES, FEEDBACK_LABELS, FEEDBACK_PROMPTS } from "../../api/pitches";
import type { ReportTarget } from "./ReportDialog";
import { FeedbackBadge } from "./FeedbackBadge";

/** Asks the composer to preset a feedback type and take focus. */
export interface ComposeRequest {
  category: CommentCategory;
  nonce: number;
}

interface BusinessDiscussionProps {
  slug: string;
  businessName: string;
  onCommentCountChange: (delta: number) => void;
  onReport: (target: ReportTarget) => void;
  /** Members of this business can turn a question into a private rehearsal. */
  viewerIsMember?: boolean;
  onPractise?: (commentId: string) => Promise<void>;
  /** The business has a live public pitch, so feedback types are offered. */
  pitchAvailable?: boolean;
  composeRequest?: ComposeRequest | null;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "P";
}

function relativeTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const steps: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) return formatter.format(Math.trunc(seconds / size), unit);
  }
  return "just now";
}

export function BusinessDiscussion({
  slug,
  businessName,
  onCommentCountChange,
  onReport,
  viewerIsMember = false,
  onPractise,
  pitchAvailable = false,
  composeRequest = null,
}: BusinessDiscussionProps) {
  const [category, setCategory] = useState<CommentCategory | null>(null);
  const draftRef = useRef<HTMLTextAreaElement | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);

  // The pitch section's feedback buttons land here with a type preselected.
  useEffect(() => {
    if (!composeRequest || !pitchAvailable) return;
    setCategory(composeRequest.category);
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => draftRef.current?.focus({ preventScroll: true }), 250);
  }, [composeRequest?.nonce]);

  // Without a live pitch, comments are plain again.
  useEffect(() => {
    if (!pitchAvailable) setCategory(null);
  }, [pitchAvailable]);

  const [practisingId, setPractisingId] = useState<string | null>(null);
  const [practiseError, setPractiseError] = useState("");

  const practise = async (commentId: string) => {
    if (!onPractise || practisingId) return;
    setPractisingId(commentId);
    setPractiseError("");
    try {
      await onPractise(commentId);
    } catch (error) {
      setPractiseError(error instanceof Error ? error.message : "We couldn't start that practice session.");
      setPractisingId(null);
    }
  };
  const { user, authFetch } = useAuth();
  const location = useLocation();
  const [comments, setComments] = useState<PublicComment[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [formError, setFormError] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setStatus("loading");
      try {
        const page = await fetchBusinessComments(authFetch, slug, null, signal);
        setComments(page.data);
        setNextCursor(page.pagination.hasMore ? page.pagination.nextCursor : null);
        setStatus("ready");
      } catch (error: any) {
        if (error?.name === "AbortError") return;
        setStatus("error");
      }
    },
    // Re-load when the viewer changes so "remove" permissions stay accurate.
    // authFetch is deliberately omitted: it changes with the token, which
    // already changes with user?.id.
    [slug, user?.id],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchBusinessComments(authFetch, slug, nextCursor);
      setComments((current) => {
        const seen = new Set(current.map((comment) => comment.id));
        return [...current, ...page.data.filter((comment) => !seen.has(comment.id))];
      });
      setNextCursor(page.pagination.hasMore ? page.pagination.nextCursor : null);
    } catch {
      // Keep the current list; the button stays available to retry.
    } finally {
      setLoadingMore(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (body.length < 2 || posting) return;
    setPosting(true);
    setFormError("");
    try {
      const created = await postBusinessComment(authFetch, slug, body, {
        category,
        onPitch: pitchAvailable && category !== null,
      });
      setComments((current) => [created, ...current]);
      setDraft("");
      setCategory(null);
      onCommentCountChange(1);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "We couldn't post your comment.");
    } finally {
      setPosting(false);
    }
  };

  const remove = async (comment: PublicComment) => {
    if (removingId) return;
    if (!window.confirm("Remove this comment from the public profile?")) return;
    setRemovingId(comment.id);
    try {
      await removeBusinessComment(authFetch, comment.id);
      setComments((current) => current.filter((item) => item.id !== comment.id));
      onCommentCountChange(-1);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "We couldn't remove that comment.");
    } finally {
      setRemovingId(null);
    }
  };

  const remaining = COMMENT_MAX_LENGTH - draft.length;

  return (
    <section
      ref={sectionRef}
      id="discussion"
      aria-labelledby="discussion-heading"
      className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 sm:p-7"
    >
      <div className="eyebrow">
        <MessageSquare size={15} />
        <span>Discussion</span>
      </div>
      <h2 id="discussion-heading" className="mt-3 text-xl font-extrabold text-slate-950 dark:text-white">
        Questions and feedback
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-zinc-400">
        Ask {businessName} a specific question or share practical feedback. Keep it constructive.
      </p>

      {user ? (
        <form onSubmit={(event) => void submit(event)} className="mt-5">
          {pitchAvailable && (
            <fieldset className="mb-3">
              <legend className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Feedback on the pitch</legend>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setCategory(null)}
                  aria-pressed={category === null}
                  className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
                    category === null
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-slate-200 text-slate-600 hover:border-indigo-300 dark:border-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  General comment
                </button>
                {FEEDBACK_CATEGORIES.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setCategory(option)}
                    aria-pressed={category === option}
                    className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
                      category === option
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-slate-200 text-slate-600 hover:border-indigo-300 dark:border-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    {FEEDBACK_LABELS[option]}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          <label htmlFor="comment-draft" className="sr-only">Your comment</label>
          <textarea
            ref={draftRef}
            id="comment-draft"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={COMMENT_MAX_LENGTH}
            rows={3}
            className="input-field w-full resize-y text-sm"
            placeholder={category ? FEEDBACK_PROMPTS[category] : "What evidence shows customers will pay for this?"}
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <span className={`text-[11px] ${remaining < 50 ? "text-amber-600" : "text-slate-400"}`}>
              {remaining} characters left · up to 2 links
            </span>
            <button
              type="submit"
              disabled={posting || draft.trim().length < 2}
              className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {posting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Post
            </button>
          </div>
          {formError && <p className="mt-2 text-sm text-rose-600 dark:text-rose-400" role="alert">{formError}</p>}
        </form>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-zinc-700 dark:text-zinc-400">
          <Link
            to="/login"
            state={{ from: { pathname: location.pathname } }}
            className="font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
          >
            Log in
          </Link>{" "}
          to ask a question or leave feedback.
        </div>
      )}

      {practiseError && (
        <p className="mt-4 text-sm text-rose-600 dark:text-rose-400" role="alert">{practiseError}</p>
      )}

      <div className="mt-6" aria-live="polite">
        {status === "loading" && (
          <p className="flex items-center gap-2 py-6 text-sm text-slate-400">
            <Loader2 size={16} className="animate-spin" /> Loading comments…
          </p>
        )}
        {status === "error" && (
          <p className="py-6 text-sm text-slate-500 dark:text-zinc-400">
            Comments couldn't load.{" "}
            <button type="button" onClick={() => void load()} className="font-bold text-indigo-600 dark:text-indigo-400">
              Try again
            </button>
          </p>
        )}
        {status === "ready" && comments.length === 0 && (
          <p className="py-6 text-sm italic text-slate-400 dark:text-zinc-500">
            No questions yet. Be the first to ask something useful.
          </p>
        )}
        {status === "ready" && comments.length > 0 && (
          <ul className="divide-y divide-slate-100 dark:divide-zinc-800">
            {comments.map((comment) => (
              <li key={comment.id} className="flex gap-3 py-4">
                {comment.author.avatarUrl ? (
                  <img
                    src={comment.author.avatarUrl}
                    alt=""
                    className="h-9 w-9 shrink-0 rounded-full object-cover"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                    {initials(comment.author.name)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-bold text-slate-900 dark:text-zinc-100">{comment.author.name}</span>
                    {comment.author.isBusinessMember && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                        <BadgeCheck size={11} /> Team
                      </span>
                    )}
                    <FeedbackBadge category={comment.category} onPitch={comment.onPitch} />
                    <span className="text-[11px] text-slate-400">{relativeTime(comment.createdAt)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700 dark:text-zinc-300">
                    {comment.body}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                    {viewerIsMember && onPractise && !comment.author.isBusinessMember && (
                      <button
                        type="button"
                        onClick={() => void practise(comment.id)}
                        disabled={practisingId !== null}
                        className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-1 text-[11px] font-bold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-60 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-950/70"
                      >
                        {practisingId === comment.id ? <Loader2 size={12} className="animate-spin" /> : <Mic size={12} />}
                        Practise this question
                      </button>
                    )}
                    {comment.viewerCanRemove && (
                      <button
                        type="button"
                        onClick={() => void remove(comment)}
                        disabled={removingId === comment.id}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 transition hover:text-rose-600 disabled:opacity-50"
                      >
                        <Trash2 size={12} /> Remove
                      </button>
                    )}
                    {user && (
                      <button
                        type="button"
                        onClick={() => onReport({ entityType: "comment", slug, commentId: comment.id, label: "this comment" })}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 transition hover:text-rose-600"
                      >
                        <Flag size={12} /> Report
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {nextCursor && status === "ready" && (
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="btn-secondary mt-2 inline-flex w-full items-center justify-center gap-2 py-2.5 text-sm"
          >
            {loadingMore && <Loader2 size={15} className="animate-spin" />} Show older comments
          </button>
        )}
      </div>
    </section>
  );
}
