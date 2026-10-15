import type { AuthFetch } from "./businesses";
import type { CommentCategory } from "./discover";

/** Business updates (milestones, launches) and the team's questions inbox. */

export type UpdateKind = "update" | "milestone" | "launch";

export const UPDATE_KIND_LABELS: Record<UpdateKind, string> = {
  update: "Update",
  milestone: "Milestone",
  launch: "Launch",
};

export const UPDATE_MAX_LENGTH = 1500;

export interface BusinessUpdate {
  id: string;
  kind: UpdateKind;
  body: string;
  createdAt: string;
}

export interface MemberQuestion {
  id: string;
  body: string;
  createdAt: string;
  author: { name: string; isBusinessMember: boolean };
  /** Pitch feedback type, when the commenter chose one. */
  category?: CommentCategory | null;
  onPitch?: boolean;
}

async function read<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || `Request failed (${response.status}).`);
  return (body as { data: T }).data;
}

/** Public: updates of a published business. */
export async function fetchPublicUpdates(slug: string, signal?: AbortSignal): Promise<BusinessUpdate[]> {
  const response = await fetch(`/api/public/businesses/${encodeURIComponent(slug)}/updates`, { signal });
  return read<BusinessUpdate[]>(response);
}

export async function listMemberUpdates(authFetch: AuthFetch, businessId: string): Promise<BusinessUpdate[]> {
  return read<BusinessUpdate[]>(await authFetch(`/api/businesses/${encodeURIComponent(businessId)}/updates`));
}

export async function postBusinessUpdate(
  authFetch: AuthFetch,
  businessId: string,
  input: { kind: UpdateKind; body: string },
): Promise<BusinessUpdate> {
  return read<BusinessUpdate>(
    await authFetch(`/api/businesses/${encodeURIComponent(businessId)}/updates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function removeBusinessUpdate(
  authFetch: AuthFetch,
  businessId: string,
  updateId: string,
): Promise<void> {
  await read<void>(
    await authFetch(
      `/api/businesses/${encodeURIComponent(businessId)}/updates/${encodeURIComponent(updateId)}`,
      { method: "DELETE" },
    ),
  );
}

export async function listMemberQuestions(authFetch: AuthFetch, businessId: string): Promise<MemberQuestion[]> {
  return read<MemberQuestion[]>(await authFetch(`/api/businesses/${encodeURIComponent(businessId)}/comments`));
}
