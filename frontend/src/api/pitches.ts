import type { AuthFetch } from "./businesses";
import type { CommentCategory } from "./discover";

/** Public pitches (text) and structured feedback. Backend: migration 0026. */

export const PITCH_HEADLINE_MAX = 120;
export const PITCH_BODY_MIN = 50;
export const PITCH_BODY_MAX = 1500;
export const PITCH_ASK_MAX = 300;

export const FEEDBACK_CATEGORIES: readonly CommentCategory[] = ["question", "clarity", "customer", "evidence", "go_to_market"];
export type FeedbackCategory = CommentCategory;

export const FEEDBACK_LABELS: Record<FeedbackCategory, string> = {
  question: "Question",
  clarity: "Clarity",
  customer: "Customer",
  evidence: "Evidence",
  go_to_market: "Go-to-market",
};

export const FEEDBACK_PROMPTS: Record<FeedbackCategory, string> = {
  question: "Ask the question an investor or customer would ask.",
  clarity: "Was anything unclear? Where did you get lost?",
  customer: "Is the customer clear? Who else might buy this?",
  evidence: "What evidence would make this more convincing?",
  go_to_market: "How could they reach their next customers faster?",
};

export interface MemberPitch {
  id: string;
  status: "draft" | "published" | "withdrawn" | "hidden";
  version: number;
  headline: string;
  body: string;
  feedbackAsk: string;
  approvedAt: string | null;
  updatedAt: string | null;
}

export interface MemberPitchState {
  draft: MemberPitch | null;
  published: MemberPitch | null;
  hidden: boolean;
  consentVersion: string;
}

export interface PublicPitch {
  version: number;
  headline: string;
  body: string;
  feedbackAsk: string;
  publishedAt: string | null;
  feedbackCount: number;
}

export interface PitchSummary {
  headline: string;
  excerpt: string;
  feedbackAsk: string;
  publishedAt: string | null;
  feedbackCount: number;
  business: { slug: string; name: string; tagline: string; industry: string; region: string };
}

async function read<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw Object.assign(new Error(body?.error || `Request failed (${response.status}).`), { status: response.status });
  }
  return body as T;
}

const json = (method: string, payload?: unknown): RequestInit => ({
  method,
  headers: payload === undefined ? undefined : { "Content-Type": "application/json" },
  body: payload === undefined ? undefined : JSON.stringify(payload),
});

export async function fetchMemberPitch(authFetch: AuthFetch, businessId: string): Promise<MemberPitchState> {
  return (await read<{ data: MemberPitchState }>(
    await authFetch(`/api/businesses/${encodeURIComponent(businessId)}/pitch`),
  )).data;
}

export async function savePitchDraft(
  authFetch: AuthFetch,
  businessId: string,
  input: { headline: string; body: string; feedbackAsk: string },
): Promise<MemberPitch> {
  return (await read<{ data: MemberPitch }>(
    await authFetch(`/api/businesses/${encodeURIComponent(businessId)}/pitch/draft`, json("PUT", input)),
  )).data;
}

export async function publishPitch(
  authFetch: AuthFetch,
  businessId: string,
  draft: MemberPitch,
  consentVersion: string,
): Promise<MemberPitch> {
  return (await read<{ data: MemberPitch }>(
    await authFetch(
      `/api/businesses/${encodeURIComponent(businessId)}/pitch/publish`,
      json("POST", { confirmed: true, consentVersion, draftId: draft.id, updatedAt: draft.updatedAt }),
    ),
  )).data;
}

export async function withdrawPitch(authFetch: AuthFetch, businessId: string): Promise<void> {
  await read<void>(await authFetch(`/api/businesses/${encodeURIComponent(businessId)}/pitch/withdraw`, json("POST")));
}

export async function fetchPublicPitch(slug: string, signal?: AbortSignal): Promise<PublicPitch | null> {
  const response = await fetch(`/api/public/businesses/${encodeURIComponent(slug)}/pitch`, { signal });
  if (response.status === 404) return null;
  return (await read<{ data: PublicPitch }>(response)).data;
}

export async function fetchPitches(
  cursor?: string | null,
  signal?: AbortSignal,
): Promise<{ data: PitchSummary[]; pagination: { hasMore: boolean; nextCursor: string | null } }> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return read(await fetch(`/api/public/pitches${query}`, { signal }));
}
