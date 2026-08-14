import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { normalizeThemePreference, THEME_TRANSITION_DURATION_MS, type Theme } from "./theme-utils";

interface ThemeContextType {
  theme: Theme;
  toggleTheme?: () => void;
  switchable: boolean;
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
      return normalizeThemePreference(stored, defaultTheme);
    }
    return defaultTheme;
  });
  const previousThemeRef = useRef(theme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    if (switchable) {
      window.localStorage.setItem("theme", theme);
    }

    if (previousThemeRef.current !== theme) {
      root.classList.add("theme-transition");
      const transitionTimer = window.setTimeout(() => root.classList.remove("theme-transition"), THEME_TRANSITION_DURATION_MS);
      previousThemeRef.current = theme;
      return () => window.clearTimeout(transitionTimer);
    }

    previousThemeRef.current = theme;
  }, [theme, switchable]);

  const toggleTheme = switchable
    ? () => {
        setTheme(prev => (prev === "light" ? "dark" : "light"));
      }
    : undefined;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, switchable }}>
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
