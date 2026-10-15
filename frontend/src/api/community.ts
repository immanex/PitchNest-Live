import type { AuthFetch } from "./businesses";
import type { ReportReason } from "./discover";

/**
 * Community discussions. Reads go through authFetch even for visitors: it only
 * adds a token when one exists, and the reads accept optional auth so authors
 * see their own remove buttons.
 */

export const COMMUNITY_TOPICS = [
  "pitching",
  "fundraising",
  "growth",
  "operations",
  "validation",
  "hiring",
  "general",
] as const;
export type CommunityTopic = (typeof COMMUNITY_TOPICS)[number];

export const TOPIC_LABELS: Record<CommunityTopic, string> = {
  pitching: "Pitching",
  fundraising: "Fundraising",
  growth: "Growth",
  operations: "Operations",
  validation: "Validation",
  hiring: "Hiring",
  general: "General",
};

export const THREAD_TITLE_MAX = 140;
export const THREAD_BODY_MAX = 3000;
export const REPLY_MAX = 2000;

export interface ThreadSummary {
  id: string;
  topic: CommunityTopic;
  title: string;
  excerpt: string;
  createdAt: string;
  lastActivityAt: string;
  replyCount: number;
  author: { name: string };
  viewerIsAuthor: boolean;
}

export interface ThreadDetail {
  id: string;
  topic: CommunityTopic;
  title: string;
  body: string;
  createdAt: string;
  lastActivityAt: string;
  replyCount: number;
  author: { name: string; avatarUrl: string | null };
  viewerIsAuthor: boolean;
}

export interface CommunityReply {
  id: string;
  body: string;
  createdAt: string;
  author: { name: string; avatarUrl: string | null };
  viewerIsAuthor: boolean;
}

export interface Page<T> {
  data: T[];
  pagination: { hasMore: boolean; nextCursor: string | null };
}

export class CommunityApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "CommunityApiError";
    this.status = status;
  }
}

async function read<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new CommunityApiError(body?.error || `Request failed (${response.status}).`, response.status);
  return body as T;
}

const json = (method: string, payload?: unknown): RequestInit => ({
  method,
  headers: payload === undefined ? undefined : { "Content-Type": "application/json" },
  body: payload === undefined ? undefined : JSON.stringify(payload),
});

export async function fetchThreads(
  authFetch: AuthFetch,
  filters: { topic?: CommunityTopic | ""; q?: string; cursor?: string | null },
  signal?: AbortSignal,
): Promise<Page<ThreadSummary>> {
  const query = new URLSearchParams();
  if (filters.topic) query.set("topic", filters.topic);
  if (filters.q) query.set("q", filters.q);
  if (filters.cursor) query.set("cursor", filters.cursor);
  return read<Page<ThreadSummary>>(await authFetch(`/api/community/threads?${query.toString()}`, { signal }));
}

export async function fetchThread(authFetch: AuthFetch, threadId: string, signal?: AbortSignal): Promise<ThreadDetail> {
  return (await read<{ data: ThreadDetail }>(
    await authFetch(`/api/community/threads/${encodeURIComponent(threadId)}`, { signal }),
  )).data;
}

export async function fetchReplies(
  authFetch: AuthFetch,
  threadId: string,
  cursor?: string | null,
  signal?: AbortSignal,
): Promise<Page<CommunityReply>> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return read<Page<CommunityReply>>(
    await authFetch(`/api/community/threads/${encodeURIComponent(threadId)}/replies${query}`, { signal }),
  );
}

export async function createThread(
  authFetch: AuthFetch,
  input: { topic: CommunityTopic; title: string; body: string },
): Promise<{ id: string }> {
  return (await read<{ data: { id: string } }>(await authFetch("/api/community/threads", json("POST", input)))).data;
}

export async function createReply(authFetch: AuthFetch, threadId: string, body: string): Promise<CommunityReply> {
  return (await read<{ data: CommunityReply }>(
    await authFetch(`/api/community/threads/${encodeURIComponent(threadId)}/replies`, json("POST", { body })),
  )).data;
}

export async function removeThread(authFetch: AuthFetch, threadId: string): Promise<void> {
  await read<void>(await authFetch(`/api/community/threads/${encodeURIComponent(threadId)}`, json("DELETE")));
}

export async function removeReply(authFetch: AuthFetch, replyId: string): Promise<void> {
  await read<void>(await authFetch(`/api/community/replies/${encodeURIComponent(replyId)}`, json("DELETE")));
}

export async function reportCommunityItem(
  authFetch: AuthFetch,
  input: { entityType: "thread" | "reply"; entityId: string; reason: ReportReason; details?: string },
): Promise<{ received: boolean; alreadyReported: boolean }> {
  return (await read<{ data: { received: boolean; alreadyReported: boolean } }>(
    await authFetch("/api/community/reports", json("POST", input)),
  )).data;
}
