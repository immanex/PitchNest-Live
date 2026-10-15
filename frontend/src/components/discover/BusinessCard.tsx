import React from "react";
import { ArrowBigUp, ArrowRight, Building2, MapPin, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";
import type { PublicBusinessSummary } from "../../api/publicBusinesses";
import { BusinessLogo } from "./BusinessRow";

/**
 * The public business card used by /discover and the landing page's
 * "Businesses to discover" section. It renders only fields from the
 * founder-approved public summary, plus support/comment counts when the
 * server includes them.
 */

function titleCase(value: string) {
  return value.replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">{children}</span>;
}

export function BusinessCard({
  business,
  headingLevel = "h2",
}: {
  business: PublicBusinessSummary;
  /** Use "h3" when the cards sit under a section's own h2. */
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  return (
    <Link
      to={`/businesses/${business.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition duration-200 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-500/10 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-800"
    >
      <div className="relative h-24 overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-sky-500 p-4">
        {business.coverUrl ? (
          <>
            <img
              src={business.coverUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-linear-to-b from-black/30 via-transparent to-black/20" />
          </>
        ) : (
          <div className="absolute -right-8 -top-12 h-32 w-32 rounded-full bg-white/15 blur-2xl" />
        )}
        <div className="relative flex items-start justify-between">
          {business.logoUrl ? (
            <BusinessLogo name={business.name} slug={business.slug} logoUrl={business.logoUrl} size="md" />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/25 bg-white/15 text-lg font-extrabold text-white backdrop-blur">
              {initials(business.name) || <Building2 size={20} />}
            </span>
          )}
          <span className="rounded-full bg-black/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/90 backdrop-blur">
            {titleCase(business.businessType)}
          </span>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <Heading className="text-lg font-extrabold text-slate-950 transition group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-300">
            {business.name}
          </Heading>
          <ArrowRight size={17} className="mt-1 shrink-0 text-slate-300 transition group-hover:translate-x-1 group-hover:text-indigo-500 dark:text-zinc-600" />
        </div>
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-500 dark:text-zinc-400">
          {business.tagline || "Explore this founder-approved business profile."}
        </p>
        <div className="mt-auto flex flex-wrap gap-2 pt-5">
          {business.industry && <Tag>{business.industry}</Tag>}
          {business.stage && <Tag>{business.stage}</Tag>}
        </div>
        {(business.region || business.engagement) && (
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-[11px] font-medium text-slate-400 dark:border-zinc-800">
            <span className="flex min-w-0 items-center gap-1.5">
              {business.region && <><MapPin size={12} className="shrink-0" /> <span className="truncate">{business.region}</span></>}
            </span>
            {business.engagement && (
              <span className="flex shrink-0 items-center gap-3 tabular-nums">
                <span className="flex items-center gap-1" title="Supporters">
                  <ArrowBigUp size={13} aria-hidden="true" />
                  <span className="sr-only">Supporters:</span> {business.engagement.supportCount}
                </span>
                <span className="flex items-center gap-1" title="Comments">
                  <MessageSquare size={12} aria-hidden="true" />
                  <span className="sr-only">Comments:</span> {business.engagement.commentCount}
                </span>
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

export function BusinessCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900" aria-hidden>
      <div className="h-24 animate-pulse bg-slate-200 dark:bg-zinc-800" />
      <div className="space-y-3 p-5">
        <div className="h-5 w-2/3 animate-pulse rounded bg-slate-200 dark:bg-zinc-800" />
        <div className="h-3 w-full animate-pulse rounded bg-slate-100 dark:bg-zinc-800/70" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-slate-100 dark:bg-zinc-800/70" />
        <div className="flex gap-2 pt-5"><div className="h-6 w-20 animate-pulse rounded-full bg-slate-100 dark:bg-zinc-800" /><div className="h-6 w-16 animate-pulse rounded-full bg-slate-100 dark:bg-zinc-800" /></div>
      </div>
    </div>
  );
}
