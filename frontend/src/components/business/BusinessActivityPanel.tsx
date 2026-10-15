import React, { useEffect, useState } from "react";
import { ExternalLink, Inbox, Loader2, Megaphone, Mic, Rocket, Send, Trash2, Trophy } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import type { Business } from "../../api/businesses";
import {
  listMemberQuestions,
  listMemberUpdates,
  postBusinessUpdate,
  removeBusinessUpdate,
  UPDATE_KIND_LABELS,
  UPDATE_MAX_LENGTH,
  type BusinessUpdate,
  type MemberQuestion,
  type UpdateKind,
} from "../../api/activity";
import { fetchDiscoverFeatures } from "../../api/discover";
import { createPracticeDraft } from "../../api/practice";
import { FeedbackBadge } from "../discover/FeedbackBadge";
import { cn } from "../../lib/utils";

const KIND_ICONS = { update: Megaphone, milestone: Trophy, launch: Rocket } as const;

function timeAgo(value: string) {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return days < 14
    ? `${days} d ago`
    : new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/**
 * The team's side of Discover for one business: questions people asked on the
 * public profile (each can become a private rehearsal) and the updates and
 * milestones the business shares with its followers.
 */
export function BusinessActivityPanel({ business, canEdit }: { business: Business; canEdit: boolean }) {
  const { authFetch } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [engagementEnabled, setEngagementEnabled] = useState(false);
  const [questions, setQuestions] = useState<MemberQuestion[]>([]);
  const [updates, setUpdates] = useState<BusinessUpdate[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [practisingId, setPractisingId] = useState<string | null>(null);
  const [kind, setKind] = useState<UpdateKind>("update");
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void fetchDiscoverFeatures().then((features) => {
      if (active) setEngagementEnabled(features.discoverEngagement);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setMessage("");
    Promise.all([listMemberQuestions(authFetch, business.id), listMemberUpdates(authFetch, business.id)])
      .then(([questionList, updateList]) => {
        if (cancelled) return;
        setQuestions(questionList);
        setUpdates(updateList);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
    // authFetch changes with the token; the business is what matters here.
  }, [business.id]);

  // Notification links open #questions; scroll once the list has rendered.
  useEffect(() => {
    if (status !== "ready" || location.hash !== "#questions") return;
    const timer = window.setTimeout(() => {
      document.getElementById("questions")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [status, location.hash]);

  const practise = async (question: MemberQuestion) => {
    if (practisingId) return;
    setPractisingId(question.id);
    setMessage("");
    try {
      const practiceDraft = await createPracticeDraft(authFetch, {
        businessId: business.id,
        mode: "panel",
        sourceCommentId: question.id,
      });
      navigate(`/setup?draft=${encodeURIComponent(practiceDraft.id)}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We couldn't start that practice session.");
      setPractisingId(null);
    }
  };

  const post = async (event: React.FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (body.length < 2 || posting) return;
    setPosting(true);
    setMessage("");
    try {
      const created = await postBusinessUpdate(authFetch, business.id, { kind, body });
      setUpdates((current) => [created, ...current]);
      setDraft("");
      setKind("update");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We couldn't post that update.");
    } finally {
      setPosting(false);
    }
  };

  const remove = async (update: BusinessUpdate) => {
    if (removingId) return;
    if (!window.confirm("Remove this update? It will disappear from your public profile.")) return;
    setRemovingId(update.id);
    try {
      await removeBusinessUpdate(authFetch, business.id, update.id);
      setUpdates((current) => current.filter((item) => item.id !== update.id));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We couldn't remove that update.");
    } finally {
      setRemovingId(null);
    }
  };

  const isPublished = business.status === "published";

  return (
    <>
      <section
        id="questions"
        className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-950 dark:text-white">Questions from the community</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
              What people asked on your public profile. Rehearse any of them privately before you answer.
            </p>
          </div>
          <Inbox size={19} className="shrink-0 text-indigo-500" />
        </div>

        <div className="mt-5">
          {status === "loading" && (
            <div className="flex justify-center py-6"><Loader2 size={19} className="animate-spin text-slate-400" /></div>
          )}
          {status === "error" && (
            <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-zinc-800/60 dark:text-zinc-400">
              Questions aren't available right now.
            </p>
          )}
          {status === "ready" && questions.length === 0 && (
            <p className="text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
              {isPublished
                ? "No questions yet. When people ask something on your profile, it appears here."
                : "Publish your profile to start receiving questions from the community."}
            </p>
          )}
          {status === "ready" && questions.length > 0 && (
            <ul className="divide-y divide-slate-100 dark:divide-zinc-800">
              {questions.map((question) => (
                <li key={question.id} className="py-3.5 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-x-2 text-[11px]">
                    <span className="font-bold text-slate-700 dark:text-zinc-200">{question.author.name}</span>
                    <FeedbackBadge category={question.category} onPitch={question.onPitch} />
                    <span className="text-slate-400">{timeAgo(question.createdAt)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700 dark:text-zinc-300">
                    {question.body}
                  </p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void practise(question)}
                      disabled={practisingId !== null}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-indigo-700 disabled:opacity-60"
                    >
                      {practisingId === question.id ? <Loader2 size={12} className="animate-spin" /> : <Mic size={12} />}
                      Practise this question
                    </button>
                    {isPublished && (
                      <Link
                        to={`/businesses/${business.slug}#discussion`}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600 transition hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        Reply on profile <ExternalLink size={11} />
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-950 dark:text-white">Updates and milestones</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
              {isPublished
                ? "Shown on your public profile. Followers get a notification."
                : "Saved privately now; shown on your profile once you publish."}
            </p>
          </div>
          <Megaphone size={19} className="shrink-0 text-indigo-500" />
        </div>

        {canEdit && engagementEnabled && (
          <form onSubmit={(event) => void post(event)} className="mt-5 space-y-2.5">
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Update type">
              {(Object.keys(UPDATE_KIND_LABELS) as UpdateKind[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={kind === value}
                  onClick={() => setKind(value)}
                  className={cn(
                    "rounded-full px-3 py-1 text-[11px] font-bold transition",
                    kind === value
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700",
                  )}
                >
                  {UPDATE_KIND_LABELS[value]}
                </button>
              ))}
            </div>
            <label htmlFor="business-update" className="sr-only">Update</label>
            <textarea
              id="business-update"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={UPDATE_MAX_LENGTH}
              rows={3}
              className="input-field w-full resize-y text-sm"
              placeholder="e.g. We signed our first 20 merchants in Ibadan."
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] text-slate-400">{UPDATE_MAX_LENGTH - draft.length} characters left · up to 3 links</span>
              <button
                type="submit"
                disabled={posting || draft.trim().length < 2}
                className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
              >
                {posting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Post update
              </button>
            </div>
          </form>
        )}

        {message && (
          <p className="mt-3 text-xs font-medium text-rose-600 dark:text-rose-400" role="alert">{message}</p>
        )}

        <div className="mt-5">
          {status === "ready" && updates.length === 0 && (
            <p className="text-xs text-slate-500 dark:text-zinc-400">No updates yet.</p>
          )}
          {updates.length > 0 && (
            <ul className="space-y-3">
              {updates.map((update) => {
                const Icon = KIND_ICONS[update.kind] ?? Megaphone;
                return (
                  <li key={update.id} className="rounded-xl border border-slate-100 p-3 dark:border-zinc-800">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                        <Icon size={12} /> {UPDATE_KIND_LABELS[update.kind]}
                        <span className="font-medium text-slate-400">· {timeAgo(update.createdAt)}</span>
                      </span>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => void remove(update)}
                          disabled={removingId === update.id}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 transition hover:text-rose-600 disabled:opacity-50"
                          aria-label="Remove update"
                        >
                          <Trash2 size={12} /> Remove
                        </button>
                      )}
                    </div>
                    <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700 dark:text-zinc-300">
                      {update.body}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
