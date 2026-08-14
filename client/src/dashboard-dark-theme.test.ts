import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(new URL("./pages/Dashboard.tsx", import.meta.url), "utf8");
const stylesheet = readFileSync(new URL("./index.css", import.meta.url), "utf8");

describe("Dashboard dark theme surfaces", () => {
  it("uses a theme-aware root surface instead of a white inline background", () => {
    expect(dashboardSource).toContain('className="dashboard-page p-6 space-y-6 bg-background min-h-full"');
    expect(dashboardSource).not.toContain('style={{ backgroundColor: \'#ffffff\' }}');
  });

  it("maps Dashboard white cards and light information boxes to dark semantic surfaces", () => {
    expect(stylesheet).toContain(".dark .dashboard-page .bg-white");
    expect(stylesheet).toContain(".dark .dashboard-page .bg-gray-50");
    expect(stylesheet).toContain("background-color: var(--card) !important;");
    expect(stylesheet).toContain("color-mix(in srgb, var(--brand-accent) 18%, var(--card))");
  });

  it("keeps readable foreground and muted text tokens inside dark Dashboard cards", () => {
    expect(stylesheet).toContain(".dark .dashboard-page .text-gray-900");
    expect(stylesheet).toContain(".dark .dashboard-page .text-gray-400");
    expect(stylesheet).toContain("color: var(--foreground) !important;");
    expect(stylesheet).toContain("color: var(--muted-foreground) !important;");
  });
});
