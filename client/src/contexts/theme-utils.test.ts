import { describe, expect, it } from "vitest";
import {
  getSystemTheme,
  getThemeToggleCopy,
  normalizeThemePreference,
  normalizeThemeTransitionDuration,
  getThemeTransitionDurationLabel,
  THEME_TRANSITION_DURATION_MS,
  THEME_TRANSITION_DURATION_OPTIONS,
  LIGHT_THEME_ACCENT,
  DARK_THEME_ACCENT,
} from "./theme-utils";

describe("theme utilities", () => {
  it("resolves the system preference when no manual value exists", () => {
    expect(getSystemTheme(() => ({ matches: true }), "light")).toBe("dark");
    expect(getSystemTheme(() => ({ matches: false }), "dark")).toBe("light");
    expect(getSystemTheme(undefined, "dark")).toBe("dark");
  });
  it("keeps a persisted manual preference ahead of the system fallback", () => {
    expect(normalizeThemePreference("dark", getSystemTheme(() => ({ matches: false }), "light"))).toBe("dark");
    expect(normalizeThemePreference(null, getSystemTheme(() => ({ matches: true }), "light"))).toBe("dark");
  });

  it("accepts only supported persisted theme values", () => {
    expect(normalizeThemePreference("dark", "light")).toBe("dark");
    expect(normalizeThemePreference("light", "dark")).toBe("light");
    expect(normalizeThemePreference("system", "dark")).toBe("dark");
    expect(normalizeThemePreference(null, "light")).toBe("light");
  });

  it("provides accessible copy for both theme states", () => {
    expect(getThemeToggleCopy("light")).toEqual({ isDark: false, label: "Tema escuro", ariaLabel: "Ativar tema escuro" });
    expect(getThemeToggleCopy("dark")).toEqual({ isDark: true, label: "Tema claro", ariaLabel: "Ativar tema claro" });
  });

  it("uses the institutional yellow in light mode and the reference teal in dark mode", () => {
    expect(LIGHT_THEME_ACCENT).toBe("#FFC30D");
    expect(DARK_THEME_ACCENT).toBe("#102C2D");
  });

  it("keeps the theme transition short and consistent", () => {
    expect(THEME_TRANSITION_DURATION_MS).toBe(260);
    expect(THEME_TRANSITION_DURATION_MS).toBeLessThan(400);
  });

  it("normalizes supported transition durations and rejects invalid values", () => {
    expect(THEME_TRANSITION_DURATION_OPTIONS).toEqual([0, 160, 260, 400, 600]);
    expect(normalizeThemeTransitionDuration("160")).toBe(160);
    expect(normalizeThemeTransitionDuration(0)).toBe(0);
    expect(normalizeThemeTransitionDuration("999")).toBe(260);
    expect(normalizeThemeTransitionDuration(null, 400)).toBe(400);
  });

  it("provides accessible labels for instant and timed transitions", () => {
    expect(getThemeTransitionDurationLabel(0)).toBe("Instantânea");
    expect(getThemeTransitionDurationLabel(400)).toBe("400 ms");
  });
});
