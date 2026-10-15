import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutGrid,
  Users,
  Armchair,
  Activity,
  UserSearch,
  FileBarChart2,
  History,
  Search,
  Bell,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Target,
  Award,
  BadgeCheck,
  Filter,
  RotateCcw,
  Gauge,
  ListChecks,
  Layers,
  Building2,
  CalendarRange,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  Play,
  Mail,
  CheckCircle2,
  AlertCircle,
  Hourglass,
  Globe,
  Copy,
  Check,
  ArrowLeft,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { LogoMark } from "../../../components/Logo";
import { ThemeToggle } from "../../../components/ThemeToggle";
import { useAuth } from "../../../contexts/AuthContext";

/* ------------------------------------------------------------------ */
/*  API DATA CONTRACT                                                  */
/* ------------------------------------------------------------------ */

export type MemberRole = "Owner" | "Admin" | "Member" | "Founder";
export type MemberStatus = "active" | "invited" | "suspended";
export type PitchStatus = "Incomplete" | "Needs Work" | "Good" | "Excellent";
export type ReportStatus = "ready" | "processing";
export type Industry =
  | "Fintech"
  | "Healthtech"
  | "SaaS"
  | "Consumer"
  | "Climate"
  | "Deeptech";
export type FundingStage = "Pre-seed" | "Seed" | "Series A" | "Series B+";

// Maps 1:1 to public."Organizations"
export interface OrganizationDetails {
  id: string;
  orgCode: number;
  orgName: string;
  capacity: number;
  enrolled: number;
  validity: string; // ISO date
  plan: string;
  email: string;
  country: string;
  websiteUrl: string;
  trialStartedAt: string | null;
  trialExpiresAt: string | null;
  trialStatus: string;
  createdAt: string;
  enrollLink: string; // link the QR code encodes
}

export interface OrgOverview {
  orgName: string;
  planName: string;
  renewalDate: string; // ISO date
  totalMembers: number;
  totalSeats: number;
  usedSeats: number;
  totalPitches: number;
  avgPitchScore: number; // 0-100
  activeFoundersThisWeek: number;
  avgReadinessScore: number; // 0-100, aggregate pitch-readiness across founders
  completionRate: number; // 0-100, % of pitches that were fully delivered
  avgScoreImprovement: number; // avg point gain from a founder's first to latest scored pitch
}

export interface Member {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  role: MemberRole;
  status: MemberStatus;
  seatAssigned: boolean;
  joinedAt: string; // ISO date
  lastActiveAt: string | null; // ISO date
  totalPitches: number;
  avgScore: number | null;
  cohort: string;
  industry: Industry;
  fundingStage: FundingStage;
}

export interface SeatUsage {
  totalSeats: number;
  usedSeats: number;
  pendingInvites: number;
  planName: string;
  seatsByRole: { role: MemberRole; count: number }[];
  history: { month: string; used: number }[]; // trailing months, oldest first
}

export interface ActivityPoint {
  date: string; // ISO date
  pitches: number;
  activeUsers: number;
}

export interface ActivityOverview {
  last7Days: ActivityPoint[]; // oldest first
  totalPitchesThisMonth: number;
  totalActiveUsersThisMonth: number;
  topActiveMembers: { memberId: string; name: string; pitches: number }[];
}

export interface FounderPitch {
  id: string;
  title: string;
  date: string; // ISO date
  panelType: string;
  status: PitchStatus;
  score: number | null;
}

export interface FounderDrilldown {
  memberId: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  cohort: string;
  industry: Industry;
  fundingStage: FundingStage;
  totalPitches: number;
  avgScore: number | null;
  bestScore: number | null;
  readinessScore: number; // 0-100, model's aggregate readiness-to-pitch signal
  completionRate: number; // 0-100, % of this founder's pitches that were fully delivered
  scoreImprovement: number; // latest scored pitch minus first scored pitch
  scoreHistory: { date: string; score: number }[]; // oldest first, for trend chart
  lastFeedback: string | null;
  recentPitches: FounderPitch[];
}

export interface Report {
  id: string;
  title: string;
  type: "Weekly" | "Monthly" | "Custom";
  generatedAt: string; // ISO date
  fileUrl: string;
  status: ReportStatus;
}

export interface Replay {
  id: string;
  founderName: string;
  pitchTitle: string;
  date: string; // ISO date
  panelType: string;
  durationSeconds: number;
  status: PitchStatus;
  score: number | null;
}

export interface ReadinessAggregation {
  overallScore: number; // 0-100
  byCohort: { cohort: string; score: number }[];
  byIndustry: { industry: Industry; score: number }[];
  byFundingStage: { stage: FundingStage; score: number }[];
}

export interface CompletionMetrics {
  overallRate: number; // 0-100
  completedPitches: number;
  incompletePitches: number;
  byCohort: { cohort: string; rate: number }[];
}

export interface ScoreImprovementSummary {
  avgImprovement: number; // org-wide avg point gain
  topImprovers: {
    memberId: string;
    name: string;
    improvement: number;
    from: number;
    to: number;
  }[];
  monthlyTrend: { month: string; avgScore: number }[]; // oldest first
}

export interface FilterOptions {
  cohorts: string[];
  industries: Industry[];
  fundingStages: FundingStage[];
}

export interface OrgDashboardData {
  organization: OrganizationDetails;
  overview: OrgOverview;
  members: Member[];
  seatUsage: SeatUsage;
  activity: ActivityOverview;
  founders: FounderDrilldown[];
  reports: Report[];
  replays: Replay[];
  readiness: ReadinessAggregation;
  completion: CompletionMetrics;
  scoreImprovementSummary: ScoreImprovementSummary;
  filters: FilterOptions;
}

/* ------------------------------------------------------------------ */

import {
  fetchOrgDetails,
  fetchOverview,
  fetchSeatUsage,
  fetchActivity,
  fetchFounders,
  fetchMembers,
  generateWeeklyReport,
  generateMonthlyReport,
} from "../../../api/organization";

const deriveAnalytics = (founders: FounderDrilldown[]) => {
  const byKey = <K extends string>(getKey: (f: FounderDrilldown) => K) => {
    const map: Record<string, number[]> = {};
    founders.forEach((f) => {
      const k = getKey(f);
      (map[k] ||= []).push(f.readinessScore);
    });
    return Object.entries(map).map(([key, vals]) => ({
      key,
      score: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
    }));
  };

  const readiness: ReadinessAggregation = {
    overallScore: founders.length
      ? Math.round(
          founders.reduce((a, f) => a + f.readinessScore, 0) / founders.length,
        )
      : 0,
    byCohort: byKey((f) => f.cohort).map((x) => ({
      cohort: x.key,
      score: x.score,
    })),
    byIndustry: byKey((f) => f.industry).map((x) => ({
      industry: x.key as Industry,
      score: x.score,
    })),
    byFundingStage: byKey((f) => f.fundingStage).map((x) => ({
      stage: x.key as FundingStage,
      score: x.score,
    })),
  };

  const completedTotal = founders.reduce(
    (a, f) => a + Math.round((f.completionRate / 100) * f.totalPitches),
    0,
  );
  const totalPitchesAll = founders.reduce((a, f) => a + f.totalPitches, 0);
  const completion: CompletionMetrics = {
    overallRate: totalPitchesAll
      ? Math.round((completedTotal / totalPitchesAll) * 100)
      : 0,
    completedPitches: completedTotal,
    incompletePitches: totalPitchesAll - completedTotal,
    byCohort: byKey((f) => f.cohort).map((x) => ({
      cohort: x.key,
      rate: x.score,
    })), // reuse grouping shape
  };

  const topImprovers = [...founders]
    .filter((f) => f.scoreHistory.length >= 2)
    .sort((a, b) => b.scoreImprovement - a.scoreImprovement)
    .slice(0, 3)
    .map((f) => ({
      memberId: f.memberId,
      name: f.name,
      improvement: f.scoreImprovement,
      from: f.scoreHistory[0].score,
      to: f.scoreHistory[f.scoreHistory.length - 1].score,
    }));

  const monthMap: Record<string, number[]> = {};
  founders.forEach((f) =>
    f.scoreHistory.forEach((h) => (monthMap[h.date] ||= []).push(h.score)),
  );
  const monthlyTrend = Object.entries(monthMap)
    .sort(([a], [b]) => (a > b ? 1 : -1))
    .map(([month, vals]) => ({
      month,
      avgScore: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
    }));

  const scoreImprovementSummary: ScoreImprovementSummary = {
    avgImprovement: founders.length
      ? Math.round(
          founders.reduce((a, f) => a + f.scoreImprovement, 0) /
            founders.length,
        )
      : 0,
    topImprovers,
    monthlyTrend,
  };

  const filters: FilterOptions = {
    cohorts: [...new Set(founders.map((f) => f.cohort))],
    industries: [...new Set(founders.map((f) => f.industry))],
    fundingStages: [...new Set(founders.map((f) => f.fundingStage))],
  };

  return { readiness, completion, scoreImprovementSummary, filters };
};

/* ------------------------------------------------------------------ */
/*  SHARED UI PRIMITIVES                                               */
/* ------------------------------------------------------------------ */

const GlassCard: React.FC<React.PropsWithChildren<{ className?: string }>> = ({
  className = "",
  children,
}) => (
  <div
    className={`rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-[#121215] shadow-sm transition-colors ${className}`}
  >
    {children}
  </div>
);

const SectionHeading: React.FC<{ title: string; action?: React.ReactNode }> = ({
  title,
  action,
}) => (
  <div className="flex items-center justify-between mb-4">
    <h2 className="font-display font-semibold text-2xl tracking-tight text-slate-900 dark:text-zinc-100">
      {title}
    </h2>
    {action}
  </div>
);

const statusStyles: Record<PitchStatus, string> = {
  Incomplete:
    "bg-slate-200/70 text-slate-600 dark:bg-white/10 dark:text-slate-300",
  "Needs Work":
    "bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300",
  Good: "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300",
  Excellent:
    "bg-indigo-100 text-indigo-700 dark:bg-indigo-400/10 dark:text-indigo-300",
};

const StatusPill: React.FC<{ status: PitchStatus }> = ({ status }) => (
  <span
    className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${statusStyles[status]}`}
  >
    {status}
  </span>
);

const memberStatusStyles: Record<
  MemberStatus,
  { label: string; className: string; icon: React.ReactNode }
> = {
  active: {
    label: "Active",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300",
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  invited: {
    label: "Invited",
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300",
    icon: <Hourglass className="w-3.5 h-3.5" />,
  },
  suspended: {
    label: "Suspended",
    className: "bg-red-100 text-red-700 dark:bg-red-400/10 dark:text-red-300",
    icon: <AlertCircle className="w-3.5 h-3.5" />,
  },
};

const MemberStatusPill: React.FC<{ status: MemberStatus }> = ({ status }) => {
  const s = memberStatusStyles[status];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${s.className}`}
    >
      {s.icon}
      {s.label}
    </span>
  );
};

const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

const Avatar: React.FC<{
  name: string;
  url?: string | null;
  size?: number;
}> = ({ name, url, size = 36 }) =>
  url ? (
    <img
      src={url}
      alt={name}
      className="rounded-full object-cover shrink-0"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className="rounded-full shrink-0 flex items-center justify-center text-white text-xs font-semibold bg-gradient-to-br from-indigo-600 to-sky-600 shadow-xs"
      style={{ width: size, height: size }}
    >
      {initials(name)}
    </div>
  );

const formatDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

const formatDuration = (seconds: number) => {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
};

/* Small colored +/- badge used for score-improvement figures */
const TrendBadge: React.FC<{ value: number; suffix?: string }> = ({
  value,
  suffix = "",
}) => {
  const isFlat = value === 0;
  const isPositive = value > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${
        isFlat
          ? "bg-slate-200/70 text-slate-600 dark:bg-white/10 dark:text-slate-300"
          : isPositive
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"
            : "bg-red-100 text-red-700 dark:bg-red-400/10 dark:text-red-300"
      }`}
    >
      {!isFlat &&
        (isPositive ? (
          <ArrowUpRight className="w-3 h-3" />
        ) : (
          <ArrowDownRight className="w-3 h-3" />
        ))}
      {isPositive ? "+" : ""}
      {value}
      {suffix}
    </span>
  );
};

/* Reusable label + bar + value row, used across the analytics panels */
const MiniBarList: React.FC<{
  items: { label: string; value: number }[];
  max?: number;
  barClassName?: string;
  formatValue?: (v: number) => string;
}> = ({ items, max, barClassName = "bg-indigo-400/80", formatValue }) => {
  const m = max ?? Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-600 dark:text-slate-300">
              {item.label}
            </span>
            <span className="text-slate-400">
              {formatValue ? formatValue(item.value) : item.value}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full ${barClassName}`}
              style={{ width: `${Math.min(100, (item.value / m) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  FILTERS — cohort + date range only (industry/funding stage were   */
/*  never real DB columns for a member/founder, so they've been cut)  */
/* ------------------------------------------------------------------ */

interface DashboardFilters {
  cohort: string;
  dateFrom: string;
  dateTo: string;
}

const DEFAULT_FILTERS: DashboardFilters = {
  cohort: "all",
  dateFrom: "",
  dateTo: "",
};

const isFiltersActive = (f: DashboardFilters) =>
  f.cohort !== "all" || !!f.dateFrom || !!f.dateTo;

const FilterBar: React.FC<{
  filters: DashboardFilters;
  onChange: (f: DashboardFilters) => void;
  cohorts: string[];
  dateLabel?: string;
}> = ({ filters, onChange, cohorts, dateLabel = "Date range" }) => {
  const update = (patch: Partial<DashboardFilters>) =>
    onChange({ ...filters, ...patch });
  return (
    <GlassCard className="p-4 mb-5">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 pr-1">
          <Filter className="w-3.5 h-3.5" /> Filters
        </div>

        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            <Layers className="w-3.5 h-3.5" /> Cohort
          </span>
          <select
            value={filters.cohort}
            onChange={(e) => update({ cohort: e.target.value })}
            className="px-2.5 py-2 rounded-lg text-xs bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400/50 min-w-[130px]"
          >
            <option value="all">All cohorts</option>
            {cohorts.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            <CalendarRange className="w-3.5 h-3.5" /> {dateLabel}
          </span>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => update({ dateFrom: e.target.value })}
              className="px-2.5 py-[7px] rounded-lg text-xs bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
            />
            <span className="text-slate-400 text-xs">–</span>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => update({ dateTo: e.target.value })}
              className="px-2.5 py-[7px] rounded-lg text-xs bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
            />
          </div>
        </div>

        {isFiltersActive(filters) && (
          <button
            onClick={() => onChange(DEFAULT_FILTERS)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors ml-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
        )}
      </div>
    </GlassCard>
  );
};

/* ------------------------------------------------------------------ */
/*  NAVIGATION                                                         */
/* ------------------------------------------------------------------ */

type NavKey =
  | "organization"
  | "overview"
  | "members"
  | "seats"
  | "activity"
  | "founders"
  | "reports"
  | "replays";

const NAV_ITEMS: { key: NavKey; label: string; icon: React.ReactNode }[] = [
  {
    key: "overview",
    label: "Dashboard overview",
    icon: <LayoutGrid className="w-[18px] h-[18px]" />,
  },
  {
    key: "members",
    label: "Member list",
    icon: <Users className="w-[18px] h-[18px]" />,
  },
  {
    key: "seats",
    label: "Seat usage",
    icon: <Armchair className="w-[18px] h-[18px]" />,
  },
  {
    key: "activity",
    label: "Activity overview",
    icon: <Activity className="w-[18px] h-[18px]" />,
  },
  {
    key: "founders",
    label: "Founder drill-down",
    icon: <UserSearch className="w-[18px] h-[18px]" />,
  },
  {
    key: "reports",
    label: "Reports",
    icon: <FileBarChart2 className="w-[18px] h-[18px]" />,
  },
  {
    key: "replays",
    label: "Replays",
    icon: <History className="w-[18px] h-[18px]" />,
  },
];

/* ------------------------------------------------------------------ */
/*  MAIN COMPONENT                                                     */
/* ------------------------------------------------------------------ */

const OrganizationDashboard: React.FC = () => {
  const { logout, authFetch } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<OrgDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<NavKey>("overview");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [memberQuery, setMemberQuery] = useState("");
  const [memberFilters, setMemberFilters] = useState<DashboardFilters>(DEFAULT_FILTERS);
  const [founderFilters, setFounderFilters] = useState<DashboardFilters>(DEFAULT_FILTERS);
  const [selectedFounderId, setSelectedFounderId] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchOrgDetails(authFetch),
      fetchOverview(authFetch),
      fetchSeatUsage(authFetch),
      fetchActivity(authFetch),
      fetchFounders(authFetch),
      fetchMembers(authFetch),
    ])
      .then(([organization, overview, seatUsage, activity, founders, members]) => {
        if (cancelled) return;
        const derived = deriveAnalytics(founders);
        setData({
          organization, overview, members, seatUsage, activity, founders,
          reports: [], replays: [], ...derived,
        });
        setSelectedFounderId(founders[0]?.memberId ?? "");
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [authFetch]);

  const filteredMembers = useMemo(() => {
    if (!data) return [];
    return data.members.filter((m) => {
      const q = memberQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q);
      const matchesCohort =
        memberFilters.cohort === "all" || m.cohort === memberFilters.cohort;
      const joined = m.joinedAt ? new Date(m.joinedAt).getTime() : null;
      const matchesFrom =
        !memberFilters.dateFrom ||
        (joined !== null && joined >= new Date(memberFilters.dateFrom).getTime());
      const matchesTo =
        !memberFilters.dateTo ||
        (joined !== null &&
          joined <= new Date(memberFilters.dateTo).getTime() + 86400000 - 1);
      return matchesQuery && matchesCohort && matchesFrom && matchesTo;
    });
  }, [data, memberQuery, memberFilters]);

  const filteredFounders = useMemo(() => {
    if (!data) return [];
    return data.founders.filter((f) => {
      const matchesCohort =
        founderFilters.cohort === "all" || f.cohort === founderFilters.cohort;
      const latestPitchDate = f.recentPitches[0]?.date ?? null;
      const latestTime = latestPitchDate ? new Date(latestPitchDate).getTime() : null;
      const matchesFrom =
        !founderFilters.dateFrom ||
        (latestTime !== null && latestTime >= new Date(founderFilters.dateFrom).getTime());
      const matchesTo =
        !founderFilters.dateTo ||
        (latestTime !== null &&
          latestTime <= new Date(founderFilters.dateTo).getTime() + 86400000 - 1);
      return matchesCohort && matchesFrom && matchesTo;
    });
  }, [data, founderFilters]);

  const selectedFounder = useMemo(
    () => filteredFounders.find((f) => f.memberId === selectedFounderId) ?? filteredFounders[0],
    [filteredFounders, selectedFounderId]
  );

  if (loading) return <div className="h-screen grid place-items-center text-slate-400">Loading dashboard…</div>;
  if (error || !data) return <div className="h-screen grid place-items-center text-red-500">Couldn't load dashboard: {error}</div>;

  const seatPct = Math.round((data.seatUsage.usedSeats / data.seatUsage.totalSeats) * 100);
  const maxActivity = Math.max(...data.activity.last7Days.map((d) => d.pitches), 1);
  const maxHistory = Math.max(...data.seatUsage.history.map((h) => h.used), 1);

  return (
    <div className="h-screen overflow-hidden bg-[#FAFBFC] dark:bg-[#09090B] text-slate-900 dark:text-zinc-100 transition-colors font-sans">
      <div className="flex h-full">
        {/* Mobile menu backdrop */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* ---------------------------------------------------- Sidebar */}
        <aside
          className={`
            fixed lg:sticky top-0 left-0 z-50 lg:z-0
            w-64 shrink-0 h-screen
            border-r border-slate-200/80 dark:border-zinc-800/80
            bg-white/95 dark:bg-zinc-950/95 lg:bg-white dark:lg:bg-zinc-950
            backdrop-blur-xl
            flex flex-col px-4 py-6
            transition-transform duration-300 ease-in-out
            ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          `}
        >
          {/* Brand Logo Header */}
          <div className="flex items-center justify-between px-2 mb-8">
            <div className="flex items-center gap-3">
              <LogoMark size="sm" />
              <div className="flex items-center gap-2">
                <span className="font-display font-semibold text-lg tracking-tight text-slate-900 dark:text-zinc-100">
                  PitchNest
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50 font-sans">
                  Org
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800"
            >
              <X size={18} />
            </button>
          </div>

          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive = active === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => {
                    setActive(item.key);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors text-left ${
                    isActive
                      ? "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 font-semibold"
                      : "text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800/50 hover:text-slate-700 dark:hover:text-zinc-200 font-medium"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto pt-4 border-t border-slate-200/80 dark:border-zinc-800/80 flex items-center gap-2">
            <button
              onClick={() => {
                setActive("organization");
                setIsMobileMenuOpen(false);
              }}
              className={`flex-1 min-w-0 flex items-center gap-3 p-2 rounded-xl text-left transition-colors ${
                active === "organization"
                  ? "bg-indigo-50 dark:bg-indigo-950/40"
                  : "hover:bg-slate-100/70 dark:hover:bg-zinc-800/50"
              }`}
            >
              <Avatar name={data.organization.orgName} size={34} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100 truncate">
                  {data.organization.orgName}
                </p>
                <p className="text-xs text-slate-500 dark:text-zinc-400 capitalize">
                  {data.organization.plan} plan
                </p>
              </div>
            </button>
            <button
              onClick={() => {
                logout();
                navigate("/organization-login");
              }}
              title="Sign out"
              className="p-2.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </aside>

        {/* ---------------------------------------------------- Main */}
        <main className="flex-1 min-w-0 h-full overflow-y-auto overscroll-contain">
          {/* Top bar */}
          <header className="flex items-center gap-4 px-6 lg:px-10 py-4 border-b border-slate-200/80 dark:border-zinc-800/80 sticky top-0 z-10 bg-[#FAFBFC]/80 dark:bg-[#09090B]/80 backdrop-blur-xl">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-xl text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <Menu size={20} />
            </button>

            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                placeholder="Search members, founders, reports..."
                className="w-full pl-10 pr-4 py-2 rounded-xl text-sm bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
              />
            </div>
            <div className="ml-auto flex items-center gap-3">
              <ThemeToggle />
              <button
                className="w-9 h-9 grid place-items-center rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors relative"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500" />
              </button>
              <button
                onClick={() => setActive("organization")}
                className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl gradient-brand text-white text-sm font-semibold shadow-xs hover:opacity-95 transition-opacity"
              >
                <ShieldCheck className="w-4 h-4" />
                View Plan
              </button>
            </div>
          </header>

            <div className="px-6 lg:px-10 py-8 space-y-8">
              {active === "organization" && (
                <OrganizationTab
                  org={data.organization}
                  onBack={() => setActive("overview")}
                />
              )}
              {active === "overview" && (
                <OverviewTab
                  data={data}
                  seatPct={seatPct}
                  onNavigate={setActive}
                />
              )}
              {active === "members" && (
                <MembersTab
                  members={filteredMembers}
                  query={memberQuery}
                  onQueryChange={setMemberQuery}
                  filters={memberFilters}
                  onFiltersChange={setMemberFilters}
                  cohorts={data.filters.cohorts}
                />
              )}
              {active === "seats" && (
                <SeatUsageTab
                  seatUsage={data.seatUsage}
                  maxHistory={maxHistory}
                />
              )}
              {active === "activity" && (
                <ActivityTab
                  activity={data.activity}
                  maxActivity={maxActivity}
                />
              )}
              {active === "founders" && (
                <FoundersTab
                  founders={filteredFounders}
                  selected={selectedFounder}
                  onSelect={setSelectedFounderId}
                  filters={founderFilters}
                  onFiltersChange={setFounderFilters}
                  cohorts={data.filters.cohorts}
                />
              )}
              {active === "reports" && <ReportsTab />}
              {active === "replays" && <ReplaysTab />}
            </div>
          </main>
        </div>
      </div>
  );
};

/* ------------------------------------------------------------------ */
/*  TAB: ORGANIZATION — full profile + QR "scanner" box                */
/* ------------------------------------------------------------------ */

const DetailRow: React.FC<{ label: string; value: React.ReactNode }> = ({
  label,
  value,
}) => (
  <div className="rounded-xl bg-slate-50 dark:bg-white/5 p-4">
    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</p>
    <p className="text-sm font-medium text-slate-900 dark:text-white break-words">
      {value}
    </p>
  </div>
);

const HeaderFact: React.FC<{ label: string; value: React.ReactNode }> = ({
  label,
  value,
}) => (
  <div>
    <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
    <p className="text-sm font-semibold text-slate-900 dark:text-white">
      {value}
    </p>
  </div>
);

const OrganizationTab: React.FC<{
  org: OrganizationDetails;
  onBack: () => void;
}> = ({ org, onBack }) => {
  const [copied, setCopied] = useState(false);

  // Public, no-key QR generator. Swap for a bundled lib (e.g. qrcode.react)
  // if you'd rather not depend on an external service.
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(
    org.enrollLink,
  )}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(org.enrollLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard API unavailable — ignore */
    }
  };

  const daysLeft =
    org.trialExpiresAt !== null
      ? Math.max(
          0,
          Math.ceil((new Date(org.trialExpiresAt).getTime() - Date.now()) / 86400000),
        )
      : null;

  const seatPct = org.capacity
    ? Math.round((org.enrolled / org.capacity) * 100)
    : 0;

  return (
    <div>
     

      <GlassCard className="p-6 mb-5">
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-4">
            <Avatar name={org.orgName} size={64} />
            <div>
              <p className="font-display font-semibold text-xl text-slate-900 dark:text-zinc-100">
                {org.orgName}
              </p>
              <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">
                {org.plan} plan · Org #{org.orgCode}
              </p>
            </div>
          </div>

          <div className="hidden sm:block w-px self-stretch bg-slate-200 dark:bg-white/10" />

          <div className="flex flex-wrap gap-x-10 gap-y-3">
            <HeaderFact label="Account email" value={org.email} />
            <HeaderFact
              label="Seats"
              value={`${org.enrolled} / ${org.capacity} (${seatPct}%)`}
            />
            <HeaderFact label="Validity" value={formatDate(org.validity)} />
            <HeaderFact
              label="Trial status"
              value={
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    org.trialStatus === "Active"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"
                      : "bg-slate-200/70 text-slate-600 dark:bg-white/10 dark:text-slate-300"
                  }`}
                >
                  {org.trialStatus}
                </span>
              }
            />
          </div>
        </div>
      </GlassCard>

      <div className="grid lg:grid-cols-3 gap-5">
        <GlassCard className="lg:col-span-2 p-6">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-5">
            Organization details
          </p>
          <div className="grid sm:grid-cols-3 gap-4">
            <DetailRow label="Organization name" value={org.orgName} />
            <DetailRow label="Org code" value={`#${org.orgCode}`} />
            <DetailRow label="Plan" value={org.plan || "—"} />
            <DetailRow label="Country" value={org.country || "—"} />
            <DetailRow label="Account email" value={org.email} />
            <DetailRow
              label="Website"
              value={
                org.websiteUrl ? (
                  <a
                    href={org.websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-indigo-600 dark:text-indigo-300 hover:underline"
                  >
                    <Globe className="w-3.5 h-3.5" /> {org.websiteUrl}
                  </a>
                ) : (
                  "—"
                )
              }
            />
            <DetailRow
              label="Seats"
              value={`${org.enrolled} / ${org.capacity} used (${seatPct}%)`}
            />
            <DetailRow label="Validity" value={formatDate(org.validity)} />
            <DetailRow label="Created" value={formatDate(org.createdAt)} />
            <DetailRow
              label="Trial status"
              value={
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    org.trialStatus === "Active"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"
                      : "bg-slate-200/70 text-slate-600 dark:bg-white/10 dark:text-slate-300"
                  }`}
                >
                  {org.trialStatus}
                </span>
              }
            />
            <DetailRow
              label="Trial window"
              value={
                org.trialStartedAt || org.trialExpiresAt
                  ? `${formatDate(org.trialStartedAt)} → ${formatDate(org.trialExpiresAt)}${
                      daysLeft !== null ? ` (${daysLeft}d left)` : ""
                    }`
                  : "—"
              }
            />
          </div>
        </GlassCard>

        {/* "Scanner" box: QR code encoding the org link, with the raw link
            shown underneath so it can be read/copied without scanning. */}
        <GlassCard className="p-6 flex flex-col items-center text-center">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4 self-start">
            Scan to open
          </p>
          <div className="p-3 rounded-2xl bg-white">
            <img
              src={qrSrc}
              alt="QR code for organization link"
              width={200}
              height={200}
              className="rounded-lg block"
            />
          </div>
          <div className="w-full mt-5 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
            <span className="flex-1 text-xs text-slate-600 dark:text-slate-300 truncate text-left">
              {org.enrollLink}
            </span>
            <button
              onClick={copyLink}
              className="shrink-0 flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" /> Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Copy
                </>
              )}
            </button>
          </div>
        </GlassCard>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  TAB: DASHBOARD OVERVIEW                                            */
/* ------------------------------------------------------------------ */

const OverviewTab: React.FC<{
  data: OrgDashboardData;
  seatPct: number;
  onNavigate: (key: NavKey) => void;
}> = ({ data, seatPct, onNavigate }) => {
  const activeMembers = data.members.filter(
    (m) => m.status === "active",
  ).length;
  const invitedMembers = data.members.filter(
    (m) => m.status === "invited",
  ).length;
  const suspendedMembers = data.members.filter(
    (m) => m.status === "suspended",
  ).length;
  const maxActivity = Math.max(
    ...data.activity.last7Days.map((d) => d.pitches),
    1,
  );

  const topFounders = [...data.founders]
    .sort((a, b) => (b.avgScore ?? -1) - (a.avgScore ?? -1))
    .slice(0, 3);
  const topFounderScore = Math.max(
    ...topFounders.map((f) => f.avgScore ?? 0),
    1,
  );

  const recentReplays = [...data.replays]
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))
    .slice(0, 3);

  const recentReports = [...data.reports]
    .sort((a, b) => +new Date(b.generatedAt) - +new Date(a.generatedAt))
    .slice(0, 3);

  const maxTrend = Math.max(
    ...data.scoreImprovementSummary.monthlyTrend.map((t) => t.avgScore),
    1,
  );

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl gradient-brand px-8 py-10 shadow-xl shadow-indigo-500/10">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <Sparkles className="absolute -right-6 -bottom-10 w-56 h-56 text-white/10 pointer-events-none" />
        <p className="text-indigo-100 text-sm font-medium mb-2 capitalize">
          {data.organization.plan} plan · valid through{" "}
          {formatDate(data.organization.validity)}
        </p>
        <h1 className="font-display font-semibold text-3xl text-white mb-3 tracking-tight">
          {data.organization.orgName}
        </h1>
        <p className="text-indigo-50/90 max-w-xl text-sm leading-relaxed">
          {data.overview.activeFoundersThisWeek} founders pitched this week
          across {data.overview.totalPitches} sessions. Average score is
          currently {data.overview.avgPitchScore}/100, up{" "}
          {data.overview.avgScoreImprovement} points per founder since they
          started.
        </p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          icon={<Users className="w-4 h-4" />}
          label="Total members"
          value={data.overview.totalMembers}
          onClick={() => onNavigate("members")}
        />
        <StatCard
          icon={<Armchair className="w-4 h-4" />}
          label="Seats used"
          value={`${data.overview.usedSeats}/${data.overview.totalSeats}`}
          sub={`${seatPct}% utilized`}
          onClick={() => onNavigate("seats")}
        />
        <StatCard
          icon={<Target className="w-4 h-4" />}
          label="Total pitches"
          value={data.overview.totalPitches}
          onClick={() => onNavigate("replays")}
        />
        <StatCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Avg pitch score"
          value={`${data.overview.avgPitchScore}/100`}
          onClick={() => onNavigate("founders")}
        />
        <StatCard
          icon={<Gauge className="w-4 h-4" />}
          label="Avg readiness score"
          value={`${data.overview.avgReadinessScore}/100`}
          onClick={() => onNavigate("founders")}
        />
        <StatCard
          icon={<ListChecks className="w-4 h-4" />}
          label="Completion rate"
          value={`${data.overview.completionRate}%`}
          onClick={() => onNavigate("founders")}
        />
        <StatCard
          icon={<Sparkles className="w-4 h-4" />}
          label="Active founders this week"
          value={data.overview.activeFoundersThisWeek}
          onClick={() => onNavigate("activity")}
        />
        <StatCard
          icon={<Hourglass className="w-4 h-4" />}
          label="Pending invites"
          value={data.seatUsage.pendingInvites}
          onClick={() => onNavigate("seats")}
        />
      </div>

      {/* Activity chart + breakdowns */}
      <div className="grid lg:grid-cols-3 gap-5">
        <GlassCard className="lg:col-span-2 p-6">
          <OverviewPanelHeader
            title="Pitch activity, last 7 days"
            onView={() => onNavigate("activity")}
          />
          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mb-5">
            <span>
              {data.activity.totalPitchesThisMonth} pitches this month
            </span>
            <span>·</span>
            <span>
              {data.activity.totalActiveUsersThisMonth} active founders
            </span>
          </div>
          <div className="flex items-end gap-3 h-32">
            {data.activity.last7Days.map((d) => (
              <div
                key={d.date}
                className="flex-1 flex flex-col items-center gap-2"
              >
                <div className="w-full flex items-end h-24">
                  <div
                    className="w-full rounded-t-lg bg-gradient-to-t from-indigo-500 to-blue-400 shadow-sm"
                    style={{ height: `${(d.pitches / maxActivity) * 100}%` }}
                  />
                </div>
                <span className="text-[11px] text-slate-400">
                  {new Date(d.date).toLocaleDateString(undefined, {
                    weekday: "short",
                  })}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>

        <div className="flex flex-col gap-5">
          <GlassCard className="p-6 flex-1">
            <OverviewPanelHeader
              title="Seats by role"
              onView={() => onNavigate("seats")}
            />
            <MiniBarList
              items={data.seatUsage.seatsByRole.map((r) => ({
                label: r.role,
                value: r.count,
              }))}
              max={data.seatUsage.usedSeats}
            />
          </GlassCard>

          <GlassCard className="p-6 flex-1">
            <OverviewPanelHeader
              title="Member status"
              onView={() => onNavigate("members")}
            />
            <div className="space-y-2.5">
              <MemberStatusRow
                label="Active"
                count={activeMembers}
                color="bg-emerald-400"
              />
              <MemberStatusRow
                label="Invited"
                count={invitedMembers}
                color="bg-blue-400"
              />
              <MemberStatusRow
                label="Suspended"
                count={suspendedMembers}
                color="bg-red-400"
              />
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Program health: readiness aggregation, completion metrics, score improvement */}
      <div className="grid lg:grid-cols-3 gap-5">
        <GlassCard className="p-6">
          <OverviewPanelHeader
            title="Readiness aggregation"
            onView={() => onNavigate("founders")}
          />
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 grid place-items-center shrink-0">
              <Gauge className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {data.readiness.overallScore}/100
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Org-wide pitch readiness
              </p>
            </div>
          </div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
            By cohort
          </p>
          <MiniBarList
            items={data.readiness.byCohort.map((c) => ({
              label: c.cohort,
              value: c.score,
            }))}
            max={100}
            formatValue={(v) => `${v}/100`}
          />
        </GlassCard>

        <GlassCard className="p-6">
          <OverviewPanelHeader
            title="Completion metrics"
            onView={() => onNavigate("founders")}
          />
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 grid place-items-center shrink-0">
              <ListChecks className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {data.completion.overallRate}%
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {data.completion.completedPitches} complete ·{" "}
                {data.completion.incompletePitches} incomplete
              </p>
            </div>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden flex mb-5">
            <div
              className="h-full bg-emerald-400"
              style={{ width: `${data.completion.overallRate}%` }}
            />
            <div
              className="h-full bg-slate-300 dark:bg-white/20"
              style={{ width: `${100 - data.completion.overallRate}%` }}
            />
          </div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
            By cohort
          </p>
          <MiniBarList
            items={data.completion.byCohort.map((c) => ({
              label: c.cohort,
              value: c.rate,
            }))}
            max={100}
            barClassName="bg-emerald-400/80"
            formatValue={(v) => `${v}%`}
          />
        </GlassCard>

        <GlassCard className="p-6">
          <OverviewPanelHeader
            title="Score improvement"
            onView={() => onNavigate("founders")}
          />
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 grid place-items-center shrink-0">
              <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                +{data.scoreImprovementSummary.avgImprovement} pts
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Avg gain, first to latest pitch
              </p>
            </div>
          </div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3">
            Top improvers
          </p>
          <div className="space-y-3">
            {data.scoreImprovementSummary.topImprovers.map((f) => (
              <div key={f.memberId} className="flex items-center gap-3">
                <Avatar name={f.name} size={26} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-700 dark:text-slate-200 truncate">
                    {f.name}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {f.from} → {f.to}
                  </p>
                </div>
                <TrendBadge value={f.improvement} suffix=" pts" />
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Score trend + segment mix */}
      <div className="grid lg:grid-cols-3 gap-5">
        <GlassCard className="lg:col-span-2 p-6">
          <OverviewPanelHeader
            title="Avg pitch score trend, last 6 months"
            onView={() => onNavigate("founders")}
          />
          <div className="flex items-end gap-3 h-28">
            {data.scoreImprovementSummary.monthlyTrend.map((t) => (
              <div
                key={t.month}
                className="flex-1 flex flex-col items-center gap-2"
              >
                <div className="w-full flex items-end h-20">
                  <div
                    className="w-full rounded-t-lg bg-gradient-to-t from-emerald-500 to-emerald-300 shadow-sm"
                    style={{ height: `${(t.avgScore / maxTrend) * 100}%` }}
                  />
                </div>
                <span className="text-[11px] text-slate-400">{t.month}</span>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">
            Readiness by segment
          </p>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
            Industry
          </p>
          <MiniBarList
            items={data.readiness.byIndustry.map((i) => ({
              label: i.industry,
              value: i.score,
            }))}
            max={100}
            barClassName="bg-blue-400/80"
            formatValue={(v) => `${v}/100`}
          />
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-5 mb-2">
            Funding stage
          </p>
          <MiniBarList
            items={data.readiness.byFundingStage.map((s) => ({
              label: s.stage,
              value: s.score,
            }))}
            max={100}
            barClassName="bg-purple-400/80"
            formatValue={(v) => `${v}/100`}
          />
        </GlassCard>
      </div>

      {/* Leaderboard + recent replays + recent reports */}
      <div className="grid lg:grid-cols-3 gap-5">
        <GlassCard className="p-6">
          <OverviewPanelHeader
            title="Top founders"
            onView={() => onNavigate("founders")}
          />
          <div className="space-y-4">
            {topFounders.map((f, i) => (
              <div key={f.memberId} className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full grid place-items-center text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 shrink-0">
                  {i + 1}
                </span>
                <Avatar name={f.name} url={f.avatarUrl} size={26} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-700 dark:text-slate-200 truncate">
                    {f.name}
                  </p>
                  <div className="h-1.5 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden mt-1">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-400"
                      style={{
                        width: `${((f.avgScore ?? 0) / topFounderScore) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                  {f.avgScore !== null ? f.avgScore : "N/A"}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <OverviewPanelHeader
            title="Recent replays"
            onView={() => onNavigate("replays")}
          />
          <div className="space-y-4">
            {recentReplays.map((r) => (
              <div key={r.id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-500/10 grid place-items-center shrink-0">
                  <Play
                    className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-300"
                    fill="currentColor"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-700 dark:text-slate-200 truncate">
                    {r.founderName}
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {formatDate(r.date)} · {r.panelType}
                  </p>
                </div>
                <StatusPill status={r.status} />
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <OverviewPanelHeader
            title="Recent reports"
            onView={() => onNavigate("reports")}
          />
          <div className="space-y-4">
            {recentReports.map((r) => (
              <div key={r.id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 grid place-items-center shrink-0">
                  <FileBarChart2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-700 dark:text-slate-200 truncate">
                    {r.title}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatDate(r.generatedAt)}
                  </p>
                </div>
                {r.status === "ready" ? (
                  <BadgeCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : (
                  <Hourglass className="w-4 h-4 text-amber-500 shrink-0" />
                )}
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </>
  );
};

const OverviewPanelHeader: React.FC<{ title: string; onView: () => void }> = ({
  title,
  onView,
}) => (
  <div className="flex items-center justify-between mb-5">
    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
      {title}
    </p>
    <button
      onClick={onView}
      className="flex items-center gap-0.5 text-xs font-medium text-indigo-600 dark:text-indigo-300 hover:text-indigo-700 dark:hover:text-indigo-200 transition-colors"
    >
      View all <ChevronRight className="w-3.5 h-3.5" />
    </button>
  </div>
);

const MemberStatusRow: React.FC<{
  label: string;
  count: number;
  color: string;
}> = ({ label, count, color }) => (
  <div className="flex items-center gap-2.5 text-sm">
    <span className={`w-2 h-2 rounded-full ${color}`} />
    <span className="text-slate-600 dark:text-slate-300 flex-1">{label}</span>
    <span className="font-semibold text-slate-900 dark:text-white">
      {count}
    </span>
  </div>
);

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: string;
  onClick?: () => void;
}> = ({ icon, label, value, sub, onClick }) => (
  <GlassCard
    className={`p-5 transition-shadow hover:shadow-lg ${onClick ? "cursor-pointer" : ""}`}
  >
    <button onClick={onClick} className="w-full text-left" disabled={!onClick}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400">
          {label}
        </span>
        <span className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 grid place-items-center">
          {icon}
        </span>
      </div>
      <p className="text-2xl font-bold text-slate-900 dark:text-white">
        {value}
      </p>
      {sub && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{sub}</p>
      )}
    </button>
  </GlassCard>
);

/* ------------------------------------------------------------------ */
/*  TAB: MEMBER LIST                                                    */
/* ------------------------------------------------------------------ */

const MembersTab: React.FC<{
  members: Member[];
  query: string;
  onQueryChange: (v: string) => void;
  filters: DashboardFilters;
  onFiltersChange: (f: DashboardFilters) => void;
  cohorts: string[];
}> = ({
  members,
  query,
  onQueryChange,
  filters,
  onFiltersChange,
  cohorts,
}) => (
  <div>
    <SectionHeading
      title="Member list"
      action={
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Filter members..."
            className="pl-9 pr-3 py-2 rounded-lg text-sm bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
          />
        </div>
      }
    />

    <FilterBar
      filters={filters}
      onChange={onFiltersChange}
      cohorts={cohorts}
      dateLabel="Joined between"
    />

    <GlassCard className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200/70 dark:border-white/10">
              <th className="px-5 py-3 font-semibold">Member</th>
              <th className="px-5 py-3 font-semibold">Role</th>
              <th className="px-5 py-3 font-semibold">Cohort</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Seat</th>
              <th className="px-5 py-3 font-semibold">Pitches</th>
              <th className="px-5 py-3 font-semibold">Avg score</th>
              <th className="px-5 py-3 font-semibold">Last active</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr
                key={m.id}
                className="border-b border-slate-100 dark:border-white/5 last:border-0 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors"
              >
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <Avatar name={m.name} url={m.avatarUrl} size={32} />
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 dark:text-white truncate">
                        {m.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 truncate">
                        <Mail className="w-3 h-3 shrink-0" /> {m.email}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">
                  {m.role}
                </td>
                <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">
                  {m.cohort}
                </td>
                <td className="px-5 py-3.5">
                  <MemberStatusPill status={m.status} />
                </td>
                <td className="px-5 py-3.5">
                  {m.seatAssigned ? (
                    <span className="text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                      Assigned
                    </span>
                  ) : (
                    <span className="text-slate-400 text-xs">Unassigned</span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">
                  {m.totalPitches}
                </td>
                <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">
                  {m.avgScore !== null ? `${m.avgScore}/100` : "—"}
                </td>
                <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">
                  {formatDate(m.lastActiveAt)}
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-5 py-10 text-center text-slate-400 text-sm"
                >
                  No members match your search or filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </GlassCard>
  </div>
);

/* ------------------------------------------------------------------ */
/*  TAB: SEAT USAGE                                                     */
/* ------------------------------------------------------------------ */

const SeatUsageTab: React.FC<{ seatUsage: SeatUsage; maxHistory: number }> = ({
  seatUsage,
  maxHistory,
}) => {
  const pct = Math.round((seatUsage.usedSeats / seatUsage.totalSeats) * 100);
  return (
    <div>
      <SectionHeading title="Seat usage" />
      <div className="grid lg:grid-cols-3 gap-5">
        <GlassCard className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {seatUsage.usedSeats} of {seatUsage.totalSeats} seats used
            </span>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {seatUsage.planName} plan
            </span>
          </div>
          <div className="h-3 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden mb-1">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
            {pct}% utilized · {seatUsage.pendingInvites} pending invites
          </p>

          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3">
            Seats used, last 6 months
          </p>
          <div className="flex items-end gap-3 h-32">
            {seatUsage.history.map((h) => (
              <div
                key={h.month}
                className="flex-1 flex flex-col items-center gap-2"
              >
                <div className="w-full flex items-end h-24">
                  <div
                    className="w-full rounded-t-lg bg-gradient-to-t from-indigo-500/80 to-blue-400/80"
                    style={{ height: `${(h.used / maxHistory) * 100}%` }}
                  />
                </div>
                <span className="text-[11px] text-slate-400">{h.month}</span>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-4">
            Seats by role
          </p>
          <MiniBarList
            items={seatUsage.seatsByRole.map((r) => ({
              label: r.role,
              value: r.count,
            }))}
            max={seatUsage.usedSeats}
          />
        </GlassCard>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  TAB: ACTIVITY OVERVIEW                                              */
/* ------------------------------------------------------------------ */

const ActivityTab: React.FC<{
  activity: ActivityOverview;
  maxActivity: number;
}> = ({ activity, maxActivity }) => (
  <div>
    <SectionHeading title="Activity overview" />
    <div className="grid lg:grid-cols-3 gap-5">
      <GlassCard className="lg:col-span-2 p-6">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Pitches, last 7 days
          </p>
          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
            <span>{activity.totalPitchesThisMonth} this month</span>
            <span>·</span>
            <span>{activity.totalActiveUsersThisMonth} active founders</span>
          </div>
        </div>
        <div className="flex items-end gap-4 h-40">
          {activity.last7Days.map((d) => (
            <div
              key={d.date}
              className="flex-1 flex flex-col items-center gap-2"
            >
              <div className="w-full flex items-end h-32">
                <div
                  className="w-full rounded-t-lg bg-gradient-to-t from-indigo-500 to-blue-400 shadow-sm"
                  style={{ height: `${(d.pitches / maxActivity) * 100}%` }}
                />
              </div>
              <span className="text-[11px] text-slate-400">
                {new Date(d.date).toLocaleDateString(undefined, {
                  weekday: "short",
                })}
              </span>
              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                {d.pitches}
              </span>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="p-6">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-4">
          Most active this month
        </p>
        <div className="space-y-3">
          {activity.topActiveMembers.map((m, i) => (
            <div key={m.memberId} className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full grid place-items-center text-xs font-semibold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
                {i + 1}
              </span>
              <Avatar name={m.name} size={28} />
              <span className="flex-1 text-sm text-slate-700 dark:text-slate-200 truncate">
                {m.name}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {m.pitches} pitches
              </span>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/*  TAB: FOUNDER DRILL-DOWN                                             */
/* ------------------------------------------------------------------ */

const FoundersTab: React.FC<{
  founders: FounderDrilldown[];
  selected?: FounderDrilldown;
  onSelect: (id: string) => void;
  filters: DashboardFilters;
  onFiltersChange: (f: DashboardFilters) => void;
  cohorts: string[];
}> = ({
  founders,
  selected,
  onSelect,
  filters,
  onFiltersChange,
  cohorts,
}) => {
  const maxScoreHistory = selected
    ? Math.max(...selected.scoreHistory.map((s) => s.score), 1)
    : 1;

  return (
    <div>
      <SectionHeading title="Founder drill-down" />

      <FilterBar
        filters={filters}
        onChange={onFiltersChange}
        cohorts={cohorts}
        dateLabel="Pitch between"
      />

      <div className="grid lg:grid-cols-3 gap-5">
        <GlassCard className="p-3 lg:self-start">
          <div className="space-y-1">
            {founders.map((f) => (
              <button
                key={f.memberId}
                onClick={() => onSelect(f.memberId)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                  selected?.memberId === f.memberId
                    ? "bg-indigo-50 dark:bg-indigo-500/10"
                    : "hover:bg-slate-50 dark:hover:bg-white/[0.03]"
                }`}
              >
                <Avatar name={f.name} url={f.avatarUrl} size={34} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {f.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {f.cohort}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>
            ))}
            {founders.length === 0 && (
              <p className="px-3 py-10 text-center text-slate-400 text-sm">
                No founders match your filters.
              </p>
            )}
          </div>
        </GlassCard>

        {selected && (
          <div className="lg:col-span-2 space-y-5">
            <GlassCard className="p-6">
              <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
                <div className="flex items-center gap-4">
                  <Avatar
                    name={selected.name}
                    url={selected.avatarUrl}
                    size={52}
                  />
                  <div>
                    <p className="font-display font-semibold text-xl text-slate-900 dark:text-zinc-100">
                      {selected.name}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-zinc-400 flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" /> {selected.email}
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                  {selected.cohort}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <MiniStat
                  icon={<Target className="w-4 h-4" />}
                  label="Total pitches"
                  value={selected.totalPitches}
                />
                <MiniStat
                  icon={<TrendingUp className="w-4 h-4" />}
                  label="Avg score"
                  value={
                    selected.avgScore !== null
                      ? `${selected.avgScore}/100`
                      : "N/A"
                  }
                />
                <MiniStat
                  icon={<Award className="w-4 h-4" />}
                  label="Best score"
                  value={
                    selected.bestScore !== null
                      ? `${selected.bestScore}/100`
                      : "N/A"
                  }
                />
                <MiniStat
                  icon={<Gauge className="w-4 h-4" />}
                  label="Readiness score"
                  value={`${selected.readinessScore}/100`}
                />
                <MiniStat
                  icon={<ListChecks className="w-4 h-4" />}
                  label="Completion rate"
                  value={`${selected.completionRate}%`}
                />
                <div className="rounded-xl bg-slate-50 dark:bg-white/5 p-4">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-2">
                    {selected.scoreImprovement >= 0 ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                    Score improvement
                  </div>
                  <TrendBadge value={selected.scoreImprovement} suffix=" pts" />
                </div>
              </div>
            </GlassCard>

            <GlassCard className="p-6">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">
                Score trend
              </p>
              <div className="flex items-end gap-3 h-24">
                {selected.scoreHistory.map((s) => (
                  <div
                    key={s.date}
                    className="flex-1 flex flex-col items-center gap-2"
                  >
                    <div className="w-full flex items-end h-16">
                      <div
                        className="w-full rounded-t-lg bg-gradient-to-t from-indigo-500 to-blue-400 shadow-sm"
                        style={{
                          height: `${(s.score / maxScoreHistory) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-[11px] text-slate-400">{s.date}</span>
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      {s.score}
                    </span>
                  </div>
                ))}
              </div>
            </GlassCard>

            {selected.lastFeedback && (
              <GlassCard className="p-6 border-l-4 border-l-indigo-500 rounded-l-none">
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white mb-2">
                  <Sparkles className="w-4 h-4 text-indigo-500" /> Latest AI
                  feedback
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  &ldquo;{selected.lastFeedback}&rdquo;
                </p>
              </GlassCard>
            )}

            <GlassCard className="p-2">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 pt-3 pb-2">
                Recent pitches
              </p>
              <div className="divide-y divide-slate-100 dark:divide-white/5">
                {selected.recentPitches.map((p) => (
                  <div key={p.id} className="flex items-center gap-4 px-4 py-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-white/5 grid place-items-center shrink-0">
                      <Play className="w-4 h-4 text-slate-500 dark:text-slate-300" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {p.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {formatDate(p.date)} · {p.panelType}
                      </p>
                    </div>
                    <span className="text-sm text-slate-600 dark:text-slate-300 w-14 text-right">
                      {p.score !== null ? p.score : "N/A"}
                    </span>
                    <StatusPill status={p.status} />
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
        )}
      </div>
    </div>
  );
};

const MiniStat: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}> = ({ icon, label, value }) => (
  <div className="rounded-xl bg-slate-50 dark:bg-white/5 p-4">
    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-2">
      {icon}
      {label}
    </div>
    <p className="text-lg font-bold text-slate-900 dark:text-white">{value}</p>
  </div>
);

/* ------------------------------------------------------------------ */
/*  TAB: REPORTS                                                        */
/* ------------------------------------------------------------------ */

const ReportsTab: React.FC = () => {
  const { authFetch } = useAuth();
  const [reports, setReports] = useState<any[]>([]);
  const [generating, setGenerating] = useState<"weekly" | "monthly" | null>(
    null,
  );

  const runWeekly = async () => {
    setGenerating("weekly");
    try {
      const r = await generateWeeklyReport(authFetch);
      setReports((prev) => [r, ...prev]);
    } finally {
      setGenerating(null);
    }
  };

  const runMonthly = async () => {
    setGenerating("monthly");
    try {
      const r = await generateMonthlyReport(authFetch);
      setReports((prev) => [r, ...prev]);
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div>
      <SectionHeading
        title="Reports"
        action={
          <div className="flex gap-2">
            <button
              onClick={runWeekly}
              disabled={generating !== null}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white disabled:opacity-50"
            >
              {generating === "weekly"
                ? "Generating…"
                : "Generate weekly report"}
            </button>
            <button
              onClick={runMonthly}
              disabled={generating !== null}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-slate-900 dark:bg-white dark:text-slate-900 text-white disabled:opacity-50"
            >
              {generating === "monthly"
                ? "Generating…"
                : "Generate monthly report"}
            </button>
          </div>
        }
      />
      <div className="grid md:grid-cols-2 gap-4">
        {reports.map((r, i) => (
          <GlassCard key={i} className="p-5">
            <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">
              {r.title}
            </p>
            <p className="text-xs text-slate-400 mb-3">
              {formatDate(r.generatedAt)}
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>{r.totalPitches} pitches</span>
              <span>{r.completionRate}% completion</span>
              <span>Avg score {r.avgScore}</span>
              <span>{r.activeFounders} active founders</span>
            </div>
          </GlassCard>
        ))}
        {reports.length === 0 && (
          <p className="text-slate-400 text-sm">
            No reports generated yet — use the buttons above.
          </p>
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  TAB: REPLAYS                                                        */
/* ------------------------------------------------------------------ */

const ReplaysTab: React.FC = () => (
  <div>
    <SectionHeading title="Replays" />
    <GlassCard className="p-12 flex flex-col items-center text-center gap-3">
      <History className="w-8 h-8 text-slate-300 dark:text-slate-600" />
      <p className="text-slate-500 dark:text-slate-400 text-sm">
        Replays aren't wired up yet — coming soon.
      </p>
    </GlassCard>
  </div>
);

export default OrganizationDashboard;
