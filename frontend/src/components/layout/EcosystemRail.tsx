import React, { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, Compass, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useEcosystemFeatures } from "../../hooks/useEcosystemFeatures";
import { fetchPublicBusinesses, type PublicBusinessSummary } from "../../api/publicBusinesses";
import { fetchOpportunities, type Opportunity } from "../../api/opportunities";
import { fetchPitches, type PitchSummary } from "../../api/pitches";
import { BusinessInitials } from "../discover/BusinessRow";

/**
 * The right-hand column on ecosystem pages (wide screens only). Every card
 * shows live data or a plain explanation; nothing here is invented.
 */

export type RailCard = "pitches" | "businesses" | "opportunities" | "connection";

// Pages share the rail; cache each request briefly so moving between pages
// doesn't refetch the same lists.
const cache = new Map<string, { at: number; promise: Promise<unknown> }>();
const CACHE_MS = 120_000;

function cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.promise as Promise<T>;
  const promise = loader().catch((error) => {
    cache.delete(key);
    throw error;
  });
  cache.set(key, { at: Date.now(), promise });
  return promise;
}

function useRailData<T>(key: string, enabled: boolean, loader: () => Promise<T>): T | null {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    cached(key, loader)
      .then((result) => {
        if (active) setData(result);
      })
      .catch(() => {
        if (active) setData(null);
      });
    return () => {
      active = false;
    };
  }, [key, enabled]);
  return data;
}

function RailCardShell({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="flex items-center gap-2 font-sans text-[13px] font-bold text-slate-950 dark:text-white">
        <Icon size={15} className="text-accent-text dark:text-accent" /> {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function closingLabel(opportunity: Opportunity) {
  if (opportunity.state === "rolling") return "Rolling";
  if (opportunity.state === "upcoming") return "Opens soon";
  if (opportunity.daysLeft !== null && opportunity.daysLeft >= 0) {
    return opportunity.daysLeft === 0 ? "Closes today" : `${opportunity.daysLeft} days left`;
  }
  return "Open";
}

export function EcosystemRail({ hide = [] }: { hide?: RailCard[] }) {
  const { user } = useAuth();
  const signedIn = Boolean(user && user.accountType !== "organization");
  const features = useEcosystemFeatures();
  const showPitches = features.pitchArena && !hide.includes("pitches");

  const pitches = useRailData<{ data: PitchSummary[] }>("pitches", showPitches, () => fetchPitches());
  const businesses = useRailData<{ data: PublicBusinessSummary[] }>(
    "businesses",
    !hide.includes("businesses"),
    () => fetchPublicBusinesses({ limit: 3 }),
  );
  const opportunities = useRailData<Opportunity[]>(
    "opportunities",
    !hide.includes("opportunities"),
    () => fetchOpportunities({}),
  );

  const latestPitch = pitches?.data?.[0] ?? null;
  const openOpportunities = (opportunities ?? []).filter((item) => item.state !== "closed").slice(0, 3);

  return (
    <aside className="hidden xl:block" aria-label="More from PitchNest">
      <div className="sticky top-24 space-y-4">
        {showPitches && (
          <section className="relative overflow-hidden rounded-2xl gradient-brand p-5 text-white">
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-accent/25 blur-2xl" />
            <p className="relative text-[10px] font-bold uppercase tracking-widest text-accent">Pitch Arena</p>
            <h2 className="relative mt-2 text-lg font-extrabold leading-snug">Show the pitch. Hear the questions.</h2>
            <p className="relative mt-2 text-xs leading-relaxed text-white/75">
              {latestPitch
                ? <>Latest: <span className="font-semibold text-white">{latestPitch.headline}</span> from {latestPitch.business.name}.</>
                : "Founders publish a short written pitch on purpose and ask for practical feedback."}
            </p>
            <Link to="/pitches" className="btn-accent relative mt-4 w-full px-4 py-2.5 text-xs">
              Explore Pitch Arena <ArrowRight size={14} />
            </Link>
          </section>
        )}

        {!hide.includes("businesses") && businesses && businesses.data.length > 0 && (
          <RailCardShell icon={Compass} title="Businesses to discover">
            <ul className="space-y-3">
              {businesses.data.map((business) => (
                <li key={business.slug}>
                  <Link to={`/businesses/${encodeURIComponent(business.slug)}`} className="group flex items-center gap-2.5">
                    <BusinessInitials name={business.name} slug={business.slug} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-bold text-slate-900 group-hover:text-indigo-600 dark:text-zinc-100 dark:group-hover:text-indigo-300">
                        {business.name}
                      </span>
                      <span className="block truncate text-[10px] text-slate-400">
                        {[business.industry, business.region].filter(Boolean).join(" · ") || "Founder-approved profile"}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link to="/discover" className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
              See all businesses <ArrowRight size={12} />
            </Link>
          </RailCardShell>
        )}

        {!hide.includes("opportunities") && openOpportunities.length > 0 && (
          <RailCardShell icon={CalendarDays} title="Open opportunities">
            <ul className="space-y-3">
              {openOpportunities.map((item) => (
                <li key={item.id} className="min-w-0">
                  <p className="truncate text-xs font-bold text-slate-900 dark:text-zinc-100">{item.title}</p>
                  <p className="mt-0.5 flex items-center justify-between gap-2 text-[10px] text-slate-400">
                    <span className="truncate">{item.organizer}</span>
                    <span className={item.state === "closing_soon" ? "shrink-0 font-bold text-accent-text dark:text-accent" : "shrink-0"}>
                      {closingLabel(item)}
                    </span>
                  </p>
                </li>
              ))}
            </ul>
            <Link to="/opportunities" className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
              Browse opportunities <ArrowRight size={12} />
            </Link>
          </RailCardShell>
        )}

        {!hide.includes("connection") && (
          <RailCardShell icon={Sparkles} title="The PitchNest connection">
            <ol className="space-y-2 text-[11px] leading-relaxed text-slate-500 dark:text-zinc-400">
              {[
                "Showcase your business in public.",
                "Collect questions and feedback.",
                "Practise tougher answers privately with AI.",
                "Come back with a stronger pitch.",
              ].map((step, index) => (
                <li key={step} className="flex gap-2">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[9px] font-extrabold text-accent-text dark:bg-accent/15 dark:text-accent">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <Link
              to={signedIn ? "/workspace/businesses" : "/signup"}
              className="btn-secondary mt-4 w-full px-3 py-2 text-xs"
            >
              {signedIn ? "Open your workspace" : "Create a free account"} <ArrowRight size={13} />
            </Link>
          </RailCardShell>
        )}
      </div>
    </aside>
  );
}

/** Main column plus the rail; the rail appears from 1280px wide. */
export function PageWithRail({ children, hide }: { children: React.ReactNode; hide?: RailCard[] }) {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 xl:grid-cols-[minmax(0,1fr)_288px]">
      <div className="min-w-0 space-y-6">{children}</div>
      <EcosystemRail hide={hide} />
    </div>
  );
}
