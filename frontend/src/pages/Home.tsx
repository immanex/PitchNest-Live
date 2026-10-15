import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Compass,
  MessageSquare,
  Mic,
  Presentation,
  Sparkles,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useEcosystemFeatures } from "../hooks/useEcosystemFeatures";
import { usePageMetadata } from "../hooks/usePageMetadata";
import { PageWithRail } from "../components/layout/EcosystemRail";
import { SectionTitle } from "../components/layout/PageHero";
import { BusinessList, BusinessRow, BusinessRowSkeleton } from "../components/discover/BusinessRow";
import { OpportunityCard } from "../components/opportunities/OpportunityCard";
import { fetchPublicBusinesses, type PublicBusinessSummary } from "../api/publicBusinesses";
import { fetchPitches, type PitchSummary } from "../api/pitches";
import { fetchThreads, TOPIC_LABELS, type ThreadSummary } from "../api/community";
import { fetchOpportunities, type Opportunity } from "../api/opportunities";

/** The in-app home feed: a little of everything happening on PitchNest. */
export default function Home() {
  const { user, authFetch } = useAuth();
  const founder = user && user.accountType !== "organization" ? user : null;
  const features = useEcosystemFeatures();
  const [businesses, setBusinesses] = useState<PublicBusinessSummary[] | null>(null);
  const [businessError, setBusinessError] = useState(false);
  const [pitch, setPitch] = useState<PitchSummary | null>(null);
  const [thread, setThread] = useState<ThreadSummary | null>(null);
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);

  usePageMetadata({
    title: "Home — PitchNest",
    description: "Discover founders, give pitch feedback, join founder conversations and find opportunities on PitchNest.",
    path: "/home",
    // The marketing landing page at "/" is the page to index.
    robots: "noindex, follow",
  });

  useEffect(() => {
    const controller = new AbortController();
    fetchPublicBusinesses({ limit: 5 }, controller.signal)
      .then((page) => setBusinesses(page.data))
      .catch((error) => {
        if (error?.name === "AbortError") return;
        setBusinesses([]);
        setBusinessError(true);
      });
    fetchOpportunities({}, controller.signal)
      .then((items) => setOpportunity(items.find((item) => item.state !== "closed") ?? null))
      .catch(() => setOpportunity(null));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!features.pitchArena) return;
    const controller = new AbortController();
    fetchPitches(null, controller.signal)
      .then((page) => setPitch(page.data[0] ?? null))
      .catch(() => setPitch(null));
    return () => controller.abort();
  }, [features.pitchArena]);

  useEffect(() => {
    if (!features.community) return;
    const controller = new AbortController();
    fetchThreads(authFetch, {}, controller.signal)
      .then((page) => setThread(page.data[0] ?? null))
      .catch(() => setThread(null));
    return () => controller.abort();
    // authFetch changes with the token; one load per visit is enough.
  }, [features.community]);

  const firstName = founder?.name?.trim().split(/\s+/)[0] || "";

  return (
    // The feed already lists businesses, so the rail skips that card here.
    <PageWithRail hide={["businesses"]}>
      <section className="relative overflow-hidden rounded-3xl gradient-brand text-white shadow-xl shadow-indigo-500/15">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-1/4 h-40 w-40 rounded-full bg-accent/25 blur-3xl" />
        <div className="relative grid gap-6 p-6 sm:p-8 md:grid-cols-[minmax(0,1fr)_220px] md:items-center lg:p-10">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-accent">
              {firstName ? `Welcome back, ${firstName}` : "The founder ecosystem"}
            </p>
            <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Great businesses deserve <span className="text-accent">to be discovered.</span>
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/80">
              Explore businesses beyond software. Share what you're building, grow with other founders, and sharpen your investor pitch with AI.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/discover" className="btn-accent px-5 py-2.5 text-sm">
                Explore businesses <ArrowRight size={16} />
              </Link>
              <Link
                to={founder ? "/setup" : "/signup"}
                className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                Practice with AI <Mic size={16} />
              </Link>
            </div>
          </div>
          <div className="relative hidden h-44 md:block" aria-hidden="true">
            <div className="absolute left-2 top-2 flex h-11 w-11 -rotate-12 items-center justify-center rounded-2xl border border-white/30 bg-white/15 text-accent backdrop-blur">
              <Sparkles size={20} />
            </div>
            <div className="absolute bottom-2 right-0 w-48 rotate-6 rounded-2xl border border-white/60 bg-white p-4 text-slate-900 shadow-2xl">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Pitch improvement</p>
              <p className="mt-1.5 text-sm font-extrabold leading-snug">Every answer gets stronger.</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full w-3/4 rounded-full bg-accent-strong" />
              </div>
              <p className="mt-2 text-[9px] text-slate-400">Practise privately · share intentionally</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { to: "/discover", icon: Compass, title: "Discover founders", text: "Across every industry", tone: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300" },
          { to: founder ? "/setup" : "/signup", icon: Mic, title: "Prepare with AI", text: "Your private practice room", tone: "bg-accent-soft text-accent-text dark:bg-accent/10 dark:text-accent" },
          {
            to: features.community ? "/community" : "/opportunities",
            icon: Users,
            title: "Grow together",
            text: "Feedback and opportunities",
            tone: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300",
          },
        ].map(({ to, icon: Icon, title, text, tone }) => (
          <Link
            key={title}
            to={to}
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-indigo-200 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-800"
          >
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}><Icon size={18} /></span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-slate-900 dark:text-zinc-100">{title}</span>
              <span className="block text-[11px] text-slate-500 dark:text-zinc-400">{text}</span>
            </span>
          </Link>
        ))}
      </div>

      <section className="space-y-4">
        <SectionTitle
          title="Businesses to discover"
          description="Support founders, explore ideas and follow their progress."
          to="/discover"
        />
        {businesses === null ? (
          <BusinessList label="Loading businesses">
            {Array.from({ length: 3 }).map((_, index) => <BusinessRowSkeleton key={index} />)}
          </BusinessList>
        ) : businesses.length > 0 ? (
          <BusinessList label="Businesses to discover">
            {businesses.map((business, index) => (
              <BusinessRow key={business.slug} business={business} rank={index + 1} />
            ))}
          </BusinessList>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center dark:border-zinc-700 dark:bg-zinc-900/70">
            <p className="text-sm font-semibold text-slate-700 dark:text-zinc-200">
              {businessError ? "Businesses couldn't load right now." : "No businesses are public yet."}
            </p>
            <Link to={founder ? "/workspace/businesses?new=1" : "/signup"} className="btn-accent mt-4 px-4 py-2 text-xs">
              Showcase your business
            </Link>
          </div>
        )}
      </section>

      {features.pitchArena && (
        <section className="space-y-4">
          <SectionTitle
            title="Pitch Arena"
            description="Public pitches are written on purpose, never taken from private AI practice."
            to="/pitches"
            linkLabel="See pitches"
          />
          <div className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-center">
            <div className="relative flex h-28 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 via-sky-600 to-teal-500 text-white sm:w-36">
              <Presentation size={38} />
              <span className="absolute bottom-2 right-2 rounded-md bg-black/25 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide">Public pitch</span>
            </div>
            <div className="min-w-0">
              <p className="eyebrow">{pitch ? "Latest public pitch" : "Founder spotlight"}</p>
              <h3 className="mt-1.5 text-lg font-extrabold leading-snug text-slate-950 dark:text-white">
                {pitch ? pitch.headline : "How clearly can you explain your business in 60 seconds?"}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
                {pitch
                  ? `From ${pitch.business.name}${pitch.feedbackAsk ? `. They want feedback on: ${pitch.feedbackAsk}` : "."}`
                  : "Give structured feedback, ask a hard question, or take that question into a private rehearsal."}
              </p>
              <Link
                to={pitch ? `/businesses/${encodeURIComponent(pitch.business.slug)}#pitch` : "/pitches"}
                className="btn-primary mt-3 px-4 py-2 text-xs"
              >
                {pitch ? "Give feedback" : "Explore public pitches"} <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </section>
      )}

      {features.community && (
        <section className="space-y-4">
          <SectionTitle
            title="Founder conversations"
            description="Practical questions from people building real businesses."
            to="/community"
          />
          {thread ? (
            <Link
              to={`/community/${thread.id}`}
              className="group block rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-indigo-200 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-800"
            >
              <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                {TOPIC_LABELS[thread.topic]}
              </span>
              <h3 className="mt-2 text-base font-extrabold text-slate-950 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-300">
                {thread.title}
              </h3>
              <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-zinc-400">{thread.excerpt}</p>
              <p className="mt-3 flex flex-wrap items-center gap-4 text-[11px] font-medium text-slate-400">
                <span>By {thread.author.name}</span>
                <span className="inline-flex items-center gap-1"><MessageSquare size={12} /> {thread.replyCount} {thread.replyCount === 1 ? "reply" : "replies"}</span>
                <span className="ml-auto inline-flex items-center gap-1 font-bold text-indigo-600 dark:text-indigo-400">Join discussion <ArrowRight size={12} /></span>
              </p>
            </Link>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-400">
              No discussions yet.{" "}
              <Link to="/community" className="font-bold text-indigo-600 dark:text-indigo-400">Start the first one</Link>
            </div>
          )}
        </section>
      )}

      <section className="space-y-4">
        <SectionTitle
          title="Opportunities & programmes"
          description="Accelerators, grants, competitions and events, linked to official sources."
          to="/opportunities"
        />
        {opportunity ? (
          <OpportunityCard opportunity={opportunity} />
        ) : (
          <div className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-400">
            <CalendarDays size={18} className="shrink-0 text-slate-300" />
            New opportunities are being curated. Check back soon.
          </div>
        )}
      </section>
    </PageWithRail>
  );
}
