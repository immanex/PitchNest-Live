/**
 * Shared route constants for deep links.
 *
 * Literals like "/settings?tab=subscription" were being typed by hand in several
 * components; a typo produced a page that silently opened the wrong tab. Import
 * these instead.
 */

export const SETTINGS_SECTIONS = [
  "profile",
  "account",
  "appearance",
  "notifications",
  "voice",
  "billing",
] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export const SETTINGS_PATH = "/settings";
export const settingsPath = (section: SettingsSection) => `/settings/${section}`;

/** Settings, on the plan and billing section. */
export const SUBSCRIPTION_TAB_PATH = settingsPath("billing");

/** Settings, on the notification preferences. */
export const NOTIFICATIONS_TAB_PATH = settingsPath("notifications");

/**
 * The user's own profile.
 *
 * Settings' Profile section IS the account page: name, avatar, bio and role all
 * live there. A separate /profile route would be a second surface editing the
 * same fields, which is exactly the kind of duplicate control we removed elsewhere.
 */
export const PROFILE_PATH = settingsPath("profile");

/** Plans and the first-subscription offer. Checkout starts from here. */
export const PRICING_PATH = "/pricing";

/** Old "?tab=" links (emails, bookmarks) mapped onto the sections. */
export const LEGACY_SETTINGS_TABS: Record<string, SettingsSection> = {
  profile: "profile",
  account: "account",
  subscription: "billing",
  billing: "billing",
  notifications: "notifications",
  voice: "voice",
};
