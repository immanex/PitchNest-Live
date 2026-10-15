import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  Filter,
  Loader2,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { PageHero } from "../components/layout/PageHero";
import { PageWithRail } from "../components/layout/EcosystemRail";
import { BusinessList, BusinessRow, BusinessRowSkeleton } from "../components/discover/BusinessRow";
import {
  fetchPublicBusinesses,
  type PublicBusinessSummary,
  type PublicBusinessType,
  type PublicDirectoryFilters,
} from "../api/publicBusinesses";
import { cn } from "../lib/utils";
import { usePageMetadata } from "../hooks/usePageMetadata";
import { trackEvent } from "../lib/analytics";

const businessTypes: Array<{ value: PublicBusinessType | ""; label: string }> = [
  { value: "", label: "All types" },
  { value: "software", label: "Software" },
  { value: "services", label: "Services" },
  { value: "physical", label: "Physical products" },
  { value: "traditional", label: "Traditional" },
  { value: "other", label: "Other" },
];

const fieldClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600";

interface DraftFilters {
  q: string;
  type: PublicBusinessType | "";
  industry: string;
  stage: string;
  region: string;
}

export default function Discover() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filterKey = searchParams.toString();
  const filters = useMemo<PublicDirectoryFilters>(() => ({
    q: searchParams.get("q") || "",
    type: (searchParams.get("type") || "") as PublicBusinessType | "",
    industry: searchParams.get("industry") || "",
    stage: searchParams.get("stage") || "",
    region: searchParams.get("region") || "",
  }), [filterKey]);
  const [draft, setDraft] = useState<DraftFilters>(filters as DraftFilters);
  const [businesses, setBusinesses] = useState<PublicBusinessSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    trackEvent({ name: "discover_viewed" });
  }, []);

  usePageMetadata({
    title: "Discover businesses — PitchNest",
    description: "Discover founder-approved business profiles across software, services, physical products, and traditional industries on PitchNest.",
    path: filterKey ? `/discover?${filterKey}` : "/discover",
  });

  useEffect(() => {
    setDraft(filters as DraftFilters);
    const controller = new AbortController();
    setStatus("loading");
    setError("");
    fetchPublicBusinesses({ ...filters, limit: 12 }, controller.signal)
      .then((page) => {
        setBusinesses(page.data);
        setNextCursor(page.pagination.nextCursor);
        setStatus("ready");
      })
      .catch((requestError) => {
        if (requestError?.name === "AbortError") return;
        setBusinesses([]);
        setNextCursor(null);
        setError(requestError instanceof Error ? requestError.message : "Could not load businesses.");
        setStatus("error");
      });
    return () => controller.abort();
  }, [filterKey, retryKey]);

  const applyFilters = (event: React.FormEvent) => {
    event.preventDefault();
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(draft)) {
      const clean = value.trim();
      if (clean) next.set(key, clean);
    }
    setSearchParams(next);
  };

  const selectType = (type: PublicBusinessType | "") => {
    setDraft((current) => ({ ...current, type }));
    const next = new URLSearchParams(searchParams);
    if (type) next.set("type", type);
    else next.delete("type");
    setSearchParams(next);
  };

  const clearFilters = () => {
    setDraft({ q: "", type: "", industry: "", stage: "", region: "" });
    setSearchParams({});
  };

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchPublicBusinesses({ ...filters, cursor: nextCursor, limit: 12 });
      setBusinesses((current) => {
        const known = new Set(current.map((business) => business.slug));
        return [...current, ...page.data.filter((business) => !known.has(business.slug))];
      });
      setNextCursor(page.pagination.nextCursor);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load more businesses.");
    } finally {
      setLoadingMore(false);
    }
  };

  const activeFilterCount = [filters.q, filters.type, filters.industry, filters.stage, filters.region].filter(Boolean).length;

  return (
    <PageWithRail hide={["businesses"]}>
      <PageHero
        icon={Compass}
        eyebrow="Discover"
        title="Meet the people building what's next."
        description="Browse founder-approved businesses across industries and regions. Every profile appears only after its founder reviews and publishes it."
      >
        <form onSubmit={applyFilters}>
          <div className="flex rounded-2xl border border-slate-200 bg-white p-1.5 shadow-lg shadow-indigo-500/5 dark:border-zinc-700 dark:bg-zinc-900">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Search businesses</span>
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={draft.q}
                onChange={(event) => setDraft((current) => ({ ...current, q: event.target.value }))}
                maxLength={100}
                placeholder="Search names, taglines, industries, or regions"
                className="w-full bg-transparent py-2.5 pl-10 pr-3 text-sm outline-none placeholder:text-slate-400 dark:text-zinc-100 dark:placeholder:text-zinc-600"
              />
            </label>
            <button type="submit" className="btn-primary shrink-0 px-5 py-2.5 text-sm">
              <span className="hidden sm:inline">Search</span><Search size={17} className="sm:hidden" />
            </button>
          </div>
        </form>
      </PageHero>

      <section>
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {businessTypes.map((type) => (
              <button
                key={type.value || "all"}
                type="button"
                onClick={() => selectType(type.value)}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-2 text-xs font-bold transition",
                  (filters.type || "") === type.value
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-indigo-800",
                )}
              >
                {type.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowFilters((shown) => !shown)}
              className={cn(
                "ml-auto flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-bold transition",
                showFilters || activeFilterCount > (filters.type ? 1 : 0)
                  ? "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-300"
                  : "border-slate-200 bg-white text-slate-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300",
              )}
            >
              <SlidersHorizontal size={14} /> Filters
              {activeFilterCount > 0 && <span className="rounded-full bg-current/10 px-1.5">{activeFilterCount}</span>}
            </button>
          </div>

          {showFilters && (
            <form onSubmit={applyFilters} className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="grid gap-3 sm:grid-cols-3">
                <label>
                  <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">Industry</span>
                  <input value={draft.industry} onChange={(event) => setDraft((current) => ({ ...current, industry: event.target.value }))} maxLength={100} placeholder="e.g. Fintech" className={fieldClass} />
                </label>
                <label>
                  <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">Stage</span>
                  <input value={draft.stage} onChange={(event) => setDraft((current) => ({ ...current, stage: event.target.value }))} maxLength={80} placeholder="e.g. Seed" className={fieldClass} />
                </label>
                <label>
                  <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">Region</span>
                  <input value={draft.region} onChange={(event) => setDraft((current) => ({ ...current, region: event.target.value }))} maxLength={120} placeholder="e.g. West Africa" className={fieldClass} />
                </label>
              </div>
              <div className="mt-4 flex items-center justify-end gap-3">
                {activeFilterCount > 0 && <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-500 hover:text-rose-600 dark:text-zinc-400"><X size={14} /> Clear all</button>}
                <button type="submit" className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 text-xs"><Filter size={14} /> Apply filters</button>
              </div>
            </form>
          )}

          <div className="mt-6 flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Recently published</p>
              <h2 className="mt-1 text-xl font-extrabold text-slate-950 dark:text-white">
                {activeFilterCount ? "Matching businesses" : "Businesses"}
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                Support is encouragement from the community, not a measure of investability.
              </p>
            </div>
            {activeFilterCount > 0 && (
              <button type="button" onClick={clearFilters} className="hidden text-xs font-bold text-slate-500 hover:text-rose-600 sm:inline-flex">Clear filters</button>
            )}
          </div>

          {status === "loading" && (
            <div className="mt-4">
              <BusinessList label="Loading businesses">
                {Array.from({ length: 5 }).map((_, index) => <BusinessRowSkeleton key={index} />)}
              </BusinessList>
            </div>
          )}

          {status === "error" && (
            <div className="mt-7 rounded-3xl border border-rose-200 bg-white px-6 py-14 text-center dark:border-rose-900/50 dark:bg-zinc-900">
              <Compass size={28} className="mx-auto text-rose-400" />
              <h3 className="mt-4 text-lg font-bold text-slate-950 dark:text-white">Discover is unavailable</h3>
              <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">{error}</p>
              <button type="button" onClick={() => setRetryKey((key) => key + 1)} className="btn-primary mt-5 px-5 py-2.5 text-sm">Try again</button>
            </div>
          )}

          {status === "ready" && businesses.length === 0 && (
            <div className="mt-7 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center dark:border-zinc-700 dark:bg-zinc-900/70">
              <Search size={28} className="mx-auto text-slate-300 dark:text-zinc-600" />
              <h3 className="mt-4 text-lg font-bold text-slate-950 dark:text-white">No public businesses found</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-zinc-400">
                Try a broader search or clear your filters. Private drafts never appear in these results.
              </p>
              {activeFilterCount > 0 && <button type="button" onClick={clearFilters} className="btn-secondary mt-5 px-5 py-2.5 text-sm">Clear filters</button>}
            </div>
          )}

          {status === "ready" && businesses.length > 0 && (
            <>
              <div className="mt-4">
                <BusinessList label="Businesses">
                  {businesses.map((business, index) => (
                    <BusinessRow key={business.slug} business={business} rank={index + 1} headingLevel="h3" />
                  ))}
                </BusinessList>
              </div>
              {error && <p className="mt-4 text-center text-sm text-rose-500">{error}</p>}
              {nextCursor && (
                <div className="mt-5 text-center">
                  <button type="button" disabled={loadingMore} onClick={() => void loadMore()} className="btn-secondary inline-flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-60">
                    {loadingMore && <Loader2 size={16} className="animate-spin" />}
                    {loadingMore ? "Loading…" : "Load more"}
                  </button>
                </div>
              )}
            </>
          )}
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="eyebrow"><Sparkles size={13} /> Build in public, prepare in private</p>
          <h2 className="mt-2 text-lg font-extrabold text-slate-950 dark:text-white">Ready to showcase what you're building?</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            Create a private business draft, preview every public field, and publish only when you choose.
          </p>
        </div>
        <Link to="/workspace/businesses?new=1" className="btn-accent shrink-0 px-5 py-2.5 text-sm">
          Showcase your business <ArrowRight size={16} />
        </Link>
      </section>

      <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-400">
        <CheckCircle2 size={13} /> Only founder-approved business information appears here.
      </p>
    </PageWithRail>
  );
}
