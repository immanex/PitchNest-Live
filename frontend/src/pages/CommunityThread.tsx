import React, { useEffect, useState } from "react";
import { ArrowLeft, Flag, Loader2, MessageSquare, MessagesSquare, Send, Trash2 } from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { PageWithRail } from "../components/layout/EcosystemRail";
import { ReportDialog, type ReportTarget } from "../components/discover/ReportDialog";
import { UserAvatar } from "../components/ui/UserAvatar";
import { useAuth } from "../contexts/AuthContext";
import { usePageMetadata } from "../hooks/usePageMetadata";
import {
  CommunityApiError,
  createReply,
  fetchReplies,
  fetchThread,
  removeReply,
  removeThread,
  REPLY_MAX,
  TOPIC_LABELS,
  type CommunityReply,
  type ThreadDetail,
} from "../api/community";

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  return <UserAvatar name={name} avatarUrl={url} size={36} />;
}

export default function CommunityThread() {
  const { threadId = "" } = useParams<{ threadId: string }>();
  const { user, authFetch } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [replies, setReplies] = useState<CommunityReply[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [formError, setFormError] = useState("");
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);

  usePageMetadata({
    title: thread ? `${thread.title} — PitchNest Community` : "Discussion — PitchNest Community",
    description: thread?.body.slice(0, 160) || "A founder discussion on PitchNest.",
    path: `/community/${encodeURIComponent(threadId)}`,
    robots: "noindex, follow",
  });

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    Promise.all([
      fetchThread(authFetch, threadId, controller.signal),
      fetchReplies(authFetch, threadId, null, controller.signal),
    ])
      .then(([detail, page]) => {
        setThread(detail);
        setReplies(page.data);
        setNextCursor(page.pagination.hasMore ? page.pagination.nextCursor : null);
        setStatus("ready");
      })
      .catch((error) => {
        if (error?.name === "AbortError") return;
        setStatus(error instanceof CommunityApiError && error.status === 404 ? "missing" : "error");
      });
    return () => controller.abort();
    // authFetch changes with the token, which changes with user?.id.
  }, [threadId, user?.id]);

  useEffect(() => {
    if (status !== "ready" || location.hash !== "#replies") return;
    const timer = window.setTimeout(() => {
      document.getElementById("replies")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [status, location.hash]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchReplies(authFetch, threadId, nextCursor);
      setReplies((current) => {
        const known = new Set(current.map((reply) => reply.id));
        return [...current, ...page.data.filter((reply) => !known.has(reply.id))];
      });
      setNextCursor(page.pagination.hasMore ? page.pagination.nextCursor : null);
    } catch {
      // Leave the button available to retry.
    } finally {
      setLoadingMore(false);
    }
  };

  const submitReply = async (event: React.FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (body.length < 2 || posting) return;
    setPosting(true);
    setFormError("");
    try {
      const created = await createReply(authFetch, threadId, body);
      // Replies are oldest first; only append when every older one is loaded.
      if (!nextCursor) setReplies((current) => [...current, created]);
      setThread((current) => (current ? { ...current, replyCount: current.replyCount + 1 } : current));
      setDraft("");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "We couldn't post your reply.");
    } finally {
      setPosting(false);
    }
  };

  const deleteThread = async () => {
    if (!thread || !window.confirm("Remove your discussion? Replies will no longer be visible.")) return;
    try {
      await removeThread(authFetch, thread.id);
      navigate("/community", { replace: true });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "We couldn't remove that discussion.");
    }
  };

  const deleteReply = async (reply: CommunityReply) => {
    if (!window.confirm("Remove your reply?")) return;
    try {
      await removeReply(authFetch, reply.id);
      setReplies((current) => current.filter((item) => item.id !== reply.id));
      setThread((current) => (current ? { ...current, replyCount: Math.max(0, current.replyCount - 1) } : current));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "We couldn't remove that reply.");
    }
  };

  const openReport = (target: ReportTarget) => {
    if (!user) {
      navigate("/login", { state: { from: { pathname: location.pathname } } });
      return;
    }
    setReportTarget(target);
  };

  return (
    <PageWithRail>
      <div>
        <Link to="/community" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:text-slate-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:text-white">
          <ArrowLeft size={14} /> All discussions
        </Link>

        {status === "loading" && (
          <p className="flex items-center gap-2 py-16 text-sm text-slate-400">
            <Loader2 size={16} className="animate-spin" /> Loading discussion…
          </p>
        )}

        {(status === "missing" || status === "error") && (
          <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <MessagesSquare size={26} className="mx-auto text-slate-300" />
            <h1 className="mt-4 text-xl font-extrabold text-slate-950 dark:text-white">
              {status === "missing" ? "Discussion not available" : "We couldn’t load this discussion"}
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
              {status === "missing" ? "It may have been removed." : "Please try again in a moment."}
            </p>
          </div>
        )}

        {status === "ready" && thread && (
          <>
            <article className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 sm:p-7">
              <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                {TOPIC_LABELS[thread.topic]}
              </span>
              <h1 className="mt-3 text-2xl font-extrabold leading-tight text-slate-950 dark:text-white sm:text-3xl">{thread.title}</h1>
              <div className="mt-4 flex items-center gap-3">
                <Avatar name={thread.author.name} url={thread.author.avatarUrl} />
                <div className="text-xs">
                  <p className="font-bold text-slate-800 dark:text-zinc-200">{thread.author.name}</p>
                  <p className="text-slate-400">{formatDate(thread.createdAt)}</p>
                </div>
              </div>
              <p className="mt-5 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700 dark:text-zinc-300">{thread.body}</p>
              <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-4 text-[11px] font-semibold text-slate-400 dark:border-zinc-800">
                <span className="inline-flex items-center gap-1">
                  <MessageSquare size={12} /> {thread.replyCount} {thread.replyCount === 1 ? "reply" : "replies"}
                </span>
                {thread.viewerIsAuthor ? (
                  <button type="button" onClick={() => void deleteThread()} className="inline-flex items-center gap-1 transition hover:text-rose-600">
                    <Trash2 size={12} /> Remove
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => openReport({ entityType: "thread", entityId: thread.id, label: "this discussion" })}
                    className="inline-flex items-center gap-1 transition hover:text-rose-600"
                  >
                    <Flag size={12} /> Report
                  </button>
                )}
              </div>
            </article>

            <section id="replies" aria-labelledby="replies-heading" className="mt-6 scroll-mt-24">
              <h2 id="replies-heading" className="text-sm font-bold text-slate-950 dark:text-white">Replies</h2>
              {replies.length === 0 ? (
                <p className="mt-3 text-sm italic text-slate-400 dark:text-zinc-500">No replies yet. Share what worked for you.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {replies.map((reply) => (
                    <li key={reply.id} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                      <Avatar name={reply.author.name} url={reply.author.avatarUrl} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 text-[11px]">
                          <span className="font-bold text-slate-800 dark:text-zinc-200">{reply.author.name}</span>
                          <span className="text-slate-400">{formatDate(reply.createdAt)}</span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700 dark:text-zinc-300">{reply.body}</p>
                        <div className="mt-2 text-[11px] font-semibold text-slate-400">
                          {reply.viewerIsAuthor ? (
                            <button type="button" onClick={() => void deleteReply(reply)} className="inline-flex items-center gap-1 transition hover:text-rose-600">
                              <Trash2 size={12} /> Remove
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openReport({ entityType: "reply", entityId: reply.id, label: "this reply" })}
                              className="inline-flex items-center gap-1 transition hover:text-rose-600"
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
              {nextCursor && (
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  disabled={loadingMore}
                  className="btn-secondary mt-3 inline-flex w-full items-center justify-center gap-2 py-2.5 text-sm"
                >
                  {loadingMore && <Loader2 size={15} className="animate-spin" />} Show more replies
                </button>
              )}

              {user ? (
                <form onSubmit={(event) => void submitReply(event)} className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <label htmlFor="reply-draft" className="sr-only">Your reply</label>
                  <textarea
                    id="reply-draft"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    maxLength={REPLY_MAX}
                    rows={3}
                    className="input-field w-full resize-y text-sm"
                    placeholder="Share a specific, practical answer"
                  />
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-400">{REPLY_MAX - draft.length} characters left · up to 2 links</span>
                    <button
                      type="submit"
                      disabled={posting || draft.trim().length < 2}
                      className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {posting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Reply
                    </button>
                  </div>
                  {formError && <p className="mt-2 text-sm text-rose-600 dark:text-rose-400" role="alert">{formError}</p>}
                </form>
              ) : (
                <p className="mt-5 rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-zinc-700 dark:text-zinc-400">
                  <Link to="/login" state={{ from: { pathname: location.pathname } }} className="font-bold text-indigo-600 dark:text-indigo-400">
                    Log in
                  </Link>{" "}
                  to reply.
                </p>
              )}
            </section>
          </>
        )}
      </div>

      <ReportDialog target={reportTarget} onClose={() => setReportTarget(null)} />
    </PageWithRail>
  );
}
