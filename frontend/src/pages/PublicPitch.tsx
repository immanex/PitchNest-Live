import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  Sparkles,
  Target,
  Wrench,
} from "lucide-react";
import { cn } from "../lib/utils";
import { LogoLink } from "../components/Logo";
import {
  MODE_LABELS,
  MODE_BADGE_CLASSES,
  getSessionMode,
  verdictLabel,
} from "../lib/sessionMode";

/**
 * The public face of a shared pitch — /share/<shareId>.
 *
 * WHAT THIS PAGE MAY SHOW IS DECIDED SERVER-SIDE. The payload comes from
 * GET /api/public/pitch/:shareId, which builds a deliberately narrow projection
 * of the evaluation report: score, sub-scores, top strengths, top fixes. Nothing
 * here reads the full report, so there is no field on this page that could leak
 * a transcript, a raise figure or the panel's verbatim quotes even if this
 * component were rewritten carelessly. Treat the API as the boundary, not this
 * file.
 *
 * NO ACCOUNT REQUIRED. A founder forwarding this to an investor or an
 * accelerator cannot assume the recipient has a PitchNest login, so the route
 * sits outside ProtectedRoute and talks to an unauthenticated endpoint.
 *
 * UNLISTED BY CONSTRUCTION: share ids are v4 UUIDs, sharing is opt-in, and the
 * owner can turn it off at any time. Two things keep it out of search results —
 * the disallow in public/robots.txt, and the noindex meta tag injected while
 * this page is mounted. The tag is removed on unmount because a SPA shares one
 * document head across every route, and leaving it behind would deindex the
 * marketing site for whoever visits a share link first.
 */
interface SharedPitch {
  businessName: string;
  date: string | null;
  mode: string;
  score: number;
  scores: {
    delivery: number;
    clarity: number;
    scalability: number;
    readiness: number;
  };
  strengths: string[];
  fixes: { title: string; desc: string; priority: string }[];
}

const SCORE_DIMENSIONS = [
  { key: "delivery", label: "Delivery" },
  { key: "clarity", label: "Clarity" },
  { key: "scalability", label: "Scalability" },
  { key: "readiness", label: "Readiness" },
] as const;

/** Injects the noindex tag for as long as this page is on screen. */
function addNoindexMeta(): HTMLMetaElement {
  const existing = document.querySelector<HTMLMetaElement>('meta[name="robots"][data-share-page]');
  if (existing) return existing;
  const meta = document.createElement("meta");
  meta.name = "robots";
  meta.content = "noindex, nofollow";
  meta.setAttribute("data-share-page", "true");
  document.head.appendChild(meta);
  return meta;
}

export default function PublicPitch() {
  const { shareId } = useParams<{ shareId: string }>();
  const [pitch, setPitch] = useState<SharedPitch | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");

  // Scoped to this page's lifetime — see the note in the file header.
  useEffect(() => {
    const meta = addNoindexMeta();
    return () => meta.remove();
  }, []);

  useEffect(() => {
    if (!shareId) {
      setStatus("missing");
      return;
    }
    let cancelled = false;
    setStatus("loading");

    fetch(`/api/public/pitch/${encodeURIComponent(shareId)}`)
      .then(async (res) => {
        if (cancelled) return;
        // 404 covers unknown, revoked and unscored alike — the server does not
        // distinguish, and neither should this page.
        if (res.status === 404) {
          setStatus("missing");
          return;
        }
        if (!res.ok) {
          setStatus("error");
          return;
        }
        const body = (await res.json()) as SharedPitch;
        if (cancelled) return;
        setPitch(body);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [shareId]);

  // Title is set only once the pitch loads, and restored on the way out so the
  // marketing site's own title comes back.
  useEffect(() => {
    if (!pitch?.businessName) return;
    const previous = document.title;
    document.title = `${pitch.businessName} — PitchNest readiness report`;
    return () => {
      document.title = previous;
    };
  }, [pitch?.businessName]);

  const mode = getSessionMode({ mode: pitch?.mode });
  const score = pitch?.score ?? 0;
  const scoreClass =
    score >= 80
      ? "text-emerald-600 dark:text-emerald-400"
      : score >= 60
        ? "text-sky-600 dark:text-sky-400"
        : "text-rose-600 dark:text-rose-400";
  const formattedDate = pitch?.date
    ? new Date(pitch.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#09090B] font-sans text-slate-900 dark:text-zinc-100">
      <header className="border-b border-slate-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-900">
        <nav className="max-w-3xl mx-auto px-5 sm:px-6 py-4 flex items-center justify-between gap-4">
          <LogoLink showText size="sm" />
          <Link
            to="/signup"
            className="text-sm font-bold text-sky-600 dark:text-sky-400 hover:underline"
          >
            Start free
          </Link>
        </nav>
      </header>

      <main className="max-w-3xl mx-auto px-5 sm:px-6 py-10 pb-20">
        {status === "loading" && (
          <div className="flex flex-col items-center justify-center gap-3 py-24">
            <Loader2 className="animate-spin text-sky-500" size={36} />
            <p className="text-sm text-slate-500 dark:text-zinc-400">Loading shared pitch…</p>
          </div>
        )}

        {status === "missing" && (
          <div className="py-20 text-center">
            <ShieldAlert size={40} className="mx-auto mb-4 text-slate-300 dark:text-zinc-700" />
            <h1 className="text-xl font-extrabold mb-2">This pitch isn't available</h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-md mx-auto">
              The link may have been turned off by the founder who shared it, or it may never
              have existed. Shared links are revocable, so a link that worked yesterday can stop
              working today.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 rounded-xl bg-sky-500 text-white text-sm font-bold hover:bg-sky-600 transition-colors"
            >
              What is PitchNest? <ArrowRight size={15} />
            </Link>
          </div>
        )}

        {status === "error" && (
          <div className="py-20 text-center">
            <ShieldAlert size={40} className="mx-auto mb-4 text-amber-400" />
            <h1 className="text-xl font-extrabold mb-2">Couldn't load this pitch</h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Something went wrong on our side. Try reloading the page.
            </p>
          </div>
        )}

        {status === "ready" && pitch && (
          <>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-2">
              Shared readiness report
            </p>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3">
              {pitch.businessName}
            </h1>
            <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-zinc-400 flex-wrap mb-8">
              {formattedDate && <span>Pitched {formattedDate}</span>}
              <span
                className={cn(
                  "px-3 py-0.5 border rounded-full text-xs font-bold",
                  MODE_BADGE_CLASSES[mode],
                )}
              >
                {MODE_LABELS[mode]}
              </span>
            </div>

            {/* Score + verdict */}
            <div className="rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-7 sm:p-8 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                <div className="text-center sm:text-left">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-1">
                    Readiness score
                  </p>
                  <p className={cn("text-6xl font-extrabold leading-none", scoreClass)}>{score}</p>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mt-2">
                    {verdictLabel(mode, score)}
                  </p>
                </div>
                <div className="flex-1 w-full space-y-3">
                  {SCORE_DIMENSIONS.map((d) => (
                    <div key={d.key}>
                      <div className="flex justify-between text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">
                        <span>{d.label}</span>
                        <span>{pitch.scores[d.key]}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-sky-500"
                          style={{ width: `${Math.min(100, Math.max(0, pitch.scores[d.key]))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-6">
              {pitch.strengths.length > 0 && (
                <div className="rounded-3xl border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/40 dark:bg-emerald-900/10 p-6">
                  <h2 className="flex items-center gap-2 text-sm font-extrabold mb-4">
                    <CheckCircle2 size={16} className="text-emerald-500" /> What landed
                  </h2>
                  <ul className="space-y-3">
                    {pitch.strengths.map((s, i) => (
                      <li
                        key={i}
                        className="text-sm text-slate-600 dark:text-zinc-300 leading-relaxed"
                      >
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {pitch.fixes.length > 0 && (
                <div className="rounded-3xl border border-amber-100 dark:border-amber-900/30 bg-amber-50/40 dark:bg-amber-900/10 p-6">
                  <h2 className="flex items-center gap-2 text-sm font-extrabold mb-4">
                    <Wrench size={16} className="text-amber-500" /> What to fix next
                  </h2>
                  <ul className="space-y-4">
                    {pitch.fixes.map((f, i) => (
                      <li key={i}>
                        <p className="text-sm font-bold text-slate-800 dark:text-zinc-100">
                          {f.title}
                        </p>
                        {f.desc && (
                          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">
                            {f.desc}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-400 dark:text-zinc-500 mt-8 leading-relaxed">
              Score and feedback are generated by AI investor personas reacting to this founder's
              spoken pitch. They are a practice tool, not an investment recommendation, and not a
              prediction of any real investor's decision. Only this summary is shared — the
              transcript and the rest of the report stay private to the founder.
            </p>

            {/* The conversion moment: someone who just read a scorecard is the
                most qualified visitor the product will ever get. */}
            <div className="mt-10 rounded-2xl gradient-brand p-7 text-center text-white relative overflow-hidden">
              <div className="relative z-10 max-w-md mx-auto">
                <Sparkles size={22} className="mx-auto mb-3 text-white/80" />
                <h2 className="font-display text-xl font-semibold mb-2">
                  Pitch to a panel that answers back
                </h2>
                <p className="text-sm text-white/80 mb-5">
                  Upload your deck, pitch out loud to AI investors, and get a scored report like
                  this one. Two sessions a week are free.
                </p>
                <Link
                  to="/signup"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white text-indigo-600 font-semibold rounded-xl hover:bg-white/95 transition-all shadow-lg text-sm"
                >
                  <Target size={16} /> Start free
                </Link>
              </div>
              <div className="absolute -top-16 -right-16 w-52 h-52 bg-white/10 rounded-full blur-3xl pointer-events-none" />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
