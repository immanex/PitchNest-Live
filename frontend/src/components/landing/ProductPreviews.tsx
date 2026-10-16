import { CheckCircle2, Lightbulb, Mic, TrendingUp, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Illustrations of the product for the landing page. They are pictures, not
 * data: every number is labelled as an example, nothing names a real company,
 * and each block is aria-hidden because the surrounding copy says the same
 * thing in words.
 */

const heroImage = '/assets/heroImage.jpeg';

const PANEL = [
  { name: 'Marcus', role: 'Lead partner', initial: 'M', tone: 'bg-indigo-500' },
  { name: 'Sarah', role: 'Financial analyst', initial: 'S', tone: 'bg-sky-500' },
  { name: 'Chen', role: 'Technical partner', initial: 'C', tone: 'bg-emerald-500' },
];

const floatCard =
  'rounded-2xl border border-slate-200/80 bg-white/95 shadow-xl shadow-slate-900/10 backdrop-blur dark:border-zinc-700/80 dark:bg-zinc-900/95 dark:shadow-black/40';

/** Hero: a founder mid-pitch, two investors pressing them, and the score. */
export function HeroVisual() {
  return (
    <div className="relative" aria-hidden="true">
      <div className="pointer-events-none absolute -inset-8 -z-10 rounded-[40px] bg-[radial-gradient(55%_55%_at_60%_40%,rgba(79,70,229,0.28),transparent_70%)] blur-2xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-6 -z-10 h-48 w-48 rounded-full bg-accent/30 blur-3xl dark:bg-accent/10" />

      <div className="rounded-[28px] border border-white/70 bg-white/60 p-2 shadow-2xl shadow-indigo-500/15 backdrop-blur dark:border-white/10 dark:bg-zinc-900/60">
        <div className="relative aspect-4/3 overflow-hidden rounded-[22px] bg-slate-900">
          <img
            src={heroImage}
            alt=""
            className="h-full w-full object-cover"
            loading="eager"
            fetchPriority="high"
            decoding="async"
          />
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-slate-950/50 to-transparent" />
          <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            <span className="text-[11px] font-medium text-emerald-300">Live session</span>
          </div>
        </div>
      </div>

      {/* The panel's question */}
      <div className={cn(floatCard, 'absolute -left-6 top-8 hidden w-64 p-3.5 lg:block xl:-left-10')}>
        <div className="flex items-center gap-2">
          <div className="flex -space-x-1.5">
            {PANEL.map((p) => (
              <span
                key={p.name}
                className={cn('flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-white dark:ring-zinc-900', p.tone)}
              >
                {p.initial}
              </span>
            ))}
          </div>
          <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">Marcus is asking</span>
        </div>
        <p className="mt-2 text-[13px] font-medium leading-snug text-slate-800 dark:text-zinc-100">
          "Who pays you, how much, and how often?"
        </p>
      </div>

      {/* The score */}
      <div className={cn(floatCard, 'absolute -bottom-6 left-3 w-52 p-4 sm:left-6 lg:-left-6')}>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">Readiness · example</p>
        <div className="mt-1 flex items-end gap-2">
          <span className="font-display text-4xl font-semibold leading-none text-slate-900 dark:text-white">78</span>
          <span className="mb-0.5 inline-flex items-center gap-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            <TrendingUp size={13} /> +32 since last try
          </span>
        </div>
        <div className="mt-3 h-1.5 rounded-full bg-slate-100 dark:bg-zinc-800">
          <div className="gradient-brand h-full w-[78%] rounded-full" />
        </div>
      </div>

      {/* A second investor pushes back on the first answer */}
      <div className={cn(floatCard, 'absolute -right-3 bottom-14 hidden w-60 p-3.5 md:block xl:-right-8')}>
        <div className="flex items-center gap-2">
          <span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white', PANEL[1].tone)}>
            {PANEL[1].initial}
          </span>
          <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">
            {PANEL[1].name} cuts in
          </span>
        </div>
        <p className="mt-2 text-[13px] font-medium leading-snug text-slate-800 dark:text-zinc-100">
          "Fourteen months' retention, across how many customers?"
        </p>
      </div>
    </div>
  );
}

/** The rehearsal room: three investors, a live exchange, and a coaching tip. */
export function LivePanelPreview() {
  return (
    <div aria-hidden="true" className="rounded-3xl border border-white/10 bg-white/4 p-4 shadow-2xl shadow-black/30 backdrop-blur sm:p-5">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-xs font-semibold text-white/70">
          <span className="h-2 w-2 animate-pulse rounded-full bg-rose-400" /> Panel session
        </p>
        <span className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-[11px] text-white/70">08:42</span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2.5">
        {PANEL.map((p, i) => (
          <div
            key={p.name}
            className={cn(
              'rounded-2xl border p-3 text-center',
              i === 0 ? 'border-accent/60 bg-accent/10' : 'border-white/10 bg-white/5',
            )}
          >
            <span className={cn('mx-auto flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white', p.tone)}>
              {p.initial}
            </span>
            <p className="mt-2 text-xs font-bold text-white">{p.name}</p>
            <p className="text-[10px] text-white/50">{p.role}</p>
            {i === 0 && (
              <div className="mt-2 flex h-3 items-end justify-center gap-0.5">
                {[6, 10, 7, 12, 8].map((h, j) => (
                  <span key={j} className="w-0.5 rounded-full bg-accent" style={{ height: h }} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-2.5">
        <div className="rounded-2xl rounded-tl-md bg-white/8 p-3">
          <p className="text-[11px] font-bold text-indigo-300">Marcus</p>
          <p className="mt-0.5 text-[13px] leading-snug text-white/90">
            You said distribution is your edge. What does it cost you to win one customer?
          </p>
        </div>
        <div className="ml-6 rounded-2xl rounded-tr-md bg-sky-500/15 p-3">
          <p className="text-[11px] font-bold text-sky-300">You</p>
          <p className="mt-0.5 text-[13px] leading-snug text-white/90">
            Through our agent network it's about four thousand naira, and customers stay around fourteen months…
          </p>
        </div>
        <div className="flex items-start gap-2.5 rounded-2xl border border-accent/30 bg-accent/10 p-3">
          <Lightbulb size={15} className="mt-0.5 shrink-0 text-accent" />
          <p className="text-[12px] leading-snug text-white/85">
            <span className="font-bold text-accent">Tip · CAC.</span> Say what each channel costs and how fast it pays back.
          </p>
        </div>
      </div>
    </div>
  );
}

const DIMENSIONS = [
  { label: 'Delivery', value: 81 },
  { label: 'Clarity', value: 76 },
  { label: 'Scalability', value: 72 },
  { label: 'Readiness', value: 83 },
];

/** The readiness report, as it looks on screen. */
export function ReportPreview() {
  const circumference = 2 * Math.PI * 34;
  return (
    <div aria-hidden="true" className="card overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-zinc-800">
        <p className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-zinc-200">
          <Mic size={14} className="text-indigo-500" /> Readiness report
        </p>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:bg-zinc-800 dark:text-zinc-400">
          Example
        </span>
      </div>

      <div className="grid gap-5 p-5 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="relative mx-auto h-28 w-28">
          <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
            <circle cx="40" cy="40" r="34" fill="none" strokeWidth="7" className="stroke-slate-100 dark:stroke-zinc-800" />
            <circle
              cx="40"
              cy="40"
              r="34"
              fill="none"
              strokeWidth="7"
              strokeLinecap="round"
              stroke="url(#report-ring)"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - 0.78)}
            />
            <defs>
              <linearGradient id="report-ring" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#4F46E5" />
                <stop offset="100%" stopColor="#0284C7" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-3xl font-semibold text-slate-900 dark:text-white">78</span>
            <span className="text-[9px] font-bold uppercase text-slate-400">/100</span>
          </div>
        </div>
        <div className="space-y-2.5">
          {DIMENSIONS.map((d) => (
            <div key={d.label}>
              <div className="mb-1 flex justify-between text-[11px] font-semibold text-slate-500 dark:text-zinc-400">
                <span>{d.label}</span>
                <span className="text-slate-700 dark:text-zinc-200">{d.value}</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 dark:bg-zinc-800">
                <div className="gradient-brand h-full rounded-full" style={{ width: `${d.value}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 border-t border-slate-100 p-5 sm:grid-cols-2 dark:border-zinc-800">
        <div className="rounded-xl bg-emerald-50/70 p-3 dark:bg-emerald-500/10">
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 size={13} /> Strengths
          </p>
          <p className="text-[12px] leading-snug text-slate-600 dark:text-zinc-300">Clear customer pain. Credible route to market.</p>
        </div>
        <div className="rounded-xl bg-rose-50/70 p-3 dark:bg-rose-500/10">
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-rose-700 dark:text-rose-300">
            <AlertTriangle size={13} /> Risks
          </p>
          <p className="text-[12px] leading-snug text-slate-600 dark:text-zinc-300">Retention unproven. Thin plan for the raise.</p>
        </div>
      </div>
    </div>
  );
}
