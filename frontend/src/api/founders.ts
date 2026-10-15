import type { AuthFetch } from "./businesses";
import type { PublicBusinessSummary } from "./publicBusinesses";

/** A founder who chose to appear on at least one published business. */
export interface PublicFounder {
  handle: string;
  name: string;
  avatarUrl: string | null;
  businesses: Array<PublicBusinessSummary & { title: string }>;
  viewer: {
    authenticated: boolean;
    isSelf: boolean;
    follows: boolean;
    /** Only present for the founder viewing their own page. */
    followerCount: number | null;
  };
}

export class FounderApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "FounderApiError";
    this.status = status;
  }
}

async function read<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new FounderApiError(body?.error || `Request failed (${response.status}).`, response.status);
  return (body as { data: T }).data;
}

/** Public read; authFetch adds the token when signed in so the page knows the viewer. */
export async function fetchFounder(authFetch: AuthFetch, handle: string, signal?: AbortSignal): Promise<PublicFounder> {
  return read<PublicFounder>(await authFetch(`/api/public/founders/${encodeURIComponent(handle)}`, { signal }));
}

export async function setFounderFollow(authFetch: AuthFetch, handle: string, active: boolean): Promise<boolean> {
  const response = await authFetch(`/api/discover/founders/${encodeURIComponent(handle)}/follow`, {
    method: active ? "PUT" : "DELETE",
  });
  return (await read<{ following: boolean }>(response)).following;
}
