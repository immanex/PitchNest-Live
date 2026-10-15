import React, { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { CheckCircle2, ExternalLink, Eye, Loader2, Lock, Presentation, Save, Undo2, X } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import type { Business } from "../../api/businesses";
import {
  fetchMemberPitch,
  PITCH_ASK_MAX,
  PITCH_BODY_MAX,
  PITCH_BODY_MIN,
  PITCH_HEADLINE_MAX,
  publishPitch,
  savePitchDraft,
  withdrawPitch,
  type MemberPitch,
  type MemberPitchState,
} from "../../api/pitches";

type Form = { headline: string; body: string; feedbackAsk: string };

const EMPTY: Form = { headline: "", body: "", feedbackAsk: "" };

function fromPitch(pitch: MemberPitch | null): Form {
  return pitch ? { headline: pitch.headline, body: pitch.body, feedbackAsk: pitch.feedbackAsk } : EMPTY;
}

function sameAs(form: Form, pitch: MemberPitch | null) {
  return Boolean(pitch) && form.headline === pitch!.headline && form.body === pitch!.body && form.feedbackAsk === pitch!.feedbackAsk;
}

/**
 * The business's public pitch, written here on purpose. Nothing from private
 * practice sessions is ever copied into it.
 */
export function PublicPitchPanel({
  business,
  canEdit,
  canPublish,
}: {
  business: Business;
  canEdit: boolean;
  canPublish: boolean;
}) {
  const { authFetch } = useAuth();
  const [state, setState] = useState<MemberPitchState | null>(null);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [previewDraft, setPreviewDraft] = useState<MemberPitch | null>(null);
  const [consented, setConsented] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState(null);
    setLoadError("");
    setMessage(null);
    fetchMemberPitch(authFetch, business.id)
      .then((result) => {
        if (cancelled) return;
        setState(result);
        setForm(fromPitch(result.draft ?? result.published));
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "The pitch isn't available.");
      });
    return () => {
      cancelled = true;
    };
    // authFetch changes with the token; the business is what matters here.
  }, [business.id]);

  // Pitch Arena's "Share your pitch" links to #public-pitch; scroll once loaded.
  const location = useLocation();
  useEffect(() => {
    if (!state || location.hash !== "#public-pitch") return;
    const timer = window.setTimeout(() => {
      document.getElementById("public-pitch")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [state === null, location.hash]);

  const businessPublished = business.status === "published";
  const valid =
    form.headline.trim().length >= 5 &&
    form.body.trim().length >= PITCH_BODY_MIN &&
    form.body.length <= PITCH_BODY_MAX;

  const save = async (): Promise<MemberPitch | null> => {
    setSaving(true);
    setMessage(null);
    try {
      const draft = await savePitchDraft(authFetch, business.id, form);
      setState((current) => (current ? { ...current, draft } : current));
      setForm(fromPitch(draft));
      setMessage({ kind: "ok", text: "Draft saved. It stays private until published." });
      return draft;
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Couldn't save the draft." });
      return null;
    } finally {
      setSaving(false);
    }
  };

  const openPreview = async () => {
    // Always preview the saved draft, so what you approve is what is published.
    const draft = sameAs(form, state?.draft ?? null) ? state!.draft : await save();
    if (!draft) return;
    setConsented(false);
    setPreviewDraft(draft);
  };

  const confirmPublish = async () => {
    if (!previewDraft || !state || !consented) return;
    setPublishing(true);
    try {
      const published = await publishPitch(authFetch, business.id, previewDraft, state.consentVersion);
      setState({ ...state, draft: null, published });
      setForm(fromPitch(published));
      setPreviewDraft(null);
      setMessage({ kind: "ok", text: "Your pitch is live on your public profile." });
    } catch (error) {
      setPreviewDraft(null);
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Couldn't publish the pitch." });
    } finally {
      setPublishing(false);
    }
  };

  const withdraw = async () => {
    if (!state?.published || !window.confirm("Take your pitch off your public profile? You can publish it again later.")) return;
    setWithdrawing(true);
    try {
      await withdrawPitch(authFetch, business.id);
      setState({ ...state, published: null });
      setMessage({ kind: "ok", text: "Pitch withdrawn. It is no longer public." });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Couldn't withdraw the pitch." });
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <section id="public-pitch" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-950 dark:text-white">Public pitch</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            A short written pitch people can give structured feedback on. Written here on purpose: nothing from your private practice is shared.
          </p>
        </div>
        <Presentation size={19} className="shrink-0 text-indigo-500" />
      </div>

      {loadError && (
        <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-zinc-800/60 dark:text-zinc-400">{loadError}</p>
      )}
      {!state && !loadError && (
        <div className="flex justify-center py-6"><Loader2 size={19} className="animate-spin text-slate-400" /></div>
      )}

      {state && (
        <>
          <div className="mt-4 rounded-xl border border-slate-100 p-3 text-xs dark:border-zinc-800">
            {state.published ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 size={14} /> Live · version {state.published.version}
                </span>
                {businessPublished && (
                  <Link to={`/businesses/${business.slug}#pitch`} className="inline-flex items-center gap-1 font-bold text-indigo-600 dark:text-indigo-400">
                    View on profile <ExternalLink size={12} />
                  </Link>
                )}
              </div>
            ) : state.hidden ? (
              <p className="font-semibold text-rose-600 dark:text-rose-400">
                Your pitch was hidden by PitchNest moderation after a report. You can revise it and publish again.
              </p>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-semibold text-slate-500 dark:text-zinc-400">
                <Lock size={13} /> Not public. {state.draft ? "A draft is saved." : "No pitch yet."}
              </span>
            )}
            {!businessPublished && (
              <p className="mt-2 text-slate-500 dark:text-zinc-400">Publish your business profile first. You can write the pitch now.</p>
            )}
          </div>

          {canEdit ? (
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-bold text-slate-600 dark:text-zinc-300">
                Headline
                <input
                  value={form.headline}
                  onChange={(event) => setForm({ ...form, headline: event.target.value })}
                  maxLength={PITCH_HEADLINE_MAX}
                  placeholder="e.g. Overnight restocking on credit for neighbourhood shops"
                  className="input-field mt-1.5 w-full text-sm"
                />
              </label>
              <label className="block text-xs font-bold text-slate-600 dark:text-zinc-300">
                Your 60-second pitch
                <textarea
                  value={form.body}
                  onChange={(event) => setForm({ ...form, body: event.target.value })}
                  maxLength={PITCH_BODY_MAX}
                  rows={6}
                  placeholder="Who has the problem, how you solve it, the proof so far, and what you want to do next."
                  className="input-field mt-1.5 w-full resize-y text-sm"
                />
                <span className="mt-1 block text-[11px] font-normal text-slate-400">
                  {form.body.trim().length < PITCH_BODY_MIN
                    ? `At least ${PITCH_BODY_MIN} characters`
                    : `${PITCH_BODY_MAX - form.body.length} characters left`}
                </span>
              </label>
              <label className="block text-xs font-bold text-slate-600 dark:text-zinc-300">
                What feedback do you want? (optional)
                <input
                  value={form.feedbackAsk}
                  onChange={(event) => setForm({ ...form, feedbackAsk: event.target.value })}
                  maxLength={PITCH_ASK_MAX}
                  placeholder="e.g. Is our pricing believable for small shops?"
                  className="input-field mt-1.5 w-full text-sm"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={saving || !valid}
                  className="btn-secondary inline-flex items-center gap-1.5 px-3.5 py-2 text-xs disabled:opacity-50"
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save draft
                </button>
                {canPublish && (
                  <button
                    type="button"
                    onClick={() => void openPreview()}
                    disabled={saving || !valid || !businessPublished}
                    className="btn-primary inline-flex items-center gap-1.5 px-3.5 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Eye size={13} /> Preview and publish
                  </button>
                )}
                {canPublish && state.published && (
                  <button
                    type="button"
                    onClick={() => void withdraw()}
                    disabled={withdrawing}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
                  >
                    <Undo2 size={13} /> Withdraw
                  </button>
                )}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-xs text-slate-500 dark:text-zinc-400">Owners, admins and editors can write the pitch.</p>
          )}

          {message && (
            <p
              className={`mt-3 text-xs font-medium ${message.kind === "ok" ? "text-emerald-700 dark:text-emerald-300" : "text-rose-600 dark:text-rose-400"}`}
              role={message.kind === "error" ? "alert" : "status"}
            >
              {message.text}
            </p>
          )}
        </>
      )}

      <Dialog.Root open={Boolean(previewDraft)} onOpenChange={(open) => !open && setPreviewDraft(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
          <Dialog.Content
            className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl focus:outline-none dark:border-zinc-800 dark:bg-zinc-900"
            aria-describedby="pitch-preview-lead"
          >
            <div className="flex items-start justify-between gap-4">
              <Dialog.Title className="text-lg font-bold text-slate-900 dark:text-zinc-100">Publish this pitch?</Dialog.Title>
              <Dialog.Close className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800" aria-label="Close">
                <X size={18} />
              </Dialog.Close>
            </div>
            <Dialog.Description id="pitch-preview-lead" className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
              Exactly this will appear on {business.name}'s public profile and in Pitch Arena.
            </Dialog.Description>
            {previewDraft && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
                <p className="text-base font-extrabold text-slate-950 dark:text-white">{previewDraft.headline}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-zinc-300">{previewDraft.body}</p>
                {previewDraft.feedbackAsk && (
                  <p className="mt-3 text-xs text-slate-500 dark:text-zinc-400">
                    <span className="font-bold">Feedback wanted:</span> {previewDraft.feedbackAsk}
                  </p>
                )}
              </div>
            )}
            <label className="mt-4 flex items-start gap-2.5 text-sm text-slate-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={consented}
                onChange={(event) => setConsented(event.target.checked)}
                className="mt-1 accent-indigo-600"
              />
              <span>
                I want this pitch shown publicly and understand people can comment on it. It does not include anything from my private practice sessions, and I can withdraw it at any time.
              </span>
            </label>
            <button
              type="button"
              onClick={() => void confirmPublish()}
              disabled={!consented || publishing}
              className="btn-primary mt-5 flex w-full items-center justify-center gap-2 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {publishing && <Loader2 size={16} className="animate-spin" />} Publish pitch
            </button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
