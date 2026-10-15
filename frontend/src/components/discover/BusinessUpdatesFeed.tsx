import React, { useEffect, useState } from "react";
import { Flag, Megaphone, Rocket, Trophy } from "lucide-react";
import { fetchPublicUpdates, UPDATE_KIND_LABELS, type BusinessUpdate } from "../../api/activity";

const KIND_ICONS = { update: Megaphone, milestone: Trophy, launch: Rocket } as const;

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(date);
}

/**
 * Public updates and milestones on a business profile. Renders nothing until
 * there is at least one update, so a new profile isn't padded with an empty
 * section.
 */
export function BusinessUpdatesFeed({ slug, onLoaded }: { slug: string; onLoaded?: () => void }) {
  const [updates, setUpdates] = useState<BusinessUpdate[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    fetchPublicUpdates(slug, controller.signal)
      .then((result) => {
        setUpdates(result);
        onLoaded?.();
      })
      .catch(() => setUpdates([]));
    return () => controller.abort();
    // onLoaded is a scroll hint from the parent; only the slug matters here.
  }, [slug]);

  if (updates.length === 0) return null;

  return (
    <section
      id="updates"
      aria-labelledby="updates-heading"
      className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 sm:p-7"
    >
      <div className="eyebrow">
        <Flag size={15} />
        <span>Progress</span>
      </div>
      <h2 id="updates-heading" className="mt-3 text-xl font-extrabold text-slate-950 dark:text-white">
        Updates and milestones
      </h2>
      <ol className="mt-5 space-y-5 border-l border-slate-200 pl-5 dark:border-zinc-800">
        {updates.map((update) => {
          const Icon = KIND_ICONS[update.kind] ?? Megaphone;
          return (
            <li key={update.id} className="relative">
              <span className="absolute -left-[31px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-indigo-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-indigo-300">
                <Icon size={11} />
              </span>
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-bold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                  {UPDATE_KIND_LABELS[update.kind]}
                </span>
                <span className="text-slate-400">{formatDate(update.createdAt)}</span>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700 dark:text-zinc-300">
                {update.body}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
