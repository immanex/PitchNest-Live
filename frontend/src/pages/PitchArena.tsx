import React, { useEffect, useState } from "react";
import { ArrowRight, Loader2, Lock, MapPin, MessageSquarePlus, Presentation, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { usePageMetadata } from "../hooks/usePageMetadata";
import { fetchDiscoverFeatures } from "../api/discover";
import { fetchPitches, type PitchSummary } from "../api/pitches";
import { trackEvent } from "../lib/analytics";
import { PageHero, SectionTitle } from "../components/layout/PageHero";
import { BusinessInitials } from "../components/discover/BusinessRow";

function formatDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(date);
}

export default function PitchArena() {
  const { user } = useAuth();
  const founder = Boolean(user && user.accountType !== "organization");
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [pitches, setPitches] = useState<PitchSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadingMore, setLoadingMore] = useState(false);

  usePageMetadata({
    title: "Pitch Arena — PitchNest",
    description: "Read short pitches from founders and give them structured, practical feedback.",
    path: "/pitches",
    robots: enabled ? "index, follow" : "noindex, follow",
  });

  useEffect(() => {
    let active = true;
    void fetchDiscoverFeatures().then((features) => {
      if (!active) return;
      setEnabled(features.pitchArena);
      if (features.pitchArena) trackEvent({ name: "pitch_arena_viewed" });
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setStatus("loading");
    fetchPitches(null, controller.signal)
      .then((page) => {
        setPitches(page.data);
        setNextCursor(page.pagination.hasMore ? page.pagination.nextCursor : null);
        setStatus("ready");
      })
      .catch((error) => {
        if (error?.name !== "AbortError") setStatus("error");
      });
    return () => controller.abort();
  }, [enabled]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchPitches(nextCursor);
      setPitches((current) => {
        const known = new Set(current.map((pitch) => pitch.business.slug));
        return [...current, ...page.data.filter((pitch) => !known.has(pitch.business.slug))];
      });
      setNextCursor(page.pagination.hasMore ? page.pagination.nextCursor : null);
    } catch {
      // Leave the button available to retry.
    } finally {
      setLoadingMore(false);
    }
  };

  if (enabled === false) {
    return (
      <div className="mx-auto flex min-h-[55vh] max-w-xl items-center">
        <div className="w-full rounded-3xl border border-slate-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <Presentation size={28} className="mx-auto text-accent-text dark:text-accent" />
          <h1 className="mt-4 text-2xl font-extrabold text-slate-950 dark:text-white">Pitch Arena is coming soon</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
            Founders will share short pitches here for structured feedback. In the meantime, explore businesses on Discover.
          </p>
          <Link to="/discover" className="btn-primary mt-6 inline-flex items-center gap-2 px-5 py-2.5 text-sm">
            Explore Discover <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <PageHero
        icon={Presentation}
        eyebrow="Pitch Arena"
        title="Show the pitch. Hear the questions."
        description="Founders choose to publish a short written pitch for public feedback. AI rehearsal recordings and private reports are never shown here."
      />

      <section className="flex flex-col gap-4 rounded-2xl border border-accent-strong/40 bg-accent-soft p-5 dark:border-accent/25 dark:bg-accent/5 sm:flex-row sm:items-center">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-ink">
          <Trophy size={26} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">The 60-second clarity pitch</p>
          <h2 className="mt-1 text-base font-extrabold text-slate-950 dark:text-white">Who are your customers? What problem do you solve? Why now?</h2>
          <p className="mt-1 text-xs text-slate-600 dark:text-zinc-400">
            Answer those three in a short written pitch and ask the community for one kind of feedback. Publishing is always optional.
          </p>
        </div>
        <Link
          to={founder ? "/workspace/businesses#public-pitch" : "/signup"}
          className="btn-accent shrink-0 px-4 py-2.5 text-sm"
        >
          Share your pitch <ArrowRight size={15} />
        </Link>
      </section>

      <section className="space-y-4" aria-live="polite">
        <SectionTitle
          title="Founder pitches"
          description="Newest first. Open a pitch to give structured feedback."
        />
        {(status === "loading" || enabled === null) && (
          <p className="flex items-center gap-2 py-10 text-sm text-slate-400">
            <Loader2 size={16} className="animate-spin" /> Loading pitches…
          </p>
        )}
        {enabled && status === "error" && (
          <p className="py-10 text-sm text-slate-500 dark:text-zinc-400">Pitches couldn't load. Please try again.</p>
        )}
        {enabled && status === "ready" && pitches.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <Presentation size={24} className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-zinc-200">No public pitches yet.</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
              Founders can publish one from their{" "}
              <Link to="/workspace/businesses" className="font-bold text-indigo-600 dark:text-indigo-400">business workspace</Link>.
            </p>
          </div>
        )}
        {enabled && status === "ready" && pitches.length > 0 && (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pitches.map((pitch) => (
              <li key={pitch.business.slug}>
                <Link
                  to={`/businesses/${encodeURIComponent(pitch.business.slug)}#pitch`}
                  className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-500/5 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-800"
                >
                  <div className="flex items-center gap-2.5">
                    <BusinessInitials name={pitch.business.name} slug={pitch.business.slug} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-slate-800 dark:text-zinc-200">{pitch.business.name}</p>
                      <p className="flex items-center gap-1 truncate text-[10px] text-slate-400">
                        {pitch.business.industry}
                        {pitch.business.region && <><MapPin size={10} className="ml-1" /> {pitch.business.region}</>}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold text-accent-text dark:bg-accent/10 dark:text-accent">
                      Public pitch
                    </span>
                  </div>
                  <h3 className="mt-3 text-base font-extrabold leading-snug text-slate-950 transition group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-300">
                    {pitch.headline}
                  </h3>
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-500 dark:text-zinc-400">{pitch.excerpt}</p>
                  {pitch.feedbackAsk && (
                    <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-zinc-800/60 dark:text-zinc-300">
                      <span className="font-bold">Wants feedback on:</span> {pitch.feedbackAsk}
                    </p>
                  )}
                  <div className="mt-auto flex items-center justify-between gap-3 pt-4 text-[11px] font-medium text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <MessageSquarePlus size={12} /> {pitch.feedbackCount} feedback
                    </span>
                    <span>{formatDate(pitch.publishedAt)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {enabled && nextCursor && status === "ready" && (
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="btn-secondary inline-flex w-full items-center justify-center gap-2 py-2.5 text-sm"
          >
            {loadingMore && <Loader2 size={15} className="animate-spin" />} Show more pitches
          </button>
        )}
      </section>

      <p className="flex items-start gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        <Lock size={14} className="mt-0.5 shrink-0 text-slate-400" />
        <span>
          <strong className="text-slate-800 dark:text-zinc-200">Privacy rule:</strong> a private rehearsal, transcript, deck, AI score or recording
          never reaches Pitch Arena. A pitch appears here only after its founder writes it, previews it and agrees to publish it.
        </span>
      </p>
    </div>
  );
}
