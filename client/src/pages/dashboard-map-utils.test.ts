import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { formatDashboardMapTimestamp } from "./dashboard-map-utils";

const dashboardSource = readFileSync(new URL("./Dashboard.tsx", import.meta.url), "utf8");

describe("dashboard map fullscreen and timestamp", () => {
  it("formats a valid timestamp with local Brazilian date and time", () => {
    const formatted = formatDashboardMapTimestamp(new Date("2026-08-14T19:30:00.000Z"));
    expect(formatted).toContain("/");
    expect(formatted).toMatch(/\d{2}:\d{2}/);
  });

  it("keeps the map container attached to the viewport in expanded mode", () => {
    expect(dashboardSource).toContain('"fixed inset-0 z-[60] bg-slate-950/60 p-3 sm:p-6"');
    expect(dashboardSource).toContain("h-[calc(100dvh-1.5rem)]");
    expect(dashboardSource).toContain("window.google.maps.event.trigger(mapRef.current, \"resize\")");
    expect(dashboardSource).toContain('onClick={() => setIsMapExpanded((expanded) => !expanded)}');
  });

  it("renders the map date/time and keeps it in the captured report", () => {
    expect(dashboardSource).toContain('data-map-stamp="true"');
    expect(dashboardSource).toContain('[data-map-control="true"]:not([data-map-stamp="true"])');
    expect(dashboardSource).toContain("Dados do mapa: {formatDashboardMapTimestamp(mapDataTimestamp)}");
    expect(dashboardSource).toContain("Dados do mapa: ${escapeInfoWindowHtml(mapCaptureTimestamp)}");
  });
});
