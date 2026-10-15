import React from "react";
import { CalendarDays, ExternalLink, MapPin, ShieldCheck } from "lucide-react";
import { KIND_LABELS, type Opportunity } from "../../api/opportunities";
import { cn } from "../../lib/utils";
import { trackEvent } from "../../lib/analytics";

function formatDate(value: string | null) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

export function StateBadge({ opportunity }: { opportunity: Pick<Opportunity, "state" | "daysLeft" | "opensOn"> }) {
  const { state, daysLeft } = opportunity;
  const label =
    state === "closed" ? "Closed" :
    state === "upcoming" ? `Opens ${formatDate(opportunity.opensOn)}` :
    state === "rolling" ? "Rolling" :
    state === "closing_soon" ? (daysLeft === 0 ? "Closes today" : `Closes in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`) :
    "Open";
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-[11px] font-bold",
        state === "closed" && "bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400",
        state === "closing_soon" && "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
        state === "upcoming" && "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300",
        (state === "open" || state === "rolling") && "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
      )}
    >
      {label}
    </span>
  );
}

/**
 * One curated opportunity. The action always leads to the organizer's own
 * page: PitchNest lists opportunities but never takes applications.
 */
export function OpportunityCard({ opportunity }: { opportunity: Opportunity }) {
  const closed = opportunity.state === "closed";
  return (
    <article
      className={cn(
        "flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900",
        closed && "opacity-75",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
          {KIND_LABELS[opportunity.kind]}
        </span>
        <StateBadge opportunity={opportunity} />
      </div>
      <h2 className="mt-3 text-base font-extrabold text-slate-950 dark:text-white">{opportunity.title}</h2>
      <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-zinc-400">by {opportunity.organizer}</p>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-600 dark:text-zinc-300">{opportunity.summary}</p>
      {opportunity.eligibility && (
        <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
          <span className="font-bold text-slate-700 dark:text-zinc-200">Who can apply: </span>
          {opportunity.eligibility}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] font-medium text-slate-400">
        {opportunity.region && (
          <span className="inline-flex items-center gap-1"><MapPin size={12} /> {opportunity.region}</span>
        )}
        {opportunity.closesOn && (
          <span className="inline-flex items-center gap-1"><CalendarDays size={12} /> Deadline {formatDate(opportunity.closesOn)}</span>
        )}
      </div>
      <div className="mt-auto pt-5">
        {opportunity.sourceUrl ? (
          <a
            href={opportunity.sourceUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            onClick={() => trackEvent({ name: "opportunity_link_opened", properties: { kind: opportunity.kind } })}
            className={cn(
              "inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition",
              closed
                ? "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                : "btn-primary",
            )}
          >
            View official listing <ExternalLink size={14} />
          </a>
        ) : null}
        {opportunity.lastCheckedAt && (
          <p className="mt-2.5 flex items-center justify-center gap-1 text-[10px] text-slate-400">
            <ShieldCheck size={11} /> Details checked {formatDate(opportunity.lastCheckedAt.slice(0, 10))}
          </p>
        )}
      </div>
    </article>
  );
}
