import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'teamhub_theme';

interface ThemeContextType {
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  isDark: boolean;
  setTheme: (theme: ThemePreference) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function getInitialTheme(): ThemePreference {
  if (typeof window === 'undefined') return 'light';
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved;
    }
  } catch {
    // localStorage not accessible
  }
  return 'light';
}

function applyThemeToDocument(isDark: boolean) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (isDark) {
    root.classList.add('dark');
    root.classList.remove('light');
    root.setAttribute('data-theme', 'dark');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.classList.add('light');
    root.setAttribute('data-theme', 'light');
    root.style.colorScheme = 'light';
  }
}

interface ThemeProviderProps {
  children: React.ReactNode;
  initialUserTheme?: ThemePreference;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children, initialUserTheme }) => {
  const [theme, setThemeState] = useState<ThemePreference>(() => {
    const stored = getInitialTheme();
    if (stored) return stored;
    if (initialUserTheme) return initialUserTheme;
    return 'light';
  });

  const [systemIsDark, setSystemIsDark] = useState<boolean>(getSystemPrefersDark);

  // Sync if initialUserTheme changes and user hasn't explicitly set localStorage
  useEffect(() => {
    if (initialUserTheme) {
      try {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        if (!stored) {
          setThemeState(initialUserTheme);
        }
      } catch {
        // ignore
      }
    }
  }, [initialUserTheme]);

  // Listen to OS prefers-color-scheme dynamically
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemIsDark(e.matches);
    };

    // Modern API
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      // Fallback for older browsers
      (mediaQuery as any).addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        (mediaQuery as any).removeListener(handleChange);
      }
    };
  }, []);

  // Compute resolved active theme ('light' or 'dark')
  const resolvedTheme: ResolvedTheme = useMemo(() => {
    if (theme === 'system') {
      return systemIsDark ? 'dark' : 'light';
    }
    return theme;
  }, [theme, systemIsDark]);

  const isDark = resolvedTheme === 'dark';

  // Apply DOM class & persist
  useEffect(() => {
    applyThemeToDocument(isDark);
  }, [isDark]);

  const setTheme = useCallback((newTheme: ThemePreference) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch {
      // ignore
    }
    const willBeDark = newTheme === 'system' ? getSystemPrefersDark() : newTheme === 'dark';
    applyThemeToDocument(willBeDark);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(isDark ? 'light' : 'dark');
  }, [isDark, setTheme]);

  const contextValue = useMemo<ThemeContextType>(() => ({
    theme,
    resolvedTheme,
    isDark,
    setTheme,
    toggleTheme,
  }), [theme, resolvedTheme, isDark, setTheme, toggleTheme]);

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
