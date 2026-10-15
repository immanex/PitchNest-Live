import type { AuthFetch } from "./businesses";

/**
 * Private practice bridge: a short-lived, single-use draft links a business in
 * the workspace to a private Solo/Coach/Panel session. The server checks
 * membership when the draft is created AND again when the session starts.
 */

export type PracticeMode = "panel" | "coach" | "solo";

export interface PracticeDraft {
  id: string;
  businessId: string;
  mode: PracticeMode;
  question: string | null;
  expiresAt: string;
  context: {
    businessName: string;
    description: string;
    industry: string;
    fundingStage: string;
  };
}

export interface PracticeSessionSummary {
  id: number;
  createdAt: string | null;
  mode: PracticeMode;
  attemptNumber: number | null;
  overallScore: number | null;
}

export const PRACTICE_QUESTION_MAX = 300;

async function read<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error || `Request failed (${response.status}).`);
  }
  return (body as { data: T }).data;
}

/**
 * Either businessId (workspace) or businessSlug (public profile, where the id
 * is never exposed). With sourceCommentId the server uses that comment's
 * stored text as the question and ignores any question sent here.
 */
export async function createPracticeDraft(
  authFetch: AuthFetch,
  input: {
    businessId?: string;
    businessSlug?: string;
    mode: PracticeMode;
    question?: string;
    sourceCommentId?: string;
  },
): Promise<PracticeDraft> {
  const response = await authFetch("/api/practice/drafts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return read<PracticeDraft>(response);
}

export async function getPracticeDraft(authFetch: AuthFetch, draftId: string): Promise<PracticeDraft> {
  const response = await authFetch(`/api/practice/drafts/${encodeURIComponent(draftId)}`);
  return read<PracticeDraft>(response);
}

export async function listBusinessPracticeSessions(
  authFetch: AuthFetch,
  businessId: string,
): Promise<PracticeSessionSummary[]> {
  const response = await authFetch(`/api/businesses/${encodeURIComponent(businessId)}/practice-sessions`);
  return read<PracticeSessionSummary[]>(response);
}
