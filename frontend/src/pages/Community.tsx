import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, Loader2, MessageSquare, MessagesSquare, Plus, Search, Send, Users, X } from "lucide-react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { PageHero } from "../components/layout/PageHero";
import { PageWithRail } from "../components/layout/EcosystemRail";
import { useAuth } from "../contexts/AuthContext";
import { usePageMetadata } from "../hooks/usePageMetadata";
import { fetchDiscoverFeatures } from "../api/discover";
import {
  COMMUNITY_TOPICS,
  createThread,
  fetchThreads,
  THREAD_BODY_MAX,
  THREAD_TITLE_MAX,
  TOPIC_LABELS,
  type CommunityTopic,
  type ThreadSummary,
} from "../api/community";
import { cn } from "../lib/utils";

function timeAgo(value: string) {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.max(0, Math.floor((Date.now() - then) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return days < 14
    ? `${days} d ago`
    : new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function Community() {
  const { user, authFetch } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const topic = (COMMUNITY_TOPICS as readonly string[]).includes(searchParams.get("topic") || "")
    ? (searchParams.get("topic") as CommunityTopic)
    : "";
  const q = searchParams.get("q") || "";
  const filterKey = useMemo(() => `${topic}|${q}`, [topic, q]);

  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState(q);
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState<{ topic: CommunityTopic; title: string; body: string }>({
    topic: "pitching",
    title: "",
    body: "",
  });
  const [posting, setPosting] = useState(false);
  const [formError, setFormError] = useState("");

  usePageMetadata({
    title: "Community — PitchNest",
    description: "Practical founder-to-founder discussions about pitching, fundraising, growth and operations.",
    path: "/community",
    // Discussions are member-written; keep them out of search engines while
    // moderation is still in its alpha.
    robots: "noindex, follow",
  });

  useEffect(() => {
    let active = true;
    void fetchDiscoverFeatures().then((features) => {
      if (active) setEnabled(features.community);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    setSearch(q);
    const controller = new AbortController();
    setStatus("loading");
    fetchThreads(authFetch, { topic, q }, controller.signal)
      .then((page) => {
        setThreads(page.data);
        setNextCursor(page.pagination.hasMore ? page.pagination.nextCursor : null);
        setStatus("ready");
      })
      .catch((error) => {
        if (error?.name !== "AbortError") setStatus("error");
      });
    return () => controller.abort();
    // authFetch changes with the token, which changes with user?.id.
  }, [enabled, filterKey, user?.id]);

  const selectTopic = (value: CommunityTopic | "") => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set("topic", value);
    else next.delete("topic");
    setSearchParams(next);
  };

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const next = new URLSearchParams(searchParams);
    const clean = search.trim();
    if (clean) next.set("q", clean);
    else next.delete("q");
    setSearchParams(next);
  };

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchThreads(authFetch, { topic, q, cursor: nextCursor });
      setThreads((current) => {
        const known = new Set(current.map((thread) => thread.id));
        return [...current, ...page.data.filter((thread) => !known.has(thread.id))];
      });
      setNextCursor(page.pagination.hasMore ? page.pagination.nextCursor : null);
    } catch {
      // Leave the button available to retry.
    } finally {
      setLoadingMore(false);
    }
  };

  const openComposer = () => {
    if (!user) {
      navigate("/login", { state: { from: { pathname: location.pathname } } });
      return;
    }
    setComposerOpen(true);
    if (topic) setDraft((current) => ({ ...current, topic }));
  };

  const submitThread = async (event: React.FormEvent) => {
    event.preventDefault();
    if (posting) return;
    setPosting(true);
    setFormError("");
    try {
      const created = await createThread(authFetch, {
        topic: draft.topic,
        title: draft.title.trim(),
        body: draft.body.trim(),
      });
      navigate(`/community/${created.id}`);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "We couldn't start that discussion.");
      setPosting(false);
    }
  };

  if (enabled === false) {
    return (
      <div className="mx-auto flex min-h-[55vh] max-w-xl items-center">
        <div className="w-full rounded-3xl border border-slate-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <MessagesSquare size={28} className="mx-auto text-accent-text dark:text-accent" />
          <h1 className="mt-4 text-2xl font-extrabold text-slate-950 dark:text-white">Community is coming soon</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
            Founder discussions will open here shortly. In the meantime, explore businesses on Discover.
          </p>
          <Link to="/discover" className="btn-primary mt-6 inline-flex items-center gap-2 px-5 py-2.5 text-sm">
            Explore Discover <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <PageWithRail>
      <PageHero
        icon={Users}
        eyebrow="Community"
        title="Build with people who understand."
        description="Ask specific questions and share real lessons about pitching, fundraising, growth and running a business."
      >
            <form onSubmit={submitSearch} className="flex gap-2">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Search discussions</span>
                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  maxLength={100}
                  placeholder="Search discussions"
                  className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </label>
              <button
                type="button"
                onClick={openComposer}
                className="btn-accent inline-flex shrink-0 items-center gap-2 px-4 py-3 text-sm"
              >
                <Plus size={16} /> <span className="hidden sm:inline">Start a discussion</span>
              </button>
            </form>
      </PageHero>

      <section>
          <div className="flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Topics">
            {(["", ...COMMUNITY_TOPICS] as Array<CommunityTopic | "">).map((value) => (
              <button
                key={value || "all"}
                type="button"
                role="tab"
                aria-selected={topic === value}
                onClick={() => selectTopic(value)}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-2 text-xs font-bold transition",
                  topic === value
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300",
                )}
              >
                {value ? TOPIC_LABELS[value] : "All topics"}
              </button>
            ))}
          </div>

          {composerOpen && (
            <form
              onSubmit={(event) => void submitThread(event)}
              className="mt-5 rounded-2xl border border-indigo-200 bg-white p-5 dark:border-indigo-900/60 dark:bg-zinc-900 sm:p-6"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-bold text-slate-950 dark:text-white">Start a discussion</h2>
                <button
                  type="button"
                  onClick={() => setComposerOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-zinc-800"
                  aria-label="Close"
                >
                  <X size={17} />
                </button>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
                <label className="text-xs font-bold text-slate-600 dark:text-zinc-300">
                  Topic
                  <select
                    value={draft.topic}
                    onChange={(event) => setDraft((current) => ({ ...current, topic: event.target.value as CommunityTopic }))}
                    className="input-field mt-1.5 w-full text-sm"
                  >
                    {COMMUNITY_TOPICS.map((value) => (
                      <option key={value} value={value}>{TOPIC_LABELS[value]}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-bold text-slate-600 dark:text-zinc-300">
                  Question or title
                  <input
                    value={draft.title}
                    onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                    maxLength={THREAD_TITLE_MAX}
                    required
                    placeholder="How did you find your first ten paying customers?"
                    className="input-field mt-1.5 w-full text-sm"
                  />
                </label>
              </div>
              <label className="mt-3 block text-xs font-bold text-slate-600 dark:text-zinc-300">
                Context
                <textarea
                  value={draft.body}
                  onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
                  maxLength={THREAD_BODY_MAX}
                  rows={5}
                  required
                  placeholder="What have you tried so far? What would help most?"
                  className="input-field mt-1.5 w-full resize-y text-sm"
                />
              </label>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <span className="text-[11px] text-slate-400">Be specific and constructive. Up to 3 links.</span>
                <button
                  type="submit"
                  disabled={posting || draft.title.trim().length < 5 || draft.body.trim().length < 10}
                  className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {posting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Post discussion
                </button>
              </div>
              {formError && <p className="mt-2 text-sm text-rose-600 dark:text-rose-400" role="alert">{formError}</p>}
            </form>
          )}

          <div className="mt-6" aria-live="polite">
            {(status === "loading" || enabled === null) && (
              <p className="flex items-center gap-2 py-10 text-sm text-slate-400">
                <Loader2 size={16} className="animate-spin" /> Loading discussions…
              </p>
            )}
            {status === "error" && (
              <p className="py-10 text-sm text-slate-500 dark:text-zinc-400">Discussions couldn't load. Please try again.</p>
            )}
            {status === "ready" && threads.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
                <MessagesSquare size={24} className="mx-auto text-slate-300" />
                <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-zinc-200">
                  {q || topic ? "No discussions match." : "No discussions yet."}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">Start one and ask the question you need answered.</p>
              </div>
            )}
            {status === "ready" && threads.length > 0 && (
              <ul className="space-y-3">
                {threads.map((thread) => (
                  <li key={thread.id}>
                    <Link
                      to={`/community/${thread.id}`}
                      className="group block rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-500/5 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-800"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 font-bold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                          {TOPIC_LABELS[thread.topic]}
                        </span>
                        <span className="text-slate-400">by {thread.author.name}</span>
                      </div>
                      <h2 className="mt-2 text-base font-extrabold text-slate-950 transition group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-300">
                        {thread.title}
                      </h2>
                      <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-500 dark:text-zinc-400">{thread.excerpt}</p>
                      <div className="mt-3 flex items-center gap-4 text-[11px] font-medium text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <MessageSquare size={12} /> {thread.replyCount} {thread.replyCount === 1 ? "reply" : "replies"}
                        </span>
                        <span>Active {timeAgo(thread.lastActivityAt)}</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {nextCursor && status === "ready" && (
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="btn-secondary mt-4 inline-flex w-full items-center justify-center gap-2 py-2.5 text-sm"
              >
                {loadingMore && <Loader2 size={15} className="animate-spin" />} Show more discussions
              </button>
            )}
          </div>
      </section>
    </PageWithRail>
  );
}
