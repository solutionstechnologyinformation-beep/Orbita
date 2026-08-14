import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import { aggregateCompletedTasksByAssignee } from "../../../shared/report-summary";
import { resolvePrintWindow } from "./report-export-utils";
import { ORBITA_LOGO_URL } from "@/branding";
import { REPORT_PALETTE } from "./report-palette";
import { useAuth } from "@/_core/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { useTheme } from "@/contexts/ThemeContext";
import { useLocation } from "wouter";
import {
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar, LabelList,
} from "recharts";
import {
  TrendingUp, AlertTriangle, CheckCircle2, Clock, Layers, ArrowUpRight,
    MapPin, Activity, Users, FolderOpen, ChevronRight,
  Target, CalendarClock, ArrowRight, FileDown, Filter, Route, Map as MapIcon, Satellite, Palette, Eye, EyeOff, ChevronDown, ChevronUp, SlidersHorizontal, Maximize2, Minimize2, X, Search, Loader2, MessageSquare, UserCheck, GripVertical, RotateCcw,
} from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { MapView } from "@/components/Map";
import { Skeleton } from "@/components/ui/skeleton";
import { buildContractNumbers, clusterMapPoints, filterVisibleSegments, type MapPoint } from "@/lib/segment-map";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { buildMapElementsCsv, extractMapElementRecords, filterMapElementRecords, findMapElementRecord, getMapElementFocusZoom, getMapElementHighlightStyle, getMapElementPanelState, getNextMapElementVisibleCount, parseMapElementAttributes, type MapElementRecord, type MapElementSort } from "../../../shared/map-element-data";
import { buildChatActivityChartData, buildChatActivityDisciplineDetails, buildUnreadBadgeAnimationKey, CHAT_ACTIVITY_METRICS, formatUnreadBadgeLabel, type ChatActivityMetric } from "../../../shared/chat-activity";
import { buildTeamChatDisciplineUrl } from "./team-chat-navigation";
import { DEFAULT_DASHBOARD_WIDGET_ORDERS, getDashboardWidgetStorageKey, moveDashboardWidget, readDashboardWidgetOrders, type DashboardWidgetGroup, type DashboardWidgetId, type DashboardWidgetOrders } from "./dashboard-widget-order";
import { DashboardTrendIndicator, DashboardTrendPeriodSelect } from "./DashboardTrendIndicator";
import { TREND_COMPARISON_PERIOD_DESCRIPTIONS, getTrendComparisonStorageKey, readTrendComparisonPeriod, type TrendComparisonPeriod } from "./dashboard-trend-period";

// ── Helpers ────────────────────────────────────────────────────────────────────
const TIPO_OBRA_MAP: Record<string, string> = {
  implementacao: "Implementação",
  restauracao: "Restauração",
  aumento_capacidade: "Aumento de Capacidade",
  levantamento: "Levantamento",
  outro: "Outro",
};
const EXTENSION_COLORS: Record<string, string> = {
  implementacao: "#2563eb",
  restauracao: "#16a34a",
  aumento_capacidade: "#f59e0b",
  levantamento: "#8b5cf6",
  outro: "#64748b",
};
const LIGHT_MAP_STYLES: google.maps.MapTypeStyle[] = [
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9e8f5" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#e8e8e8" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];
const DARK_MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#1f2937" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1f2937" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#d1d5db" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0b1d2a" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#374151" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#4b5563" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];
function parseTipoObra(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { const p = JSON.parse(raw); return Array.isArray(p) ? p : [raw]; } catch { return [raw]; }
}
function initials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}
function fmtTime(d: Date | string) {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
function getStatusLabel(progress: number) {
  if (progress >= 90) return { label: "Em Dia", color: "#22c55e" };
  if (progress >= 60) return { label: "Em Andamento", color: "#3b82f6" };
  if (progress >= 30) return { label: "Atenção", color: "#f59e0b" };
  return { label: "Atrasado", color: "#ef4444" };
}
function getImportedPointStyle(name: string) {
  const normalized = name.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toUpperCase();
  if (normalized.includes("INICIO")) return { fillColor: "#16a34a", strokeColor: "#14532d", scale: 7 };
  if (normalized.includes("FIM")) return { fillColor: "#dc2626", strokeColor: "#7f1d1d", scale: 7 };
  if (/\\bKM\\s*\\d/.test(normalized)) return { fillColor: "#facc15", strokeColor: "#92400e", scale: 5 };
  return { fillColor: "#a855f7", strokeColor: "#581c87", scale: 6 };
}
function escapeInfoWindowHtml(value: unknown) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;");
}
function renderElementAttributesHtml(rawAttributes: unknown) {
  const attributes = parseMapElementAttributes(rawAttributes);
  if (attributes.length === 0) return `<div style="font-size:11px;color:#64748b;margin-top:6px;">Atributos: <strong>Não informados</strong></div>`;
  return `<div style="margin-top:7px;border-top:1px solid #e2e8f0;padding-top:6px;"><div style="font-size:11px;font-weight:700;color:#334155;margin-bottom:4px;">Atributos</div>${attributes.map(({ key, value }) => `<div style="display:flex;gap:6px;font-size:11px;color:#475569;margin:2px 0;"><span style="font-weight:600;color:#64748b;min-width:72px;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeInfoWindowHtml(key)}</span><span style="word-break:break-word;">${escapeInfoWindowHtml(value)}</span></div>`).join("")}</div>`;
}

// ── Google Maps de Contratos ──────────────────────────────────────────────────
interface ContractItem { id: number; name: string; clientName: string | null; progress: number; }
interface ContractLocation {
  name: string;
  state: string | null;
  country: string | null;
  count: number;
  avgProgress: number;
  contracts?: ContractItem[];
}
interface SegmentOverlay {
  id: number;
  crsId: number;
  name: string;
  fileName?: string;
  geometryJson: string;
  crsName?: string | null;
  tipoObra?: string | null;
  extensaoKm?: number | null;
  techDataByType?: string | null;
}
type ContractMarkerData = { crsId: number; name: string; number: number | string };
type ElementOverlayMeta = { lines: google.maps.Polyline[]; marker?: google.maps.Marker; baseColor?: string; baseIcon?: google.maps.Symbol };
  function ContractsMap({ locations, segments, segmentsLoading, onNavigate, mapExportRef }: { locations: ContractLocation[]; segments: SegmentOverlay[]; segmentsLoading: boolean; onNavigate: (path: string) => void; mapExportRef: React.RefObject<HTMLDivElement | null> }) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const segmentLinesRef = useRef<google.maps.Polyline[]>([]);
  const segmentMarkersRef = useRef<google.maps.Marker[]>([]);
  const elementOverlayMetaRef = useRef<Map<string, ElementOverlayMeta>>(new Map());
  const hoveredElementKeyRef = useRef<string | null>(null);
  const zoomListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const highlightTimerRef = useRef<number | null>(null);
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [mapType, setMapType] = useState<"roadmap" | "satellite">("roadmap");
  const mapStyles = mapType === "roadmap" ? (isDark ? DARK_MAP_STYLES : LIGHT_MAP_STYLES) : undefined;
  const [segmentVisibility, setSegmentVisibility] = useState<Record<number, boolean>>({});
  const [selectedSegmentId, setSelectedSegmentId] = useState<number | "all">("all");
  const [segmentColors, setSegmentColors] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return { ...EXTENSION_COLORS };
    try {
      const saved = JSON.parse(window.localStorage.getItem("orbita-map-segment-colors") ?? "{}");
      return { ...EXTENSION_COLORS, ...(saved && typeof saved === "object" ? saved : {}) };
    } catch {
      return { ...EXTENSION_COLORS };
    }
  });
  const [controlsOpen, setControlsOpen] = useState(true);
  const [elementSearch, setElementSearch] = useState("");
  const [elementSort, setElementSort] = useState<MapElementSort>("alphabetical");
  const [hoveredElementKey, setHoveredElementKey] = useState<string | null>(null);
  const [selectedElementKey, setSelectedElementKey] = useState<string | null>(null);
  const [visibleElementCount, setVisibleElementCount] = useState(8);
  const elementListRef = useRef<HTMLDivElement | null>(null);
  const mapElementPanelState = getMapElementPanelState(segmentsLoading, segments.length);
  const mapPanelSurface = isDark ? "bg-slate-900/95 border-slate-700" : "bg-white/95 border-gray-200";
  const mapPanelText = isDark ? "text-slate-100" : "text-gray-800";
  const mapPanelMuted = isDark ? "text-slate-400" : "text-gray-500";
  const mapPanelInput = isDark ? "border-slate-600 bg-slate-800 text-slate-100" : "border-gray-200 bg-white text-gray-700";
  const visibleSegments = useMemo(() => filterVisibleSegments(segments, segmentVisibility, selectedSegmentId), [segments, segmentVisibility, selectedSegmentId]);
  const mapElementRecords = useMemo(() => extractMapElementRecords(visibleSegments), [visibleSegments]);
  const filteredElementRecords = useMemo(() => filterMapElementRecords(mapElementRecords, elementSearch, Math.max(mapElementRecords.length, 1), elementSort), [elementSearch, elementSort, mapElementRecords]);
  const visibleElementRecords = useMemo(() => filteredElementRecords.slice(0, visibleElementCount), [filteredElementRecords, visibleElementCount]);
  useEffect(() => {
    setVisibleElementCount((current) => Math.min(Math.max(current, 8), filteredElementRecords.length || 8));
  }, [filteredElementRecords.length]);
  const handleElementListScroll = useCallback(() => {
    const elementList = elementListRef.current;
    if (!elementList || visibleElementCount >= filteredElementRecords.length) return;
    if (elementList.scrollTop + elementList.clientHeight >= elementList.scrollHeight - 24) {
      setVisibleElementCount((current) => getNextMapElementVisibleCount(current, filteredElementRecords.length));
    }
  }, [filteredElementRecords.length, visibleElementCount]);
  const selectedElement = useMemo(() => findMapElementRecord(mapElementRecords, selectedElementKey), [mapElementRecords, selectedElementKey]);
  const applyElementHover = useCallback((key: string | null) => {
    elementOverlayMetaRef.current.forEach((meta, overlayKey) => {
      const isHovered = overlayKey === key;
      meta.lines.forEach((line) => line.setOptions(getMapElementHighlightStyle(isHovered, meta.baseColor ?? "#2563eb")));
      if (meta.marker && meta.baseIcon) {
        meta.marker.setIcon(isHovered ? {
          ...meta.baseIcon,
          scale: (meta.baseIcon.scale ?? 6) + 3,
          fillColor: "#f59e0b",
          strokeColor: "#92400e",
          strokeWeight: 2.5,
        } : meta.baseIcon);
        meta.marker.setZIndex(isHovered ? 120 : 1);
      }
    });
  }, []);
  const setElementHover = useCallback((key: string | null) => {
    hoveredElementKeyRef.current = key;
    setHoveredElementKey(key);
    applyElementHover(key);
  }, [applyElementHover]);
  const focusElement = useCallback((record: MapElementRecord) => {
    setSelectedElementKey(record.key);
    setSegmentVisibility((current) => ({ ...current, [record.segmentId]: true }));
    if (record.center && mapRef.current) {
      mapRef.current.panTo(record.center);
      mapRef.current.setZoom(Math.max(mapRef.current.getZoom() ?? 6, record.geometryType === "Point" ? 12 : 10));
    }
  }, []);
  const exportElementsCsv = useCallback(() => {
    if (mapElementRecords.length === 0) return;
    const csv = buildMapElementsCsv(mapElementRecords);
    const blob = new Blob([`\\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `orbita-elementos-mapa-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }, [mapElementRecords]);
  const enabledSegmentCount = useMemo(() => segments.filter((segment) => segmentVisibility[segment.id] !== false).length, [segments, segmentVisibility]);
  const contractNumbers = useMemo(() => buildContractNumbers(segments), [segments]);
  const segmentTypeKeys = useMemo(() => {
    const keys = new Set<string>();
    segments.forEach((segment) => {
      const types = parseTipoObra(segment.tipoObra);
      if (types.length === 0) keys.add("outro");
      types.forEach((key) => keys.add(key));
    });
    return Array.from(keys).filter((key) => TIPO_OBRA_MAP[key]);
  }, [segments]);
  const getSegmentTypeKey = useCallback((segment: SegmentOverlay) => parseTipoObra(segment.tipoObra)[0] ?? "outro", []);
  const getSegmentExtensionKm = useCallback((segment: SegmentOverlay) => {
    if (typeof segment.extensaoKm === "number" && Number.isFinite(segment.extensaoKm)) return segment.extensaoKm;
    try {
      const technical = JSON.parse(segment.techDataByType ?? "{}");
      const total = Object.values(technical as Record<string, { extensaoKm?: number | null }>).reduce((sum, entry) => sum + (Number(entry?.extensaoKm) || 0), 0);
      return total > 0 ? total : null;
    } catch {
      return null;
    }
  }, []);
  useEffect(() => {
    window.localStorage.setItem("orbita-map-segment-colors", JSON.stringify(segmentColors));
  }, [segmentColors]);

  const handleMapReady = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    // Configure map style
    map.setOptions({
      mapTypeId: mapType,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: true,
      styles: mapStyles,
    });
    if (locations.length === 0 && segments.length === 0) return;
    placeMarkers(map);
  }, [locations, segments, theme, mapType]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mapRef.current) mapRef.current.setOptions({ styles: mapStyles });
  }, [mapStyles]);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setMapTypeId(mapType);
    mapRef.current.setOptions({ styles: mapStyles });
  }, [mapType, mapStyles]);

  const placeMarkers = useCallback((map: google.maps.Map) => {
    const g = (window as any).google.maps;
    // Clear old markers and imported route overlays
    markersRef.current.forEach((m) => { try { m.setMap(null); } catch {} });
    markersRef.current = [];
    segmentLinesRef.current.forEach((line) => { try { line.setMap(null); } catch {} });
    segmentLinesRef.current = [];
    segmentMarkersRef.current.forEach((marker) => { try { marker.setMap(null); } catch {} });
    segmentMarkersRef.current = [];
    elementOverlayMetaRef.current.clear();
    const geocoder = new g.Geocoder();
    const bounds = new g.LatLngBounds();
    let geocodedCount = 0;
    let segmentPointCount = 0;
    let pending = locations.length;
    const contractPoints = new Map<number, { latTotal: number; lngTotal: number; pointCount: number; name: string }>();
    const segmentLineMeta: Array<{ line: google.maps.Polyline; crsId: number; baseColor: string }> = [];
    const attachElementFocusAction = (infoWindow: google.maps.InfoWindow, featureKey: string, position: google.maps.LatLngLiteral, minimumZoom: number, anchor?: google.maps.Marker) => {
      window.setTimeout(() => {
        const button = document.querySelector(`[data-map-focus="${featureKey}"]`) as HTMLButtonElement | null;
        if (!button || button.dataset.focusBound === "true") return;
        button.dataset.focusBound = "true";
        button.addEventListener("click", () => {
          map.panTo(position);
          map.setZoom(getMapElementFocusZoom(map.getZoom(), minimumZoom));
          infoWindow.setPosition(position);
          infoWindow.open(anchor ? { map, anchor } : { map });
        });
      }, 150);
    };

    if (zoomListenerRef.current) {
      zoomListenerRef.current.remove();
      zoomListenerRef.current = null;
    }
    if (highlightTimerRef.current !== null) {
      window.clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = null;
    }

    visibleSegments.forEach((segment) => {
      try {
        const collection = JSON.parse(segment.geometryJson);
        const features = Array.isArray(collection.features) ? collection.features : [];
        features.forEach((feature: any, featureIndex: number) => {
          const geometry = feature?.geometry;
          const featureKey = `${segment.id}:${featureIndex}`;
          const featName = feature?.properties?.name || segment.name;
          const featDesc = feature?.properties?.description;
          const attributesHtml = renderElementAttributesHtml(feature?.properties?.attributes);

          if (geometry?.type === "LineString" || geometry?.type === "MultiLineString") {
            const paths = geometry.type === "LineString" ? [geometry.coordinates] : geometry.coordinates;
            paths.forEach((coordinates: any[]) => {
              const path = coordinates.map(([lng, lat]) => ({ lat: Number(lat), lng: Number(lng) })).filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
              if (path.length < 2) return;
              path.forEach((point) => bounds.extend(point));
              segmentPointCount += path.length;
              const currentCenter = contractPoints.get(segment.crsId) ?? { latTotal: 0, lngTotal: 0, pointCount: 0, name: segment.crsName ?? `Contrato #${segment.crsId}` };
              path.forEach((point) => { currentCenter.latTotal += point.lat; currentCenter.lngTotal += point.lng; currentCenter.pointCount += 1; });
              contractPoints.set(segment.crsId, currentCenter);
              const typeKey = getSegmentTypeKey(segment);
              const strokeColor = segmentColors[typeKey] ?? EXTENSION_COLORS[typeKey] ?? "#16a34a";
              const extension = getSegmentExtensionKm(segment);
              const infoWindow = new g.InfoWindow({
                content: `<div style="font-family:Inter,sans-serif;padding:6px 4px;min-width:190px;max-width:280px;">
                  <div style="font-weight:700;font-size:13px;color:#1e293b;margin-bottom:5px;">${escapeInfoWindowHtml(segment.crsName ?? `Contrato #${segment.crsId}`)}</div>
                  <div style="font-size:12px;color:#475569;margin-bottom:3px;">Elemento: <strong>${escapeInfoWindowHtml(featName)}</strong></div>
                  ${featDesc ? `<div style="font-size:11px;color:#334155;margin-bottom:3px;background:#f8fafc;padding:4px;border-radius:4px;">${escapeInfoWindowHtml(featDesc)}</div>` : ""}
                  <div style="font-size:12px;color:#475569;margin-bottom:3px;">Tipo: <strong>${escapeInfoWindowHtml(TIPO_OBRA_MAP[typeKey] ?? typeKey)}</strong></div>
                  ${attributesHtml}
                  <div style="font-size:12px;color:#475569;">Extensão: <strong>${extension !== null ? `${extension.toLocaleString("pt-BR")} km` : "Não informada"}</strong></div>
                  <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;"><button data-map-focus="${featureKey}" style="border:0;border-radius:6px;background:#f59e0b;color:#422006;padding:5px 9px;font-size:11px;font-weight:700;cursor:pointer;">Centralizar e aproximar</button><button data-segment-crs="${segment.crsId}" style="border:0;border-radius:6px;background:#2563eb;color:#fff;padding:5px 9px;font-size:11px;font-weight:600;cursor:pointer;">Abrir contrato</button></div>
                </div>`,
              });
              const line = new g.Polyline({ map, path, geodesic: true, strokeColor, strokeOpacity: 0.9, strokeWeight: 4, clickable: true });
              const lineMeta = elementOverlayMetaRef.current.get(featureKey) ?? { lines: [], baseColor: strokeColor };
              lineMeta.lines.push(line);
              lineMeta.baseColor = strokeColor;
              elementOverlayMetaRef.current.set(featureKey, lineMeta);
              line.addListener("click", () => {
                setSelectedElementKey(featureKey);
                map.panTo(path[Math.floor(path.length / 2)]);
                map.setZoom(Math.max(map.getZoom() ?? 6, 10));
                infoWindow.setPosition(path[Math.floor(path.length / 2)]);
                infoWindow.open({ map });
                attachElementFocusAction(infoWindow, featureKey, path[Math.floor(path.length / 2)], 10);
                setTimeout(() => {
                  const button = document.querySelector(`[data-segment-crs="${segment.crsId}"]`);
                  button?.addEventListener("click", () => { infoWindow.close(); onNavigate(`/kanban?crs=${segment.crsId}`); });
                }, 200);
              });
              segmentLinesRef.current.push(line);
              segmentLineMeta.push({ line, crsId: segment.crsId, baseColor: strokeColor });
            });
          } else if (geometry?.type === "Point" && Array.isArray(geometry.coordinates) && geometry.coordinates.length >= 2) {
            const [lng, lat] = geometry.coordinates;
            const position = { lat: Number(lat), lng: Number(lng) };
            if (Number.isFinite(position.lat) && Number.isFinite(position.lng)) {
              bounds.extend(position);
              const infoWindow = new g.InfoWindow({
                content: `<div style="font-family:Inter,sans-serif;padding:6px 4px;min-width:180px;max-width:260px;">
                  <div style="font-weight:700;font-size:13px;color:#1e293b;margin-bottom:4px;">${escapeInfoWindowHtml(featName)}</div>
                  ${featDesc ? `<div style="font-size:11px;color:#334155;margin-bottom:3px;background:#f8fafc;padding:4px;border-radius:4px;">${escapeInfoWindowHtml(featDesc)}</div>` : ""}
                  <div style="font-size:11px;color:#64748b;">Arquivo: ${escapeInfoWindowHtml(segment.name)}</div>
                  ${attributesHtml}
                  <button data-map-focus="${featureKey}" style="margin-top:8px;border:0;border-radius:6px;background:#f59e0b;color:#422006;padding:5px 9px;font-size:11px;font-weight:700;cursor:pointer;">Centralizar e aproximar</button>
                </div>`,
              });
              const pointStyle = getImportedPointStyle(featName);
              const baseIcon: google.maps.Symbol = { path: g.SymbolPath.CIRCLE, scale: pointStyle.scale, fillColor: pointStyle.fillColor, fillOpacity: 0.95, strokeColor: pointStyle.strokeColor, strokeWeight: 1.5 };
              const marker = new g.Marker({
                map,
                position,
                title: featName,
                icon: baseIcon,
              });
              elementOverlayMetaRef.current.set(featureKey, { lines: [], marker, baseIcon });
              marker.addListener("click", () => {
                setSelectedElementKey(featureKey);
                map.panTo(position);
                map.setZoom(Math.max(map.getZoom() ?? 6, 12));
                infoWindow.open({ map, anchor: marker });
                attachElementFocusAction(infoWindow, featureKey, position, 12, marker);
              });
              segmentMarkersRef.current.push(marker);
            }
          }
        });
      } catch {
        // Segmentos inválidos são ignorados sem interromper os marcadores do mapa.
      }
    });

    const focusContract = (crsId: number, position: google.maps.LatLngLiteral) => {
      map.panTo(position);
      map.setZoom(Math.max(map.getZoom() ?? 6, 10));
      segmentLineMeta.forEach(({ line, crsId: lineCrsId, baseColor }) => {
        line.setOptions({
          strokeWeight: lineCrsId === crsId ? 9 : 3,
          strokeOpacity: lineCrsId === crsId ? 1 : 0.2,
          strokeColor: lineCrsId === crsId ? "#f59e0b" : baseColor,
          zIndex: lineCrsId === crsId ? 100 : 1,
        });
      });
      if (highlightTimerRef.current !== null) window.clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = window.setTimeout(() => {
        segmentLineMeta.forEach(({ line, baseColor }) => {
          line.setOptions({ strokeWeight: 4, strokeOpacity: 0.9, strokeColor: baseColor, zIndex: 1 });
        });
        highlightTimerRef.current = null;
      }, 3500);
    };

    const renderSegmentMarkers = (zoom: number) => {
      segmentMarkersRef.current.forEach((marker) => { try { marker.setMap(null); } catch {} });
      segmentMarkersRef.current = [];
      const points: MapPoint<ContractMarkerData>[] = Array.from(contractPoints.entries())
        .filter(([, center]) => center.pointCount > 0)
        .map(([crsId, center]) => {
          const position = { lat: center.latTotal / center.pointCount, lng: center.lngTotal / center.pointCount };
          bounds.extend(position);
          return {
            item: { crsId, name: center.name, number: contractNumbers[crsId] ?? "" },
            position,
          };
        });

      clusterMapPoints(points, zoom).forEach((cluster) => {
        const first = cluster.points[0];
        const isCluster = cluster.points.length > 1;
        const marker = new g.Marker({
          map,
          position: cluster.center,
          title: isCluster ? `${cluster.points.length} contratos agrupados` : `${first.item.number} — ${first.item.name}`,
          icon: {
            path: g.SymbolPath.CIRCLE,
            scale: isCluster ? 15 : 10,
            fillColor: isCluster ? "#111827" : "#facc15",
            fillOpacity: 1,
            strokeColor: isCluster ? "#ffffff" : "#92400e",
            strokeWeight: isCluster ? 2 : 1.5,
          },
          label: {
            text: isCluster ? String(cluster.points.length) : String(first.item.number),
            color: isCluster ? "#ffffff" : "#1f2937",
            fontWeight: "800",
            fontSize: isCluster ? "11px" : "10px",
          },
          zIndex: isCluster ? 30 : 20,
        });

        if (isCluster) {
          marker.addListener("click", () => {
            const clusterBounds = new g.LatLngBounds();
            cluster.points.forEach((point) => clusterBounds.extend(point.position));
            map.fitBounds(clusterBounds, 80);
            window.setTimeout(() => map.setZoom(Math.min((map.getZoom() ?? 6) + 2, 14)), 160);
          });
        } else {
          marker.addListener("click", () => focusContract(first.item.crsId, first.position));
        }
        segmentMarkersRef.current.push(marker);
      });
    };

    applyElementHover(hoveredElementKeyRef.current);
    renderSegmentMarkers(map.getZoom() ?? 4);
    zoomListenerRef.current = map.addListener("zoom_changed", () => renderSegmentMarkers(map.getZoom() ?? 4));

    const finish = () => {
      const totalPoints = geocodedCount + segmentPointCount;
      if (totalPoints > 0) {
        if (totalPoints === 1) {
          map.setCenter(bounds.getCenter());
          map.setZoom(6);
        } else {
          map.fitBounds(bounds, 60);
        }
      }
    };

    locations.forEach((loc, i) => {
      const query = [loc.state, loc.country || "Brasil"].filter(Boolean).join(", ");
      if (!query) { pending--; if (pending === 0) finish(); return; }
      setTimeout(() => {
        geocoder.geocode({ address: query }, (results: any, status: any) => {
          if (status === "OK" && results?.[0]) {
            const pos = results[0].geometry.location;
            bounds.extend(pos);
            geocodedCount++;
            const marker = new g.Marker({
              map,
              position: pos,
              title: `${loc.state ?? loc.country}: ${loc.count} contrato(s)`,
              icon: {
                path: g.SymbolPath.CIRCLE,
                scale: 14 + Math.min(loc.count * 2, 10),
                fillColor: "#1d4ed8",
                fillOpacity: 0.9,
                strokeColor: "#ffffff",
                strokeWeight: 2.5,
              },
              label: {
                text: String(loc.count),
                color: "#ffffff",
                fontWeight: "700",
                fontSize: "12px",
              },
            });
            // Build infoWindow content with contract list if available
            const contractsList = loc.contracts && loc.contracts.length > 0
              ? loc.contracts.map((c: ContractItem) =>
                  `<div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid #f1f5f9;cursor:pointer;" data-crs-id="${c.id}">
                    <div style="width:6px;height:6px;border-radius:50%;background:#3b82f6;flex-shrink:0;"></div>
                    <div style="flex:1;min-width:0;">
                      <div style="font-size:12px;font-weight:600;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px;">${c.name}</div>
                      ${c.clientName ? `<div style="font-size:11px;color:#64748b;">${c.clientName}</div>` : ''}
                    </div>
                    <div style="font-size:11px;color:#3b82f6;font-weight:600;white-space:nowrap;">${c.progress}%</div>
                  </div>`
                ).join('')
              : '';
            const infoWindow = new g.InfoWindow({
              content: `<div style="font-family:Inter,sans-serif;padding:6px 4px;min-width:200px;max-width:260px;">
                <div style="font-weight:700;font-size:13px;color:#1e293b;margin-bottom:4px;">${loc.state ?? loc.country ?? ""}</div>
                <div style="font-size:12px;color:#64748b;margin-bottom:2px;">${loc.count} contrato${loc.count !== 1 ? "s" : ""} &bull; Progresso médio: <span style="color:#3b82f6;font-weight:600;">${loc.avgProgress}%</span></div>
                ${contractsList ? `<div style="margin-top:6px;max-height:180px;overflow-y:auto;">${contractsList}</div>` : ''}
              </div>`,
            });
            marker.addListener("click", () => {
              infoWindow.open({ anchor: marker, map });
              // After open, attach click listeners to contract rows
              setTimeout(() => {
                const container = document.querySelector('.gm-style-iw-d');
                if (container) {
                  container.querySelectorAll('[data-crs-id]').forEach((el: Element) => {
                    (el as HTMLElement).addEventListener('click', () => {
                      const crsId = (el as HTMLElement).getAttribute('data-crs-id');
                      if (crsId) { onNavigate(`/kanban?crs=${crsId}`); infoWindow.close(); }
                    });
                  });
                }
              }, 200);
            });
            markersRef.current.push(marker);
          }
          pending--;
          if (pending === 0) finish();
        });
      }, i * 150);
    });
  }, [locations, visibleSegments, onNavigate, segmentColors, getSegmentTypeKey, getSegmentExtensionKm, contractNumbers, applyElementHover]);



  useEffect(() => {
    if (mapRef.current) mapRef.current.setMapTypeId(mapType);
  }, [mapType]);

  useEffect(() => {
    if (!isMapExpanded) return;
    const previousOverflow = document.body.style.overflow;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMapExpanded(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);
    const resizeTimer = window.setTimeout(() => {
      if (mapRef.current && window.google?.maps?.event) window.google.maps.event.trigger(mapRef.current, "resize");
    }, 160);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
      window.clearTimeout(resizeTimer);
    };
  }, [isMapExpanded]);

  useEffect(() => {
    if (mapRef.current && (locations.length > 0 || segments.length > 0)) {
      placeMarkers(mapRef.current);
    }
  }, [locations, segments, placeMarkers]);



  useEffect(() => () => {
    zoomListenerRef.current?.remove();
    zoomListenerRef.current = null;
    if (highlightTimerRef.current !== null) window.clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = null;
  }, []);

  if (locations.length === 0 && segments.length === 0 && !segmentsLoading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-xl border border-gray-100">
        <div className="text-center text-gray-400">
          <MapPin className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhum contrato ativo com localização</p>
        </div>
      </div>
    );
  }
  return (
    <div className={isMapExpanded ? "fixed inset-0 z-[60] bg-slate-950/60 p-3 sm:p-6" : "relative"}>
      <div ref={mapExportRef} className={isMapExpanded ? `relative h-full w-full overflow-hidden rounded-2xl bg-card shadow-2xl ring-1 ${isDark ? "ring-slate-700/60" : "ring-white/30"}` : "relative rounded-xl overflow-hidden"}>
        <MapView
          className={isMapExpanded ? "rounded-2xl overflow-hidden !h-full" : "rounded-xl overflow-hidden !h-[28rem]"}
          initialCenter={{ lat: -14.235, lng: -51.925 }}
          initialZoom={4}
          onMapReady={handleMapReady}
        />
        {selectedElement && (
          <aside data-map-control="true" className={`absolute bottom-3 right-3 z-30 max-h-[calc(100%-5rem)] w-[330px] max-w-[calc(100%-1.5rem)] overflow-y-auto rounded-xl border ${mapPanelSurface} p-4 shadow-xl backdrop-blur-sm`} aria-label="Detalhes do elemento importado">
            <div className={`mb-3 flex items-start justify-between gap-3 border-b ${isDark ? "border-slate-700" : "border-gray-100"} pb-2`}>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-600">Detalhes do elemento</p>
                <h3 className={`truncate text-sm font-bold ${isDark ? "text-slate-100" : "text-gray-900"}`} title={selectedElement.elementName}>{selectedElement.elementName}</h3>
              </div>
              <button type="button" onClick={() => setSelectedElementKey(null)} className={`rounded-md p-1 ${mapPanelMuted} ${isDark ? "hover:bg-slate-800 hover:text-slate-100" : "hover:bg-gray-100 hover:text-gray-700"}`} aria-label="Fechar detalhes do elemento"><X className="h-4 w-4" /></button>
            </div>
            <dl className="space-y-2 text-[11px]">
              <div><dt className={`font-semibold ${mapPanelMuted}`}>Tipo</dt><dd className={isDark ? "text-slate-200" : "text-gray-700"}>{selectedElement.geometryType === "Point" ? "Ponto" : "Trecho linear"}</dd></div>
              <div><dt className={`font-semibold ${mapPanelMuted}`}>Contrato</dt><dd className={isDark ? "text-slate-200" : "text-gray-700"}>{selectedElement.crsName}</dd></div>
              <div><dt className={`font-semibold ${mapPanelMuted}`}>Arquivo / OS</dt><dd className={`break-words ${isDark ? "text-slate-200" : "text-gray-700"}`}>{selectedElement.segmentName}</dd></div>
              {selectedElement.workType && <div><dt className={`font-semibold ${mapPanelMuted}`}>Tipo de obra</dt><dd className={isDark ? "text-slate-200" : "text-gray-700"}>{TIPO_OBRA_MAP[selectedElement.workType] ?? selectedElement.workType}</dd></div>}
              {selectedElement.extensionKm !== null && <div><dt className={`font-semibold ${mapPanelMuted}`}>Extensão do contrato</dt><dd className={isDark ? "text-slate-200" : "text-gray-700"}>{selectedElement.extensionKm.toLocaleString("pt-BR")} km</dd></div>}
              {selectedElement.description && <div><dt className={`font-semibold ${mapPanelMuted}`}>Descrição</dt><dd className={`whitespace-pre-wrap break-words rounded-md ${isDark ? "bg-slate-800 text-slate-200" : "bg-gray-50 text-gray-700"} p-2`}>{selectedElement.description}</dd></div>}
              {selectedElement.attributes && <div><dt className={`font-semibold ${mapPanelMuted}`}>Atributos</dt><dd className="max-h-32 overflow-auto rounded-md bg-gray-950 p-2 font-mono text-[10px] text-green-200">{selectedElement.attributes}</dd></div>}
              {selectedElement.center && <div><dt className={`font-semibold ${mapPanelMuted}`}>Centro geográfico</dt><dd className={isDark ? "text-slate-200" : "text-gray-700"}>Lat. {selectedElement.center.lat.toFixed(6)} · Lng. {selectedElement.center.lng.toFixed(6)}</dd></div>}
            </dl>
            <button type="button" onClick={() => onNavigate(`/kanban?crs=${selectedElement.crsId}`)} className="mt-4 w-full rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">Abrir contrato no Kanban</button>
          </aside>
        )}
      </div>
      <div data-map-control="true" className={`absolute top-3 right-3 z-20 flex flex-wrap justify-end gap-1 rounded-lg ${mapPanelSurface} p-1 shadow-sm`} role="group" aria-label="Tipo de visualização, ampliação e exportação do mapa">
        <button type="button" onClick={() => setIsMapExpanded((expanded) => !expanded)} className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium ${mapPanelMuted} ${isDark ? "hover:bg-slate-800" : "hover:bg-gray-100"}`} aria-pressed={isMapExpanded} title={isMapExpanded ? "Sair da visualização ampliada" : "Ampliar mapa"}>
          {isMapExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          {isMapExpanded ? "Reduzir" : "Ampliar"}
        </button>
        <span className={`mx-0.5 h-5 w-px ${isDark ? "bg-slate-700" : "bg-gray-200"}`} aria-hidden="true" />
        <div className="flex items-center gap-1" role="group" aria-label="Camadas do mapa">
          <span className={`hidden sm:inline-flex items-center gap-1 px-1 text-[10px] font-semibold uppercase tracking-wide ${mapPanelMuted}`}><Layers className="h-3 w-3" /> Camadas</span>
          <button type="button" onClick={() => setMapType("roadmap")} className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${mapType === "roadmap" ? "bg-blue-600 text-white shadow-sm" : `${mapPanelMuted} ${isDark ? "hover:bg-slate-800" : "hover:bg-gray-100"}`}`} aria-pressed={mapType === "roadmap"} title="Exibir mapa padrão">
            <MapIcon className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Padrão</span>
          </button>
          <button type="button" onClick={() => setMapType("satellite")} className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${mapType === "satellite" ? "bg-blue-600 text-white shadow-sm" : `${mapPanelMuted} ${isDark ? "hover:bg-slate-800" : "hover:bg-gray-100"}`}`} aria-pressed={mapType === "satellite"} title="Exibir imagem de satélite">
            <Satellite className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Satélite</span>
          </button>
        </div>
        <span className={`mx-0.5 h-5 w-px ${isDark ? "bg-slate-700" : "bg-gray-200"}`} aria-hidden="true" />
        {isMapExpanded && (
          <button type="button" onClick={() => setIsMapExpanded(false)} className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium ${mapPanelMuted} ${isDark ? "hover:bg-slate-800" : "hover:bg-gray-100"}`} title="Fechar visualização ampliada">
            <X className="w-3.5 h-3.5" />
            Fechar
          </button>
        )}
        <span className={`mx-0.5 h-5 w-px ${isDark ? "bg-slate-700" : "bg-gray-200"}`} aria-hidden="true" />

      </div>


      {mapElementPanelState !== "empty" && (
        <div data-map-control="true" className={`absolute top-3 left-3 z-20 w-[292px] max-w-[calc(100%-1.5rem)] rounded-xl ${mapPanelSurface} shadow-md overflow-hidden`}>
          <button type="button" onClick={() => setControlsOpen((open) => !open)} className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left ${isDark ? "hover:bg-slate-800" : "hover:bg-gray-50"}`} aria-expanded={controlsOpen}>
            <span className={`flex items-center gap-2 text-xs font-semibold ${mapPanelText}`}><SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" /> {mapElementPanelState === "loading" ? "Processando KML/KMZ" : "Trechos importados"} <span className={mapPanelMuted}>{mapElementPanelState === "loading" ? <Loader2 className="inline h-3 w-3 animate-spin" aria-label="Carregando segmentos" /> : `${enabledSegmentCount}/${segments.length}`}</span></span>
            {controlsOpen ? <ChevronUp className={`w-4 h-4 ${mapPanelMuted}`} /> : <ChevronDown className={`w-4 h-4 ${mapPanelMuted}`} />}
          </button>
          {controlsOpen && (mapElementPanelState === "loading" ? (
            <div className={`border-t ${isDark ? "border-slate-700" : "border-gray-100"} px-3 py-3 space-y-2.5`} aria-live="polite" aria-label="Processando elementos KML/KMZ">
              <div className={`flex items-center gap-2 text-[11px] font-medium ${mapPanelMuted}`}><Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" /> Processando elementos do mapa...</div>
              {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-9 w-full rounded-md" />)}
              <p className={`text-[10px] ${mapPanelMuted}`}>Os controles aparecerão assim que os arquivos terminarem de ser processados.</p>
            </div>
          ) : (
            <div className={`border-t ${isDark ? "border-slate-700" : "border-gray-100"} px-3 py-2.5 space-y-3 max-h-[22rem] overflow-y-auto`}>
              <label className="block">
                <span className="mb-1 block text-[10px] uppercase tracking-wide font-semibold text-gray-400">Localizar trecho</span>
                <select value={selectedSegmentId} onChange={(event) => {
                  const value = event.target.value === "all" ? "all" : Number(event.target.value);
                  setSelectedSegmentId(value);
                  if (value !== "all") setSegmentVisibility((current) => ({ ...current, [value]: true }));
                }} className={`w-full rounded-md border ${mapPanelInput} px-2 py-1.5 text-[11px] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500`} aria-label="Localizar trecho importado">
                  <option value="all">Todos os trechos</option>
                  {segments.map((segment) => <option key={segment.id} value={segment.id}>{segment.crsName ?? `Contrato #${segment.crsId}`} — {segment.name}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-[minmax(0,1fr)_8.5rem] items-end gap-2">
                <label className="block min-w-0">
                  <span className="mb-1 block text-[10px] uppercase tracking-wide font-semibold text-gray-400">Pesquisar</span>
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" aria-hidden="true" />
                    <input value={elementSearch} onChange={(event) => setElementSearch(event.target.value)} placeholder="Nome ou atributo" className={`w-full rounded-md border ${mapPanelInput} pl-7 pr-2 py-1.5 text-[11px] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500`} aria-label="Pesquisar elementos KML/KMZ por nome ou atributo" />
                  </div>
                </label>
                <label className="block min-w-0">
                  <span className="mb-1 block text-[10px] uppercase tracking-wide font-semibold text-gray-400">Ordenar</span>
                  <select value={elementSort} onChange={(event) => setElementSort(event.target.value as MapElementSort)} className={`w-full rounded-md border ${mapPanelInput} px-2 py-1.5 text-[11px] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500`} aria-label="Ordenar resultados dos elementos KML/KMZ">
                    <option value="alphabetical">A–Z</option>
                    <option value="geometry">Geometria</option>
                  </select>
                </label>
              </div>
              <div ref={elementListRef} onScroll={handleElementListScroll} className="max-h-64 space-y-1.5 overflow-y-auto pr-1" role="list" aria-label="Resultados dos elementos KML/KMZ">
                {filteredElementRecords.length === 0 ? <p className={`rounded-md ${isDark ? "bg-slate-800 text-slate-400" : "bg-gray-50 text-gray-500"} px-2 py-2 text-[10px]`}>Nenhum elemento encontrado.</p> : visibleElementRecords.map((record) => {
                  const pointStyle = record.geometryType === "Point" ? getImportedPointStyle(record.elementName) : null;
                  const accent = pointStyle?.fillColor ?? "#2563eb";
                  return <button key={record.key} type="button" onClick={() => focusElement(record)} onMouseEnter={() => setElementHover(record.key)} onMouseLeave={() => setElementHover(null)} onFocus={() => setElementHover(record.key)} onBlur={() => setElementHover(null)} data-map-element-key={record.key} className={`w-full rounded-md px-2 py-1.5 text-left transition-colors ${selectedElementKey === record.key ? (isDark ? "bg-blue-950/70 ring-1 ring-blue-700" : "bg-blue-50 ring-1 ring-blue-200") : hoveredElementKey === record.key ? (isDark ? "bg-amber-950/70 ring-1 ring-amber-700" : "bg-amber-50 ring-1 ring-amber-200") : (isDark ? "bg-slate-800 hover:bg-slate-700" : "bg-gray-50 hover:bg-gray-100")}`}>
                    <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: accent }} /><span className={`min-w-0 flex-1 truncate text-[11px] font-medium ${isDark ? "text-slate-100" : "text-gray-700"}`}>{record.elementName}</span><span className={`text-[9px] uppercase ${mapPanelMuted}`}>{record.geometryType === "Point" ? "ponto" : "trecho"}</span></span>
                    <span className={`mt-0.5 block truncate pl-4 text-[10px] ${mapPanelMuted}`}>{record.description || record.crsName}</span>
                  </button>;
                })}
                {filteredElementRecords.length > visibleElementRecords.length && <p className={`sticky bottom-0 rounded-md ${isDark ? "bg-slate-900/95" : "bg-white/95"} px-2 py-1 text-center text-[10px] ${mapPanelMuted}`}>Role para carregar mais ({visibleElementRecords.length} de {filteredElementRecords.length})</p>}
                {filteredElementRecords.length > 0 && visibleElementRecords.length === filteredElementRecords.length && filteredElementRecords.length > 8 && <p className={`px-2 py-1 text-center text-[10px] ${mapPanelMuted}`}>Todos os {filteredElementRecords.length} resultados carregados.</p>}
              </div>
              <div className={`flex items-center justify-between gap-2 border-t ${isDark ? "border-slate-700" : "border-gray-100"} pt-2`}>
                <span className={`text-[10px] ${mapPanelMuted}`}>{mapElementRecords.length} elemento(s) disponível(is)</span>
                <button type="button" onClick={exportElementsCsv} disabled={mapElementRecords.length === 0} className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1.5 text-[10px] font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50" title="Exportar elementos do mapa para CSV"><FileDown className="h-3 w-3" /> CSV</button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className={`text-[10px] uppercase tracking-wide font-semibold ${mapPanelMuted}`}>Cores por tipo de obra</p>
                <Palette className={`w-3.5 h-3.5 ${mapPanelMuted}`} />
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                {segmentTypeKeys.map((typeKey) => (
                  <label key={typeKey} className={`flex items-center gap-2 text-[11px] ${isDark ? "text-slate-200" : "text-gray-600"} cursor-pointer`}>
                    <input type="color" value={segmentColors[typeKey] ?? EXTENSION_COLORS[typeKey] ?? "#16a34a"} onChange={(event) => setSegmentColors((current) => ({ ...current, [typeKey]: event.target.value }))} className="w-5 h-5 rounded border-0 p-0 cursor-pointer" aria-label={`Cor de ${TIPO_OBRA_MAP[typeKey]}`} />
                    <span className="truncate">{TIPO_OBRA_MAP[typeKey]}</span>
                  </label>
                ))}
              </div>
              <div className={`space-y-1.5 rounded-md ${isDark ? "bg-slate-800" : "bg-gray-50"} px-2 py-2`}>
                <p className={`text-[10px] uppercase tracking-wide font-semibold ${mapPanelMuted}`}>Ícones dos elementos</p>
                <div className={`grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] ${isDark ? "text-slate-200" : "text-gray-600"}`}>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-green-600" />Início</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-600" />Fim</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-yellow-400 ring-1 ring-yellow-700" />Marco KM</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-purple-500" />Outro ponto</span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 pt-1">
                <p className={`text-[10px] uppercase tracking-wide font-semibold ${mapPanelMuted}`}>Arquivos KMZ/KML</p>
                <div className="flex gap-1">
                  <button type="button" onClick={() => setSegmentVisibility(Object.fromEntries(segments.map((segment) => [segment.id, true])))} className="text-[10px] text-blue-600 hover:underline">Mostrar todos</button>
                  <button type="button" onClick={() => setSegmentVisibility(Object.fromEntries(segments.map((segment) => [segment.id, false])))} className={`text-[10px] ${mapPanelMuted} hover:underline`}>Ocultar todos</button>
                </div>
              </div>
              <div className="space-y-1.5">
                {segments.map((segment) => {
                  const typeKey = getSegmentTypeKey(segment);
                  const visible = segmentVisibility[segment.id] !== false;
                  const extension = getSegmentExtensionKm(segment);
                  return (
                    <button key={segment.id} type="button" onClick={() => setSegmentVisibility((current) => ({ ...current, [segment.id]: !visible }))} className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${visible ? (isDark ? "bg-slate-800 hover:bg-slate-700" : "bg-gray-50 hover:bg-gray-100") : (isDark ? "bg-slate-800/50 opacity-55 hover:opacity-80" : "bg-gray-50/50 opacity-55 hover:opacity-80")}`} aria-pressed={visible}>
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: segmentColors[typeKey] ?? EXTENSION_COLORS[typeKey] ?? "#16a34a" }} />
                      {visible ? <Eye className="w-3.5 h-3.5 text-blue-600 shrink-0" /> : <EyeOff className={`w-3.5 h-3.5 ${mapPanelMuted} shrink-0`} />}
                      <span className="min-w-0 flex-1"><span className={`block truncate text-[11px] font-medium ${isDark ? "text-slate-100" : "text-gray-700"}`}>{segment.name}</span><span className={`block truncate text-[10px] ${mapPanelMuted}`}>{segment.crsName ?? `Contrato #${segment.crsId}`} · {TIPO_OBRA_MAP[typeKey] ?? typeKey}{extension !== null ? ` · ${extension.toLocaleString("pt-BR")} km` : ""}</span></span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      {segments.length > 0 && (
        <div data-map-control="true" className={`absolute left-3 bottom-3 rounded-lg ${mapPanelSurface} px-3 py-2 text-[11px] ${mapPanelMuted} shadow-sm`}>
          <span className="inline-block w-3 h-1 rounded-full align-middle mr-1.5" style={{ backgroundColor: visibleSegments.length > 0 ? "#16a34a" : "#94a3b8" }} />
          Trechos visíveis: {visibleSegments.length}/{segments.length}
        </div>
      )}
    </div>
  );
}
// ── KPI Card ───────────────────────────────────────────────────────────────────
function KpiCard({ label, value, icon, iconBg, trend, trendSuffix = "%", trendPeriod = "período anterior", positiveWhenUp = true }: {
  label: string; value: string | number; icon: React.ReactNode; iconBg: string; trend?: number | null; trendSuffix?: string; trendPeriod?: string; positiveWhenUp?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 flex items-start justify-between shadow-sm">
      <div>
        <p className="text-sm text-gray-500 mb-1">{label}</p>
        <div className="flex items-center gap-2">
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          <DashboardTrendIndicator label={label} value={trend} suffix={trendSuffix} period={trendPeriod} positiveWhenUp={positiveWhenUp} />
        </div>
      </div>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBg}`}>
        {icon}
      </div>
    </div>
  );
}

// ── Stat Row (mapa lateral) ────────────────────────────────────────────────────
function StatRow({ icon, label, value, valueColor, trend, trendSuffix = "%", trendPeriod = "período anterior", positiveWhenUp = true }: {
  icon: React.ReactNode; label: string; value: string | number; valueColor?: string; trend?: number | null; trendSuffix?: string; trendPeriod?: string; positiveWhenUp?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-3 px-4 bg-white rounded-xl border border-gray-100 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
          {icon}
        </div>
        <span className="text-sm font-medium text-gray-700">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-base font-bold ${valueColor ?? "text-gray-900"}`}>{value}</span>
        <DashboardTrendIndicator label={label} value={trend} suffix={trendSuffix} period={trendPeriod} positiveWhenUp={positiveWhenUp} />
      </div>
    </div>
  );
}

// ── View Toggle ────────────────────────────────────────────────────────────────
type DashView = "geral" | "detalhada";

type WidgetFrameProps = {
  group: DashboardWidgetGroup;
  id: DashboardWidgetId;
  label: string;
  order: DashboardWidgetId[];
  draggedWidget: { group: DashboardWidgetGroup; id: DashboardWidgetId } | null;
  dragOverWidget: { group: DashboardWidgetGroup; id: DashboardWidgetId } | null;
  onDragStart: (group: DashboardWidgetGroup, id: DashboardWidgetId, event: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (group: DashboardWidgetGroup, id: DashboardWidgetId, event: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (group: DashboardWidgetGroup, id: DashboardWidgetId, event: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onKeyDown: (group: DashboardWidgetGroup, id: DashboardWidgetId, event: React.KeyboardEvent<HTMLDivElement>) => void;
  children: React.ReactNode;
  className?: string;
};

function DashboardWidgetFrame({ group, id, label, order, draggedWidget, dragOverWidget, onDragStart, onDragOver, onDrop, onDragEnd, onKeyDown, children, className = "" }: WidgetFrameProps) {
  const isDragging = draggedWidget?.group === group && draggedWidget.id === id;
  const isDragOver = dragOverWidget?.group === group && dragOverWidget.id === id && !isDragging;
  const [isSettling, setIsSettling] = useState(false);
  const hasRendered = useRef(false);
  const orderKey = order.join("|");

  useEffect(() => {
    if (!hasRendered.current) {
      hasRendered.current = true;
      return;
    }
    setIsSettling(true);
    const timeout = window.setTimeout(() => setIsSettling(false), 280);
    return () => window.clearTimeout(timeout);
  }, [orderKey]);

  return (
    <div
      draggable
      tabIndex={0}
      role="group"
      aria-label={`${label}. Use as setas para reordenar.`}
      aria-grabbed={isDragging}
      onDragStart={(event) => onDragStart(group, id, event)}
      onDragOver={(event) => onDragOver(group, id, event)}
      onDrop={(event) => onDrop(group, id, event)}
      onDragEnd={onDragEnd}
      onKeyDown={(event) => onKeyDown(group, id, event)}
      style={{ order: order.indexOf(id) }}
      className={`dashboard-widget-frame relative min-w-0 rounded-xl transition-[transform,opacity,box-shadow] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffc30d] ${isDragging ? "dashboard-widget-dragging opacity-55 scale-[0.985] shadow-lg" : ""} ${isDragOver ? "dashboard-widget-drop-target ring-2 ring-[#ffc30d] ring-offset-2" : ""} ${isSettling ? "dashboard-widget-reordered" : ""} ${className}`}
    >
      <button
        type="button"
        draggable={false}
        className="dashboard-widget-handle absolute right-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffc30d]"
        aria-label={`Arrastar widget ${label}`}
        title="Arrastar para reordenar"
        onClick={(event) => event.stopPropagation()}
      >
        <GripVertical className="h-4 w-4" aria-hidden="true" />
      </button>
      {children}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [view, setView] = useState<DashView>("geral");
  const [trendComparisonPeriod, setTrendComparisonPeriod] = useState<TrendComparisonPeriod>(() => readTrendComparisonPeriod(undefined));
  const [selectedCompany, setSelectedCompany] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<number | undefined>();
  const [chatMetric, setChatMetric] = useState<ChatActivityMetric>("onlineCount");
  const [clientFilterOpen, setClientFilterOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [widgetOrders, setWidgetOrders] = useState<DashboardWidgetOrders>(() => readDashboardWidgetOrders(undefined));
  const [draggedWidget, setDraggedWidget] = useState<{ group: DashboardWidgetGroup; id: DashboardWidgetId } | null>(null);
  const [dragOverWidget, setDragOverWidget] = useState<{ group: DashboardWidgetGroup; id: DashboardWidgetId } | null>(null);
  const dashboardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setWidgetOrders(readDashboardWidgetOrders(user?.id));
    const persistedPeriod = readTrendComparisonPeriod(user?.id);
    setTrendComparisonPeriod(persistedPeriod);
  }, [user?.id]);

  useEffect(() => {
    if (user?.id !== undefined && typeof window !== "undefined") {
      window.localStorage.setItem(getDashboardWidgetStorageKey(user.id), JSON.stringify(widgetOrders));
      window.localStorage.setItem(getTrendComparisonStorageKey(user.id), trendComparisonPeriod);
    }
  }, [user?.id, widgetOrders, trendComparisonPeriod]);

  const handleTrendPeriodChange = useCallback((period: TrendComparisonPeriod) => {
    setTrendComparisonPeriod(period);
  }, []);

  const updateWidgetOrder = useCallback((group: DashboardWidgetGroup, sourceId: DashboardWidgetId, targetId: DashboardWidgetId) => {
    setWidgetOrders((current) => ({ ...current, [group]: moveDashboardWidget(current[group], sourceId, targetId) }));
  }, []);

  const handleWidgetDragStart = useCallback((group: DashboardWidgetGroup, id: DashboardWidgetId, event: React.DragEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("button, input, select, textarea, a")) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `${group}:${id}`);
    setDraggedWidget({ group, id });
    setDragOverWidget(null);
  }, []);

  const handleWidgetDragOver = useCallback((group: DashboardWidgetGroup, id: DashboardWidgetId, event: React.DragEvent<HTMLDivElement>) => {
    if (!draggedWidget || draggedWidget.group !== group || draggedWidget.id === id) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverWidget({ group, id });
  }, [draggedWidget]);

  const clearWidgetDrag = useCallback(() => {
    setDraggedWidget(null);
    setDragOverWidget(null);
  }, []);

  const handleWidgetDrop = useCallback((group: DashboardWidgetGroup, id: DashboardWidgetId, event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (draggedWidget && draggedWidget.group === group) updateWidgetOrder(group, draggedWidget.id, id);
    clearWidgetDrag();
  }, [clearWidgetDrag, draggedWidget, updateWidgetOrder]);

  const handleWidgetKeyDown = useCallback((group: DashboardWidgetGroup, id: DashboardWidgetId, event: React.KeyboardEvent<HTMLDivElement>) => {
    const order = widgetOrders[group];
    const currentIndex = order.indexOf(id);
    if (currentIndex < 0) return;
    const direction = event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : 0;
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const targetIndex = event.key === "Home" ? 0 : order.length - 1;
      if (targetIndex !== currentIndex) updateWidgetOrder(group, id, order[targetIndex]);
      return;
    }
    if (!direction) return;
    const targetIndex = Math.max(0, Math.min(order.length - 1, currentIndex + direction));
    if (targetIndex !== currentIndex) {
      event.preventDefault();
      updateWidgetOrder(group, id, order[targetIndex]);
    }
  }, [updateWidgetOrder, widgetOrders]);

  const resetWidgetOrders = useCallback(() => {
    setWidgetOrders(DEFAULT_DASHBOARD_WIDGET_ORDERS);
    if (user?.id !== undefined && typeof window !== "undefined") {
      window.localStorage.removeItem(getDashboardWidgetStorageKey(user.id));
    }
    toast.success("Ordem padrão dos widgets restaurada.");
  }, [user?.id]);

  // ── Alerta automático de prazo ────────────────────────────────────────────────────
  const checkDeadlineAlertsMut = trpc.dashboard.checkDeadlineAlerts.useMutation();
  useEffect(() => {
    // Verificar alertas de prazo ao carregar o Dashboard (máx 1x por dia por sessão)
    const key = "orbita_deadline_check_" + new Date().toDateString();
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, "1");
      checkDeadlineAlertsMut.mutate(undefined, {
        onSuccess: (data) => {
          if (data.alertsSent > 0) {
            toast.success(`${data.alertsSent} alerta${data.alertsSent === 1 ? "" : "s"} de prazo enviado${data.alertsSent === 1 ? "" : "s"}.`, { description: `${data.tasksChecked} tarefa${data.tasksChecked === 1 ? "" : "s"} dentro da janela de ${data.alertDays} dia${data.alertDays === 1 ? "" : "s"}.` });
          }
        },
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Queries ──────────────────────────────────────────────────────────────────
  const normalizedCompany = useMemo(() => selectedCompany.trim() || undefined, [selectedCompany]);
  const dashboardDataInput = useMemo(() => ({ clientId: selectedClientId, company: normalizedCompany }), [selectedClientId, normalizedCompany]);
  const companiesQ = trpc.dashboard.companies.useQuery();
  const chatActivityQ = trpc.dashboard.chatActivityByDiscipline.useQuery(undefined, {
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
    staleTime: 10000,
  });
  const clientsQ = trpc.clients.list.useQuery();
  const statsQ = trpc.dashboard.stats.useQuery(dashboardDataInput);
  const contractDetailsQ = trpc.dashboard.contractDetails.useQuery(dashboardDataInput);
  const clientProgressQ = trpc.dashboard.clientProgress.useQuery(dashboardDataInput);
  const myTasksQ = trpc.dashboard.myTasks.useQuery();
  const completedTasksQ = trpc.dashboard.completedTasksSummary.useQuery({ limit: 100 });
  const activeSprintQ = trpc.dashboard.activeSprint.useQuery();
  const contractsByStateQ = trpc.dashboard.contractsByState.useQuery(dashboardDataInput);
  const segmentsQ = trpc.crs.segments.list.useQuery(dashboardDataInput);
  const slaQ = trpc.dashboard.slaStats.useQuery({ period: trendComparisonPeriod });
  const slaSparklineData = useMemo(() => [slaQ.data?.slaLast, slaQ.data?.slaThis].filter((value): value is number => typeof value === "number" && Number.isFinite(value)), [slaQ.data?.slaLast, slaQ.data?.slaThis]);
  const upcomingQ = trpc.dashboard.upcomingDeadlines.useQuery();
  const crsQ = trpc.crs.list.useQuery(dashboardDataInput);
  const stats = statsQ.data;
  const companies = (companiesQ.data ?? []) as string[];
  const clients = (clientsQ.data ?? []) as any[];
  const selectedClient = useMemo(() => clients.find((client: any) => client.id === selectedClientId), [clients, selectedClientId]);
  const clientProgress = (clientProgressQ.data ?? []) as any[];
  const myTasks = (myTasksQ.data ?? []) as any[];
  const completedTasks = (completedTasksQ.data ?? []) as any[];
  const activeSprint = activeSprintQ.data as any;
  const stateData = (contractsByStateQ.data ?? []) as any[];
  const crsItems = (crsQ.data ?? []) as any[];
  const contractDetails = (contractDetailsQ.data ?? []) as any[];
  const chatActivity = chatActivityQ.data;
  const chatActivityDisciplineDetails = useMemo(() => buildChatActivityDisciplineDetails((chatActivity?.disciplines ?? []) as any[]), [chatActivity?.disciplines]);
  const chatActivityChartData = useMemo(() => buildChatActivityChartData(chatActivity?.disciplines ?? [], chatMetric), [chatActivity?.disciplines, chatMetric]);
  const unreadBadgeAnimationKey = useMemo(() => buildUnreadBadgeAnimationKey(chatActivityChartData), [chatActivityChartData]);
  const chatMetricLabel = CHAT_ACTIVITY_METRICS.find((metric) => metric.key === chatMetric)?.label ?? "Métrica";

  // ── Tipo de Obra stats ────────────────────────────────────────────────────────
  const tipoObraStats = useMemo(() => {
    const map: Record<string, number> = {};
    crsItems.forEach((c: any) => {
      const types = parseTipoObra(c.tipoObra);
      if (types.length === 0) { map["outro"] = (map["outro"] ?? 0) + 1; return; }
      types.forEach((t) => { map[t] = (map[t] ?? 0) + 1; });
    });
    return Object.entries(map)
      .map(([key, count]) => ({ key, label: TIPO_OBRA_MAP[key] ?? key, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [crsItems]);

  const maxTipoObra = useMemo(() => Math.max(1, ...tipoObraStats.map((t) => t.count)), [tipoObraStats]);

  // ── Extensão por tipo de obra ─────────────────────────────────────────────────
  // A fonte oficial é dashboard.stats, que consolida techDataByType e dados legados.
  const extensaoByTipo = useMemo(() => {
    const map = (stats?.extensaoByTipo ?? {}) as Record<string, number>;
    const entries = Object.entries(map)
      .map(([key, km]) => ({ key, label: TIPO_OBRA_MAP[key] ?? key, km: Number(km) }))
      .filter((entry) => Number.isFinite(entry.km) && entry.km > 0)
      .sort((a, b) => b.km - a.km);
    return { entries, totalKm: Number(stats?.totalExtensaoKm ?? 0) };
  }, [stats]);
  const maxExtensao = useMemo(() => Math.max(1, ...extensaoByTipo.entries.map((e) => e.km)), [extensaoByTipo]);
  const extensaoChartData = useMemo(() => extensaoByTipo.entries.map((entry) => ({
    ...entry,
    color: EXTENSION_COLORS[entry.key] ?? "#94a3b8",
    percent: extensaoByTipo.totalKm > 0 ? (entry.km / extensaoByTipo.totalKm) * 100 : 0,
  })), [extensaoByTipo]);

  // ── Donut data ────────────────────────────────────────────────────────────────
  const donutData = useMemo(() => {
    if (!stats) return [];
    const total = stats.totalTasks || 1;
    return [
      { name: "Concluídas", value: stats.completedTasks, color: "#22c55e", pct: Math.round((stats.completedTasks / total) * 100) },
      { name: "Em Andamento", value: stats.inProgressTasks, color: "#3b82f6", pct: Math.round((stats.inProgressTasks / total) * 100) },
      { name: "Pendentes", value: stats.pendingTasks, color: "#f59e0b", pct: Math.round((stats.pendingTasks / total) * 100) },
    ].filter((d) => d.value > 0);
  }, [stats]);

  // ── KPI derived ───────────────────────────────────────────────────────────────
  const thisMonthCrs = useMemo(() => {
    const now = new Date();
    return crsItems.filter((c: any) => {
      if (!c.createdAt) return false;
      const d = new Date(c.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
  }, [crsItems]);

  const isLoading = statsQ.isLoading;

  // ── Export Dashboard PDF ─────────────────────────────────────────────────────
  const mapExportRef = useRef<HTMLDivElement | null>(null);

  const exportDashboardPDF = useCallback(async () => {
    setIsExporting(true);
    const printWindow = resolvePrintWindow(() => window.open("", "_blank"));
    if (!printWindow) {
      setIsExporting(false);
      return;
    }
    let mapDataUrl = "";
    try {
      if (mapExportRef.current) {
        const controls = mapExportRef.current.querySelectorAll('[data-map-control="true"]');
        controls.forEach((el: Element) => { (el as HTMLElement).style.display = "none"; });
        try {
          const canvas = await html2canvas(mapExportRef.current, { scale: 1.5, useCORS: true, logging: false });
          mapDataUrl = canvas.toDataURL("image/png");
        } finally {
          controls.forEach((el: Element) => { (el as HTMLElement).style.display = ""; });
        }
      }
    } catch {
      // Falha na captura do mapa não bloqueia o relatório
    }
    try {
      const sla = slaQ.data;
      const upcoming = upcomingQ.data;
      const stateRows = stateData;
      const stateMapHeight = Math.max(220, Math.ceil(Math.max(stateRows.length, 1) / 5) * 58 + 34);
      const stateMarkersHtml = stateRows.map((state: any, index: number) => {
        const column = index % 5;
        const row = Math.floor(index / 5);
        const left = 8 + column * 21;
        const top = 16 + row * 58;
        return `<div class="state-marker" style="left:${left}%;top:${top}px" title="${escapeInfoWindowHtml(state.state ?? "Estado não informado")}"><span>${escapeInfoWindowHtml(state.state ?? "—")}</span><strong>${Number(state.count ?? 0)}</strong></div>`;
      }).join("");
      const contractDetailRows = contractDetails.slice(0, 50).map((contract: any) => {
        const types = parseTipoObra(contract.tipoObra).map((type) => TIPO_OBRA_MAP[type] ?? type).join(", ") || "Outro";
        const extension = contract.extensaoKm == null ? "—" : `${Number(contract.extensaoKm).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km`;
        const perimeter = contract.perimetroUrbano == null ? "—" : `${Number(contract.perimetroUrbano).toLocaleString("pt-BR")} Un`;
        const disciplineRows = (contract.disciplineSummary ?? []).map((discipline: any) => `<div class="discipline-row"><strong>${escapeInfoWindowHtml(discipline.discipline)}</strong><span>${Number(discipline.taskCount ?? 0)} tarefa(s) · checklist ${Number(discipline.completedChecklistCount ?? 0)}/${Number(discipline.checklistCount ?? 0)}</span></div>`).join("") || '<div class="discipline-row muted">Sem tarefas ou checklist por disciplina.</div>';
        return `<tr><td><strong>${escapeInfoWindowHtml(contract.name ?? "Contrato sem nome")}</strong>${contract.code ? `<div class="muted">${escapeInfoWindowHtml(contract.code)}</div>` : ""}</td><td>${escapeInfoWindowHtml(contract.clientName ?? "—")}</td><td>${escapeInfoWindowHtml(contract.state ?? "—")}</td><td>${escapeInfoWindowHtml(types)}<div class="muted">Extensão: ${extension} · Perímetro: ${perimeter}</div></td><td>${Number(contract.completedTaskCount ?? 0)}/${Number(contract.taskCount ?? 0)}<div class="muted">Checklist: ${Number(contract.completedChecklistCount ?? 0)}/${Number(contract.checklistCount ?? 0)}</div></td><td><div class="discipline-list">${disciplineRows}</div></td></tr>`;
      }).join("");
      const completedRows = completedTasks.slice(0, 100);
      const completedByAssignee = aggregateCompletedTasksByAssignee(completedTasks);
      const completedContracts = new Set(completedTasks.map((task: any) => task.crsName).filter(Boolean)).size;
      const completedOnTime = completedTasks.filter((task: any) => task.completedAt && (!task.dueDate || new Date(task.completedAt) <= new Date(task.dueDate))).length;
      const assigneeChartColors = ["#2563eb", "#16a34a", "#f59e0b", "#9333ea", "#0891b2", "#e11d48", "#64748b"];
      const periodLabel = trendComparisonPeriod === "month" ? "Mês Atual" : trendComparisonPeriod === "quarter" ? "Trimestre Atual" : "Ano Atual";
      const now = new Date();
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
	<title>Dashboard Orbita</title>
	<style>
	  * { box-sizing: border-box; margin: 0; padding: 0; }
	  body { font-family: Arial, sans-serif; background: #f7f8fa; color: #111827; }
	  .header { background: ${REPORT_PALETTE.navy}; border-bottom: 4px solid ${REPORT_PALETTE.yellow}; color: white; padding: 28px 36px; display: flex; align-items: center; justify-content: space-between; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
	  .header h1 { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
	  .header p { font-size: 12px; opacity: 0.7; margin-top: 4px; }
	  .body { padding: 28px 36px; }
	  .section-title { font-size: 14px; font-weight: 700; color: ${REPORT_PALETTE.navy}; border-left: 4px solid ${REPORT_PALETTE.yellow}; padding-left: 10px; margin: 24px 0 12px; }
	  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
	  .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 16px; }
	  .card { background: white; border-radius: 10px; border: 1px solid #dbe3ea; padding: 16px; box-shadow: 0 2px 8px rgba(15,23,42,0.06); }
	  .card-title { font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
	  .card-value { font-size: 28px; font-weight: 800; color: ${REPORT_PALETTE.navy}; }
	  .card-sub { font-size: 11px; color: #94a3b8; margin-top: 4px; }
	  .sla-bar-bg { background: #dbe3ea; border-radius: 6px; height: 8px; margin: 8px 0; }
	  .sla-bar { height: 8px; border-radius: 6px; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
	  .green { color: #16a34a; } .yellow { color: #d97706; } .red { color: #dc2626; }
	  .bg-green { background: #22c55e; } .bg-yellow { background: ${REPORT_PALETTE.yellow}; } .bg-red { background: #ef4444; } .bg-gray { background: #94a3b8; }
	  table { width: 100%; border-collapse: collapse; font-size: 12px; }
	  th { background: ${REPORT_PALETTE.navy}; color: white; padding: 8px 12px; text-align: left; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
	  td { padding: 7px 12px; border-bottom: 1px solid #eef2f7; }
	  tr:nth-child(even) td { background: #f7f8fa; }
	  .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; }
	  .assignee-chart { background: white; border-radius: 10px; border: 1px solid #dbe3ea; padding: 16px; display: grid; gap: 8px; }
	  .assignee-chart-row { display: grid; grid-template-columns: 140px 1fr 90px; gap: 12px; align-items: center; font-size: 12px; }
	  .assignee-chart-label { color: #334155; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	  .assignee-chart-track { background: #dbe3ea; border-radius: 999px; height: 12px; overflow: hidden; }
	  .assignee-chart-fill { height: 100%; border-radius: 999px; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
	  .assignee-chart-value { color: #475569; font-size: 11px; text-align: right; white-space: nowrap; }
	  .state-map { position: relative; min-height: 220px; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 55%, #bfdbfe 100%); border: 1px solid #bfdbfe; border-radius: 12px; overflow: hidden; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
	  .state-map::before { content: ""; position: absolute; inset: 16px; border: 1px dashed rgba(37,99,235,.25); border-radius: 40% 55% 45% 60%; transform: rotate(-4deg); }
	  .state-marker { position: absolute; z-index: 1; transform: translate(-50%, 0); min-width: 46px; padding: 5px 7px; border-radius: 999px; background: #2563eb; color: white; text-align: center; box-shadow: 0 4px 10px rgba(30,64,175,.28); print-color-adjust: exact; -webkit-print-color-adjust: exact; }
	  .state-marker span { display: block; font-size: 8px; font-weight: 700; letter-spacing: .3px; opacity: .88; }
	  .state-marker strong { display: block; font-size: 16px; line-height: 17px; }
	  .map-legend { font-size: 10px; color: #475569; margin-top: 8px; }
	  .muted { color: #64748b; font-size: 10px; margin-top: 3px; }
	  .discipline-list { display: grid; gap: 4px; min-width: 170px; }
	  .discipline-row { display: flex; justify-content: space-between; gap: 8px; font-size: 10px; line-height: 1.25; }
	  .discipline-row span { color: #475569; text-align: right; }
	  .footer { background: ${REPORT_PALETTE.navy}; border-top: 4px solid ${REPORT_PALETTE.yellow}; color: white; padding: 14px 36px; display: flex; justify-content: space-between; align-items: center; font-size: 11px; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
	  .brand-logo { width: 44px; height: 44px; object-fit: contain; background: rgba(255,255,255,0.92); border-radius: 8px; padding: 3px; }
	  @media print { body { background: white; } .header, .footer, th { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
	</style></head><body>
<div class="header">
  <div style="display:flex;align-items:center;gap:12px;"><img class="brand-logo" src="${ORBITA_LOGO_URL}" alt="Logo Órbita" /><div><h1>Órbita GIS &amp; OS</h1><p>Relatório do Dashboard — ${now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p></div></div>
  <div style="text-align:right"><p style="font-size:13px;font-weight:700">Visão Geral</p><p>Gerado em ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p></div>
</div>
<div class="body">
  <div class="section-title">Indicadores Gerais</div>
  <div class="grid3">
    <div class="card"><div class="card-title">Contratos Ativos</div><div class="card-value">${stats?.totalCrs ?? 0}</div></div>
    <div class="card"><div class="card-title">Tarefas em Atraso</div><div class="card-value" style="color:#dc2626">${stats?.overdueTasks ?? 0}</div></div>
    <div class="card"><div class="card-title">Checklist Concluído</div><div class="card-value">${stats?.checklistProgress ?? 0}%</div></div>
  </div>
  <div class="section-title">SLA / Pontualidade — ${periodLabel}</div>
  <div class="card">
    <div class="grid2">
      <div>
        <div class="card-title">Taxa de Pontualidade</div>
        <div class="card-value ${sla?.slaThis !== null && sla?.slaThis !== undefined ? (sla.slaThis >= 80 ? 'green' : sla.slaThis >= 60 ? 'yellow' : 'red') : ''}">${sla?.slaThis !== null && sla?.slaThis !== undefined ? sla.slaThis + '%' : '—'}</div>
        <div class="sla-bar-bg"><div class="sla-bar ${sla?.slaThis !== null && sla?.slaThis !== undefined ? (sla.slaThis >= 80 ? 'bg-green' : sla.slaThis >= 60 ? 'bg-yellow' : 'bg-red') : 'bg-gray'}" style="width:${sla?.slaThis ?? 0}%"></div></div>
        <div class="card-sub">Período anterior: ${sla?.slaLast !== null && sla?.slaLast !== undefined ? sla.slaLast + '%' : '—'} | Tendência: ${sla?.trend !== null && sla?.trend !== undefined ? (sla.trend >= 0 ? '+' : '') + sla.trend + 'pp' : '—'}</div>
      </div>
      <div>
        <div class="grid2">
          <div class="card" style="border:none;padding:8px"><div class="card-title">No Prazo</div><div style="font-size:22px;font-weight:800;color:#16a34a">${sla?.onTimeThis ?? 0}</div></div>
          <div class="card" style="border:none;padding:8px"><div class="card-title">Total Concluídas</div><div style="font-size:22px;font-weight:800">${sla?.totalThis ?? 0}</div></div>
        </div>
      </div>
    </div>
  </div>
  <div class="section-title">Visão Geográfica — Contratos por Estado</div>
  <div class="grid2">
    <div class="card">
      <div class="card-title">Mapa esquemático de contratos</div>
      <div class="state-map" style="min-height:${stateMapHeight}px">${stateMarkersHtml || '<div style="padding:80px 20px;text-align:center;color:#64748b;font-size:12px;">Nenhum contrato por estado para exibir.</div>'}</div>
      <div class="map-legend">As bolhas azuis representam a quantidade de contratos ativos em cada estado filtrado.</div>
    </div>
    <div class="card">
      <div class="card-title">Captura do mapa atual</div>
      ${mapDataUrl ? `<img src="${mapDataUrl}" style="width:100%;height:auto;max-height:300px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0;" alt="Mapa atual do Dashboard" />` : '<div style="padding:80px 20px;text-align:center;color:#64748b;font-size:12px;">A captura do mapa não ficou disponível nesta exportação.</div>'}
    </div>
  </div>
  <table><thead><tr><th>Estado</th><th>Contratos</th><th>Progresso Médio</th><th>Status</th></tr></thead><tbody>
    ${stateRows.map((s: any) => `<tr><td>${s.state}</td><td>${s.count}</td><td>${s.avgProgress ?? 0}%</td><td><span class="badge" style="background:${(s.avgProgress ?? 0) >= 80 ? '#dcfce7;color:#16a34a' : (s.avgProgress ?? 0) >= 50 ? '#fef9c3;color:#d97706' : '#fee2e2;color:#dc2626'}">${(s.avgProgress ?? 0) >= 80 ? 'Em Dia' : (s.avgProgress ?? 0) >= 50 ? 'Atenção' : 'Crítico'}</span></td></tr>`).join('')}
  </tbody></table>
  <div class="section-title">Detalhamento Técnico por Contrato e Disciplina</div>
  <table><thead><tr><th>Contrato</th><th>Cliente</th><th>Estado</th><th>Tipo de obra e medidas</th><th>Tarefas / checklist</th><th>Disciplinas</th></tr></thead><tbody>
    ${contractDetailRows || '<tr><td colspan="6" style="color:#64748b;text-align:center;">Nenhum detalhe de contrato disponível para os filtros atuais.</td></tr>'}
  </tbody></table>
  <div class="section-title">Tarefas Concluídas no Kanban</div>
  <div class="grid3">
    <div class="card"><div class="card-title">Cards concluídos</div><div class="card-value" style="color:#16a34a">${completedTasks.length}</div><div class="card-sub">Progresso de 100% ou fase terminal</div></div>
    <div class="card"><div class="card-title">Contratos envolvidos</div><div class="card-value">${completedContracts}</div></div>
    <div class="card"><div class="card-title">Concluídas no prazo</div><div class="card-value" style="color:#16a34a">${completedOnTime}</div></div>
  </div>
  <div class="section-title">Proporção de Concluídas por Responsável</div>
  <div class="card assignee-chart">
    ${completedByAssignee.length > 0 ? completedByAssignee.map((row, index) => `<div class="assignee-chart-row"><div class="assignee-chart-label" title="${row.assigneeName}">${row.assigneeName}</div><div class="assignee-chart-track"><div class="assignee-chart-fill" style="width:${row.percentage}%;background:${assigneeChartColors[index % assigneeChartColors.length]}"></div></div><div class="assignee-chart-value">${row.count} (${row.percentage.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%)</div></div>`).join('') : '<p style="color:#94a3b8;font-size:12px">Nenhuma tarefa concluída encontrada para distribuir por responsável.</p>'}
  </div>
  ${completedRows.length > 0 ? `<table><thead><tr><th>Tarefa</th><th>Contrato</th><th>Responsável</th><th>Fase</th><th>Conclusão</th></tr></thead><tbody>${completedRows.map((t: any) => `<tr><td>${t.title}</td><td>${t.crsName ?? '—'}</td><td>${t.assigneeName ?? 'Não atribuído'}</td><td>${t.phaseName ?? 'Concluído'}</td><td>${t.completedAt ? new Date(t.completedAt).toLocaleDateString('pt-BR') : '—'}</td></tr>`).join('')}</tbody></table>` : '<p style="color:#94a3b8;font-size:12px">Nenhuma tarefa concluída encontrada no Kanban.</p>'}
  <div class="section-title">Vencimentos Próximos</div>
  <div class="grid3">
    <div class="card"><div class="card-title">Próximos 7 dias</div><div class="card-value" style="color:#dc2626">${upcoming?.counts?.next7 ?? 0}</div></div>
    <div class="card"><div class="card-title">Próximos 15 dias</div><div class="card-value" style="color:#d97706">${upcoming?.counts?.next15 ?? 0}</div></div>
    <div class="card"><div class="card-title">Próximos 30 dias</div><div class="card-value" style="color:#f59e0b">${upcoming?.counts?.next30 ?? 0}</div></div>
  </div>
  ${(upcoming?.tasks ?? []).length > 0 ? `<table><thead><tr><th>Tarefa</th><th>Contrato</th><th>Fase</th><th>Vencimento</th><th>Prioridade</th></tr></thead><tbody>${(upcoming?.tasks as any[] ?? []).map((t: any) => `<tr><td>${t.title}</td><td>${t.crsName ?? '—'}</td><td>${t.phaseName ?? '—'}</td><td>${t.dueDate ? new Date(t.dueDate).toLocaleDateString('pt-BR') : '—'}</td><td>${t.priority ?? '—'}</td></tr>`).join('')}</tbody></table>` : '<p style="color:#94a3b8;font-size:12px">Nenhuma tarefa com vencimento próximo.</p>'}
</div>
<div class="footer"><span style="display:flex;align-items:center;gap:8px;"><img class="brand-logo" src="${ORBITA_LOGO_URL}" alt="Logo Órbita" /> Órbita GIS &amp; OS — Sistema de Gestão de Contratos</span><span>Página 1 de 1 — ${now.toLocaleDateString('pt-BR')}</span></div>
</body></html>`;
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        if (!printWindow.closed) printWindow.print();
      }, 800);
    } catch {
      if (!printWindow.closed) {
        printWindow.document.body.innerHTML = '<main style="font-family:Arial,sans-serif;padding:32px;color:#0f172a"><h1>Não foi possível gerar o relatório</h1><p>Feche esta janela e tente novamente.</p></main>';
      }
    } finally {
      setIsExporting(false);
    }
  }, [slaQ.data, upcomingQ.data, stateData, stats, trendComparisonPeriod, completedTasks, contractDetails]);

  const exportChatActivityPDF = useCallback(() => {
    const printWindow = resolvePrintWindow(() => window.open("", "_blank"));
    if (!printWindow) {
      toast.error("Pop-up bloqueado. Permita pop-ups para exportar o relatório de atividade.");
      return;
    }
    const now = new Date();
    const disciplines = (chatActivity?.disciplines ?? []) as any[];
    const totals = chatActivity?.totals ?? { memberCount: 0, onlineCount: 0, typingCount: 0, messagesLast24h: 0, messagesLast7d: 0, unreadCount: 0 };
    const disciplineRowsHtml = disciplines.length > 0 ? disciplines.map((d) => `<tr>
      <td><strong>${escapeInfoWindowHtml(d.discipline)}</strong></td>
      <td style="text-align:center">${Number(d.memberCount ?? 0)}</td>
      <td style="text-align:center;color:#16a34a;font-weight:600">${Number(d.onlineCount ?? 0)}</td>
      <td style="text-align:center;color:#7c3aed">${Number(d.typingCount ?? 0)}</td>
      <td style="text-align:center">${Number(d.messagesLast24h ?? 0)}</td>
      <td style="text-align:center">${Number(d.messagesLast7d ?? 0)}</td>
      <td style="text-align:center"><span class="badge ${Number(d.unreadCount ?? 0) > 0 ? 'unread' : ''}">${Number(d.unreadCount ?? 0)}</span></td>
    end`).join("") : '<tr><td colspan="7" style="color:#64748b;text-align:center;">Nenhuma disciplina com atividade de chat registrada.</td></tr>';

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Relatório de Atividade do Chat — Orbita</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; background: #f7f8fa; color: #111827; }
  .header { background: ${REPORT_PALETTE.navy}; border-bottom: 4px solid ${REPORT_PALETTE.yellow}; color: white; padding: 28px 36px; display: flex; align-items: center; justify-content: space-between; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  .header h1 { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
  .header p { font-size: 12px; opacity: 0.7; margin-top: 4px; }
  .body { padding: 28px 36px; }
  .section-title { font-size: 14px; font-weight: 700; color: ${REPORT_PALETTE.navy}; border-left: 4px solid ${REPORT_PALETTE.yellow}; padding-left: 10px; margin: 24px 0 12px; }
  .grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 16px; }
  .card { background: white; border-radius: 10px; border: 1px solid #dbe3ea; padding: 16px; box-shadow: 0 2px 8px rgba(15,23,42,0.06); }
  .card-title { font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
  .card-value { font-size: 28px; font-weight: 800; color: ${REPORT_PALETTE.navy}; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
  th { background: ${REPORT_PALETTE.navy}; color: white; padding: 8px 12px; text-align: left; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  td { padding: 8px 12px; border-bottom: 1px solid #eef2f7; }
  tr:nth-child(even) td { background: #f7f8fa; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 700; background: #e2e8f0; color: #475569; }
  .badge.unread { background: #fee2e2; color: #dc2626; }
  .footer { background: ${REPORT_PALETTE.navy}; border-top: 4px solid ${REPORT_PALETTE.yellow}; color: white; padding: 14px 36px; display: flex; justify-content: space-between; align-items: center; font-size: 11px; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  .brand-logo { width: 44px; height: 44px; object-fit: contain; background: rgba(255,255,255,0.92); border-radius: 8px; padding: 3px; }
  @media print { body { background: white; } .header, .footer, th { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
</style></head><body>
<div class="header">
  <div style="display:flex;align-items:center;gap:12px;"><img class="brand-logo" src="${ORBITA_LOGO_URL}" alt="Logo Órbita" /><div><h1>Órbita GIS &amp; OS</h1><p>Relatório de Atividade do Chat e Presença — ${now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p></div></div>
  <div style="text-align:right"><p style="font-size:13px;font-weight:700">Equipes &amp; Comunicação</p><p>Gerado em ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p></div>
</div>
<div class="body">
  <div class="section-title">Métricas Gerais de Atividade</div>
  <div class="grid3">
    <div class="card"><div class="card-title">Usuários Online</div><div class="card-value" style="color:#16a34a">${totals.onlineCount ?? 0}</div></div>
    <div class="card"><div class="card-title">Mensagens em 24h</div><div class="card-value" style="color:#2563eb">${totals.messagesLast24h ?? 0}</div></div>
    <div class="card"><div class="card-title">Usuários Digitando</div><div class="card-value" style="color:#7c3aed">${totals.typingCount ?? 0}</div></div>
  </div>
  <div class="grid3">
    <div class="card"><div class="card-title">Mensagens Não Lidas</div><div class="card-value" style="color:#dc2626">${totals.unreadCount ?? 0}</div></div>
    <div class="card"><div class="card-title">Total de Membros</div><div class="card-value">${totals.memberCount ?? 0}</div></div>
    <div class="card"><div class="card-title">Mensagens nos Últimos 7 Dias</div><div class="card-value">${totals.messagesLast7d ?? 0}</div></div>
  </div>
  <div class="section-title">Detalhamento por Disciplina</div>
  <table>
    <thead>
      <tr>
        <th>Disciplina</th>
        <th style="text-align:center">Membros</th>
        <th style="text-align:center">Online</th>
        <th style="text-align:center">Digitando</th>
        <th style="text-align:center">Msgs 24h</th>
        <th style="text-align:center">Msgs 7d</th>
        <th style="text-align:center">Não Lidas</th>
      </tr>
    </thead>
    <tbody>
      ${disciplineRowsHtml.replace(/end<\/tr>/g, '</tr>')}
    </tbody>
  </table>
</div>
<div class="footer"><span style="display:flex;align-items:center;gap:8px;"><img class="brand-logo" src="${ORBITA_LOGO_URL}" alt="Logo Órbita" /> Órbita GIS &amp; OS — Sistema de Gestão de Contratos</span><span>Página 1 de 1 — ${now.toLocaleDateString('pt-BR')}</span></div>
</body></html>`;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      if (!printWindow.closed) printWindow.print();
    }, 800);
  }, [chatActivity]);

  const widgetFrameProps = (group: DashboardWidgetGroup, id: DashboardWidgetId, label: string, className = "") => ({
    group,
    id,
    label,
    order: widgetOrders[group],
    draggedWidget,
    dragOverWidget,
    onDragStart: handleWidgetDragStart,
    onDragOver: handleWidgetDragOver,
    onDrop: handleWidgetDrop,
    onDragEnd: clearWidgetDrag,
    onKeyDown: handleWidgetKeyDown,
    className,
  });

  return (
    <AppLayout title="Dashboard">
      <div className="dashboard-page p-6 space-y-6 bg-background min-h-full">
        {isExporting && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/35 backdrop-blur-[2px]" role="status" aria-live="polite" aria-label="Gerando relatório PDF">
            <div className="flex min-w-[240px] flex-col items-center gap-3 rounded-2xl bg-white px-8 py-7 text-center shadow-2xl ring-1 ring-slate-200">
              <span className="h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-slate-800">Gerando relatório PDF</p>
                <p className="mt-1 text-xs text-slate-500">Capturando o mapa e consolidando as tarefas concluídas...</p>
              </div>
            </div>
          </div>
        )}
        {/* ── Header ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900" style={{ color: '#000000' }}>Visão Geral</h1>
            {normalizedCompany && (
              <span className="hidden rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 sm:inline-flex" title="Os KPIs, mapa e contratos estão filtrados por empresa">
                {normalizedCompany}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 shadow-sm" htmlFor="dashboard-company-filter">
              <Filter className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
              <span>Empresa</span>
              <select
                id="dashboard-company-filter"
                value={selectedCompany}
                onChange={(event) => setSelectedCompany(event.target.value)}
                className="max-w-[180px] bg-transparent text-xs font-semibold text-gray-800 outline-none"
                aria-label="Filtrar Dashboard por empresa"
              >
                <option value="">Todas</option>
                {companies.map((company) => <option key={company} value={company}>{company}</option>)}
              </select>
            </label>
            <Popover open={clientFilterOpen} onOpenChange={setClientFilterOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex min-w-[180px] items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 shadow-sm transition-colors hover:border-blue-300"
                  aria-label="Filtrar Dashboard por cliente"
                  aria-expanded={clientFilterOpen}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Filter className="h-3.5 w-3.5 shrink-0 text-blue-600" aria-hidden="true" />
                    <span>Cliente</span>
                    <span className="max-w-[110px] truncate font-semibold text-gray-800">{selectedClient?.name ?? "Todos"}</span>
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-500" aria-hidden="true" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[280px] p-0">
                <Command>
                  <CommandInput placeholder="Buscar cliente..." aria-label="Buscar cliente" />
                  <CommandList>
                    <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                    <CommandGroup heading="Clientes">
                      <CommandItem value="todos os clientes" onSelect={() => { setSelectedClientId(undefined); setClientFilterOpen(false); }}>
                        <CheckCircle2 className={`h-4 w-4 ${selectedClientId === undefined ? "text-blue-600" : "text-transparent"}`} aria-hidden="true" />
                        <span>Todos os clientes</span>
                      </CommandItem>
                      {clients.map((client: any) => (
                        <CommandItem
                          key={client.id}
                          value={`${client.name} ${client.crsCode ?? ""}`}
                          onSelect={() => { setSelectedClientId(client.id); setClientFilterOpen(false); }}
                        >
                          <CheckCircle2 className={`h-4 w-4 ${selectedClientId === client.id ? "text-blue-600" : "text-transparent"}`} aria-hidden="true" />
                          <span className="truncate">{client.name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <button
              onClick={exportDashboardPDF}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-950 bg-[#ffbe00] hover:bg-[#eab000] disabled:opacity-60 rounded-lg shadow-sm transition-all"
            >
              <FileDown className="w-4 h-4" />
              {isExporting ? "Exportando..." : "Exportar PDF"}
            </button>
            <button
              type="button"
              onClick={resetWidgetOrders}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffc30d]"
              title="Restaurar a ordem padrão dos widgets"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              <span className="hidden xl:inline">Restaurar widgets</span>
              <span className="sr-only xl:hidden">Restaurar ordem dos widgets</span>
            </button>
            <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
              <button
                onClick={() => setView("geral")}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  view === "geral" ? "bg-blue-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Geral
              </button>
              <button
                onClick={() => setView("detalhada")}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  view === "detalhada" ? "bg-blue-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Detalhada
              </button>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            VISÃO GERAL
        ══════════════════════════════════════════════════════════════════════ */}
        {view === "geral" && (
          <div className="grid grid-cols-12 gap-5">
            {/* ── Coluna esquerda: Mapa + Stats + Vencimentos ── */}
            <div className="col-span-12 lg:col-span-6 flex flex-col gap-4">
              {/* Mapa */}
              <DashboardWidgetFrame {...widgetFrameProps("generalLeft", "map", "Mapa de contratos", "shrink-0")}>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  {contractsByStateQ.isLoading ? (
                    <Skeleton className="h-64 w-full rounded-lg" />
                  ) : (
                    <ContractsMap
                      locations={stateData.map((s: any) => ({ name: s.state ?? s.code, state: s.state ?? s.code, country: "Brasil", count: s.count, avgProgress: s.avgProgress ?? 0, contracts: s.contracts ?? [] }))}
                      segments={(segmentsQ.data ?? []) as SegmentOverlay[]}
                      segmentsLoading={segmentsQ.isLoading}
                      onNavigate={navigate}
                      mapExportRef={mapExportRef}
                    />
                  )}
                </div>
              </DashboardWidgetFrame>

              {/* Stat rows */}
              <DashboardWidgetFrame {...widgetFrameProps("generalLeft", "stats", "Resumo de indicadores", "shrink-0")}>
                <div className="space-y-2">
                  {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)
                ) : (
                  <>
                    <StatRow
                      icon={<FolderOpen className="w-4 h-4" />}
                      label="Contratos Ativos"
                      value={stats?.totalCrs ?? 0}
                    />
                    <StatRow
                      icon={<AlertTriangle className="w-4 h-4" />}
                      label="Tarefas em Atraso"
                      value={stats?.overdueTasks ?? 0}
                      valueColor="text-red-500"
                    />
                    <StatRow
                      icon={<CheckCircle2 className="w-4 h-4" />}
                      label="Checklist Concluído"
                      value={`${stats?.checklistProgress ?? 0}%`}
                      valueColor="text-green-600"
                    />
                    {/* Extensão Total + por tipo */}
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                            <Layers className="w-4 h-4" />
                          </div>
                          <span className="text-sm font-medium text-gray-700">Extensão Total</span>
                        </div>
                        <span className="text-base font-bold text-gray-900">{extensaoByTipo.totalKm.toLocaleString("pt-BR")} km</span>
                      </div>
                      {extensaoByTipo.entries.length > 0 && (
                        <div className="space-y-1.5 mt-2 pt-2 border-t border-gray-50">
                          {extensaoByTipo.entries.map((e) => (
                            <div key={e.key} className="flex items-center gap-2">
                              <span className="text-xs text-gray-500 w-28 truncate shrink-0">{e.label}</span>
                              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-blue-400 transition-all"
                                  style={{ width: `${(e.km / maxExtensao) * 100}%` }}
                                />
                              </div>
                              <span className="text-xs font-semibold text-gray-600 w-16 text-right shrink-0">{e.km.toLocaleString("pt-BR")} km</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                  )}
                </div>
              </DashboardWidgetFrame>
              {/* ── Linha do Tempo de Vencimentos ──────────────────────────────── */}
              <DashboardWidgetFrame {...widgetFrameProps("generalLeft", "deadlines", "Vencimentos próximos", "shrink-0")}>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                    <CalendarClock className="w-4 h-4 text-orange-500" /> Vencimentos Próximos
                  </h3>
                </div>
                {upcomingQ.isLoading ? (
                  <Skeleton className="h-24 w-full" />
                ) : (() => {
                  const up = upcomingQ.data;
                  const counts = up?.counts ?? { next7: 0, next15: 0, next30: 0 };
                  const tasks = (up?.tasks ?? []) as any[];
                  const bars = [
                    { label: "7 dias", value: counts.next7, color: "bg-red-500" },
                    { label: "15 dias", value: counts.next15, color: "bg-orange-400" },
                    { label: "30 dias", value: counts.next30, color: "bg-yellow-400" },
                  ];
                  const maxVal = Math.max(...bars.map(b => b.value), 1);
                  return (
                    <div className="space-y-3">
                      <div className="flex gap-3">
                        {bars.map(b => (
                          <div key={b.label} className="flex-1 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <div className="w-full bg-gray-100 rounded h-16 flex flex-col-reverse overflow-hidden">
                                <div
                                  className={`${b.color} transition-all`}
                                  style={{ height: `${Math.round((b.value / maxVal) * 100)}%`, minHeight: b.value > 0 ? "4px" : "0" }}
                                />
                              </div>
                              <span className="text-lg font-bold text-gray-800">{b.value}</span>
                              <span className="text-xs text-gray-400">{b.label}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-1 max-h-36 overflow-y-auto">
                        {tasks.length === 0 ? (
                          <p className="text-xs text-gray-400 text-center py-2">Nenhuma tarefa com prazo próximo</p>
                        ) : tasks.map((t: any) => (
                          <div key={t.id} className="flex items-center gap-2 py-1 border-b border-gray-50 last:border-0">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.phaseColor ?? "#94a3b8" }} />
                            <span className="text-xs text-gray-700 flex-1 truncate">{t.title}</span>
                            <span className="text-xs text-gray-400 shrink-0">{new Date(t.dueDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                  })()}
                </div>
              </DashboardWidgetFrame>
            </div>

            {/* ── Coluna direita: KPIs + Burndown + Contratos por Estado ── */}
            <div className="col-span-12 lg:col-span-6 flex flex-col gap-4">
              {/* KPI cards */}
              <DashboardWidgetFrame {...widgetFrameProps("generalRight", "primary-kpis", "Indicadores principais", "shrink-0")}>
                <div className="grid grid-cols-3 gap-3">
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
                ) : (
                  <>
                    <KpiCard
                      label="Contratos este mês"
                      value={`+${thisMonthCrs}`}
                      icon={<TrendingUp className="w-5 h-5 text-blue-600" />}
                      iconBg="bg-blue-50"
                    />
                    <KpiCard
                      label="Em risco"
                      value={stats?.overdueTasks ?? 0}
                      icon={<AlertTriangle className="w-5 h-5 text-amber-500" />}
                      iconBg="bg-amber-50"
                    />
                    <KpiCard
                      label="Concluídos"
                      value={stats?.completedTasks ?? 0}
                      icon={<CheckCircle2 className="w-5 h-5 text-green-600" />}
                      iconBg="bg-green-50"
                    />
                  </>
                )}
                </div>
              </DashboardWidgetFrame>

              {/* KPI cards para extensao, area e perimetro urbano */}
              <DashboardWidgetFrame {...widgetFrameProps("generalRight", "secondary-kpis", "Indicadores de extensão", "shrink-0")}>
                <div className="grid grid-cols-3 gap-3">
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
                ) : (
                  <>
                    <KpiCard
                      label="Extensao Total"
                      value={`${(stats?.totalExtensaoKm ?? 0).toLocaleString("pt-BR")} km`}
                      icon={<Layers className="w-5 h-5 text-blue-600" />}
                      iconBg="bg-blue-50"
                    />
                    <KpiCard
                      label="Area Total"
                      value={`${(stats?.totalAreaHa ?? 0).toLocaleString("pt-BR")} ha`}
                      icon={<MapPin className="w-5 h-5 text-green-600" />}
                      iconBg="bg-green-50"
                    />
                    <KpiCard
                      label="Perimetro Urbano"
                      value={`${(stats?.totalPerimetroUrbano ?? 0).toLocaleString("pt-BR")} Un.`}
                      icon={<Route className="w-5 h-5 text-orange-600" />}
                      iconBg="bg-orange-50"
                    />
                  </>
                )}
                </div>
              </DashboardWidgetFrame>

              {/* Distribuição visual da extensão por tipo de obra */}
              <DashboardWidgetFrame {...widgetFrameProps("generalRight", "distribution", "Distribuição da extensão", "shrink-0")}>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-800">Distribuição da Extensão</h3>
                    <p className="text-xs text-gray-400">Quilômetros por tipo de obra</p>
                  </div>
                  <span className="text-sm font-bold text-gray-800">{extensaoByTipo.totalKm.toLocaleString("pt-BR")} km</span>
                </div>
                {statsQ.isLoading ? (
                  <Skeleton className="h-48 w-full" />
                ) : extensaoChartData.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-sm text-gray-400">Sem extensão cadastrada</div>
                ) : (
                  <div className="grid grid-cols-5 gap-3 items-center" role="img" aria-label="Distribuição da extensão em quilômetros por tipo de obra">
                    <div className="col-span-2 h-48 min-w-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={extensaoChartData}
                            dataKey="km"
                            nameKey="label"
                            cx="50%"
                            cy="50%"
                            innerRadius={42}
                            outerRadius={70}
                            paddingAngle={2}
                          >
                            {extensaoChartData.map((entry) => (
                              <Cell key={entry.key} fill={entry.color} />
                            ))}
                          </Pie>
                          <RechartsTooltip
                            contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="col-span-3 space-y-2">
                      {extensaoChartData.map((entry) => (
                        <div key={entry.key} className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                          <span className="text-xs text-gray-600 truncate flex-1">{entry.label}</span>
                          <span className="text-xs font-semibold text-gray-800 whitespace-nowrap">{entry.km.toLocaleString("pt-BR")} km</span>
                          <span className="text-[11px] text-gray-400 w-10 text-right">{Math.round(entry.percent)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                </div>
              </DashboardWidgetFrame>

              {/* Atividade do chat e presença por disciplina */}
              <DashboardWidgetFrame {...widgetFrameProps("generalRight", "chat", "Atividade do chat por disciplina", "shrink-0")}>
                <div className="chat-activity-panel bg-white rounded-xl border border-gray-100 shadow-sm p-4" aria-live="polite">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-start gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center text-teal-700 shrink-0">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-800">Atividade do Chat por Disciplina</h3>
                      <p className="text-xs text-gray-400">Presença atualizada a cada 15 segundos</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {chatActivity?.generatedAt && (
                      <span className="text-[10px] text-gray-400 whitespace-nowrap">
                        Atualizado às {new Date(chatActivity.generatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={exportChatActivityPDF}
                      className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-800 bg-[#ffbe00] hover:bg-[#eab000] rounded-md shadow-xs transition-all"
                      title="Exportar estatísticas do chat em PDF"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                      PDF
                    </button>
                  </div>
                </div>
                {chatActivityQ.isLoading ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2"><Skeleton className="h-16 rounded-lg" /><Skeleton className="h-16 rounded-lg" /><Skeleton className="h-16 rounded-lg" /></div>
                    <Skeleton className="h-12 w-full rounded-lg" />
                    <Skeleton className="h-12 w-full rounded-lg" />
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      <div className="rounded-lg bg-emerald-50 px-3 py-2">
                        <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700"><UserCheck className="w-3.5 h-3.5" /> Online agora</div>
                        <div className="mt-1 text-xl font-bold text-emerald-800">{chatActivity?.totals.onlineCount ?? 0}</div>
                      </div>
                      <div className="rounded-lg bg-blue-50 px-3 py-2">
                        <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-blue-700"><MessageSquare className="w-3.5 h-3.5" /> Mensagens 24h</div>
                        <div className="mt-1 text-xl font-bold text-blue-800">{chatActivity?.totals.messagesLast24h ?? 0}</div>
                      </div>
                      <div className="rounded-lg bg-violet-50 px-3 py-2">
                        <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-violet-700"><Activity className="w-3.5 h-3.5" /> Digitando</div>
                        <div className="mt-1 text-xl font-bold text-violet-800">{chatActivity?.totals.typingCount ?? 0}</div>
                      </div>
                    </div>
                    <div className="mb-4 rounded-lg border border-gray-100 bg-gray-50/60 p-3" role="group" aria-label={`Comparação de ${chatMetricLabel.toLowerCase()} entre disciplinas; rótulos vermelhos indicam mensagens não lidas`}
>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold text-gray-700">Comparativo por disciplina</p>
                          <p className="text-[10px] text-gray-400">Clique em uma barra para abrir o chat da disciplina · <span className="font-semibold text-red-600">●</span> não lidas</p>
                        </div>
                        <label className="flex items-center gap-1.5 text-[10px] font-medium text-gray-500" htmlFor="chat-activity-metric">
                          Métrica
                          <select
                            id="chat-activity-metric"
                            value={chatMetric}
                            onChange={(event) => setChatMetric(event.target.value as ChatActivityMetric)}
                            className="h-7 rounded-md border border-gray-200 bg-white px-2 text-[10px] font-semibold text-gray-700 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                            aria-label="Métrica do gráfico de atividade do chat"
                          >
                            {CHAT_ACTIVITY_METRICS.map((metric) => <option key={metric.key} value={metric.key}>{metric.label}</option>)}
                          </select>
                        </label>
                      </div>
                      {chatActivityChartData.length === 0 ? (
                        <div className="flex h-24 items-center justify-center text-xs text-gray-400">Sem dados para comparar</div>
                      ) : (
                        <ResponsiveContainer width="100%" height={Math.min(220, Math.max(125, chatActivityChartData.length * 31 + 30))}>
                          <BarChart data={chatActivityChartData} layout="vertical" margin={{ top: 2, right: 42, left: 4, bottom: 2 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                            <YAxis
                              type="category"
                              dataKey="discipline"
                              width={94}
                              tick={{ fontSize: 10, fill: "#64748b" }}
                              tickLine={false}
                              axisLine={false}
                              tickFormatter={(value: string) => value.length > 15 ? `${value.slice(0, 14)}…` : value}
                            />
                            <RechartsTooltip
                              cursor={{ fill: "rgba(20, 184, 166, 0.08)" }}
                              contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #dbe3ea" }}
                              formatter={(value: any) => [value, chatMetricLabel]}
                            />
                            <Bar
                              dataKey="value"
                              name={chatMetricLabel}
                              fill="#0f766e"
                              radius={[0, 4, 4, 0]}
                              barSize={14}
                              style={{ cursor: "pointer" }}
                              onClick={(barData: any, index: number) => {
                                const selected = barData?.payload ?? chatActivityChartData[index];
                                if (selected?.discipline) navigate(buildTeamChatDisciplineUrl(selected.discipline));
                              }}
                            >
                              <LabelList
                                key={unreadBadgeAnimationKey}
                                dataKey="unreadCount"
                                position="right"
                                className="chat-unread-badge"
                                formatter={(value: number) => formatUnreadBadgeLabel(value)}
                                style={{ fill: "#dc2626", fontSize: 10, fontWeight: 700 }}
                              />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                      <div className="sr-only">
                        {chatActivityChartData.map((datum) => (
                          <button key={`chat-chart-action-${datum.discipline}`} type="button" onClick={() => navigate(buildTeamChatDisciplineUrl(datum.discipline))}>
                            Abrir chat da disciplina {datum.discipline}; {datum.unreadCount} mensagens não lidas
                          </button>
                        ))}
                      </div>
                    </div>
                    {(chatActivity?.disciplines ?? []).length === 0 ? (
                      <div className="rounded-lg border border-dashed border-gray-200 px-4 py-6 text-center text-xs text-gray-400">
                        Nenhuma disciplina com membros ou atividade de chat disponível.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {(chatActivity?.disciplines ?? []).map((row: any) => {
                          const onlinePercent = row.memberCount > 0 ? Math.round((row.onlineCount / row.memberCount) * 100) : 0;
                          const lastActivity = row.lastActivityAt ? new Date(row.lastActivityAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "Sem atividade recente";
                          return (
                            <div key={row.discipline} className="rounded-lg border border-gray-100 px-3 py-2.5">
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0 flex items-center gap-2">
                                  <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${row.onlineCount > 0 ? "bg-emerald-500" : "bg-gray-300"}`} />
                                  <span className="chat-discipline-name truncate text-xs font-semibold text-gray-700">{row.discipline}</span>
                                </div>
                                <span className="shrink-0 text-[10px] text-gray-400">{row.onlineCount}/{row.memberCount} online</span>
                              </div>
                              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100" aria-label={`${onlinePercent}% da disciplina online`}>
                                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${onlinePercent}%` }} />
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-gray-500">
                                <span>{row.messagesLast24h} mensagens em 24h</span>
                                <span>{row.activeConversationsLast24h} conversa{row.activeConversationsLast24h === 1 ? "" : "s"} ativa{row.activeConversationsLast24h === 1 ? "" : "s"}</span>
                                {row.typingCount > 0 && <span className="font-medium text-violet-600">{row.typingCount} digitando agora</span>}
                                <span className="ml-auto text-gray-400">{lastActivity}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
                </div>
              </DashboardWidgetFrame>

              {/* Burndown + Contratos por Estado lado a lado */}
              <div className="grid grid-cols-2 gap-4">
                {/* Burndown da Sprint Atual */}
                <DashboardWidgetFrame {...widgetFrameProps("generalRight", "burndown", "Burndown da sprint", "min-w-0")}>
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">Burndown da Sprint Atual</h3>
                  {activeSprintQ.isLoading ? (
                    <Skeleton className="h-40 w-full" />
                  ) : !activeSprint ? (
                    <div className="h-40 flex items-center justify-center text-sm text-gray-400">
                      Nenhuma sprint ativa
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={160}>
                      <LineChart data={activeSprint.dataPoints} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <RechartsTooltip
                          contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }}
                          formatter={(v: any, name: string) => [v, name === "ideal" ? "Ideal" : "Real"]}
                        />
                        <Line type="monotone" dataKey="ideal" stroke="#94a3b8" strokeDasharray="5 5" strokeWidth={2} dot={false} name="ideal" />
                        <Line type="monotone" dataKey="real" stroke="#f59e0b" strokeWidth={2} dot={false} name="real" />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                  {activeSprint && (
                    <div className="flex items-center gap-4 mt-1">
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <span className="inline-block w-6 border-t-2 border-dashed border-gray-400" /> ideal
                      </span>
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <span className="inline-block w-6 border-t-2 border-amber-400" /> real
                      </span>
                    </div>
                  )}
                  </div>
                </DashboardWidgetFrame>

                {/* Contratos por Estado */}
                <DashboardWidgetFrame {...widgetFrameProps("generalRight", "contracts-state", "Contratos por estado", "min-w-0")}>
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">Contratos por Estado</h3>
                  {contractsByStateQ.isLoading ? (
                    <Skeleton className="h-40 w-full" />
                  ) : stateData.length === 0 ? (
                    <div className="h-40 flex items-center justify-center text-sm text-gray-400">
                      Nenhum contrato com estado definido
                    </div>
                  ) : (
                    <div className="space-y-0">
                      <div className="grid grid-cols-4 text-xs text-gray-400 font-medium pb-1 border-b border-gray-100">
                        <span>Estado</span>
                        <span className="text-center">Contratos</span>
                        <span className="col-span-1 text-center">Progresso</span>
                        <span className="text-right">Status</span>
                      </div>
                      {stateData.slice(0, 5).map((s: any) => {
                        const st = getStatusLabel(s.avgProgress);
                        return (
                          <div key={s.code} className="grid grid-cols-4 items-center py-2 border-b border-gray-50 text-sm">
                            <span className="font-semibold text-gray-700">{s.code}</span>
                            <span className="text-center text-gray-600">{s.count}</span>
                            <div className="flex items-center gap-1">
                              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: `${s.avgProgress}%`, backgroundColor: st.color }}
                                />
                              </div>
                            </div>
                            <span className="text-right text-xs font-medium" style={{ color: st.color }}>{st.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  </div>
                </DashboardWidgetFrame>
              </div>

              {/* ── Painel SLA / Pontualidade ───────────────────────────────── */}
              <DashboardWidgetFrame {...widgetFrameProps("generalRight", "sla", "SLA e pontualidade", "shrink-0")}>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-blue-600" /> SLA / Pontualidade
                  </h3>
                  <DashboardTrendPeriodSelect value={trendComparisonPeriod} onChange={handleTrendPeriodChange} />
                </div>
                {slaQ.isLoading ? (
                  <Skeleton className="h-20 w-full" />
                ) : (() => {
                  const sla = slaQ.data;
                  const pct = sla?.slaThis;
                  const trend = sla?.trend;
                  const color = pct === null || pct === undefined ? "gray" : pct >= 80 ? "green" : pct >= 60 ? "yellow" : "red";
                  const colorMap: Record<string, string> = { green: "text-green-600", yellow: "text-yellow-600", red: "text-red-600", gray: "text-gray-400" };
                  const bgMap: Record<string, string> = { green: "bg-green-50", yellow: "bg-yellow-50", red: "bg-red-50", gray: "bg-gray-50" };
                  return (
                    <div className="space-y-3">
                      <div className="flex items-end gap-3">
                        <span className={`text-4xl font-bold ${colorMap[color]}`}>
                          {pct !== null && pct !== undefined ? `${pct}%` : "—"}
                        </span>
                        <DashboardTrendIndicator label="SLA" value={trend} suffix="pp" period={TREND_COMPARISON_PERIOD_DESCRIPTIONS[trendComparisonPeriod]} series={slaSparklineData} />
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${color === "green" ? "bg-green-500" : color === "yellow" ? "bg-yellow-500" : color === "red" ? "bg-red-500" : "bg-gray-300"}`}
                          style={{ width: `${pct ?? 0}%` }}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <div className={`rounded-lg p-2 ${bgMap[color]}`}>
                          <p className="text-xs text-gray-500">No prazo (mês)</p>
                          <p className={`text-lg font-bold ${colorMap[color]}`}>{sla?.onTimeThis ?? 0}</p>
                        </div>
                        <div className="rounded-lg p-2 bg-gray-50">
                          <p className="text-xs text-gray-500">Total concluídas</p>
                          <p className="text-lg font-bold text-gray-700">{sla?.totalThis ?? 0}</p>
                        </div>
                      </div>
                      {sla?.slaLast !== null && sla?.slaLast !== undefined && (
                        <p className="text-xs text-gray-400">Mês anterior: <span className="font-medium text-gray-600">{sla.slaLast}%</span></p>
                      )}
                    </div>
                  );
                })()}
                </div>
              </DashboardWidgetFrame>

            </div>
          </div>
        )}
        {/* ══════════════════════════════════════════════════════════════════════
            VISÃO DETALHADA
        ══════════════════════════════════════════════════════════════════════ */}
        {view === "detalhada" && (
          <div className="space-y-5">
            {/* Row 1: A + B + C */}
            <div className="grid grid-cols-12 gap-5">
              {/* A — Status das Atividades */}
              <DashboardWidgetFrame {...widgetFrameProps("detailTop", "activity-status", "Status das atividades", "col-span-12 lg:col-span-4")}>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">A</span>
                  <h3 className="text-sm font-semibold text-gray-800">Status das Atividades</h3>
                </div>
                {statsQ.isLoading ? (
                  <Skeleton className="h-52 w-full" />
                ) : donutData.length === 0 ? (
                  <div className="h-52 flex items-center justify-center text-sm text-gray-400">Sem dados</div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={donutData} cx="50%" cy="50%"
                          innerRadius={55} outerRadius={80}
                          paddingAngle={3} dataKey="value"
                        >
                          {donutData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Center label */}
                    <div className="flex justify-center gap-4 mt-1">
                      {donutData.map((d) => (
                        <div key={d.name} className="flex flex-col items-center">
                          <div className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                            <span className="text-xs text-gray-500">{d.name}</span>
                          </div>
                          <span className="text-xs font-bold text-gray-700">{d.pct}%</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-center text-2xl font-bold text-gray-800 mt-2">{stats?.totalTasks ?? 0}</p>
                    <p className="text-center text-xs text-gray-400">Atividades</p>
                  </>
                )}
              </div>
              </DashboardWidgetFrame>

              {/* B — Tipo de Obra */}
              <DashboardWidgetFrame {...widgetFrameProps("detailTop", "work-type", "Tipo de obra", "col-span-12 lg:col-span-4")}>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">B</span>
                  <h3 className="text-sm font-semibold text-gray-800">Tipo de Obra</h3>
                </div>
                {crsQ.isLoading ? (
                  <Skeleton className="h-52 w-full" />
                ) : tipoObraStats.length === 0 ? (
                  <div className="h-52 flex items-center justify-center text-sm text-gray-400">Sem dados</div>
                ) : (
                  <div className="space-y-2.5">
                    {tipoObraStats.map((t) => (
                      <div key={t.key} className="flex items-center gap-3">
                        <div
                          className="flex items-center justify-center rounded-md text-white text-xs font-semibold px-3 py-1.5 shrink-0"
                          style={{ backgroundColor: "#3b82f6", minWidth: 120 }}
                        >
                          {t.label}
                        </div>
                        <div className="flex-1 h-7 bg-gray-100 rounded-md overflow-hidden">
                          <div
                            className="h-full rounded-md flex items-center justify-end pr-2"
                            style={{
                              width: `${(t.count / maxTipoObra) * 100}%`,
                              backgroundColor: "#e2e8f0",
                              minWidth: 20,
                            }}
                          />
                        </div>
                        <span className="text-sm font-bold text-gray-700 w-8 text-right">{t.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              </DashboardWidgetFrame>

              {/* C — Progresso por Cliente */}
              <DashboardWidgetFrame {...widgetFrameProps("detailTop", "client-progress", "Progresso por cliente", "col-span-12 lg:col-span-4")}>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">C</span>
                  <h3 className="text-sm font-semibold text-gray-800">Progresso por Cliente</h3>
                </div>
                {clientProgressQ.isLoading ? (
                  <Skeleton className="h-52 w-full" />
                ) : clientProgress.length === 0 ? (
                  <div className="h-52 flex items-center justify-center text-sm text-gray-400">Sem clientes</div>
                ) : (
                  <div className="space-y-3">
                    {clientProgress.slice(0, 6).map((c: any) => (
                      <div key={c.id} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700 truncate max-w-[140px]">{c.name}</span>
                          <span className="text-sm font-bold text-gray-800">{c.avgProgress}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue-600 transition-all"
                            style={{ width: `${c.avgProgress}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                </div>
              </DashboardWidgetFrame>
            </div>

            {/* Row 2: Atividade detalhada do chat */}
            <DashboardWidgetFrame {...widgetFrameProps("detailBottom", "chat-detail", "Atividade detalhada do chat", "") }>
              <div className="chat-activity-panel bg-white rounded-xl border border-gray-100 shadow-sm p-5" aria-labelledby="detailed-chat-activity-title">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-teal-50 flex items-center justify-center text-xs font-bold text-teal-700">D</span>
                  <div>
                    <h3 id="detailed-chat-activity-title" className="text-sm font-semibold text-gray-800">Atividade do Chat por Disciplina</h3>
                    <p className="text-xs text-gray-400">Presença, mensagens, conversas ativas e pendências de leitura</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {chatActivity?.generatedAt && (
                    <span className="text-[10px] text-gray-400 whitespace-nowrap">
                      Atualizado às {new Date(chatActivity.generatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={exportChatActivityPDF}
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-800 bg-[#ffbe00] hover:bg-[#eab000] rounded-md shadow-xs transition-all"
                    title="Exportar estatísticas do chat em PDF"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    PDF
                  </button>
                </div>
              </div>
              {chatActivityQ.isLoading ? (
                <div className="space-y-2.5" aria-label="Carregando atividade do chat">
                  {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-20 w-full rounded-lg" />)}
                </div>
              ) : chatActivityDisciplineDetails.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-400">
                  Nenhuma disciplina com membros ou atividade de chat disponível.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {chatActivityDisciplineDetails.map((row) => {
                    const lastActivity = row.lastActivityAt
                      ? new Date(row.lastActivityAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                      : "Sem atividade recente";
                    return (
                      <button
                        key={row.discipline}
                        type="button"
                        className="w-full rounded-lg border border-gray-100 px-3 py-2.5 text-left transition-all hover:border-teal-200 hover:bg-teal-50/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                        onClick={() => navigate(buildTeamChatDisciplineUrl(row.discipline))}
                        aria-label={`Abrir chat da disciplina ${row.discipline}; ${row.unreadCount} mensagens não lidas`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${row.onlineCount > 0 ? "bg-emerald-500" : "bg-gray-300"}`} aria-hidden="true" />
                            <span className="chat-discipline-name truncate text-xs font-semibold text-gray-700">{row.discipline}</span>
                            {row.unreadCount > 0 && (
                              <span className="chat-unread-badge inline-flex shrink-0 items-center rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-600" aria-label={`${row.unreadCount} mensagens não lidas`}>
                                ● {row.unreadCount}
                              </span>
                            )}
                          </div>
                          <span className="shrink-0 text-[10px] text-gray-400">{row.onlineCount}/{row.memberCount} online</span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100" aria-label={`${row.onlinePercent}% da disciplina online`}>
                          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${row.onlinePercent}%` }} />
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-gray-500">
                          <span>{row.messagesLast24h} mensagens em 24h</span>
                          <span>{row.activeConversationsLast24h} conversa{row.activeConversationsLast24h === 1 ? "" : "s"} ativa{row.activeConversationsLast24h === 1 ? "" : "s"}</span>
                          {row.typingCount > 0 && <span className="font-medium text-violet-600">{row.typingCount} digitando agora</span>}
                          <span className="ml-auto text-gray-400">{lastActivity}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              </div>
            </DashboardWidgetFrame>

            {/* Row 3: E + F */}
            <div className="grid grid-cols-12 gap-5">
              {/* D — Minhas Tarefas */}
              <DashboardWidgetFrame {...widgetFrameProps("detailBottom", "my-tasks", "Minhas tarefas", "col-span-12 lg:col-span-7")}>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">E</span>
                  <h3 className="text-sm font-semibold text-gray-800">Minhas Tarefas</h3>
                </div>
                {myTasksQ.isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                  </div>
                ) : myTasks.length === 0 ? (
                  <div className="py-8 text-center text-sm text-gray-400">Nenhuma tarefa atribuída a você</div>
                ) : (
                  <div className="space-y-0">
                    {myTasks.slice(0, 5).map((t: any) => {
                      const isOverdue = t.dueDate && new Date(t.dueDate) < new Date() && t.progress < 100;
                      const isDone = t.progress >= 100;
                      const statusLabel = isDone ? "Concluído" : isOverdue ? "Atrasado" : t.progress > 0 ? "Em Progresso" : "Pendente";
                      const statusColor = isDone ? "bg-green-100 text-green-700" : isOverdue ? "bg-red-100 text-red-700" : t.progress > 0 ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700";
                      return (
                        <div
                          key={t.id}
                          className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50 rounded-lg px-2 -mx-2 transition-colors"
                          onClick={() => navigate(`/tasks/${t.id}`)}
                        >
                          <Badge className="text-xs shrink-0 bg-blue-50 text-blue-700 border-0 hover:bg-blue-50">
                            {t.crsName ?? "—"}
                          </Badge>
                          <span className="flex-1 text-sm text-gray-700 truncate">{t.title}</span>
                          <span className="text-xs text-gray-400 shrink-0">{fmtDate(t.dueDate)}</span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${statusColor}`}>
                            {statusLabel}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              </DashboardWidgetFrame>

              {/* E — Projetos Ativos */}
              <DashboardWidgetFrame {...widgetFrameProps("detailBottom", "active-projects", "Projetos ativos", "col-span-12 lg:col-span-5")}>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">F</span>
                  <h3 className="text-sm font-semibold text-gray-800">Projetos Ativos</h3>
                </div>
                {crsQ.isLoading ? (
                  <div className="grid grid-cols-2 gap-3">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
                  </div>
                ) : crsItems.filter((c: any) => c.status === "active").length === 0 ? (
                  <div className="py-8 text-center text-sm text-gray-400">Nenhum projeto ativo</div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {crsItems.filter((c: any) => c.status === "active").slice(0, 4).map((c: any) => (
                      <div
                        key={c.id}
                        className="border border-gray-100 rounded-xl p-3 cursor-pointer hover:border-blue-200 hover:shadow-sm transition-all"
                        onClick={() => navigate(`/kanban?crs=${c.id}`)}
                      >
                        <p className="text-sm font-semibold text-gray-800 leading-tight mb-1">{c.name}</p>
                        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                          {c.clientName && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{c.clientName}</span>
                          )}
                          {c.stateCode && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{c.stateCode}</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-400">Progresso</span>
                          <span className="text-sm font-bold text-gray-700">{c.progress}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue-600 transition-all"
                            style={{ width: `${c.progress}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                </div>
              </DashboardWidgetFrame>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
