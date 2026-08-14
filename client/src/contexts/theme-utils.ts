export type Theme = "light" | "dark";

export const THEME_TRANSITION_DURATION_MS = 260;

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
