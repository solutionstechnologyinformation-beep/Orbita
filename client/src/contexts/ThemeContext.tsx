import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  getSystemTheme,
  normalizeThemePreference,
  normalizeThemeTransitionDuration,
  THEME_TRANSITION_DURATION_MS,
  THEME_TRANSITION_DURATION_STORAGE_KEY,
  type Theme,
  type ThemeTransitionDuration,
} from "./theme-utils";

interface ThemeContextType {
  theme: Theme;
  toggleTheme?: () => void;
  switchable: boolean;
  transitionDuration: ThemeTransitionDuration;
  setTransitionDuration?: (duration: ThemeTransitionDuration) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  switchable?: boolean;
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  switchable = false,
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (switchable && typeof window !== "undefined") {
      const stored = window.localStorage.getItem("theme");
      if (stored === "dark" || stored === "light") return normalizeThemePreference(stored, defaultTheme);
      return getSystemTheme(window.matchMedia?.bind(window), defaultTheme);
    }
    return defaultTheme;
  });
  const [transitionDuration, setTransitionDurationState] = useState<ThemeTransitionDuration>(() => {
    if (typeof window === "undefined") return THEME_TRANSITION_DURATION_MS;
    return normalizeThemeTransitionDuration(window.localStorage.getItem(THEME_TRANSITION_DURATION_STORAGE_KEY));
  });
  const previousThemeRef = useRef(theme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    root.style.setProperty("--theme-transition-duration", `${transitionDuration}ms`);

    if (previousThemeRef.current !== theme) {
      root.classList.add("theme-transition");
      const transitionTimer = window.setTimeout(() => root.classList.remove("theme-transition"), transitionDuration);
      previousThemeRef.current = theme;
      return () => window.clearTimeout(transitionTimer);
    }

    previousThemeRef.current = theme;
  }, [theme, switchable, transitionDuration]);

  const setTransitionDuration = switchable
    ? (duration: ThemeTransitionDuration) => {
        setTransitionDurationState(duration);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(THEME_TRANSITION_DURATION_STORAGE_KEY, String(duration));
        }
      }
    : undefined;

  const toggleTheme = switchable
    ? () => {
        setTheme(prev => {
          const nextTheme = prev === "light" ? "dark" : "light";
          if (typeof window !== "undefined") window.localStorage.setItem("theme", nextTheme);
          return nextTheme;
        });
      }
    : undefined;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, switchable, transitionDuration, setTransitionDuration }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
