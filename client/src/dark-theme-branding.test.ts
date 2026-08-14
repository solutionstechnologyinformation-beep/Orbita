import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(new URL("./index.css", import.meta.url), "utf8");

describe("dark theme branding contrast", () => {
  it("keeps the light-theme yellow as the dark-theme highlight", () => {
    expect(stylesheet).toContain("--brand-highlight: #ffc30d;");
    expect(stylesheet).toContain("--brand-highlight-soft:    #ffe9a3;");
  });

  it("applies the yellow highlight to discipline text in chat activity panels", () => {
    expect(stylesheet).toContain(".dark .chat-activity-panel .chat-discipline-name");
    expect(stylesheet).toContain("color: var(--brand-highlight) !important;");
  });

  it("declares the current Orbita logo as transparent in dark mode", () => {
    expect(stylesheet).toContain(".dark .orbita-logo-transparent");
    expect(stylesheet).toContain("background: transparent !important;");
  });
});
