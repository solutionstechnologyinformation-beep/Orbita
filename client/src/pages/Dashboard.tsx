import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { useLocation } from "wouter";
import {
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  AlertTriangle, CheckCircle2, Clock, TrendingDown, TrendingUp,
  Layers, Briefcase, FolderKanban, CalendarDays, Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

// ── Helpers ────────────────────────────────────────────────────────────────────
function pct(n: number, total: number) {
  if (!total) return 0;
  return Math.round((n / total) * 100);
}

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  pending:     "#94a3b8",
  in_progress: "#3b82f6",
  shared:      "#f59e0b",
  published:   "#22c55e",
  archived:    "#6b7280",
  blocked:     "#ef4444",
};
const STATUS_LABELS: Record<string, string> = {
  pending:     "Para Iniciar",
  in_progress: "Em Andamento",
  shared:      "Em Revisão",
  published:   "Aprovado",
  archived:    "Arquivado",
  blocked:     "Bloqueado",
};

// ── Gauge card ─────────────────────────────────────────────────────────────────
function GaugeCard({
  label, value, color, icon: Icon, description,
}: {
  label: string; value: number; color: string; icon: any; description?: string;
}) {
  const r = 36;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (Math.min(value, 100) / 100) * circumference;
  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col items-center gap-2">
      <p className="text-xs font-medium text-muted-foreground text-center">{label}</p>
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 88 88">
          <circle cx="44" cy="44" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
          <circle
            cx="44" cy="44" r={r} fill="none"
            stroke={color} strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.8s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Icon className="w-4 h-4 mb-0.5" style={{ color }} />
          <span className="text-xl font-bold text-foreground">{value}%</span>
        </div>
      </div>
      {description && <p className="text-xs text-muted-foreground text-center">{description}</p>}
    </div>
  );
}

// ── Custom donut label ─────────────────────────────────────────────────────────
const RADIAN = Math.PI / 180;
function CustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
  if (percent < 0.05) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [, navigate] = useLocation();

  const statsQ = trpc.dashboard.stats.useQuery();
  const conflictsQ = trpc.dashboard.conflicts.useQuery();
  const clientCountQ = trpc.dashboard.clientCount.useQuery();
  const projectsQ = trpc.projects.list.useQuery();
  const sprintsQ = trpc.sprints.listAll.useQuery();
  const recentQ = trpc.dashboard.recentTasks.useQuery();

  const stats = statsQ.data;
  const conflicts = conflictsQ.data ?? [];
  const clientCount = clientCountQ.data ?? 0;
  const projects = (projectsQ.data ?? []) as any[];
  const sprints = (sprintsQ.data ?? []) as any[];
  const recentTasks = (recentQ.data ?? []) as any[];

  // Current week sprints
  const now = new Date();
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay());
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
  const weekSprints = useMemo(() =>
    sprints.filter((s: any) => {
      const start = s.startDate ? new Date(s.startDate) : null;
      const end = s.endDate ? new Date(s.endDate) : null;
      if (!start || !end) return false;
      return start <= weekEnd && end >= weekStart;
    }),
    [sprints]
  );

  // Percentages
  const total = stats?.totalTasks ?? 0;
  const overdueP = pct(stats?.overdueTasks ?? 0, total);
  const completedP = pct(stats?.completedTasks ?? 0, total);
  const revisionP = pct(stats?.sharedTasks ?? 0, total);
  const onTimeP = total > 0 ? Math.max(0, 100 - overdueP) : 0;

  // Donut data
  const donutData = [
    { name: STATUS_LABELS.pending,     value: stats?.pendingTasks ?? 0,    color: STATUS_COLORS.pending },
    { name: STATUS_LABELS.in_progress, value: stats?.inProgressTasks ?? 0, color: STATUS_COLORS.in_progress },
    { name: STATUS_LABELS.shared,      value: stats?.sharedTasks ?? 0,     color: STATUS_COLORS.shared },
    { name: STATUS_LABELS.published,   value: stats?.publishedTasks ?? 0,  color: STATUS_COLORS.published },
    { name: STATUS_LABELS.archived,    value: stats?.archivedTasks ?? 0,   color: STATUS_COLORS.archived },
  ].filter(d => d.value > 0);

  const isLoading = statsQ.isLoading;

  return (
    <AppLayout title="Dashboard">
      <div className="space-y-6">

        {/* ── Header ── */}
        <div>
          <h2 className="text-2xl font-bold text-foreground">Acompanhamento dos Projetos</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
          </p>
        </div>

        {/* ── Top KPI Row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total de Projetos", value: projects.length,    icon: FolderKanban, color: "text-blue-400",    bg: "bg-blue-500/10" },
            { label: "Total de Tarefas",  value: total,              icon: Layers,       color: "text-violet-400", bg: "bg-violet-500/10" },
            { label: "Clientes",          value: clientCount,        icon: Briefcase,    color: "text-orange-400", bg: "bg-orange-500/10" },
            { label: "Sprints da Semana", value: weekSprints.length, icon: Zap,          color: "text-emerald-400",bg: "bg-emerald-500/10" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{label}</p>
                  {isLoading ? <Skeleton className="h-8 w-16" /> : (
                    <p className="text-3xl font-bold text-foreground">{value}</p>
                  )}
                </div>
                <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Gauge KPIs ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-2xl" />)
          ) : (
            <>
              <GaugeCard label="Tarefas em Atraso"  value={overdueP}   color="#ef4444" icon={TrendingDown}
                description={`${stats?.overdueTasks ?? 0} de ${total} tarefas`} />
              <GaugeCard label="Tarefas Concluídas" value={completedP} color="#22c55e" icon={CheckCircle2}
                description={`${stats?.completedTasks ?? 0} de ${total} tarefas`} />
              <GaugeCard label="Em Revisão"         value={revisionP}  color="#f59e0b" icon={Clock}
                description={`${stats?.sharedTasks ?? 0} de ${total} tarefas`} />
              <GaugeCard label="Dentro do Prazo"    value={onTimeP}    color="#3b82f6" icon={TrendingUp}
                description={`${total - (stats?.overdueTasks ?? 0)} de ${total} tarefas`} />
            </>
          )}
        </div>

        {/* ── Middle Row: Donut + Conflicts + Sprint ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Donut Chart */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Layers className="w-4 h-4 text-violet-400" />
              Status das Atividades
            </h3>
            {isLoading ? <Skeleton className="h-52 w-full" /> : donutData.length === 0 ? (
              <div className="flex items-center justify-center h-52 text-muted-foreground text-sm">Sem dados</div>
            ) : (
              <div className="relative">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="45%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      labelLine={false}
                      label={CustomLabel}
                    >
                      {donutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(value: number, name: string) => [`${value} tarefas`, name]}
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        color: "hsl(var(--foreground))",
                        fontSize: 12,
                      }}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 11 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center label */}
                <div className="absolute pointer-events-none" style={{ top: "38%", left: "50%", transform: "translate(-50%, -50%)" }}>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground">{total}</p>
                    <p className="text-xs text-muted-foreground">tarefas</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Conflict Alerts */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              Alertas de Conflito
              {conflicts.length > 0 && (
                <Badge className="ml-auto bg-red-500/15 text-red-400 border border-red-500/30 text-xs">
                  {conflicts.length}
                </Badge>
              )}
            </h3>
            {conflictsQ.isLoading ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
            ) : conflicts.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400/40 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum conflito detectado</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Todas as atividades estão sem sobreposição</p>
              </div>
            ) : (
              <div className="space-y-2 overflow-y-auto max-h-52">
                {conflicts.map((c: any, i: number) => (
                  <div key={i} className="bg-red-500/5 border border-red-500/20 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                      <span className="text-xs font-medium text-red-400">{c.projectName ?? "Projeto"}</span>
                    </div>
                    <p className="text-xs text-foreground">
                      <span className="font-medium">{c.task1?.assigneeName ?? "Membro"}</span>
                      {": "}
                      <span className="text-muted-foreground">"{c.task1?.title}"</span>
                      {" e "}
                      <span className="text-muted-foreground">"{c.task2?.title}"</span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sprint da Semana */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-emerald-400" />
              Sprints da Semana
            </h3>
            {sprintsQ.isLoading ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
            ) : weekSprints.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <Zap className="w-8 h-8 text-muted-foreground/20 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhuma sprint ativa esta semana</p>
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto max-h-52">
                {weekSprints.map((s: any) => {
                  const sprintPct = s.taskCount > 0 ? Math.round((s.completedCount / s.taskCount) * 100) : 0;
                  const endDate = s.endDate ? new Date(s.endDate) : null;
                  const daysLeft = endDate ? Math.ceil((endDate.getTime() - Date.now()) / 86400000) : null;
                  return (
                    <div key={s.id} className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-foreground truncate">{s.name}</span>
                        {daysLeft !== null && (
                          <span className={`text-xs flex-shrink-0 ml-2 ${daysLeft < 2 ? "text-red-400" : "text-muted-foreground"}`}>
                            {daysLeft > 0 ? `${daysLeft}d restantes` : "Encerrada"}
                          </span>
                        )}
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5 mb-1">
                        <div
                          className="bg-emerald-400 h-1.5 rounded-full transition-all"
                          style={{ width: `${sprintPct}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">{sprintPct}% concluído · {s.completedCount}/{s.taskCount} tarefas</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Bottom Row: Recent Tasks + Projects ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Recent Tasks */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              Minhas Tarefas Recentes
            </h3>
            {recentQ.isLoading ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : !recentTasks.length ? (
              <div className="flex flex-col items-center py-8 text-center">
                <CheckCircle2 className="w-8 h-8 text-muted-foreground/20 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhuma tarefa atribuída</p>
              </div>
            ) : (
              <div className="space-y-1.5 overflow-y-auto max-h-64">
                {recentTasks.slice(0, 10).map((t: any) => {
                  const isOverdue = t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "published" && t.status !== "archived";
                  const statusColor = STATUS_COLORS[t.status] ?? STATUS_COLORS.pending;
                  return (
                    <div
                      key={t.id}
                      className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-secondary/40 cursor-pointer transition-colors"
                      onClick={() => navigate(`/tasks/${t.id}`)}
                    >
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: statusColor }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{t.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{t.projectName ?? "Projeto"}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isOverdue && <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
                        <span className="text-xs text-muted-foreground">{STATUS_LABELS[t.status] ?? t.status}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Projects */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-violet-400" />
              Projetos Ativos
            </h3>
            {projectsQ.isLoading ? (
              <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
            ) : !projects.length ? (
              <div className="flex flex-col items-center py-8 text-center">
                <FolderKanban className="w-8 h-8 text-muted-foreground/20 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum projeto ainda</p>
              </div>
            ) : (
              <div className="space-y-2 overflow-y-auto max-h-64">
                {projects.slice(0, 8).map((p: any) => {
                  const tc = p.taskCounts ?? {};
                  const ptotal = (tc.pending ?? 0) + (tc.in_progress ?? 0) + (tc.shared ?? 0) + (tc.published ?? 0) + (tc.archived ?? 0);
                  const pdone = (tc.published ?? 0) + (tc.archived ?? 0);
                  const ppct = pct(pdone, ptotal);
                  return (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/40 cursor-pointer transition-colors"
                      onClick={() => navigate(`/projects/${p.id}`)}
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${p.color ?? "#3b82f6"}20` }}>
                        <FolderKanban className="w-4 h-4" style={{ color: p.color ?? "#3b82f6" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="flex-1 bg-muted rounded-full h-1">
                            <div className="bg-blue-400 h-1 rounded-full" style={{ width: `${ppct}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground">{ppct}%</span>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0">{ptotal} tarefas</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
