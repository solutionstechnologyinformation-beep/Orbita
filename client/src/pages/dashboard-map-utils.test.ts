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
    expect(stylesheet).toContain("animation: orbitaMapFullscreenEnter 380ms");
    expect(stylesheet).toContain("animation: orbitaMapFullscreenExit 340ms");
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
    expect(dashboardSource).toContain("filteredExtensionKm");
    expect(dashboardSource).toContain("visibleExtensionKm");
    expect(dashboardSource).toContain("filteredSummarySegments");
    expect(dashboardSource).toContain("onClick={() => focusSegment(segment.id)}");
    expect(dashboardSource).toContain('data-map-focus="${featureKey}"');
  });

  it("animates opening and retracting the summary panel while respecting reduced motion", () => {
    expect(dashboardSource).toContain("map-summary-panel-open");
    expect(dashboardSource).toContain("map-summary-panel-closed w-16");
    expect(stylesheet).toContain("@keyframes orbitaMapSummaryOpen");
    expect(stylesheet).toContain(".map-summary-panel-open");
    expect(stylesheet).toContain(".map-summary-panel");
    expect(stylesheet).toContain(".map-summary-panel-open {");
  });

  it("animates entering and leaving fullscreen with a smooth scale and fade", () => {
    expect(dashboardSource).toContain("map-fullscreen-enter");
    expect(dashboardSource).toContain("map-fullscreen-exit");
    expect(stylesheet).toContain("@keyframes orbitaMapFullscreenEnter");
    expect(stylesheet).toContain("@keyframes orbitaMapFullscreenExit");
    expect(stylesheet).toContain("animation: orbitaMapFullscreenEnter 380ms");
    expect(stylesheet).toContain("animation: orbitaMapFullscreenExit 340ms");
    expect(stylesheet).toContain("backface-visibility: hidden;");
    expect(stylesheet).toContain(".map-fullscreen-enter,");
    expect(stylesheet).toContain(".map-fullscreen-exit,");
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

describe("dashboard map fullscreen canvas width adjustment", () => {
  it("reserves panel width in expanded mode so the summary panel is never clipped", () => {
    expect(dashboardSource).toContain("map-fullscreen-canvas");
    expect(dashboardSource).toContain("map-fullscreen-canvas-with-summary");
    expect(dashboardSource).toContain("map-fullscreen-canvas-collapsed");
    expect(stylesheet).toContain(".map-fullscreen-canvas-with-summary {");
    expect(stylesheet).toContain("right: min(26rem, calc(100vw - 1rem));");
  });
});

describe("dashboard map viewport preservation", () => {
  it("preserves the current viewport when marker data is refreshed after a selection", () => {
    expect(dashboardSource).toContain("const previousCenter = map.getCenter()?.toJSON();");
    expect(dashboardSource).toContain("const previousZoom = map.getZoom();");
    expect(dashboardSource).toContain("const shouldPreserveViewport");
    expect(dashboardSource).toContain("map.setCenter(previousCenter);");
    expect(dashboardSource).toContain("map.setZoom(previousZoom);");
  });

  it("does not pan or zoom when selecting a point, line, contract marker, or summary result", () => {
    expect(dashboardSource).toContain("const focusElement = useCallback((record: MapElementRecord)");
    expect(dashboardSource).toContain("const focusSegment = useCallback((segmentId: number)");
    expect(dashboardSource).toContain("infoWindow.open({ map, anchor: marker });");
    expect(dashboardSource).toContain("focusContract(first.item.crsId);");
    expect(dashboardSource).not.toContain("focusContract(first.item.crsId, first.position)");
  });
});

describe("dashboard map viewport across fullscreen transitions", () => {
  it("captures the viewport before entering or leaving fullscreen", () => {
    expect(dashboardSource).toContain("const mapViewportRef = useRef");
    expect(dashboardSource).toContain("const captureMapViewport = useCallback");
    expect(dashboardSource).toContain("captureMapViewport();");
    expect(dashboardSource).toContain("onExpandedChange(false)");
    expect(dashboardSource).toContain("onExpandedChange(true)");
  });

  it("restores the exact center and zoom after the map resize", () => {
    expect(dashboardSource).toContain("const restoreMapViewport = useCallback");
    expect(dashboardSource).toContain("map.setCenter(viewport.center);");
    expect(dashboardSource).toContain("map.setZoom(viewport.zoom);");
    expect(dashboardSource).toContain("window.google.maps.event.trigger(mapRef.current, \"resize\")");
    expect(dashboardSource).toContain("restoreViewportFrame = window.requestAnimationFrame(restoreMapViewport);");
  });
});

describe("dashboard map quick work-status filters", () => {
  it("defines all, in-progress, completed, and planned status options from contract progress", () => {
    expect(dashboardSource).toContain('type MapWorkStatusFilter = "all" | "in-progress" | "completed" | "planned";');
    expect(dashboardSource).toContain('{ value: "in-progress", label: "Em andamento"');
    expect(dashboardSource).toContain('{ value: "completed", label: "Concluídas"');
    expect(dashboardSource).toContain('{ value: "planned", label: "Planejadas"');
    expect(dashboardSource).toContain("if (normalizedProgress >= 100) return \"completed\";");
    expect(dashboardSource).toContain("if (normalizedProgress > 0) return \"in-progress\";");
  });

  it("combines the active status filter with search, markers, list and live metrics", () => {
    expect(dashboardSource).toContain("const statusFilteredSegments = useMemo");
    expect(dashboardSource).toContain("const filteredSummarySegments = useMemo");
    expect(dashboardSource).toContain("data-map-work-status-filter={option.value}");
    expect(dashboardSource).toContain("aria-pressed={active}");
    expect(dashboardSource).toContain("setWorkStatusFilter(option.value)");
    expect(dashboardSource).toContain("{ label: \"Trechos\", value: filteredSummarySegments.length }");
    expect(dashboardSource).toContain("Extensão filtrada");
  });
});

describe("dashboard map work-status legend", () => {
  it("renders a labeled visual legend with the same colors used by contract markers", () => {
    expect(dashboardSource).toContain('data-map-status-legend="true"');
    expect(dashboardSource).toContain('aria-label="Legenda de status das obras"');
    expect(dashboardSource).toContain("data-map-status-legend-filter={option.value}");
    expect(dashboardSource).toContain("aria-pressed={active}");
    expect(dashboardSource).toContain("onClick={() => setWorkStatusFilter(option.value)}");
    expect(dashboardSource).toContain("workStatusCounts[option.value]");
    expect(dashboardSource).toContain("aria-label={`${workStatusCounts[option.value]} obras`}");
    expect(dashboardSource).toContain("MAP_WORK_STATUS_COLORS");
    expect(dashboardSource).toContain('"in-progress": { color: "#2563eb"');
    expect(dashboardSource).toContain('completed: { color: "#16a34a"');
    expect(dashboardSource).toContain('planned: { color: "#f59e0b"');
    expect(dashboardSource).toContain("fillColor: contractStatusColor.color");
    expect(dashboardSource).toContain("border: `1px solid ${statusColor.stroke}`");
  });
});
