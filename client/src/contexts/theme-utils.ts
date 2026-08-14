export type Theme = "light" | "dark";

export const THEME_TRANSITION_DURATION_MS = 260;
export const THEME_TRANSITION_DURATION_STORAGE_KEY = "theme-transition-duration";
export const THEME_TRANSITION_DURATION_OPTIONS = [0, 160, 260, 400, 600] as const;
export type ThemeTransitionDuration = (typeof THEME_TRANSITION_DURATION_OPTIONS)[number];

export const LIGHT_THEME_ACCENT = "#FFC30D";
export const DARK_THEME_ACCENT = "#102C2D";

type MatchMediaReader = (query: string) => { matches: boolean };

export function getSystemTheme(matchMedia: MatchMediaReader | undefined, fallback: Theme): Theme {
  if (!matchMedia) return fallback;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function normalizeThemePreference(stored: string | null, fallback: Theme): Theme {
  return stored === "dark" || stored === "light" ? stored : fallback;
}

export function normalizeThemeTransitionDuration(value: string | number | null | undefined, fallback: ThemeTransitionDuration = THEME_TRANSITION_DURATION_MS): ThemeTransitionDuration {
  if (value === null || value === undefined || value === "") return fallback;
  const numericValue = typeof value === "number" ? value : Number(value);
  return (THEME_TRANSITION_DURATION_OPTIONS as readonly number[]).includes(numericValue)
    ? numericValue as ThemeTransitionDuration
    : fallback;
}

export function getThemeTransitionDurationLabel(duration: ThemeTransitionDuration): string {
  return duration === 0 ? "Instantânea" : `${duration} ms`;
}

export function getThemeToggleCopy(theme: Theme) {
  const isDark = theme === "dark";
  return {
    isDark,
    label: isDark ? "Tema claro" : "Tema escuro",
    ariaLabel: isDark ? "Ativar tema claro" : "Ativar tema escuro",
  };
}
