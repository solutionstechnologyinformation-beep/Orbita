import { useState, useMemo } from "react";
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
  MapPin, Activity, Users, FolderOpen, ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

// ── Mapa SVG do Brasil ─────────────────────────────────────────────────────────
// Mapa simplificado com estados como círculos posicionados geograficamente
const BRAZIL_STATES: { code: string; name: string; cx: number; cy: number }[] = [
  { code: "AC", name: "Acre", cx: 80, cy: 210 },
  { code: "AM", name: "Amazonas", cx: 145, cy: 165 },
  { code: "RR", name: "Roraima", cx: 165, cy: 95 },
  { code: "PA", name: "Pará", cx: 240, cy: 155 },
  { code: "AP", name: "Amapá", cx: 285, cy: 105 },
  { code: "TO", name: "Tocantins", cx: 270, cy: 215 },
  { code: "MA", name: "Maranhão", cx: 310, cy: 160 },
  { code: "PI", name: "Piauí", cx: 340, cy: 185 },
  { code: "CE", name: "Ceará", cx: 375, cy: 155 },
  { code: "RN", name: "Rio Grande do Norte", cx: 405, cy: 155 },
  { code: "PB", name: "Paraíba", cx: 405, cy: 175 },
  { code: "PE", name: "Pernambuco", cx: 390, cy: 195 },
  { code: "AL", name: "Alagoas", cx: 405, cy: 210 },
  { code: "SE", name: "Sergipe", cx: 400, cy: 225 },
  { code: "BA", name: "Bahia", cx: 355, cy: 240 },
  { code: "MG", name: "Minas Gerais", cx: 320, cy: 285 },
  { code: "ES", name: "Espírito Santo", cx: 365, cy: 280 },
  { code: "RJ", name: "Rio de Janeiro", cx: 345, cy: 305 },
  { code: "SP", name: "São Paulo", cx: 295, cy: 310 },
  { code: "PR", name: "Paraná", cx: 265, cy: 340 },
  { code: "SC", name: "Santa Catarina", cx: 270, cy: 365 },
  { code: "RS", name: "Rio Grande do Sul", cx: 255, cy: 395 },
  { code: "MS", name: "Mato Grosso do Sul", cx: 230, cy: 300 },
  { code: "MT", name: "Mato Grosso", cx: 195, cy: 230 },
  { code: "GO", name: "Goiás", cx: 265, cy: 265 },
  { code: "DF", name: "Distrito Federal", cx: 285, cy: 265 },
  { code: "RO", name: "Rondônia", cx: 135, cy: 230 },
];

function BrazilMap({ stateData }: { stateData: { code: string; count: number }[] }) {
  const stateMap = useMemo(() => {
    const m: Record<string, number> = {};
    stateData.forEach((s) => { m[s.code] = s.count; });
    return m;
  }, [stateData]);

  const maxCount = useMemo(() => Math.max(1, ...stateData.map((s) => s.count)), [stateData]);

  return (
    <svg viewBox="0 0 480 440" className="w-full h-full" style={{ maxHeight: 340 }}>
      {/* Background */}
      <rect width="480" height="440" fill="#f0f6ff" rx="12" />
      {/* State bubbles */}
      {BRAZIL_STATES.map((st) => {
        const count = stateMap[st.code] ?? 0;
        const hasData = count > 0;
        const intensity = hasData ? 0.3 + (count / maxCount) * 0.7 : 0;
        const r = hasData ? 14 + (count / maxCount) * 10 : 10;
        return (
          <g key={st.code}>
            <circle
              cx={st.cx} cy={st.cy} r={r}
              fill={hasData ? `rgba(30, 64, 175, ${intensity})` : "#cbd5e1"}
              stroke={hasData ? "#1e40af" : "#94a3b8"}
              strokeWidth={hasData ? 1.5 : 0.5}
            />
            {hasData && (
              <text
                x={st.cx} y={st.cy + 1}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={count >= 100 ? 8 : 10}
                fontWeight="700"
                fill="white"
              >
                {count}
              </text>
            )}
            {!hasData && (
              <text
                x={st.cx} y={st.cy + 1}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={7} fill="#64748b"
              >
                {st.code}
              </text>
            )}
          </g>
        );
      })}
    </svg>
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

  // ── Queries ──────────────────────────────────────────────────────────────────
  const statsQ = trpc.dashboard.stats.useQuery({ clientId: undefined });
  const recentQ = trpc.dashboard.recentActivity.useQuery({ limit: 6 });
  const clientProgressQ = trpc.dashboard.clientProgress.useQuery();
  const myTasksQ = trpc.dashboard.myTasks.useQuery();
  const activeSprintQ = trpc.dashboard.activeSprint.useQuery();
  const contractsByStateQ = trpc.dashboard.contractsByState.useQuery();
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
                  <BrazilMap stateData={stateData.map((s: any) => ({ code: s.code, count: s.count }))} />
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
                    <StatRow
                      icon={<Layers className="w-4 h-4" />}
                      label="Extensão Total"
                      value={`${crsItems.reduce((sum: number, c: any) => sum + (c.extensaoKm ?? 0), 0).toLocaleString("pt-BR")} km`}
                    />
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
