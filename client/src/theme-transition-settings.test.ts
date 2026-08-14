import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const themeContextSource = readFileSync(new URL("./contexts/ThemeContext.tsx", import.meta.url), "utf8");
const profileSource = readFileSync(new URL("./pages/Profile.tsx", import.meta.url), "utf8");

describe("theme transition duration settings", () => {
  it("persists the duration and exposes it through ThemeContext", () => {
    expect(themeContextSource).toContain('THEME_TRANSITION_DURATION_STORAGE_KEY');
    expect(themeContextSource).toContain('window.localStorage.getItem(THEME_TRANSITION_DURATION_STORAGE_KEY)');
    expect(themeContextSource).toContain('window.localStorage.setItem(THEME_TRANSITION_DURATION_STORAGE_KEY, String(duration))');
    expect(themeContextSource).toContain('root.style.setProperty("--theme-transition-duration", `${transitionDuration}ms`)');
    expect(themeContextSource).toContain("setTransitionDuration");
  });

  it("renders an accessible preference control and reduced-motion status", () => {
    expect(profileSource).toContain('id="theme-transition-duration"');
    expect(profileSource).toContain('aria-describedby="theme-transition-duration-help"');
    expect(profileSource).toContain("THEME_TRANSITION_DURATION_OPTIONS.map");
    expect(profileSource).toContain("prefersReducedMotion");
    expect(profileSource).toContain("movimento reduzido");
  });
});
