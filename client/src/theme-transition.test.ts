import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { THEME_TRANSITION_DURATION_MS } from "./contexts/theme-utils";

const stylesheet = readFileSync(new URL("./index.css", import.meta.url), "utf8");

describe("global theme transition", () => {
  it("transitions the visual properties used by light and dark surfaces", () => {
    expect(stylesheet).toContain("html.theme-transition body *::before");
    expect(stylesheet).toContain("background-color");
    expect(stylesheet).toContain("border-color");
    expect(stylesheet).toContain("box-shadow");
    expect(stylesheet).toContain("fill");
    expect(stylesheet).toContain("stroke");
    expect(stylesheet).toContain("text-shadow");
    expect(stylesheet).toContain("accent-color");
    expect(stylesheet).toContain("cubic-bezier(0.22, 1, 0.36, 1)");
  });

  it("keeps the transition synchronized with the ThemeContext timer", () => {
    expect(stylesheet).toContain(`transition-duration: ${THEME_TRANSITION_DURATION_MS}ms;`);
    expect(THEME_TRANSITION_DURATION_MS).toBe(260);
  });

  it("disables the theme transition for users who prefer reduced motion", () => {
    expect(stylesheet).toContain("@media (prefers-reduced-motion: reduce)");
    expect(stylesheet).toContain("transition-property: none !important;");
    expect(stylesheet).toContain("transition-duration: 0ms !important;");
  });
});
