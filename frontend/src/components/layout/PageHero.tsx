import React from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/utils";

type IconType = React.ComponentType<{ size?: number; className?: string }>;

/**
 * The banner at the top of every ecosystem page: a yellow eyebrow, the page
 * title, one line of context, and optional actions or a search form below.
 */
export function PageHero({
  icon: Icon,
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
}: {
  icon?: IconType;
  eyebrow: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-br from-white via-indigo-50/70 to-sky-50 p-6 dark:border-indigo-950/60 dark:from-zinc-900 dark:via-indigo-950/20 dark:to-sky-950/20 sm:p-8",
        className,
      )}
    >
      <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-indigo-300/20 blur-3xl dark:bg-indigo-600/10" />
      <div className="pointer-events-none absolute -bottom-20 left-1/3 h-40 w-40 rounded-full bg-accent/20 blur-3xl dark:bg-accent/5" />
      <div className="relative">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="eyebrow">
              {Icon && <Icon size={14} />} {eyebrow}
            </p>
            <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-3xl">{title}</h1>
            {description && (
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-zinc-400">{description}</p>
            )}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
        </div>
        {children && <div className="mt-6">{children}</div>}
      </div>
    </section>
  );
}

/** A section heading with an optional "View all" style link on the right. */
export function SectionTitle({
  title,
  description,
  to,
  linkLabel = "View all",
  as: Heading = "h2",
}: {
  title: string;
  description?: string;
  to?: string;
  linkLabel?: string;
  as?: "h2" | "h3";
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="min-w-0">
        <Heading className="text-lg font-extrabold text-slate-950 dark:text-white sm:text-xl">{title}</Heading>
        {description && <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">{description}</p>}
      </div>
      {to && (
        <Link
          to={to}
          className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-indigo-600 transition hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          {linkLabel} <ArrowRight size={14} />
        </Link>
      )}
    </div>
  );
}
