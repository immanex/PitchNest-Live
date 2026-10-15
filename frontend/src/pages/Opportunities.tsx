import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, Info, Loader2, Search } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { PageHero } from "../components/layout/PageHero";
import { PageWithRail } from "../components/layout/EcosystemRail";
import { OpportunityCard } from "../components/opportunities/OpportunityCard";
import { usePageMetadata } from "../hooks/usePageMetadata";
import {
  fetchOpportunities,
  KIND_LABELS,
  OPPORTUNITY_KINDS,
  type Opportunity,
  type OpportunityKind,
} from "../api/opportunities";
import { cn } from "../lib/utils";

export default function Opportunities() {
  const [searchParams, setSearchParams] = useSearchParams();
  const kind = (OPPORTUNITY_KINDS as readonly string[]).includes(searchParams.get("kind") || "")
    ? (searchParams.get("kind") as OpportunityKind)
    : "";
  const q = searchParams.get("q") || "";
  const includeClosed = searchParams.get("closed") === "1";
  const filterKey = useMemo(() => `${kind}|${q}|${includeClosed}`, [kind, q, includeClosed]);

  const [items, setItems] = useState<Opportunity[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [search, setSearch] = useState(q);

  usePageMetadata({
    title: "Opportunities for founders — PitchNest",
    description: "Accelerators, grants, pitch competitions and events for founders, each linked to the organizer's official listing.",
    path: "/opportunities",
  });

  useEffect(() => {
    setSearch(q);
    const controller = new AbortController();
    setStatus("loading");
    fetchOpportunities({ kind, q, includeClosed }, controller.signal)
      .then((result) => {
        setItems(result);
        setStatus("ready");
      })
      .catch((error) => {
        if (error?.name !== "AbortError") setStatus("error");
      });
    return () => controller.abort();
  }, [filterKey]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setParam("q", search.trim());
  };

  return (
    <PageWithRail hide={["opportunities"]}>
      <PageHero
        icon={CalendarDays}
        eyebrow="Opportunities"
        title="More doors for ambitious founders."
        description="Accelerators, grants, competitions and events, each checked against the organizer's official page."
      >
        <form onSubmit={submitSearch}>
          <label className="relative block">
            <span className="sr-only">Search opportunities</span>
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              maxLength={100}
              placeholder="Search by name, organizer or sector, then press Enter"
              className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </label>
        </form>
      </PageHero>

      <section>
          <div className="flex flex-wrap items-center gap-2">
            {(["", ...OPPORTUNITY_KINDS] as Array<OpportunityKind | "">).map((value) => (
              <button
                key={value || "all"}
                type="button"
                onClick={() => setParam("kind", value)}
                aria-pressed={kind === value}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-2 text-xs font-bold transition",
                  kind === value
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300",
                )}
              >
                {value ? KIND_LABELS[value] : "All types"}
              </button>
            ))}
            <label className="ml-auto inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-600 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={includeClosed}
                onChange={(event) => setParam("closed", event.target.checked ? "1" : "")}
                className="accent-indigo-600"
              />
              Show recently closed
            </label>
          </div>

          <div className="mt-6" aria-live="polite">
            {status === "loading" && (
              <p className="flex items-center gap-2 py-10 text-sm text-slate-400">
                <Loader2 size={16} className="animate-spin" /> Loading opportunities…
              </p>
            )}
            {status === "error" && (
              <p className="py-10 text-sm text-slate-500 dark:text-zinc-400">Opportunities couldn't load. Please try again.</p>
            )}
            {status === "ready" && items.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
                <CalendarDays size={24} className="mx-auto text-slate-300" />
                <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-zinc-200">
                  {kind || q ? "Nothing matches those filters right now." : "New opportunities are being curated."}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                  We only list programmes we can link to an official source. Check back soon.
                </p>
              </div>
            )}
            {status === "ready" && items.length > 0 && (
              <div className="grid gap-5 md:grid-cols-2">
                {items.map((item) => (
                  <OpportunityCard key={item.id} opportunity={item} />
                ))}
              </div>
            )}
          </div>

          <p className="mt-10 flex items-start justify-center gap-2 text-center text-[11px] leading-relaxed text-slate-400">
            <Info size={13} className="mt-0.5 shrink-0" />
            PitchNest lists these opportunities to help founders find them. Unless stated, we are not affiliated with
            the organizers. Always confirm deadlines and eligibility on the official listing.
          </p>
      </section>
    </PageWithRail>
  );
}
