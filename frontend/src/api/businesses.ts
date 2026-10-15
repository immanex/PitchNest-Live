export type AuthFetch = (url: string, options?: RequestInit) => Promise<Response>;

export type BusinessType =
  | "software"
  | "services"
  | "physical"
  | "traditional"
  | "other";

export type BusinessRole = "owner" | "admin" | "editor" | "viewer";
export type BusinessStatus = "draft" | "published" | "hidden" | "removed";

export interface Business {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  businessType: BusinessType;
  industry: string;
  stage: string;
  region: string;
  problem: string;
  solution: string;
  targetCustomer: string;
  websiteUrl: string;
  /** Short-lived signed URLs of the draft images (visible to members only). */
  logoUrl: string | null;
  coverUrl: string | null;
  status: BusinessStatus;
  profileVersion: number;
  publishedAt: string | null;
  unpublishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  membershipRole: BusinessRole;
}

export interface BusinessInput {
  name: string;
  businessType: BusinessType;
  tagline?: string;
  description?: string;
  industry?: string;
  stage?: string;
  region?: string;
  problem?: string;
  solution?: string;
  targetCustomer?: string;
  websiteUrl?: string;
}

export interface BusinessMember {
  userId: number;
  name: string;
  avatarUrl: string | null;
  email?: string | null;
  role: BusinessRole;
  status: "invited" | "active" | "suspended" | "removed";
  publicDisplayConsent: boolean;
  publicTitle: string;
  /** Their founder page handle, for members shown publicly. */
  founderHandle: string | null;
  joinedAt: string | null;
}

export interface PublicTeamMember {
  name: string;
  title: string;
  avatarUrl: string | null;
  handle: string | null;
}

export type BusinessMediaKind = "logo" | "cover";

export interface PublicationPreview {
  preview: Pick<
    Business,
    | "id"
    | "slug"
    | "name"
    | "tagline"
    | "description"
    | "businessType"
    | "industry"
    | "stage"
    | "region"
    | "problem"
    | "solution"
    | "targetCustomer"
    | "websiteUrl"
    | "logoUrl"
    | "coverUrl"
  > & { team: PublicTeamMember[] };
  profileVersion: number;
  consentVersion: string;
  canPublish: boolean;
  blockers: string[];
}

export interface LegacyBusinessDraft {
  available: boolean;
  draft: BusinessInput | null;
}

interface ApiEnvelope<T> {
  data: T;
}

async function request<T>(
  authFetch: AuthFetch,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (options.body) headers.set("Content-Type", "application/json");

  const response = await authFetch(`/api/businesses${path}`, {
    ...options,
    headers,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      body?.error || body?.message || `Business request failed (${response.status}).`,
    );
  }
  return (body as ApiEnvelope<T>).data;
}

export const listBusinesses = (authFetch: AuthFetch) =>
  request<Business[]>(authFetch, "/mine");

export const getLegacyBusinessDraft = (authFetch: AuthFetch) =>
  request<LegacyBusinessDraft>(authFetch, "/legacy-profile-draft");

export const getBusiness = (authFetch: AuthFetch, businessId: string) =>
  request<Business>(authFetch, `/${businessId}`);

export const createBusiness = (authFetch: AuthFetch, input: BusinessInput) =>
  request<Business>(authFetch, "", {
    method: "POST",
    body: JSON.stringify(input),
  });

export const updateBusiness = (
  authFetch: AuthFetch,
  businessId: string,
  input: Partial<BusinessInput>,
) =>
  request<Business>(authFetch, `/${businessId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });

export const getBusinessMembers = (
  authFetch: AuthFetch,
  businessId: string,
) => request<BusinessMember[]>(authFetch, `/${businessId}/members`);

export const getPublicationPreview = (
  authFetch: AuthFetch,
  businessId: string,
) => request<PublicationPreview>(authFetch, `/${businessId}/publication-preview`);

/** Publishes the previewed version. `warning` is set when images failed to go public. */
export async function publishBusiness(
  authFetch: AuthFetch,
  businessId: string,
  preview: PublicationPreview,
): Promise<{ business: Business; warning: string | null }> {
  const response = await authFetch(`/api/businesses/${businessId}/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      confirmed: true,
      consentVersion: preview.consentVersion,
      profileVersion: preview.profileVersion,
    }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error || body?.message || `Business request failed (${response.status}).`);
  }
  return { business: body.data as Business, warning: typeof body?.warning === "string" ? body.warning : null };
}

/** Replaces the logo or cover draft. Sent as multipart, so no JSON header. */
export async function uploadBusinessMedia(
  authFetch: AuthFetch,
  businessId: string,
  kind: BusinessMediaKind,
  file: File,
): Promise<Business> {
  const form = new FormData();
  form.append("image", file);
  const response = await authFetch(`/api/businesses/${businessId}/media/${kind}`, {
    method: "PUT",
    body: form,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error || `Upload failed (${response.status}).`);
  }
  return (body as ApiEnvelope<Business>).data;
}

export const removeBusinessMedia = (
  authFetch: AuthFetch,
  businessId: string,
  kind: BusinessMediaKind,
) => request<Business>(authFetch, `/${businessId}/media/${kind}`, { method: "DELETE" });

/** The caller's own choice to appear on the public profile. */
export const updateMyPublicProfile = (
  authFetch: AuthFetch,
  businessId: string,
  input: { consent: boolean; title?: string },
) =>
  request<{ publicDisplayConsent: boolean; publicTitle: string; founderHandle: string | null }>(
    authFetch,
    `/${businessId}/members/me/public-profile`,
    { method: "PUT", body: JSON.stringify(input) },
  );

export const unpublishBusiness = (authFetch: AuthFetch, businessId: string) =>
  request<Business>(authFetch, `/${businessId}/unpublish`, { method: "POST" });

export async function archiveBusiness(
  authFetch: AuthFetch,
  businessId: string,
): Promise<void> {
  const response = await authFetch(`/api/businesses/${businessId}`, {
    method: "DELETE",
  });
  if (response.ok) return;
  const body = await response.json().catch(() => null);
  throw new Error(
    body?.error || body?.message || `Business request failed (${response.status}).`,
  );
}
