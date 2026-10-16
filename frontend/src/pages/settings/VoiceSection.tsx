import { useState } from 'react';
import { isSupportedSttLocale, TRANSCRIPTION_LOCALES } from '../../lib/transcriptionLocales';
import { SectionHeader, SettingRow, SettingsGroup, usePersistSettings, useStoredUser } from './shared';

export default function VoiceSection() {
  const user = useStoredUser();
  const persist = usePersistSettings();
  // `null` means "no preference": the server picks, and a later change to its
  // default reaches everyone who never actively chose.
  const [locale, setLocale] = useState<string | null>(() =>
    isSupportedSttLocale(user.settings?.sttLocale) ? user.settings!.sttLocale : null,
  );

  const change = (next: string) => {
    if (next === 'auto') {
      setLocale(null);
      void persist({ sttLocale: 'auto' });
      return;
    }
    if (!isSupportedSttLocale(next)) return;
    setLocale(next);
    void persist({ sttLocale: next });
  };

  return (
    <>
      <SectionHeader title="Voice & language" description="How live sessions listen to you." />
      <SettingsGroup>
        <SettingRow label="Recognition language" description="Applies to live voice sessions. Typed pitches are unaffected.">
          <select
            aria-label="Recognition language"
            value={locale ?? 'auto'}
            onChange={(e) => change(e.target.value)}
            className="min-w-56 cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
          >
            <option value="auto">Automatic (recommended)</option>
            {TRANSCRIPTION_LOCALES.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </SettingRow>
      </SettingsGroup>
    </>
  );
}
