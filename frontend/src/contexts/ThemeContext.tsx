import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
/** What the user chose. "system" follows the device setting. */
export type ThemePreference = Theme | 'system';

interface ThemeContextType {
  /** The theme on screen right now. */
  theme: Theme;
  setTheme: (theme: Theme) => void;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const DARK_QUERY = '(prefers-color-scheme: dark)';

function readPreference(): ThemePreference {
  try {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light' || saved === 'system') return saved;
  } catch {}
  // Default to light if no saved preference
  return 'light';
}

function systemTheme(): Theme {
  return typeof window !== 'undefined' && window.matchMedia?.(DARK_QUERY).matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(readPreference);
  const [systemValue, setSystemValue] = useState<Theme>(systemTheme);
  const theme: Theme = preference === 'system' ? systemValue : preference;

  useEffect(() => {
    if (preference !== 'system' || !window.matchMedia) return;
    const media = window.matchMedia(DARK_QUERY);
    const update = () => setSystemValue(media.matches ? 'dark' : 'light');
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [preference]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    try { localStorage.setItem('theme', preference); } catch {}
  }, [theme, preference]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setPreference, preference, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
