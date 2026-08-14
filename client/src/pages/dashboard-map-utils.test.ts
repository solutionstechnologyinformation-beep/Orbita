import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { formatDashboardMapTimestamp } from "./dashboard-map-utils";

const dashboardSource = readFileSync(new URL("./Dashboard.tsx", import.meta.url), "utf8");
const stylesheet = readFileSync(new URL("../index.css", import.meta.url), "utf8");

describe("dashboard map fullscreen and timestamp", () => {
  it("formats a valid timestamp with local Brazilian date and time", () => {
    const formatted = formatDashboardMapTimestamp(new Date("2026-08-14T19:30:00.000Z"));
    expect(formatted).toContain("/");
    expect(formatted).toMatch(/\d{2}:\d{2}/);
  });

  it("keeps the map container attached to the viewport in expanded mode", () => {
    expect(dashboardSource).toContain("fixed inset-0 z-[60] h-screen w-screen overflow-hidden bg-slate-950/60");
    expect(dashboardSource).toContain("h-[100dvh]");
    expect(dashboardSource).toContain("min-h-screen");
    expect(dashboardSource).toContain("!rounded-none");
    expect(dashboardSource).toContain("window.google.maps.event.trigger(mapRef.current, \"resize\")");
    expect(dashboardSource).toContain("onClick={toggleMapExpanded}");
  });

  it("renders the map date/time and keeps it in the captured report", () => {
    expect(dashboardSource).toContain('data-map-stamp="true"');
    expect(dashboardSource).toContain('[data-map-control="true"]:not([data-map-stamp="true"])');
    expect(dashboardSource).toContain("Dados do mapa: {formatDashboardMapTimestamp(mapDataTimestamp)}");
    expect(dashboardSource).toContain("Dados do mapa: ${escapeInfoWindowHtml(mapCaptureTimestamp)}");
  });

  it("animates entering and leaving fullscreen without removing the map during the exit", () => {
    expect(dashboardSource).toContain("map-fullscreen-enter");
    expect(dashboardSource).toContain("map-fullscreen-exit");
    expect(dashboardSource).toContain("const minimizeMap = useCallback");
    expect(dashboardSource).toContain("MAP_FULLSCREEN_ANIMATION_DURATION_MS");
    expect(dashboardSource).toContain("setIsMapExpanded(false)");
    expect(dashboardSource).toContain("window.google.maps.event.trigger(mapRef.current, \"resize\")");
  });

  it("defines smooth map keyframes and disables them for reduced motion", () => {
    expect(stylesheet).toContain("@keyframes orbitaMapFullscreenEnter");
    expect(stylesheet).toContain("@keyframes orbitaMapFullscreenExit");
    expect(stylesheet).toContain("animation: orbitaMapFullscreenEnter 320ms");
    expect(stylesheet).toContain("animation: orbitaMapFullscreenExit 320ms");
    expect(stylesheet).toContain(".map-fullscreen-enter,");
    expect(stylesheet).toContain(".map-fullscreen-exit {");
    expect(stylesheet).toContain("animation: none;");
  });
});
