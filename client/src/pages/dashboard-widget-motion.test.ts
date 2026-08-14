import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(new URL("./Dashboard.tsx", import.meta.url), "utf8");
const stylesheet = readFileSync(new URL("../index.css", import.meta.url), "utf8");

describe("dashboard widget motion", () => {
  it("animates the widget after its order changes and distinguishes drag states", () => {
    expect(dashboardSource).toContain("const [isSettling, setIsSettling]");
    expect(dashboardSource).toContain("dashboard-widget-reordered");
    expect(dashboardSource).toContain("dashboard-widget-dragging");
    expect(dashboardSource).toContain("dashboard-widget-drop-target");
  });

  it("defines a smooth reorder animation and a position transition", () => {
    expect(stylesheet).toContain("@keyframes orbitaWidgetReordered");
    expect(stylesheet).toContain("transition: transform 240ms cubic-bezier");
    expect(stylesheet).toContain("animation: orbitaWidgetReordered 280ms");
  });

  it("disables reorder motion when the user prefers reduced motion", () => {
    expect(stylesheet).toContain("@media (prefers-reduced-motion: reduce)");
    expect(stylesheet).toContain(".dashboard-widget-frame,");
    expect(stylesheet).toContain("animation: none;");
    expect(stylesheet).toContain("will-change: auto;");
  });
});
