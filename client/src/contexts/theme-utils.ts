export type Theme = "light" | "dark";

export const THEME_TRANSITION_DURATION_MS = 260;

type MatchMediaReader = (query: string) => { matches: boolean };

export function getSystemTheme(matchMedia: MatchMediaReader | undefined, fallback: Theme): Theme {
  if (!matchMedia) return fallback;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function normalizeThemePreference(stored: string | null, fallback: Theme): Theme {
  return stored === "dark" || stored === "light" ? stored : fallback;
}

export function getThemeToggleCopy(theme: Theme) {
  const isDark = theme === "dark";
  return {
    isDark,
    label: isDark ? "Tema claro" : "Tema escuro",
    ariaLabel: isDark ? "Ativar tema claro" : "Ativar tema escuro",
  };
}
