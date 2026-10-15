import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Compass,
  ExternalLink,
  Flag,
  Lightbulb,
  Loader2,
  MapPin,
  Mic,
  Presentation,
  Share2,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  fetchPublicBusiness,
  PublicBusinessApiError,
  type PublicBusinessProfile as PublicBusinessProfileType,
} from "../api/publicBusinesses";
import {
  fetchBusinessEngagement,
  fetchDiscoverFeatures,
  type BusinessEngagement,
} from "../api/discover";
import { EngagementBar, EngagementCounts } from "../components/discover/EngagementBar";
import { BusinessUpdatesFeed } from "../components/discover/BusinessUpdatesFeed";
import { createPracticeDraft } from "../api/practice";
import { BusinessDiscussion, type ComposeRequest } from "../components/discover/BusinessDiscussion";
import { PublicPitchSection } from "../components/discover/PublicPitchSection";
import { BusinessInitials } from "../components/discover/BusinessRow";
import { fetchPublicPitch, type FeedbackCategory, type PublicPitch } from "../api/pitches";
import { ReportDialog, type ReportTarget } from "../components/discover/ReportDialog";
import { useAuth } from "../contexts/AuthContext";
import { usePageMetadata } from "../hooks/usePageMetadata";
import { trackEvent } from "../lib/analytics";
import { cn } from "../lib/utils";

type Tab = "overview" | "updates" | "pitch" | "discussion";
const TAB_IDS: Tab[] = ["overview", "updates", "pitch", "discussion"];

function titleCase(value: string) {
  return value.replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(date);
}

function tabFromHash(hash: string): Tab {
  const id = hash.replace(/^#/, "");
  return (TAB_IDS as string[]).includes(id) ? (id as Tab) : "overview";
}

export default function PublicBusinessProfile() {
  const { slug = "" } = useParams<{ slug: string }>();
  const [business, setBusiness] = useState<PublicBusinessProfileType | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [error, setError] = useState("");
  const [shared, setShared] = useState(false);
  const { user, authFetch } = useAuth();
  const founder = user && user.accountType !== "organization" ? user : null;
  const navigate = useNavigate();
  const location = useLocation();
  const [featuresReady, setFeaturesReady] = useState(false);
  const [engagementEnabled, setEngagementEnabled] = useState(false);
  const [engagement, setEngagement] = useState<BusinessEngagement | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [pitchArenaEnabled, setPitchArenaEnabled] = useState(false);
  const [pitch, setPitch] = useState<PublicPitch | null>(null);
  const [composeRequest, setComposeRequest] = useState<ComposeRequest | null>(null);
  const [visited, setVisited] = useState<Set<Tab>>(() => new Set<Tab>(["overview"]));
  // Tab clicks change the hash too; only links from elsewhere should scroll.
  const tabClickRef = useRef(false);

  useEffect(() => {
    let active = true;
    void fetchDiscoverFeatures().then((features) => {
      if (!active) return;
      setEngagementEnabled(features.discoverEngagement);
      setPitchArenaEnabled(features.pitchArena);
      setFeaturesReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "overview", label: "Overview" },
    ...(engagementEnabled ? [{ id: "updates" as Tab, label: "Updates" }] : []),
    ...(pitchArenaEnabled ? [{ id: "pitch" as Tab, label: "Public pitch" }] : []),
    ...(engagementEnabled
      ? [{ id: "discussion" as Tab, label: engagement ? `Discussion · ${engagement.commentCount}` : "Discussion" }]
      : []),
  ];
  const requestedTab = tabFromHash(location.hash);
  const activeTab: Tab = tabs.some((tab) => tab.id === requestedTab) ? requestedTab : "overview";

  useEffect(() => {
    setVisited((current) => (current.has(activeTab) ? current : new Set(current).add(activeTab)));
  }, [activeTab]);

  const selectTab = (tab: Tab) => {
    tabClickRef.current = true;
    navigate(
      { pathname: location.pathname, search: location.search, hash: tab === "overview" ? "" : `#${tab}` },
      { replace: true },
    );
  };

  // Notification and Pitch Arena links arrive with #updates, #pitch or
  // #discussion: open that tab and bring the tabs into view.
  useEffect(() => {
    if (status !== "ready" || !featuresReady) return;
    if (tabClickRef.current) {
      tabClickRef.current = false;
      return;
    }
    if (!(TAB_IDS as string[]).includes(location.hash.replace(/^#/, ""))) return;
    const timer = window.setTimeout(() => {
      document.getElementById("profile-tabs")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [status, featuresReady, location.hash]);

  // The public pitch is optional: a missing pitch is simply not shown.
  useEffect(() => {
    setPitch(null);
    if (!pitchArenaEnabled || status !== "ready" || !business) return;
    const controller = new AbortController();
    fetchPublicPitch(business.slug, controller.signal)
      .then(setPitch)
      .catch(() => setPitch(null));
    return () => controller.abort();
  }, [pitchArenaEnabled, status, business?.slug]);

  const giveFeedback = (category: FeedbackCategory) => {
    if (!user) {
      navigate("/login", { state: { from: { pathname: location.pathname } } });
      return;
    }
    setComposeRequest({ category, nonce: Date.now() });
    selectTab("discussion");
  };

  // Engagement is personalised, so it reloads when the signed-in user changes.
  useEffect(() => {
    if (!engagementEnabled || status !== "ready" || !business) return;
    const controller = new AbortController();
    fetchBusinessEngagement(authFetch, business.slug, controller.signal)
      .then(setEngagement)
      .catch((requestError) => {
        if (requestError?.name !== "AbortError") setEngagement(null);
      });
    return () => controller.abort();
    // authFetch changes with the token, which changes with user?.id.
  }, [engagementEnabled, status, business?.slug, user?.id]);

  const openReport = (target: ReportTarget) => {
    if (!user) {
      navigate("/login", { state: { from: { pathname: location.pathname } } });
      return;
    }
    setReportTarget(target);
  };

  const adjustCommentCount = (delta: number) =>
    setEngagement((current) =>
      current ? { ...current, commentCount: Math.max(0, current.commentCount + delta) } : current,
    );

  // Members turn a community question into a private rehearsal. The server
  // takes the question text from the stored comment, never from this page.
  const practiseComment = async (commentId: string) => {
    if (!business) return;
    const draft = await createPracticeDraft(authFetch, {
      businessSlug: business.slug,
      mode: "panel",
      sourceCommentId: commentId,
    });
    navigate(`/setup?draft=${encodeURIComponent(draft.id)}`);
  };

  usePageMetadata({
    title: business ? `${business.name} — PitchNest` : status === "missing" ? "Business not found — PitchNest" : "Business profile — PitchNest",
    description: business?.tagline || business?.description || "Explore a founder-approved business profile on PitchNest.",
    path: `/businesses/${encodeURIComponent(slug)}`,
    robots: status === "ready" ? "index, follow" : "noindex, follow",
  });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    if (!slug) {
      setStatus("missing");
      return;
    }
    const controller = new AbortController();
    setStatus("loading");
    setError("");
    setBusiness(null);
    fetchPublicBusiness(slug, controller.signal)
      .then((result) => {
        setBusiness(result);
        setStatus("ready");
        trackEvent({ name: "business_profile_opened", properties: { slug: result.slug } });
      })
      .catch((requestError) => {
        if (requestError?.name === "AbortError") return;
        if (requestError instanceof PublicBusinessApiError && requestError.status === 404) {
          setStatus("missing");
          return;
        }
        setError(requestError instanceof Error ? requestError.message : "Could not load this business.");
        setStatus("error");
      });
    return () => controller.abort();
  }, [slug]);

  useEffect(() => {
    if (!business) return;
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute("data-business-profile", "true");
    script.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: business.name,
      description: business.description || business.tagline,
      url: business.websiteUrl || `https://www.pitchnest.app/businesses/${business.slug}`,
      areaServed: business.region || undefined,
      industry: business.industry || undefined,
    });
    document.head.appendChild(script);
    return () => script.remove();
  }, [business]);

  const share = async () => {
    if (!business) return;
    const url = `${window.location.origin}/businesses/${encodeURIComponent(business.slug)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: business.name, text: business.tagline, url });
      } else {
        await navigator.clipboard.writeText(url);
        setShared(true);
        window.setTimeout(() => setShared(false), 2500);
      }
    } catch (shareError: any) {
      if (shareError?.name !== "AbortError") {
        setShared(false);
      }
    }
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <div className="text-center text-slate-400 dark:text-zinc-500">
          <Loader2 size={28} className="mx-auto animate-spin" />
          <p className="mt-3 text-sm font-medium">Loading public profile…</p>
        </div>
      </div>
    );
  }

  if (status !== "ready" || !business) {
    return (
      <div className="mx-auto flex min-h-[55vh] max-w-xl items-center">
        <div className="w-full rounded-3xl border border-slate-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900 sm:p-10">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-500">
            <Building2 size={26} />
          </span>
          <h1 className="mt-5 text-2xl font-extrabold text-slate-950 dark:text-white">
            {status === "missing" ? "Business not available" : "We couldn't load this profile"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-zinc-400">
            {status === "missing" ? "This profile may be private, unpublished, or no longer available." : error}
          </p>
          <Link to="/discover" className="btn-primary mt-6 inline-flex items-center gap-2 px-5 py-2.5 text-sm">
            <Compass size={16} /> Explore businesses
          </Link>
        </div>
      </div>
    );
  }

  const panelClass = (tab: Tab) => (activeTab === tab ? "" : "hidden");

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <Link
        to="/discover"
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:text-slate-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:text-white"
      >
        <ArrowLeft size={14} /> Back to Discover
      </Link>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <BusinessInitials name={business.name} slug={business.slug} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-3xl">{business.name}</h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                <CheckCircle2 size={11} /> Founder published
              </span>
              {pitch && (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-[10px] font-bold text-accent-text dark:bg-accent/10 dark:text-accent">
                  <Presentation size={11} /> Public pitch
                </span>
              )}
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-zinc-300 sm:text-base">{business.tagline}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold">
              <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                {titleCase(business.businessType)}
              </span>
              {business.industry && (
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">{business.industry}</span>
              )}
              {business.stage && (
                <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                  <Sparkles size={11} /> {business.stage}
                </span>
              )}
              {business.region && (
                <span className="inline-flex items-center gap-1 text-slate-400"><MapPin size={12} /> {business.region}</span>
              )}
              {business.publishedAt && (
                <span className="inline-flex items-center gap-1 text-slate-400"><ShieldCheck size={12} /> Published {formatDate(business.publishedAt)}</span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-start gap-2 border-t border-slate-100 pt-5 dark:border-zinc-800">
          {engagementEnabled && engagement && (
            <EngagementBar slug={business.slug} engagement={engagement} onChange={setEngagement} />
          )}
          <button
            type="button"
            onClick={() => void share()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-indigo-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          >
            {shared ? <Check size={16} /> : <Share2 size={16} />} {shared ? "Link copied" : "Share"}
          </button>
          {business.websiteUrl && (
            <a
              href={business.websiteUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-indigo-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            >
              Website <ExternalLink size={15} />
            </a>
          )}
          <Link
            to={founder ? "/setup" : "/signup"}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-slate-500 transition hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-300"
          >
            <Mic size={15} /> Practise your own pitch
          </Link>
        </div>
        {engagementEnabled && engagement && (
          <div className="mt-3">
            <EngagementCounts engagement={engagement} />
          </div>
        )}
      </section>

      {tabs.length > 1 && (
        <div
          id="profile-tabs"
          role="tablist"
          aria-label="Profile sections"
          className="flex scroll-mt-24 gap-1 overflow-x-auto border-b border-slate-200 dark:border-zinc-800"
        >
          {tabs.map((tab) => {
            const active = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={active}
                aria-controls={`panel-${tab.id}`}
                onClick={() => selectTab(tab.id)}
                className={cn(
                  "relative shrink-0 whitespace-nowrap px-4 py-3 text-sm transition",
                  active
                    ? "font-bold text-slate-950 after:absolute after:inset-x-3 after:-bottom-px after:h-[3px] after:rounded-full after:bg-accent-strong dark:text-white dark:after:bg-accent"
                    : "font-semibold text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200",
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      <div role="tabpanel" id="panel-overview" aria-labelledby="tab-overview" className={panelClass("overview")}>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-5">
            <ProfileSection icon={Building2} eyebrow="About" title="What we do" value={business.description} />
            <div className="grid gap-5 md:grid-cols-2">
              <ProfileSection icon={Lightbulb} eyebrow="The problem" title="What needs to change" value={business.problem} compact />
              <ProfileSection icon={Sparkles} eyebrow="The solution" title="How they approach it" value={business.solution} compact />
            </div>
            <ProfileSection icon={Target} eyebrow="Customer" title="Who this is built for" value={business.targetCustomer} />
          </div>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-sm font-bold text-slate-950 dark:text-white">Business details</h2>
              <dl className="mt-4 space-y-4">
                <Detail label="Type" value={titleCase(business.businessType)} />
                <Detail label="Industry" value={business.industry} />
                <Detail label="Stage" value={business.stage} />
                <Detail label="Region" value={business.region} />
              </dl>
            </section>

            {pitch && activeTab === "overview" && (
              <button
                type="button"
                onClick={() => selectTab("pitch")}
                className="flex w-full items-center gap-3 rounded-2xl border border-accent-strong/40 bg-accent-soft p-4 text-left transition hover:border-accent-strong dark:border-accent/25 dark:bg-accent/5"
              >
                <Presentation size={18} className="shrink-0 text-accent-text dark:text-accent" />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold text-slate-900 dark:text-zinc-100">Read their public pitch</span>
                  <span className="block truncate text-[11px] text-slate-500 dark:text-zinc-400">{pitch.headline}</span>
                </span>
                <ArrowRight size={14} className="shrink-0 text-slate-400" />
              </button>
            )}

            <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 dark:border-indigo-900/50 dark:bg-indigo-950/20">
              <div className="flex items-start gap-3">
                <ShieldCheck size={19} className="mt-0.5 shrink-0 text-indigo-600 dark:text-indigo-400" />
                <div>
                  <h2 className="text-sm font-bold text-slate-950 dark:text-white">Founder-controlled profile</h2>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-zinc-400">This page contains only business information reviewed and published by an authorized workspace member.</p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/30 dark:text-sky-300"><Users size={17} /></div>
              <h2 className="mt-3 text-sm font-bold text-slate-950 dark:text-white">Building something too?</h2>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-zinc-400">Create a private profile, practice your pitch, and publish when you're ready.</p>
              <Link to={founder ? "/workspace/businesses?new=1" : "/signup"} className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">
                Showcase your business <ArrowRight size={14} />
              </Link>
            </section>

            {engagementEnabled && (
              <button
                type="button"
                onClick={() => openReport({ entityType: "business", slug: business.slug, label: "this profile" })}
                className="inline-flex items-center gap-1.5 px-1 text-xs font-semibold text-slate-400 transition hover:text-rose-600"
              >
                <Flag size={13} /> Report this profile
              </button>
            )}
          </aside>
        </div>
      </div>

      {engagementEnabled && visited.has("updates") && (
        <div role="tabpanel" id="panel-updates" aria-labelledby="tab-updates" className={panelClass("updates")}>
          <BusinessUpdatesFeed slug={business.slug} />
        </div>
      )}

      {pitchArenaEnabled && visited.has("pitch") && (
        <div role="tabpanel" id="panel-pitch" aria-labelledby="tab-pitch" className={panelClass("pitch")}>
          {pitch ? (
            <PublicPitchSection
              pitch={pitch}
              businessName={business.name}
              feedbackEnabled={engagementEnabled}
              onGiveFeedback={giveFeedback}
              onReport={() => openReport({ entityType: "pitch", slug: business.slug, label: "this pitch" })}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900/70">
              <Presentation size={24} className="mx-auto text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-zinc-200">No public pitch shared</p>
              <p className="mx-auto mt-1 max-w-md text-xs text-slate-500 dark:text-zinc-400">
                {business.name} hasn't published a pitch. You can still explore the profile, support them, and ask questions.
              </p>
            </div>
          )}
        </div>
      )}

      {engagementEnabled && visited.has("discussion") && (
        <div role="tabpanel" id="panel-discussion" aria-labelledby="tab-discussion" className={panelClass("discussion")}>
          <BusinessDiscussion
            slug={business.slug}
            businessName={business.name}
            onCommentCountChange={adjustCommentCount}
            onReport={openReport}
            viewerIsMember={engagement?.viewer?.isMember === true}
            onPractise={practiseComment}
            pitchAvailable={Boolean(pitch)}
            composeRequest={composeRequest}
          />
        </div>
      )}

      <ReportDialog target={reportTarget} onClose={() => setReportTarget(null)} />
    </div>
  );
}

function ProfileSection({
  icon: Icon,
  eyebrow,
  title,
  value,
  compact = false,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  eyebrow: string;
  title: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="eyebrow"><Icon size={14} /> {eyebrow}</p>
      <h2 className="mt-2.5 text-lg font-extrabold text-slate-950 dark:text-white">{title}</h2>
      <p className={`mt-2.5 whitespace-pre-wrap text-sm leading-7 ${value ? "text-slate-600 dark:text-zinc-300" : "italic text-slate-400 dark:text-zinc-600"}`}>
        {value || (compact ? "Not shared yet." : "This business has not shared this part of its story yet.")}
      </p>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3 last:border-0 last:pb-0 dark:border-zinc-800">
      <dt className="text-xs font-medium text-slate-400">{label}</dt>
      <dd className="text-right text-xs font-bold text-slate-700 dark:text-zinc-200">{value || "Not shared"}</dd>
    </div>
  );
}
