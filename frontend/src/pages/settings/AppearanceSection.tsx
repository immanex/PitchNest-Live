import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type ThemePreference } from '../../contexts/ThemeContext';
import { cn } from '../../lib/utils';
import { SectionHeader, SettingRow, SettingsGroup } from './shared';

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
];

export default function AppearanceSection() {
  const { preference, setPreference } = useTheme();

  return (
    <>
      <SectionHeader title="Appearance" description="How PitchNest looks on this device." />
      <SettingsGroup>
        <SettingRow label="Theme" description="System follows your device's light or dark setting.">
          <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1 dark:border-zinc-700 dark:bg-zinc-800/60">
            {OPTIONS.map((option) => {
              const selected = preference === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setPreference(option.value)}
                  className={cn(
                    'inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                    selected
                      ? 'bg-white font-semibold text-indigo-700 shadow-sm dark:bg-indigo-500/20 dark:text-indigo-100'
                      : 'text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-100',
                  )}
                >
                  <option.icon size={15} /> {option.label}
                </button>
              );
            })}
          </div>
        </SettingRow>
      </SettingsGroup>
    </>
  );
}
