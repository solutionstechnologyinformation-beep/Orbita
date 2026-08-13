import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { useLocation } from "wouter";
import {
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar,
} from "recharts";
import {
  TrendingUp, AlertTriangle, CheckCircle2, Clock, Layers, ArrowUpRight,
  MapPin, Activity, Users, FolderOpen, ChevronRight, ChevronLeft,
  Target, CalendarClock, Zap, TrendingDown, ArrowRight, FileDown, Filter, Route,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MapView } from "@/components/Map";
import { Skeleton } from "@/components/ui/skeleton";
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
  geometryJson: string;
}
function ContractsMap({ locations, segments, onNavigate }: { locations: ContractLocation[]; segments: SegmentOverlay[]; onNavigate: (path: string) => void }) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const segmentLinesRef = useRef<google.maps.Polyline[]>([]);

  const handleMapReady = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    // Configure map style
    map.setOptions({
      mapTypeId: "roadmap",
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
    const geocoder = new g.Geocoder();
    const bounds = new g.LatLngBounds();
    let geocodedCount = 0;
    let segmentPointCount = 0;
    let pending = locations.length;

    segments.forEach((segment) => {
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
            const line = new g.Polyline({ map, path, geodesic: true, strokeColor: "#16a34a", strokeOpacity: 0.9, strokeWeight: 4, clickable: true });
            line.addListener("click", () => onNavigate(`/kanban?crs=${segment.crsId}`));
            segmentLinesRef.current.push(line);
          });
        });
      } catch {
        // Segmentos inválidos são ignorados sem interromper os marcadores do mapa.
      }
    });

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
  }, [locations, segments, onNavigate]);

  useEffect(() => {
    if (mapRef.current && (locations.length > 0 || segments.length > 0)) {
      placeMarkers(mapRef.current);
    }
  }, [locations, segments, placeMarkers]);

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
    <div className="relative">
      <MapView
        className="rounded-xl overflow-hidden !h-[28rem]"
        initialCenter={{ lat: -14.235, lng: -51.925 }}
        initialZoom={4}
        onMapReady={handleMapReady}
      />
      {segments.length > 0 && (
        <div className="absolute left-3 bottom-3 rounded-lg bg-white/95 px-3 py-2 text-[11px] text-gray-600 shadow-sm border border-gray-100">
          <span className="inline-block w-3 h-1 rounded-full bg-green-600 align-middle mr-1.5" />
          Trechos importados ({segments.length})
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
  const [weekOffset, setWeekOffset] = useState(0);
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
  const recentQ = trpc.dashboard.recentActivity.useQuery({ limit: 6 });
  const clientProgressQ = trpc.dashboard.clientProgress.useQuery();
  const myTasksQ = trpc.dashboard.myTasks.useQuery();
  const activeSprintQ = trpc.dashboard.activeSprint.useQuery();
  const contractsByStateQ = trpc.dashboard.contractsByState.useQuery();
  const segmentsQ = trpc.crs.segments.list.useQuery({});
  const weekTasksQ = trpc.dashboard.weekTasks.useQuery({ weekOffset });
  const slaQ = trpc.dashboard.slaStats.useQuery({ period: slaPeriod });
  const upcomingQ = trpc.dashboard.upcomingDeadlines.useQuery();
  const recentFullQ = trpc.dashboard.recentActivity.useQuery({ limit: 10 });
  const weekTasks = (weekTasksQ.data ?? []) as any[];
  const crsQ = trpc.crs.list.useQuery();
  const stats = statsQ.data;
  const clientProgress = (clientProgressQ.data ?? []) as any[];
  const myTasks = (myTasksQ.data ?? []) as any[];
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
  const exportDashboardPDF = useCallback(async () => {
    setIsExporting(true);
    try {
      const sla = slaQ.data;
      const upcoming = upcomingQ.data;
      const recent = recentFullQ.data ?? [];
      const stateRows = stateData;
      const periodLabel = slaPeriod === "month" ? "Mês Atual" : slaPeriod === "quarter" ? "Trimestre Atual" : "Ano Atual";
      const now = new Date();
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Dashboard Orbita</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; background: #f8fafc; color: #1e293b; }
  .header { background: linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%); color: white; padding: 28px 36px; display: flex; align-items: center; justify-content: space-between; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  .header h1 { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
  .header p { font-size: 12px; opacity: 0.7; margin-top: 4px; }
  .body { padding: 28px 36px; }
  .section-title { font-size: 14px; font-weight: 700; color: #0f172a; border-left: 4px solid #1d4ed8; padding-left: 10px; margin: 24px 0 12px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
  .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 16px; }
  .card { background: white; border-radius: 10px; border: 1px solid #e2e8f0; padding: 16px; }
  .card-title { font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
  .card-value { font-size: 28px; font-weight: 800; color: #0f172a; }
  .card-sub { font-size: 11px; color: #94a3b8; margin-top: 4px; }
  .sla-bar-bg { background: #e2e8f0; border-radius: 6px; height: 8px; margin: 8px 0; }
  .sla-bar { height: 8px; border-radius: 6px; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  .green { color: #16a34a; } .yellow { color: #d97706; } .red { color: #dc2626; }
  .bg-green { background: #22c55e; } .bg-yellow { background: #f59e0b; } .bg-red { background: #ef4444; } .bg-gray { background: #94a3b8; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #0f172a; color: white; padding: 8px 12px; text-align: left; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  td { padding: 7px 12px; border-bottom: 1px solid #f1f5f9; }
  tr:nth-child(even) td { background: #f8fafc; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; }
  .footer { background: #0f172a; color: white; padding: 14px 36px; display: flex; justify-content: space-between; align-items: center; font-size: 11px; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  @media print { body { background: white; } .header, .footer, th { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
</style></head><body>
<div class="header">
  <div><h1>&#9679; Orbita</h1><p>Relatório do Dashboard — ${now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p></div>
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
  <div class="section-title">Contratos por Estado</div>
  <table><thead><tr><th>Estado</th><th>Contratos</th><th>Progresso Médio</th><th>Status</th></tr></thead><tbody>
    ${stateRows.map((s: any) => `<tr><td>${s.state}</td><td>${s.count}</td><td>${s.avgProgress ?? 0}%</td><td><span class="badge" style="background:${(s.avgProgress ?? 0) >= 80 ? '#dcfce7;color:#16a34a' : (s.avgProgress ?? 0) >= 50 ? '#fef9c3;color:#d97706' : '#fee2e2;color:#dc2626'}">${(s.avgProgress ?? 0) >= 80 ? 'Em Dia' : (s.avgProgress ?? 0) >= 50 ? 'Atenção' : 'Crítico'}</span></td></tr>`).join('')}
  </tbody></table>
  <div class="section-title">Vencimentos Próximos</div>
  <div class="grid3">
    <div class="card"><div class="card-title">Próximos 7 dias</div><div class="card-value" style="color:#dc2626">${upcoming?.counts?.next7 ?? 0}</div></div>
    <div class="card"><div class="card-title">Próximos 15 dias</div><div class="card-value" style="color:#d97706">${upcoming?.counts?.next15 ?? 0}</div></div>
    <div class="card"><div class="card-title">Próximos 30 dias</div><div class="card-value" style="color:#f59e0b">${upcoming?.counts?.next30 ?? 0}</div></div>
  </div>
  ${(upcoming?.tasks ?? []).length > 0 ? `<table><thead><tr><th>Tarefa</th><th>Contrato</th><th>Fase</th><th>Vencimento</th><th>Prioridade</th></tr></thead><tbody>${(upcoming?.tasks as any[] ?? []).map((t: any) => `<tr><td>${t.title}</td><td>${t.crsName ?? '—'}</td><td>${t.phaseName ?? '—'}</td><td>${t.dueDate ? new Date(t.dueDate).toLocaleDateString('pt-BR') : '—'}</td><td>${t.priority ?? '—'}</td></tr>`).join('')}</tbody></table>` : '<p style="color:#94a3b8;font-size:12px">Nenhuma tarefa com vencimento próximo.</p>'}
  <div class="section-title">Últimas Atualizações</div>
  <table><thead><tr><th>Usuário</th><th>Ação</th><th>Data/Hora</th></tr></thead><tbody>
    ${(recent as any[]).slice(0, 8).map((a: any) => `<tr><td>${a.userName ?? '—'}</td><td>${a.action ?? '—'} ${a.entityLabel ? '"' + a.entityLabel + '"' : ''}</td><td>${a.createdAt ? new Date(a.createdAt).toLocaleString('pt-BR') : '—'}</td></tr>`).join('')}
  </tbody></table>
</div>
<div class="footer"><span>&#9679; Orbita — Sistema de Gestão de Contratos</span><span>Página 1 de 1 — ${now.toLocaleDateString('pt-BR')}</span></div>
</body></html>`;
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
        setTimeout(() => { win.print(); }, 800);
      }
    } finally {
      setIsExporting(false);
    }
  }, [slaQ.data, upcomingQ.data, recentFullQ.data, stateData, stats, slaPeriod]);

  return (
    <AppLayout title="Dashboard">
      <div className="p-6 space-y-6 bg-gray-50 min-h-full" style={{ backgroundColor: '#ffffff' }}>
        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900" style={{ color: '#000000' }}>Visão Geral</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={exportDashboardPDF}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg shadow-sm transition-all"
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
            {/* ── Coluna esquerda: Mapa + Stats ── */}
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
            </div>

            {/* ── Coluna direita: KPIs + Burndown + Contratos por Estado + Atividade ── */}
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

              {/* Mini-Gantt da Semana */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    Gantt da Semana
                    <span className="text-xs text-gray-400 font-normal">
                      {(() => {
                        const today = new Date();
                        const dow = today.getDay();
                        const mon = new Date(today); mon.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1) + weekOffset * 7); mon.setHours(0,0,0,0);
                        const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
                        return `${mon.toLocaleDateString("pt-BR",{day:"2-digit",month:"short"})} – ${sun.toLocaleDateString("pt-BR",{day:"2-digit",month:"short"})}`;
                      })()}
                    </span>
                  </h3>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setWeekOffset(w => w - 1)} className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {weekOffset !== 0 && (
                      <button onClick={() => setWeekOffset(0)} className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
                        Hoje
                      </button>
                    )}
                    <button onClick={() => setWeekOffset(w => w + 1)} className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {weekTasksQ.isLoading ? (
                  <div className="space-y-2">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-7 w-full"/>)}</div>
                ) : weekTasks.length === 0 ? (
                  <div className="h-20 flex items-center justify-center text-sm text-gray-400">Nenhuma tarefa esta semana</div>
                ) : (() => {
                  const today = new Date();
                  const dow = today.getDay();
                  const mon = new Date(today); mon.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1)); mon.setHours(0,0,0,0);
                  const todayIdx = dow === 0 ? 6 : dow - 1;
                  const DAYS = ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];
                  return (
                    <div>
                      <div className="grid mb-1" style={{gridTemplateColumns:"130px repeat(7,1fr)"}}>
                        <div/>
                        {DAYS.map((d,i)=>{
                          const dd = new Date(mon); dd.setDate(mon.getDate()+i);
                          return <div key={d} className={`text-center text-[10px] font-medium py-0.5 rounded ${i===todayIdx?"bg-blue-100 text-blue-700":"text-gray-400"}`}>{d}<br/>{dd.getDate()}</div>;
                        })}
                      </div>
                      <div className="space-y-1">
                        {weekTasks.slice(0,8).map((task:any)=>{
                          const sD = task.startDate ? new Date(task.startDate) : (task.dueDate ? new Date(task.dueDate) : null);
                          const eD = task.endDate ? new Date(task.endDate) : (task.dueDate ? new Date(task.dueDate) : null);
                          const si = sD ? Math.max(0,Math.min(6,Math.round((sD.getTime()-mon.getTime())/86400000))) : 0;
                          const ei = eD ? Math.max(si,Math.min(6,Math.round((eD.getTime()-mon.getTime())/86400000))) : si;
                          // Use phase color (status) as primary; fall back to priority color
                          const barColor = task.phaseColor ?? (task.phaseIsTerminal ? "#22c55e" : task.priority==="urgent" ? "#ef4444" : task.priority==="high" ? "#f59e0b" : "#3b82f6");
                          return (
                            <div key={task.id} className="grid items-center" style={{gridTemplateColumns:"130px repeat(7,1fr)"}}>
                              <div className="text-xs text-gray-700 truncate pr-1" title={task.title}>{task.title}</div>
                              {Array.from({length:7}).map((_,ci)=>(
                                <div key={ci} className={`h-5 ${ci===todayIdx?"bg-blue-50":"bg-gray-50"} relative`}>
                                  {ci===si && (
                                    <div className="absolute inset-y-0.5 left-0 rounded flex items-center px-1 overflow-hidden"
                                      style={{backgroundColor:barColor+"cc", right:`${-(ei-si)*100}%`, minWidth:"100%"}}>
                                      <span className="text-[9px] text-white font-medium truncate">{task.assigneeName??""}</span>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex flex-wrap gap-3 mt-2 pt-2 border-t border-gray-50">
                        {weekTasks.reduce((acc:any[], t:any) => {
                          if (t.phaseName && t.phaseColor && !acc.find((x:any)=>x.l===t.phaseName)) acc.push({c:t.phaseColor,l:t.phaseName});
                          return acc;
                        }, []).map((x:any)=>(
                          <div key={x.l} className="flex items-center gap-1">
                            <span className="w-3 h-2 rounded-sm" style={{backgroundColor:x.c}}/>
                            <span className="text-[10px] text-gray-400">{x.l}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
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

              {/* ── Feed de Últimas Atualizações ───────────────────────────────── */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-purple-500" /> Últimas Atualizações
                  </h3>
                </div>
                {recentFullQ.isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
                  </div>
                ) : (recentFullQ.data ?? []).length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">Nenhuma atividade recente</p>
                ) : (
                  <div className="space-y-0 max-h-64 overflow-y-auto">
                    {(recentFullQ.data ?? []).map((a: any) => {
                      const meta = (() => { try { return JSON.parse(a.metadata ?? "{}"); } catch { return {}; } })();
                      const entityLabel = meta.entityName ?? meta.crsName ?? meta.taskTitle ?? "";
                      const actionIcon = a.action === "create" ? "🟢" : a.action === "delete" ? "🔴" : "🔵";
                      const actionText = a.action === "create" ? "criou" : a.action === "update" ? "atualizou" : a.action === "delete" ? "excluiu" : a.action;
                      const entityText = a.entityType === "crs" ? "contrato" : a.entityType === "task" ? "tarefa" : a.entityType === "checklist" ? "checklist" : a.entityType;
                      return (
                        <div key={a.id} className="flex items-start gap-2.5 py-2 border-b border-gray-50 last:border-0">
                          <span className="text-sm mt-0.5">{actionIcon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-700 leading-snug">
                              <span className="font-semibold">{a.userName}</span> {actionText} {entityText}
                              {entityLabel && <span className="text-blue-600 font-medium"> "{entityLabel}"</span>}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">{fmtTime(a.createdAt)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
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
