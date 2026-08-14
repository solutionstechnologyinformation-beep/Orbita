import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import html2canvas from "html2canvas";
import { aggregateCompletedTasksByAssignee } from "../../../shared/report-summary";
import { resolvePrintWindow } from "./report-export-utils";
import { ORBITA_LOGO_URL } from "@/branding";
import { useAuth } from "@/_core/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { useLocation } from "wouter";
import {
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar,
} from "recharts";
import {
  TrendingUp, AlertTriangle, CheckCircle2, Clock, Layers, ArrowUpRight,
    MapPin, Activity, Users, FolderOpen, ChevronRight,
  Target, CalendarClock, TrendingDown, ArrowRight, FileDown, Filter, Route, Map as MapIcon, Satellite, Palette, Eye, EyeOff, ChevronDown, ChevronUp, SlidersHorizontal, Maximize2, Minimize2, X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MapView } from "@/components/Map";
import { Skeleton } from "@/components/ui/skeleton";
import { buildContractNumbers, clusterMapPoints, filterVisibleSegments, type MapPoint } from "@/lib/segment-map";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

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
  function ContractsMap({ locations, segments, onNavigate, mapExportRef }: { locations: ContractLocation[]; segments: SegmentOverlay[]; onNavigate: (path: string) => void; mapExportRef: React.RefObject<HTMLDivElement | null> }) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const segmentLinesRef = useRef<google.maps.Polyline[]>([]);
  const segmentMarkersRef = useRef<google.maps.Marker[]>([]);
  const zoomListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const highlightTimerRef = useRef<number | null>(null);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [mapType, setMapType] = useState<"roadmap" | "satellite">("roadmap");
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
  const visibleSegments = useMemo(() => filterVisibleSegments(segments, segmentVisibility, selectedSegmentId), [segments, segmentVisibility, selectedSegmentId]);
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
      styles: [
        { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9e8f5" }] },
        { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
        { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
        { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#e8e8e8" }] },
        { featureType: "poi", stylers: [{ visibility: "off" }] },
        { featureType: "transit", stylers: [{ visibility: "off" }] },
      ],
    });
    if (locations.length === 0 && segments.length === 0) return;
    placeMarkers(map);
  }, [locations, segments]); // eslint-disable-line react-hooks/exhaustive-deps

  const placeMarkers = useCallback((map: google.maps.Map) => {
    const g = (window as any).google.maps;
    // Clear old markers and imported route overlays
    markersRef.current.forEach((m) => { try { m.setMap(null); } catch {} });
    markersRef.current = [];
    segmentLinesRef.current.forEach((line) => { try { line.setMap(null); } catch {} });
    segmentLinesRef.current = [];
    segmentMarkersRef.current.forEach((marker) => { try { marker.setMap(null); } catch {} });
    segmentMarkersRef.current = [];
    const geocoder = new g.Geocoder();
    const bounds = new g.LatLngBounds();
    let geocodedCount = 0;
    let segmentPointCount = 0;
    let pending = locations.length;
    const contractPoints = new Map<number, { latTotal: number; lngTotal: number; pointCount: number; name: string }>();
    const segmentLineMeta: Array<{ line: google.maps.Polyline; crsId: number; baseColor: string }> = [];

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
        features.forEach((feature: any) => {
          const geometry = feature?.geometry;
          const paths = geometry?.type === "LineString" ? [geometry.coordinates] : geometry?.type === "MultiLineString" ? geometry.coordinates : [];
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
              content: `<div style="font-family:Inter,sans-serif;padding:6px 4px;min-width:190px;max-width:260px;">
                <div style="font-weight:700;font-size:13px;color:#1e293b;margin-bottom:5px;">${segment.crsName ?? `Contrato #${segment.crsId}`}</div>
                <div style="font-size:12px;color:#475569;margin-bottom:3px;">Trecho: <strong>${segment.name}</strong></div>
                <div style="font-size:12px;color:#475569;margin-bottom:3px;">Tipo: <strong>${TIPO_OBRA_MAP[typeKey] ?? typeKey}</strong></div>
                <div style="font-size:12px;color:#475569;">Extensão: <strong>${extension !== null ? `${extension.toLocaleString("pt-BR")} km` : "Não informada"}</strong></div>
                <button data-segment-crs="${segment.crsId}" style="margin-top:8px;border:0;border-radius:6px;background:#2563eb;color:#fff;padding:5px 9px;font-size:11px;font-weight:600;cursor:pointer;">Abrir contrato</button>
              </div>`,
            });
            const line = new g.Polyline({ map, path, geodesic: true, strokeColor, strokeOpacity: 0.9, strokeWeight: 4, clickable: true });
            line.addListener("click", () => {
              infoWindow.setPosition(path[Math.floor(path.length / 2)]);
              infoWindow.open({ map });
              setTimeout(() => {
                const button = document.querySelector(`[data-segment-crs="${segment.crsId}"]`);
                button?.addEventListener("click", () => { infoWindow.close(); onNavigate(`/kanban?crs=${segment.crsId}`); });
              }, 200);
            });
            segmentLinesRef.current.push(line);
            segmentLineMeta.push({ line, crsId: segment.crsId, baseColor: strokeColor });
          });
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
  }, [locations, visibleSegments, onNavigate, segmentColors, getSegmentTypeKey, getSegmentExtensionKm, contractNumbers]);



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

  if (locations.length === 0 && segments.length === 0) {
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
      <div ref={mapExportRef} className={isMapExpanded ? "relative h-full w-full overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-white/30" : "relative rounded-xl overflow-hidden"}>
        <MapView
          className={isMapExpanded ? "rounded-2xl overflow-hidden !h-full" : "rounded-xl overflow-hidden !h-[28rem]"}
          initialCenter={{ lat: -14.235, lng: -51.925 }}
          initialZoom={4}
          onMapReady={handleMapReady}
        />
      </div>
      <div data-map-control="true" className="absolute top-3 right-3 z-20 flex flex-wrap justify-end gap-1 rounded-lg bg-white/95 p-1 shadow-sm border border-gray-100" role="group" aria-label="Tipo de visualização, ampliação e exportação do mapa">
        <button type="button" onClick={() => setIsMapExpanded((expanded) => !expanded)} className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100" aria-pressed={isMapExpanded} title={isMapExpanded ? "Sair da visualização ampliada" : "Ampliar mapa"}>
          {isMapExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          {isMapExpanded ? "Reduzir" : "Ampliar"}
        </button>
        <span className="mx-0.5 h-5 w-px bg-gray-200" aria-hidden="true" />
        {isMapExpanded && (
          <button type="button" onClick={() => setIsMapExpanded(false)} className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100" title="Fechar visualização ampliada">
            <X className="w-3.5 h-3.5" />
            Fechar
          </button>
        )}
        <button type="button" onClick={() => setMapType("roadmap")} className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${mapType === "roadmap" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`} aria-pressed={mapType === "roadmap"}>
          <MapIcon className="w-3.5 h-3.5" /> Mapa
        </button>
        <button type="button" onClick={() => setMapType("satellite")} className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${mapType === "satellite" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`} aria-pressed={mapType === "satellite"}>
          <Satellite className="w-3.5 h-3.5" /> Satélite
        </button>
        <span className="mx-0.5 h-5 w-px bg-gray-200" aria-hidden="true" />

      </div>


      {segments.length > 0 && (
        <div data-map-control="true" className="absolute top-3 left-3 z-20 w-[292px] max-w-[calc(100%-1.5rem)] rounded-xl bg-white/95 shadow-md border border-gray-200 overflow-hidden">
          <button type="button" onClick={() => setControlsOpen((open) => !open)} className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-gray-50" aria-expanded={controlsOpen}>
            <span className="flex items-center gap-2 text-xs font-semibold text-gray-800"><SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" /> Trechos importados <span className="text-gray-400 font-normal">{enabledSegmentCount}/{segments.length}</span></span>
            {controlsOpen ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
          </button>
          {controlsOpen && (
            <div className="border-t border-gray-100 px-3 py-2.5 space-y-3 max-h-[22rem] overflow-y-auto">
              <label className="block">
                <span className="mb-1 block text-[10px] uppercase tracking-wide font-semibold text-gray-400">Localizar trecho</span>
                <select value={selectedSegmentId} onChange={(event) => {
                  const value = event.target.value === "all" ? "all" : Number(event.target.value);
                  setSelectedSegmentId(value);
                  if (value !== "all") setSegmentVisibility((current) => ({ ...current, [value]: true }));
                }} className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-[11px] text-gray-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" aria-label="Localizar trecho importado">
                  <option value="all">Todos os trechos</option>
                  {segments.map((segment) => <option key={segment.id} value={segment.id}>{segment.crsName ?? `Contrato #${segment.crsId}`} — {segment.name}</option>)}
                </select>
              </label>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-wide font-semibold text-gray-400">Cores por tipo de obra</p>
                <Palette className="w-3.5 h-3.5 text-gray-400" />
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                {segmentTypeKeys.map((typeKey) => (
                  <label key={typeKey} className="flex items-center gap-2 text-[11px] text-gray-600 cursor-pointer">
                    <input type="color" value={segmentColors[typeKey] ?? EXTENSION_COLORS[typeKey] ?? "#16a34a"} onChange={(event) => setSegmentColors((current) => ({ ...current, [typeKey]: event.target.value }))} className="w-5 h-5 rounded border-0 p-0 cursor-pointer" aria-label={`Cor de ${TIPO_OBRA_MAP[typeKey]}`} />
                    <span className="truncate">{TIPO_OBRA_MAP[typeKey]}</span>
                  </label>
                ))}
              </div>
              <div className="flex items-center justify-between gap-2 pt-1">
                <p className="text-[10px] uppercase tracking-wide font-semibold text-gray-400">Arquivos KMZ/KML</p>
                <div className="flex gap-1">
                  <button type="button" onClick={() => setSegmentVisibility(Object.fromEntries(segments.map((segment) => [segment.id, true])))} className="text-[10px] text-blue-600 hover:underline">Mostrar todos</button>
                  <button type="button" onClick={() => setSegmentVisibility(Object.fromEntries(segments.map((segment) => [segment.id, false])))} className="text-[10px] text-gray-500 hover:underline">Ocultar todos</button>
                </div>
              </div>
              <div className="space-y-1.5">
                {segments.map((segment) => {
                  const typeKey = getSegmentTypeKey(segment);
                  const visible = segmentVisibility[segment.id] !== false;
                  const extension = getSegmentExtensionKm(segment);
                  return (
                    <button key={segment.id} type="button" onClick={() => setSegmentVisibility((current) => ({ ...current, [segment.id]: !visible }))} className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${visible ? "bg-gray-50 hover:bg-gray-100" : "bg-gray-50/50 opacity-55 hover:opacity-80"}`} aria-pressed={visible}>
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: segmentColors[typeKey] ?? EXTENSION_COLORS[typeKey] ?? "#16a34a" }} />
                      {visible ? <Eye className="w-3.5 h-3.5 text-blue-600 shrink-0" /> : <EyeOff className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
                      <span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-medium text-gray-700">{segment.name}</span><span className="block truncate text-[10px] text-gray-400">{segment.crsName ?? `Contrato #${segment.crsId}`} · {TIPO_OBRA_MAP[typeKey] ?? typeKey}{extension !== null ? ` · ${extension.toLocaleString("pt-BR")} km` : ""}</span></span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
      {segments.length > 0 && (
        <div data-map-control="true" className="absolute left-3 bottom-3 rounded-lg bg-white/95 px-3 py-2 text-[11px] text-gray-600 shadow-sm border border-gray-100">
          <span className="inline-block w-3 h-1 rounded-full align-middle mr-1.5" style={{ backgroundColor: visibleSegments.length > 0 ? "#16a34a" : "#94a3b8" }} />
          Trechos visíveis: {visibleSegments.length}/{segments.length}
        </div>
      )}
    </div>
  );
}
// ── KPI Card ───────────────────────────────────────────────────────────────────
function KpiCard({ label, value, icon, iconBg, trend }: {
  label: string; value: string | number; icon: React.ReactNode; iconBg: string; trend?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 flex items-start justify-between shadow-sm">
      <div>
        <p className="text-sm text-gray-500 mb-1">{label}</p>
        <p className="text-3xl font-bold text-gray-900">{value}</p>
      </div>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBg}`}>
        {icon}
      </div>
    </div>
  );
}

// ── Stat Row (mapa lateral) ────────────────────────────────────────────────────
function StatRow({ icon, label, value, valueColor }: {
  icon: React.ReactNode; label: string; value: string | number; valueColor?: string;
}) {
  return (
    <div className="flex items-center justify-between py-3 px-4 bg-white rounded-xl border border-gray-100 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
          {icon}
        </div>
        <span className="text-sm font-medium text-gray-700">{label}</span>
      </div>
      <span className={`text-base font-bold ${valueColor ?? "text-gray-900"}`}>{value}</span>
    </div>
  );
}

// ── View Toggle ────────────────────────────────────────────────────────────────
type DashView = "geral" | "detalhada";

export default function Dashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [view, setView] = useState<DashView>("geral");
  const [slaPeriod, setSlaPeriod] = useState<"month" | "quarter" | "year">("month");
  const [isExporting, setIsExporting] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);

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
            console.log(`[Orbita] ${data.alertsSent} alerta(s) de prazo enviado(s) para ${data.tasksChecked} tarefa(s).`);
          }
        },
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Queries ──────────────────────────────────────────────────────────────────
  const statsQ = trpc.dashboard.stats.useQuery({ clientId: undefined });
  const clientProgressQ = trpc.dashboard.clientProgress.useQuery();
  const myTasksQ = trpc.dashboard.myTasks.useQuery();
  const completedTasksQ = trpc.dashboard.completedTasksSummary.useQuery({ limit: 100 });
  const activeSprintQ = trpc.dashboard.activeSprint.useQuery();
  const contractsByStateQ = trpc.dashboard.contractsByState.useQuery();
  const segmentsQ = trpc.crs.segments.list.useQuery({});
  const slaQ = trpc.dashboard.slaStats.useQuery({ period: slaPeriod });
  const upcomingQ = trpc.dashboard.upcomingDeadlines.useQuery();
  const crsQ = trpc.crs.list.useQuery();
  const stats = statsQ.data;
  const clientProgress = (clientProgressQ.data ?? []) as any[];
  const myTasks = (myTasksQ.data ?? []) as any[];
  const completedTasks = (completedTasksQ.data ?? []) as any[];
  const activeSprint = activeSprintQ.data as any;
  const stateData = (contractsByStateQ.data ?? []) as any[];
  const crsItems = (crsQ.data ?? []) as any[];

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
      const completedRows = completedTasks.slice(0, 100);
      const completedByAssignee = aggregateCompletedTasksByAssignee(completedTasks);
      const completedContracts = new Set(completedTasks.map((task: any) => task.crsName).filter(Boolean)).size;
      const completedOnTime = completedTasks.filter((task: any) => task.completedAt && (!task.dueDate || new Date(task.completedAt) <= new Date(task.dueDate))).length;
      const assigneeChartColors = ["#2563eb", "#16a34a", "#f59e0b", "#9333ea", "#0891b2", "#e11d48", "#64748b"];
      const periodLabel = slaPeriod === "month" ? "Mês Atual" : slaPeriod === "quarter" ? "Trimestre Atual" : "Ano Atual";
      const now = new Date();
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Dashboard Orbita</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; background: #f7f8fa; color: #111827; }
  .header { background: #0f172a; border-bottom: 4px solid #ffbe00; color: white; padding: 28px 36px; display: flex; align-items: center; justify-content: space-between; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  .header h1 { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
  .header p { font-size: 12px; opacity: 0.7; margin-top: 4px; }
  .body { padding: 28px 36px; }
  .section-title { font-size: 14px; font-weight: 700; color: #0f172a; border-left: 4px solid #ffbe00; padding-left: 10px; margin: 24px 0 12px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
  .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 16px; }
  .card { background: white; border-radius: 10px; border: 1px solid #dbe3ea; padding: 16px; box-shadow: 0 2px 8px rgba(15,23,42,0.06); }
  .card-title { font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
  .card-value { font-size: 28px; font-weight: 800; color: #0f172a; }
  .card-sub { font-size: 11px; color: #94a3b8; margin-top: 4px; }
  .sla-bar-bg { background: #dbe3ea; border-radius: 6px; height: 8px; margin: 8px 0; }
  .sla-bar { height: 8px; border-radius: 6px; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  .green { color: #16a34a; } .yellow { color: #d97706; } .red { color: #dc2626; }
  .bg-green { background: #22c55e; } .bg-yellow { background: #ffbe00; } .bg-red { background: #ef4444; } .bg-gray { background: #94a3b8; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #0f172a; color: white; padding: 8px 12px; text-align: left; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  td { padding: 7px 12px; border-bottom: 1px solid #eef2f7; }
  tr:nth-child(even) td { background: #f7f8fa; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; }
  .assignee-chart { padding: 18px; }
  .assignee-chart-row { display: grid; grid-template-columns: 150px 1fr 82px; align-items: center; gap: 12px; margin: 10px 0; }
  .assignee-chart-label { color: #334155; font-size: 11px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .assignee-chart-track { background: #dbe3ea; border-radius: 999px; height: 12px; overflow: hidden; }
  .assignee-chart-fill { height: 100%; border-radius: 999px; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  .assignee-chart-value { color: #475569; font-size: 11px; text-align: right; white-space: nowrap; }
  .footer { background: #0f172a; border-top: 4px solid #ffbe00; color: white; padding: 14px 36px; display: flex; justify-content: space-between; align-items: center; font-size: 11px; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  .brand-logo { width: 44px; height: 44px; object-fit: contain; background: rgba(255,255,255,0.92); border-radius: 8px; padding: 3px; }
  @media print { body { background: white; } .header, .footer, th { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
</style></head><body>
<div class="header">
  <div style="display:flex;align-items:center;gap:12px;"><img class="brand-logo" src="${ORBITA_LOGO_URL}" alt="Logo Orbita" /><div><h1>Orbita GIS &amp; OS</h1><p>Relatório do Dashboard — ${now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p></div></div>
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
  <div class="section-title">Visão Geral do Mapa e Contratos por Estado</div>
  ${mapDataUrl ? `<div style="margin-bottom:16px;text-align:center;"><img src="${mapDataUrl}" style="max-width:100%;height:auto;border-radius:8px;border:1px solid #e2e8f0;" /></div>` : ''}
  <table><thead><tr><th>Estado</th><th>Contratos</th><th>Progresso Médio</th><th>Status</th></tr></thead><tbody>
    ${stateRows.map((s: any) => `<tr><td>${s.state}</td><td>${s.count}</td><td>${s.avgProgress ?? 0}%</td><td><span class="badge" style="background:${(s.avgProgress ?? 0) >= 80 ? '#dcfce7;color:#16a34a' : (s.avgProgress ?? 0) >= 50 ? '#fef9c3;color:#d97706' : '#fee2e2;color:#dc2626'}">${(s.avgProgress ?? 0) >= 80 ? 'Em Dia' : (s.avgProgress ?? 0) >= 50 ? 'Atenção' : 'Crítico'}</span></td></tr>`).join('')}
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
<div class="footer"><span style="display:flex;align-items:center;gap:8px;"><img class="brand-logo" src="${ORBITA_LOGO_URL}" alt="Logo Orbita" /> Orbita GIS &amp; OS — Sistema de Gestão de Contratos</span><span>Página 1 de 1 — ${now.toLocaleDateString('pt-BR')}</span></div>
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
  }, [slaQ.data, upcomingQ.data, stateData, stats, slaPeriod, completedTasks]);

  return (
    <AppLayout title="Dashboard">
      <div className="p-6 space-y-6 bg-gray-50 min-h-full" style={{ backgroundColor: '#ffffff' }}>
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
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900" style={{ color: '#000000' }}>Visão Geral</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={exportDashboardPDF}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-950 bg-[#ffbe00] hover:bg-[#eab000] disabled:opacity-60 rounded-lg shadow-sm transition-all"
            >
              <FileDown className="w-4 h-4" />
              {isExporting ? "Exportando..." : "Exportar PDF"}
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
            <div className="col-span-12 lg:col-span-6 space-y-4">
              {/* Mapa */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                {contractsByStateQ.isLoading ? (
                  <Skeleton className="h-64 w-full rounded-lg" />
                ) : (
                  <ContractsMap
                    locations={stateData.map((s: any) => ({ name: s.state ?? s.code, state: s.state ?? s.code, country: "Brasil", count: s.count, avgProgress: s.avgProgress ?? 0, contracts: s.contracts ?? [] }))}
                    segments={(segmentsQ.data ?? []) as SegmentOverlay[]}
                    onNavigate={navigate}
                    mapExportRef={mapExportRef}
                  />
                )}
              </div>

              {/* Stat rows */}
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
              {/* ── Linha do Tempo de Vencimentos ──────────────────────────────── */}
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
            </div>

            {/* ── Coluna direita: KPIs + Burndown + Contratos por Estado ── */}
            <div className="col-span-12 lg:col-span-6 space-y-4">
              {/* KPI cards */}
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

              {/* KPI cards para extensao, area e perimetro urbano */}
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

              {/* Distribuição visual da extensão por tipo de obra */}
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

              {/* Burndown + Contratos por Estado lado a lado */}
              <div className="grid grid-cols-2 gap-4">
                {/* Burndown da Sprint Atual */}
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

                {/* Contratos por Estado */}
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
              </div>

              {/* ── Painel SLA / Pontualidade ───────────────────────────────── */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-blue-600" /> SLA / Pontualidade
                  </h3>
                  <div className="flex items-center gap-1">
                    {(["month", "quarter", "year"] as const).map(p => (
                      <button
                        key={p}
                        onClick={() => setSlaPeriod(p)}
                        className={`px-2 py-0.5 text-xs rounded font-medium transition-all ${
                          slaPeriod === p ? "bg-blue-600 text-white" : "text-gray-400 hover:text-gray-600"
                        }`}
                      >
                        {p === "month" ? "Mês" : p === "quarter" ? "Trim." : "Ano"}
                      </button>
                    ))}
                  </div>
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
                        {trend !== null && trend !== undefined && (
                          <div className={`flex items-center gap-0.5 text-sm mb-1 ${trend >= 0 ? "text-green-600" : "text-red-500"}`}>
                            {trend >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                            <span>{trend >= 0 ? "+" : ""}{trend}pp</span>
                          </div>
                        )}
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
              <div className="col-span-12 lg:col-span-4 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
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

              {/* B — Tipo de Obra */}
              <div className="col-span-12 lg:col-span-4 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
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

              {/* C — Progresso por Cliente */}
              <div className="col-span-12 lg:col-span-4 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
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
            </div>

            {/* Row 2: D + E */}
            <div className="grid grid-cols-12 gap-5">
              {/* D — Minhas Tarefas */}
              <div className="col-span-12 lg:col-span-7 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">D</span>
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

              {/* E — Projetos Ativos */}
              <div className="col-span-12 lg:col-span-5 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">E</span>
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
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
