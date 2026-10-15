import React, { useState } from "react";
import { ArrowBigUp, Bell, BellRing, Building2, Loader2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { setBusinessEngagement, type BusinessEngagement } from "../../api/discover";
import { cn } from "../../lib/utils";

interface EngagementBarProps {
  slug: string;
  engagement: BusinessEngagement;
  onChange: (next: BusinessEngagement) => void;
}

/**
 * Support and follow controls for a public business profile. Optimistic:
 * the count moves immediately and rolls back if the server refuses.
 */
export function EngagementBar({ slug, engagement, onChange }: EngagementBarProps) {
  const { user, authFetch } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [pending, setPending] = useState<"support" | "follow" | null>(null);
  const [error, setError] = useState("");

  const viewer = engagement.viewer;
  const isMember = viewer?.isMember === true;

  const toggle = async (kind: "support" | "follow") => {
    if (!user) {
      navigate("/login", { state: { from: { pathname: location.pathname } } });
      return;
    }
    if (pending || !viewer) return;

    const wasActive = kind === "support" ? viewer.supports : viewer.follows;
    const countKey = kind === "support" ? "supportCount" : "followerCount";
    const previous = engagement;
    const optimistic: BusinessEngagement = {
      ...engagement,
      [countKey]: Math.max(0, engagement[countKey] + (wasActive ? -1 : 1)),
      viewer: {
        ...viewer,
        ...(kind === "support" ? { supports: !wasActive } : { follows: !wasActive }),
      },
    };

    setError("");
    setPending(kind);
    onChange(optimistic);
    try {
      const result = await setBusinessEngagement(authFetch, slug, kind, !wasActive);
      onChange({ ...optimistic, [countKey]: result.count });
    } catch (requestError) {
      onChange(previous);
      setError(requestError instanceof Error ? requestError.message : "That didn't work. Please try again.");
    } finally {
      setPending(null);
    }
  };

  if (isMember) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-600 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300">
          <Building2 size={14} /> Your business. Members can't support or follow it.
        </p>
      </div>
    );
  }

  const supports = viewer?.supports === true;
  const follows = viewer?.follows === true;

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void toggle("support")}
          aria-pressed={supports}
          disabled={pending !== null}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition disabled:cursor-wait",
            supports
              ? "bg-accent text-accent-ink hover:bg-[#FFE19C]"
              : "border border-slate-200 bg-white text-slate-700 hover:border-accent-strong hover:bg-accent-soft dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-accent/50 dark:hover:bg-accent/10",
          )}
        >
          {pending === "support" ? <Loader2 size={16} className="animate-spin" /> : <ArrowBigUp size={17} />}
          {supports ? "Supported" : "Support"}
          <span className="tabular-nums opacity-70">· {engagement.supportCount}</span>
        </button>
        <button
          type="button"
          onClick={() => void toggle("follow")}
          aria-pressed={follows}
          disabled={pending !== null}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition disabled:cursor-wait",
            follows
              ? "bg-indigo-600 text-white hover:bg-indigo-700"
              : "border border-slate-200 bg-white text-slate-700 hover:border-indigo-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200",
          )}
        >
          {pending === "follow" ? (
            <Loader2 size={16} className="animate-spin" />
          ) : follows ? (
            <BellRing size={16} />
          ) : (
            <Bell size={16} />
          )}
          {follows ? "Following" : "Follow"}
        </button>
      </div>
      {error && (
        <p className="text-xs font-medium text-rose-600 dark:text-rose-400" role="alert">{error}</p>
      )}
    </div>
  );
}

/** "3 supporters · 2 followers · 4 comments", plus the investment disclaimer. */
export function EngagementCounts({ engagement }: { engagement: BusinessEngagement }) {
  return (
    <div className="space-y-0.5">
      <Counts engagement={engagement} />
      <p className="text-[11px] leading-relaxed text-slate-400 dark:text-zinc-500">
        Support is encouragement from the community. It is not an investment signal.
      </p>
    </div>
  );
}

function Counts({ engagement }: { engagement: BusinessEngagement }) {
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return (
    <p className="text-xs font-medium text-slate-500 dark:text-zinc-400">
      {plural(engagement.supportCount, "supporter", "supporters")} ·{" "}
      {plural(engagement.followerCount, "follower", "followers")} ·{" "}
      {plural(engagement.commentCount, "comment", "comments")}
    </p>
  );
}
