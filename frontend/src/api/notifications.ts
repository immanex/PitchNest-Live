import type { AuthFetch } from "./businesses";

export type NotificationType =
  | "business_comment"
  | "business_update"
  | "community_reply"
  | "founder_update"
  | "founder_business";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  excerpt: string;
  /** In-app path to open when the notification is clicked. */
  link: string;
  createdAt: string;
  read: boolean;
}

export async function fetchNotifications(
  authFetch: AuthFetch,
  signal?: AbortSignal,
): Promise<{ items: AppNotification[]; unreadCount: number }> {
  const response = await authFetch("/api/notifications", { signal });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || "Failed to load notifications.");
  return {
    items: Array.isArray(body?.data) ? body.data : [],
    unreadCount: Number(body?.unreadCount) || 0,
  };
}

export async function markNotificationsRead(
  authFetch: AuthFetch,
  target: { ids: string[] } | { all: true },
): Promise<void> {
  const response = await authFetch("/api/notifications/read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(target),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || "Failed to update notifications.");
  }
}
