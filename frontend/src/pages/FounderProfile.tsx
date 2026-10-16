import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Bell, BellOff, Check, Compass, Loader2, Settings2, Share2, UserRound } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useEcosystemFeatures } from "../hooks/useEcosystemFeatures";
import { usePageMetadata } from "../hooks/usePageMetadata";
import { BusinessCard } from "../components/discover/BusinessCard";
import { UserAvatar } from "../components/ui/UserAvatar";
import { fetchFounder, setFounderFollow, FounderApiError, type PublicFounder } from "../api/founders";

function FounderAvatar({ name, url }: { name: string; url: string | null }) {
  return <UserAvatar name={name} avatarUrl={url} size={96} className="ring-4 ring-white shadow-md dark:ring-zinc-900" />;
}

/**
 * A founder's public page: who they are and the published businesses they
 * chose to appear on. Nothing else about the person is shown.
 */
export default function FounderProfile() {
  const { handle = "" } = useParams();
  const { authFetch, user } = useAuth();
  const features = useEcosystemFeatures();
  const [founder, setFounder] = useState<PublicFounder | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  usePageMetadata({
    title: founder ? `${founder.name} — PitchNest` : "Founder — PitchNest",
    description: founder
      ? `${founder.name} is building ${founder.businesses.map((b) => b.name).join(", ")} on PitchNest.`
      : "A founder on PitchNest.",
    path: `/founders/${handle}`,
    // People's pages stay out of search engines unless we decide otherwise.
    robots: "noindex, follow",
  });

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    fetchFounder(authFetch, handle, controller.signal)
      .then((data) => {
        setFounder(data);
        setFollowing(data.viewer.follows);
        setStatus("ready");
      })
      .catch((error) => {
        if (error?.name === "AbortError") return;
        setStatus(error instanceof FounderApiError && error.status === 404 ? "missing" : "error");
      });
    return () => controller.abort();
  }, [authFetch, handle, user?.id]);

  const toggleFollow = async () => {
    if (!founder) return;
    setBusy(true);
    setMessage("");
    try {
      const next = await setFounderFollow(authFetch, founder.handle, !following);
      setFollowing(next);
      setMessage(next ? `You'll hear when ${founder.name.split(" ")[0]} posts an update or appears on a new business.` : "");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-400">
        <Loader2 size={26} className="animate-spin" />
      </div>
    );
  }

  if (status !== "ready" || !founder) {
    return (
      <div className="mx-auto flex min-h-[55vh] max-w-xl items-center">
        <div className="w-full rounded-3xl border border-slate-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900 sm:p-10">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-500">
            <UserRound size={26} />
          </span>
          <h1 className="mt-5 text-2xl font-extrabold text-slate-950 dark:text-white">
            {status === "missing" ? "Founder not available" : "We couldn't load this page"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-zinc-400">
            {status === "missing"
              ? "This founder isn't shown publicly right now."
              : "Please try again in a moment."}
          </p>
          <Link to="/discover" className="btn-primary mt-6 inline-flex items-center gap-2 px-5 py-2.5 text-sm">
            <Compass size={16} /> Explore businesses
          </Link>
        </div>
      </div>
    );
  }

  const firstName = founder.name.split(" ")[0];
  const building =
    founder.businesses.length === 1 ? `Building ${founder.businesses[0].name}` : `Building ${founder.businesses.length} businesses`;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <Link
        to="/discover"
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:text-slate-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:text-white"
      >
        <ArrowLeft size={14} /> Back to Discover
      </Link>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="h-24 bg-linear-to-br from-indigo-600 via-violet-600 to-sky-500 sm:h-28" />
        <div className="px-5 pb-6 sm:px-7">
          <div className="-mt-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <FounderAvatar name={founder.name} url={founder.avatarUrl} />
            <div className="flex flex-wrap gap-2">
              {founder.viewer.isSelf ? (
                <Link
                  to="/workspace/businesses"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-indigo-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                >
                  <Settings2 size={16} /> Manage visibility
                </Link>
              ) : features.discoverEngagement && (
                founder.viewer.authenticated ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void toggleFollow()}
                    aria-pressed={following}
                    className={
                      following
                        ? "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-rose-200 hover:text-rose-600 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                        : "btn-accent px-4 py-2 text-sm disabled:opacity-50"
                    }
                  >
                    {busy ? <Loader2 size={16} className="animate-spin" /> : following ? <BellOff size={16} /> : <Bell size={16} />}
                    {following ? "Following" : `Follow ${firstName}`}
                  </button>
                ) : (
                  <Link to="/login" className="btn-accent px-4 py-2 text-sm">
                    <Bell size={16} /> Log in to follow
                  </Link>
                )
              )}
              <button
                type="button"
                onClick={() => void share()}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-indigo-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              >
                {copied ? <Check size={16} /> : <Share2 size={16} />} {copied ? "Link copied" : "Share"}
              </button>
            </div>
          </div>

          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-3xl">{founder.name}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">Founder on PitchNest · {building}</p>
          {founder.viewer.isSelf && founder.viewer.followerCount !== null && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
              {founder.viewer.followerCount} {founder.viewer.followerCount === 1 ? "follower" : "followers"} · only you can see this
            </p>
          )}
          {message && <p className="mt-3 text-xs text-slate-500 dark:text-zinc-400">{message}</p>}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-extrabold text-slate-950 dark:text-white">Businesses</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
          Published businesses {firstName} chose to appear on.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {founder.businesses.map((business) => (
            <div key={business.slug} className="flex flex-col gap-2">
              {business.title && (
                <p className="truncate px-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">{business.title}</p>
              )}
              <BusinessCard business={business} headingLevel="h3" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
