/**
 * Speech-to-text locale catalogue — the CLIENT half of the allowlist.
 *
 * Deliberately mirrors backend/src/utils/transcriptionLocales.ts, the same way
 * lib/entitlements.ts mirrors entitlementService.ts: the server is authoritative
 * and validates again on write and on read, but the picker still needs to render
 * the list, so the two are kept in step by hand. Adding a locale here without
 * adding it there produces a choice the server will silently drop.
 *
 * WHY ENGLISH-ONLY. The panel speaks English and the evaluation pipeline scores
 * English output. Offering French here would transcribe French speech and feed it
 * to an English scorer — worse than not offering it at all.
 *
 * Azure supports every African English locale below for real-time recognition,
 * with NO post-stream refinement available for them — which is why getting the
 * locale right matters more here than relying on the model to clean up after us.
 */

/** Matches the server default, shown when the founder has chosen nothing. */
export const DEFAULT_STT_LOCALE = "en-NG";

export interface TranscriptionLocale {
  code: string;
  label: string;
  note?: string;
}

/** Order matters: this is the order the picker renders in. African locales lead. */
export const TRANSCRIPTION_LOCALES: readonly TranscriptionLocale[] = [
  { code: "en-NG", label: "English (Nigeria)", note: "Recommended for Nigerian English." },
  { code: "en-KE", label: "English (Kenya)" },
  { code: "en-GH", label: "English (Ghana)" },
  { code: "en-ZA", label: "English (South Africa)" },
  { code: "en-TZ", label: "English (Tanzania)" },
  { code: "en-GB", label: "English (United Kingdom)" },
  { code: "en-US", label: "English (United States)" },
  { code: "en-IN", label: "English (India)" },
];

const SUPPORTED = new Set(TRANSCRIPTION_LOCALES.map((l) => l.code));

/** Narrows a stored value to a locale the server will actually accept. */
export function isSupportedSttLocale(v: unknown): v is string {
  return typeof v === "string" && SUPPORTED.has(v);
}

/** The label for a locale code, for display. */
export function sttLocaleLabel(code: string | undefined): string {
  if (!code) return "";
  return TRANSCRIPTION_LOCALES.find((l) => l.code === code)?.label ?? code;
}
