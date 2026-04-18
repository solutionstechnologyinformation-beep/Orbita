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
interface ContractLocation {
  name: string;
  state: string | null;
  country: string | null;
  count: number;
  avgProgress: number;
}
function ContractsMap({ locations }: { locations: ContractLocation[] }) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);

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
    if (locations.length === 0) return;
    placeMarkers(map);
  }, [locations]); // eslint-disable-line react-hooks/exhaustive-deps

  const placeMarkers = useCallback((map: google.maps.Map) => {
    const g = (window as any).google.maps;
    // Clear old markers
    markersRef.current.forEach((m) => { try { m.setMap(null); } catch {} });
    markersRef.current = [];
    const geocoder = new g.Geocoder();
    const bounds = new g.LatLngBounds();
    let geocodedCount = 0;
    let pending = locations.length;

    const finish = () => {
      if (geocodedCount > 0) {
        if (geocodedCount === 1) {
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
            const infoWindow = new g.InfoWindow({
              content: `<div style="font-family:Inter,sans-serif;padding:4px 2px;min-width:140px;">
                <div style="font-weight:700;font-size:13px;color:#1e293b;margin-bottom:4px;">${loc.state ?? loc.country ?? ""}</div>
                <div style="font-size:12px;color:#64748b;">${loc.count} contrato${loc.count !== 1 ? "s" : ""}</div>
                <div style="font-size:12px;color:#3b82f6;margin-top:2px;">Progresso médio: ${loc.avgProgress}%</div>
              </div>`,
            });
            marker.addListener("click", () => {
              infoWindow.open({ anchor: marker, map });
            });
            markersRef.current.push(marker);
          }
          pending--;
          if (pending === 0) finish();
        });
      }, i * 150);
    });
  }, [locations]);

  useEffect(() => {
    if (mapRef.current && locations.length > 0) {
      placeMarkers(mapRef.current);
    }
  }, [locations, placeMarkers]);

  if (locations.length === 0) {
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
    <MapView
      className="rounded-xl overflow-hidden !h-80"
      initialCenter={{ lat: -14.235, lng: -51.925 }}
      initialZoom={4}
      onMapReady={handleMapReady}
    />
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

  // ── Queries ──────────────────────────────────────────────────────────────────
  const statsQ = trpc.dashboard.stats.useQuery({ clientId: undefined });
  const recentQ = trpc.dashboard.recentActivity.useQuery({ limit: 6 });
  const clientProgressQ = trpc.dashboard.clientProgress.useQuery();
  const myTasksQ = trpc.dashboard.myTasks.useQuery();
  const activeSprintQ = trpc.dashboard.activeSprint.useQuery();
  const contractsByStateQ = trpc.dashboard.contractsByState.useQuery();
  const weekTasksQ = trpc.dashboard.weekTasks.useQuery({ weekOffset });
  const weekTasks = (weekTasksQ.data ?? []) as any[];
  const crsQ = trpc.crs.list.useQuery();
  const onboardingQ = (trpc as any).onboarding?.status?.useQuery?.();

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
  const extensaoByTipo = useMemo(() => {
    const map: Record<string, number> = {};
    let totalKm = 0;
    crsItems.forEach((c: any) => {
      const km = c.extensaoKm ?? 0;
      totalKm += km;
      if (km === 0) return;
      const types = parseTipoObra(c.tipoObra);
      if (types.length === 0) { map["outro"] = (map["outro"] ?? 0) + km; return; }
      types.forEach((t) => { map[t] = (map[t] ?? 0) + km / types.length; });
    });
    const entries = Object.entries(map)
      .map(([key, km]) => ({ key, label: TIPO_OBRA_MAP[key] ?? key, km: Math.round(km * 10) / 10 }))
      .sort((a, b) => b.km - a.km);
    return { entries, totalKm: Math.round(totalKm * 10) / 10 };
  }, [crsItems]);
  const maxExtensao = useMemo(() => Math.max(1, ...extensaoByTipo.entries.map((e) => e.km)), [extensaoByTipo]);

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

  // ── Onboarding check ─────────────────────────────────────────────────────────
  const showOnboarding = false; // onboarding check disabled

  const isLoading = statsQ.isLoading;

  return (
    <AppLayout title="Dashboard">
      <div className="p-6 space-y-6 bg-gray-50 min-h-full">
        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Visão Geral</h1>
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

        {/* ══════════════════════════════════════════════════════════════════════
            VISÃO GERAL
        ══════════════════════════════════════════════════════════════════════ */}
        {view === "geral" && (
          <div className="grid grid-cols-12 gap-5">
            {/* ── Coluna esquerda: Mapa + Stats ── */}
            <div className="col-span-12 lg:col-span-5 space-y-4">
              {/* Mapa */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                {contractsByStateQ.isLoading ? (
                  <Skeleton className="h-64 w-full rounded-lg" />
                ) : (
                  <ContractsMap locations={stateData.map((s: any) => ({ name: s.state ?? s.code, state: s.state ?? s.code, country: "Brasil", count: s.count, avgProgress: s.avgProgress ?? 0 }))} />
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
            <div className="col-span-12 lg:col-span-7 space-y-4">
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
                          const barColor = task.phaseIsTerminal ? "#22c55e" : task.priority==="urgent" ? "#ef4444" : task.priority==="high" ? "#f59e0b" : "#3b82f6";
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
                      <div className="flex gap-3 mt-2 pt-2 border-t border-gray-50">
                        {[{c:"#22c55e",l:"Concluído"},{c:"#3b82f6",l:"Normal"},{c:"#f59e0b",l:"Alta"},{c:"#ef4444",l:"Urgente"}].map(x=>(
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
              {/* Atividade Recente */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">Atividade Recente</h3>
                {recentQ.isLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                  </div>
                ) : (recentQ.data ?? []).length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">Nenhuma atividade recente</p>
                ) : (
                  <div className="space-y-0">
                    {(recentQ.data ?? []).slice(0, 5).map((a: any) => {
                      const meta = (() => { try { return JSON.parse(a.metadata ?? "{}"); } catch { return {}; } })();
                      const entityLabel = meta.entityName ?? meta.crsName ?? meta.taskTitle ?? "";
                      return (
                        <div key={a.id} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                          <Avatar className="w-8 h-8 shrink-0">
                            <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
                              {initials(a.userName ?? "?")}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-gray-700">
                              <span className="font-medium">{a.userName}</span>{" "}
                              {a.action === "create" ? "criou" : a.action === "update" ? "atualizou" : a.action === "delete" ? "excluiu" : a.action}{" "}
                              {a.entityType === "crs" ? "o contrato" : a.entityType === "task" ? "a tarefa" : a.entityType === "checklist" ? "o checklist" : a.entityType}
                            </span>
                            {entityLabel && (
                              <Badge variant="secondary" className="ml-2 text-xs py-0 px-1.5 bg-blue-50 text-blue-700 border-0">
                                {entityLabel}
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-gray-400 shrink-0">{fmtTime(a.createdAt)}</span>
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
