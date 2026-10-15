import type { AuthFetch } from "./businesses";

/** Staff-curated opportunities (accelerators, grants, competitions, events). */

export const OPPORTUNITY_KINDS = [
  "accelerator",
  "grant",
  "competition",
  "event",
  "fellowship",
  "program",
  "other",
] as const;
export type OpportunityKind = (typeof OPPORTUNITY_KINDS)[number];

export const KIND_LABELS: Record<OpportunityKind, string> = {
  accelerator: "Accelerator",
  grant: "Grant",
  competition: "Pitch competition",
  event: "Event",
  fellowship: "Fellowship",
  program: "Programme",
  other: "Other",
};

export type OpportunityState = "upcoming" | "open" | "closing_soon" | "closed" | "rolling";
export type OpportunityStatus = "draft" | "published" | "archived";

export interface Opportunity {
  id: string;
  title: string;
  organizer: string;
  kind: OpportunityKind;
  summary: string;
  eligibility: string;
  region: string;
  sector: string;
  sourceUrl: string;
  opensOn: string | null;
  closesOn: string | null;
  lastCheckedAt: string | null;
  state: OpportunityState;
  daysLeft: number | null;
}

export interface StaffOpportunity extends Opportunity {
  status: OpportunityStatus;
  stale: boolean;
  updatedAt: string | null;
}

export interface OpportunityInput {
  title: string;
  organizer: string;
  kind: OpportunityKind;
  summary: string;
  eligibility: string;
  region: string;
  sector: string;
  sourceUrl: string;
  opensOn: string;
  closesOn: string;
  status: OpportunityStatus;
}

async function read<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw Object.assign(new Error(body?.error || `Request failed (${response.status}).`), { status: response.status });
  return (body as { data: T }).data;
}

export async function fetchOpportunities(
  filters: { kind?: OpportunityKind | ""; region?: string; q?: string; includeClosed?: boolean },
  signal?: AbortSignal,
): Promise<Opportunity[]> {
  const query = new URLSearchParams();
  if (filters.kind) query.set("kind", filters.kind);
  if (filters.region) query.set("region", filters.region);
  if (filters.q) query.set("q", filters.q);
  if (filters.includeClosed) query.set("includeClosed", "true");
  return read<Opportunity[]>(await fetch(`/api/public/opportunities?${query.toString()}`, { signal }));
}

export async function fetchStaffOpportunities(authFetch: AuthFetch): Promise<StaffOpportunity[]> {
  return read<StaffOpportunity[]>(await authFetch("/api/staff/opportunities"));
}

export async function saveStaffOpportunity(
  authFetch: AuthFetch,
  input: OpportunityInput,
  id?: string,
): Promise<StaffOpportunity> {
  return read<StaffOpportunity>(
    await authFetch(id ? `/api/staff/opportunities/${encodeURIComponent(id)}` : "/api/staff/opportunities", {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function updateStaffOpportunityStatus(
  authFetch: AuthFetch,
  id: string,
  status: OpportunityStatus,
): Promise<StaffOpportunity> {
  return read<StaffOpportunity>(
    await authFetch(`/api/staff/opportunities/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }),
  );
}

export async function markStaffOpportunityChecked(authFetch: AuthFetch, id: string): Promise<StaffOpportunity> {
  return read<StaffOpportunity>(
    await authFetch(`/api/staff/opportunities/${encodeURIComponent(id)}/checked`, { method: "POST" }),
  );
}
