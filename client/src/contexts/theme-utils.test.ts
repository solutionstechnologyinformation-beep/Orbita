import { describe, expect, it } from "vitest";
import { getThemeToggleCopy, normalizeThemePreference, THEME_TRANSITION_DURATION_MS } from "./theme-utils";

describe("theme utilities", () => {
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

  it("keeps the theme transition short and consistent", () => {
    expect(THEME_TRANSITION_DURATION_MS).toBe(260);
    expect(THEME_TRANSITION_DURATION_MS).toBeLessThan(400);
  });
});
