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
    expect(dashboardSource).toContain("onExpandedChange(false)");
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

  it("hides every non-map widget while expanded and restores the Dashboard afterward", () => {
    expect(dashboardSource).toContain("data-dashboard-widget-id={id}");
    expect(dashboardSource).toContain("dashboard-map-focused");
    expect(dashboardSource).toContain('data-map-focused={isMapExpanded ? "true" : "false"}');
    expect(stylesheet).toContain('.dashboard-map-focused [data-dashboard-widget-id]:not([data-dashboard-widget-id="map"])');
    expect(stylesheet).toContain("display: none !important");
    expect(dashboardSource).toContain("onExpandedChange(true)");
    expect(dashboardSource).toContain("onExpandedChange(false)");
  });

  it("provides a retractable fullscreen summary panel with real map data and accessible controls", () => {
    expect(dashboardSource).toContain("isMapSummaryPanelOpen");
    expect(dashboardSource).toContain("Resumo rápido do mapa e trechos importados");
    expect(dashboardSource).toContain("Recolher resumo do mapa");
    expect(dashboardSource).toContain("Expandir resumo do mapa");
    expect(dashboardSource).toContain("Trechos importados");
    expect(dashboardSource).toContain("totalImportedExtensionKm");
    expect(dashboardSource).toContain("visibleExtensionKm");
    expect(dashboardSource).toContain("filteredSummarySegments");
    expect(dashboardSource).toContain("onClick={() => focusSegment(segment.id)}");
    expect(dashboardSource).toContain("map.fitBounds(bounds, 56)");
  });

  it("animates opening and retracting the summary panel while respecting reduced motion", () => {
    expect(dashboardSource).toContain("map-summary-panel-open");
    expect(dashboardSource).toContain("map-summary-panel-closed w-16");
    expect(stylesheet).toContain("@keyframes orbitaMapSummaryOpen");
    expect(stylesheet).toContain(".map-summary-panel-open");
    expect(stylesheet).toContain(".map-summary-panel");
    expect(stylesheet).toContain(".map-summary-panel-open {");
  });

  it("shows a quick preview on marker hover and focus before opening full details", () => {
    expect(dashboardSource).toContain("markerPreviewRef");
    expect(dashboardSource).toContain("showMarkerPreview");
    expect(dashboardSource).toContain('marker.addListener("mouseover"');
    expect(dashboardSource).toContain('marker.addListener("mouseout"');
    expect(dashboardSource).toContain('marker.addListener("focus"');
    expect(dashboardSource).toContain('marker.addListener("blur"');
    expect(dashboardSource).toContain("Clique para ver detalhes");
    expect(dashboardSource).toContain("Clique para destacar o contrato");
    expect(dashboardSource).toContain("closeMarkerPreview();");
  });

  it("maps work types to configurable colors and semantic marker symbols", () => {
    expect(dashboardSource).toContain("MAP_MARKER_SYMBOL_NAMES");
    expect(dashboardSource).toContain("MAP_MARKER_SYMBOL_LABELS");
    expect(dashboardSource).toContain("getMapMarkerVisual");
    expect(dashboardSource).toContain("segmentColors[typeKey]");
    expect(dashboardSource).toContain("BACKWARD_CLOSED_ARROW");
    expect(dashboardSource).toContain("FORWARD_CLOSED_ARROW");
    expect(dashboardSource).toContain("MAP_MARKER_SYMBOL_LABELS[typeKey]");
    expect(dashboardSource).toContain("orbita-map-segment-colors");
  });

  it("animates cluster entry and exit during zoom while honoring reduced motion", () => {
    expect(dashboardSource).toContain("contractMarkersRef");
    expect(dashboardSource).toContain("clusterAnimationFramesRef");
    expect(dashboardSource).toContain("animateClusterMarker");
    expect(dashboardSource).toContain("requestAnimationFrame");
    expect(dashboardSource).toContain("setOpacity");
    expect(dashboardSource).toContain("prefers-reduced-motion: reduce");
    expect(dashboardSource).toContain("opacity: reduceClusterMotion ? 1 : 0");
  });
});
