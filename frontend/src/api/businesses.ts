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
  joinedAt: string | null;
}

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
  >;
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

export const publishBusiness = (
  authFetch: AuthFetch,
  businessId: string,
  preview: PublicationPreview,
) =>
  request<Business>(authFetch, `/${businessId}/publish`, {
    method: "POST",
    body: JSON.stringify({
      confirmed: true,
      consentVersion: preview.consentVersion,
      profileVersion: preview.profileVersion,
    }),
  });

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
