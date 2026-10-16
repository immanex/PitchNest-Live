import { getAuthToken } from "./authStorage";

/**
 * First-party, privacy-safe page-view analytics (backend: services/eventService.ts).
 *
 * The browser can report only five view events, and the server drops any
 * property it does not allowlist. Respects Do Not Track and Global Privacy
 * Control. Fire-and-forget: never blocks, never throws, never retries.
 */

export type ClientEvent =
  | { name: "discover_viewed"; properties?: Record<string, never> }
  | { name: "business_profile_opened"; properties: { slug: string } }
  | { name: "practice_setup_opened"; properties: { fromBusiness: boolean } }
  | { name: "opportunity_link_opened"; properties: { kind: string } }
  | { name: "pitch_arena_viewed"; properties?: Record<string, never> };

function trackingAllowed(): boolean {
  try {
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string };
    const win = window as Window & { doNotTrack?: string };
    if (nav.globalPrivacyControl === true) return false;
    if (nav.doNotTrack === "1" || nav.doNotTrack === "yes" || win.doNotTrack === "1" || nav.msDoNotTrack === "1") {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function trackEvent(event: ClientEvent): void {
  if (!trackingAllowed()) return;
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    // Attributes the view to the signed-in account when there is one; the
    // server ignores invalid or organization tokens.
    const token = getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    void fetch("/api/public/events", {
      method: "POST",
      headers,
      body: JSON.stringify({ name: event.name, properties: event.properties ?? {} }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Analytics must never affect the page.
  }
}
