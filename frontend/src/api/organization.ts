import type {
  OrgOverview,
  SeatUsage,
  ActivityOverview,
  FounderDrilldown,
  Member,
  OrganizationDetails,
} from "../pages/organization/dashbaord/Main";

const BASE_URL = "/api/organization";

export type AuthFetch = (url: string, options?: RequestInit) => Promise<Response>;

async function post<T>(
  authFetch: AuthFetch,
  path: string,
  body: Record<string, unknown> = {},
): Promise<T> {
  const res = await authFetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(json?.error || `Request to ${path} failed (${res.status})`);
  }
  return json.data as T;
}

// Organization identity and scope are derived from the authenticated token.
// No API accepts an organization id from browser-controlled request data.
export const fetchOrgDetails = (authFetch: AuthFetch) =>
  post<OrganizationDetails>(authFetch, "/details");
export const fetchOverview = (authFetch: AuthFetch) =>
  post<OrgOverview>(authFetch, "/overview");
export const fetchSeatUsage = (authFetch: AuthFetch) =>
  post<SeatUsage>(authFetch, "/seats");
export const fetchActivity = (authFetch: AuthFetch) =>
  post<ActivityOverview>(authFetch, "/activity");
export const fetchFounders = (authFetch: AuthFetch) =>
  post<{ founders: FounderDrilldown[] }>(authFetch, "/founder-drill").then(
    (data) => data.founders,
  );
export const fetchMembers = (authFetch: AuthFetch) =>
  post<{ members: Member[] }>(authFetch, "/members").then(
    (data) => data.members,
  );
export const generateWeeklyReport = (authFetch: AuthFetch, date?: string) =>
  post<any>(authFetch, "/reports/weekly", { date });
export const generateMonthlyReport = (
  authFetch: AuthFetch,
  month?: number,
  year?: number,
) => post<any>(authFetch, "/reports/monthly", { month, year });
