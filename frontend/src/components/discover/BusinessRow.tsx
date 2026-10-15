import React from "react";
import { ArrowBigUp, MapPin, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";
import type { PublicBusinessSummary } from "../../api/publicBusinesses";

/**
 * Ranked list rows for Discover and Home: number, initials, name, tagline,
 * tags, comment count and the support count on the right. Every field comes
 * from the founder-approved public summary.
 */

const PALETTES = [
  "from-indigo-500 to-violet-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-sky-500 to-blue-600",
  "from-violet-500 to-fuchsia-600",
];

function paletteFor(slug: string) {
  let hash = 0;
  for (let index = 0; index < slug.length; index += 1) hash = (hash * 31 + slug.charCodeAt(index)) >>> 0;
  return PALETTES[hash % PALETTES.length];
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "P";
}

function titleCase(value: string) {
  return value.replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function BusinessInitials({ name, slug, size = "md" }: { name: string; slug: string; size?: "sm" | "md" | "lg" }) {
  const dimensions = size === "lg" ? "h-16 w-16 rounded-2xl text-xl" : size === "sm" ? "h-8 w-8 rounded-lg text-[11px]" : "h-11 w-11 rounded-xl text-sm";
  return (
    <span
      className={`flex shrink-0 items-center justify-center bg-gradient-to-br ${paletteFor(slug)} ${dimensions} font-extrabold text-white shadow-sm`}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

export function BusinessList({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <ol
      aria-label={label}
      className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900"
    >
      {children}
    </ol>
  );
}

export function BusinessRow({
  business,
  rank,
  headingLevel = "h3",
}: {
  business: PublicBusinessSummary;
  rank?: number;
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  const supporters = business.engagement?.supportCount;
  const comments = business.engagement?.commentCount;
  return (
    <li className="group relative flex items-center gap-3 px-3 py-3.5 transition hover:bg-slate-50 dark:hover:bg-zinc-800/50 sm:gap-4 sm:px-5 sm:py-4">
      {rank !== undefined && (
        <span className="hidden w-5 shrink-0 text-center text-xs font-bold tabular-nums text-slate-400 sm:block">{rank}</span>
      )}
      <BusinessInitials name={business.name} slug={business.slug} />
      <div className="min-w-0 flex-1">
        <Heading className="truncate font-sans text-sm font-extrabold text-slate-950 dark:text-white">
          <Link
            to={`/businesses/${encodeURIComponent(business.slug)}`}
            className="outline-none after:absolute after:inset-0 after:content-[''] group-hover:text-indigo-600 focus-visible:underline dark:group-hover:text-indigo-300"
          >
            {business.name}
          </Link>
        </Heading>
        <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-zinc-400">
          {business.tagline || "Founder-approved business profile."}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] font-medium text-slate-400">
          {business.industry && (
            <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 font-bold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
              {business.industry}
            </span>
          )}
          {business.region && (
            <span className="inline-flex items-center gap-1"><MapPin size={10} /> {business.region}</span>
          )}
          <span className="hidden sm:inline">{titleCase(business.businessType)}</span>
        </div>
      </div>
      {comments !== undefined && (
        <span className="hidden shrink-0 items-center gap-1 text-[11px] font-semibold tabular-nums text-slate-400 sm:flex" title="Comments">
          <MessageSquare size={13} aria-hidden="true" />
          <span className="sr-only">Comments:</span> {comments}
        </span>
      )}
      {supporters !== undefined && (
        <span
          className="flex min-w-[48px] shrink-0 flex-col items-center rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-extrabold tabular-nums text-slate-700 transition group-hover:border-accent-strong group-hover:bg-accent-soft dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:group-hover:border-accent/60 dark:group-hover:bg-accent/10"
          title="Supporters"
        >
          <ArrowBigUp size={16} aria-hidden="true" />
          <span className="sr-only">Supporters:</span> {supporters}
        </span>
      )}
    </li>
  );
}

export function BusinessRowSkeleton() {
  return (
    <li className="flex items-center gap-4 px-5 py-4" aria-hidden="true">
      <span className="h-11 w-11 shrink-0 animate-pulse rounded-xl bg-slate-200 dark:bg-zinc-800" />
      <span className="flex-1 space-y-2">
        <span className="block h-3.5 w-1/3 animate-pulse rounded bg-slate-200 dark:bg-zinc-800" />
        <span className="block h-3 w-2/3 animate-pulse rounded bg-slate-100 dark:bg-zinc-800/70" />
      </span>
      <span className="h-11 w-12 animate-pulse rounded-xl bg-slate-100 dark:bg-zinc-800" />
    </li>
  );
}
