import type { AuthFetch } from "./businesses";

/**
 * Discover engagement client: supports, follows, comments and reports.
 *
 * Reads go through `authFetch` even for visitors. It only attaches a token
 * when one exists, and the backend's optional-auth reads never return 401,
 * so a signed-out visitor simply gets the anonymous view.
 */

export interface BusinessEngagement {
  supportCount: number;
  followerCount: number;
  commentCount: number;
  viewer: { supports: boolean; follows: boolean; isMember: boolean } | null;
}

export interface PublicComment {
  id: string;
  body: string;
  createdAt: string;
  author: { name: string; avatarUrl: string | null; isBusinessMember: boolean };
  viewerCanRemove: boolean;
  /** Structured feedback type (Pitch Arena). Missing on older backends. */
  category?: CommentCategory | null;
  /** True when the comment was left on the business's public pitch. */
  onPitch?: boolean;
}

export type CommentCategory = "question" | "clarity" | "customer" | "evidence" | "go_to_market";

export interface CommentPage {
  data: PublicComment[];
  pagination: { hasMore: boolean; nextCursor: string | null };
}

export const REPORT_REASONS = [
  "spam",
  "harassment",
  "misleading",
  "inappropriate",
  "intellectual_property",
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: "Spam or advertising",
  harassment: "Harassment or hateful content",
  misleading: "Misleading or false claims",
  inappropriate: "Inappropriate content",
  intellectual_property: "Copies someone else's work",
  other: "Something else",
};

export const COMMENT_MAX_LENGTH = 1000;

export class DiscoverApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "DiscoverApiError";
    this.status = status;
    this.code = code;
  }
}

async function read<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new DiscoverApiError(
      body?.error || `Request failed (${response.status}).`,
      response.status,
      body?.code,
    );
  }
  return body as T;
}

function jsonOptions(method: string, payload?: unknown): RequestInit {
  return {
    method,
    headers: payload === undefined ? undefined : { "Content-Type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  };
}

export interface EcosystemFeatures {
  discoverEngagement: boolean;
  community: boolean;
  pitchArena: boolean;
}

let featuresRequest: Promise<EcosystemFeatures> | null = null;

/** Server-controlled feature flags, fetched once per page load. */
export function fetchDiscoverFeatures(): Promise<EcosystemFeatures> {
  if (!featuresRequest) {
    featuresRequest = fetch("/api/public/features")
      .then((response) =>
        read<{ data: { discoverEngagement?: boolean; community?: boolean; pitchArena?: boolean } }>(response),
      )
      .then((body) => ({
        discoverEngagement: body?.data?.discoverEngagement === true,
        community: body?.data?.community === true,
        pitchArena: body?.data?.pitchArena === true,
      }))
      .catch(() => {
        featuresRequest = null;
        return { discoverEngagement: false, community: false, pitchArena: false };
      });
  }
  return featuresRequest;
}

export async function fetchBusinessEngagement(
  authFetch: AuthFetch,
  slug: string,
  signal?: AbortSignal,
): Promise<BusinessEngagement> {
  const response = await authFetch(`/api/public/businesses/${encodeURIComponent(slug)}/engagement`, { signal });
  return (await read<{ data: BusinessEngagement }>(response)).data;
}

export async function fetchBusinessComments(
  authFetch: AuthFetch,
  slug: string,
  cursor?: string | null,
  signal?: AbortSignal,
): Promise<CommentPage> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  const response = await authFetch(
    `/api/public/businesses/${encodeURIComponent(slug)}/comments${query}`,
    { signal },
  );
  return read<CommentPage>(response);
}

export async function setBusinessEngagement(
  authFetch: AuthFetch,
  slug: string,
  kind: "support" | "follow",
  active: boolean,
): Promise<{ active: boolean; count: number }> {
  const response = await authFetch(
    `/api/discover/businesses/${encodeURIComponent(slug)}/${kind}`,
    jsonOptions(active ? "PUT" : "DELETE"),
  );
  return (await read<{ data: { active: boolean; count: number } }>(response)).data;
}

export async function postBusinessComment(
  authFetch: AuthFetch,
  slug: string,
  body: string,
  options: { category?: CommentCategory | null; onPitch?: boolean } = {},
): Promise<PublicComment> {
  const payload: Record<string, unknown> = { body };
  if (options.category) payload.category = options.category;
  if (options.onPitch) payload.onPitch = true;
  const response = await authFetch(
    `/api/discover/businesses/${encodeURIComponent(slug)}/comments`,
    jsonOptions("POST", payload),
  );
  return (await read<{ data: PublicComment }>(response)).data;
}

export async function removeBusinessComment(authFetch: AuthFetch, commentId: string): Promise<void> {
  const response = await authFetch(
    `/api/discover/comments/${encodeURIComponent(commentId)}`,
    jsonOptions("DELETE"),
  );
  await read<void>(response);
}

export interface ReportInput {
  entityType: "business" | "comment" | "pitch";
  slug: string;
  commentId?: string;
  reason: ReportReason;
  details?: string;
}

export async function reportContent(
  authFetch: AuthFetch,
  input: ReportInput,
): Promise<{ received: boolean; alreadyReported: boolean }> {
  const response = await authFetch("/api/discover/reports", jsonOptions("POST", input));
  return (await read<{ data: { received: boolean; alreadyReported: boolean } }>(response)).data;
}

// ─── Staff moderation ────────────────────────────────────────────────────────

export type ReportStatus = "open" | "actioned" | "dismissed";

export type ModerationEntityType = "business" | "comment" | "thread" | "reply" | "pitch";

export interface StaffReport {
  id: string;
  entityType: ModerationEntityType;
  entityId: string;
  reason: ReportReason;
  details: string;
  status: ReportStatus;
  createdAt: string | null;
  resolvedAt: string | null;
  resolutionNote: string;
  openReportsForEntity: number;
  /** Null for community reports (discussions and replies). */
  business: { id: string; name: string; slug: string; status: string } | null;
  comment: { body: string; status: string } | null;
  community: { threadId: string | null; threadTitle: string; body: string; status: string } | null;
  /** The reported public pitch (migration 0026). Missing on older backends. */
  pitch?: { headline: string; body: string; status: string } | null;
}

export async function fetchStaffReports(
  authFetch: AuthFetch,
  status: ReportStatus,
): Promise<StaffReport[]> {
  const response = await authFetch(`/api/staff/moderation/reports?status=${status}`);
  return (await read<{ data: StaffReport[] }>(response)).data;
}

export async function resolveStaffReport(
  authFetch: AuthFetch,
  reportId: string,
  action: "hide" | "dismiss",
  note?: string,
): Promise<void> {
  const response = await authFetch(
    `/api/staff/moderation/reports/${encodeURIComponent(reportId)}/resolve`,
    jsonOptions("POST", { action, note: note || undefined }),
  );
  await read<unknown>(response);
}

export async function restoreStaffContent(
  authFetch: AuthFetch,
  entityType: ModerationEntityType,
  entityId: string,
): Promise<void> {
  const response = await authFetch(
    "/api/staff/moderation/restore",
    jsonOptions("POST", { entityType, entityId }),
  );
  await read<unknown>(response);
}
