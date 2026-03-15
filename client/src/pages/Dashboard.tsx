import { useMemo, useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { useLocation } from "wouter";
import OnboardingWizard from "@/components/OnboardingWizard";
import {
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  AlertTriangle, CheckCircle2, Clock, TrendingDown, TrendingUp,
  Layers, Briefcase, FolderKanban, CalendarDays, Zap, FileDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

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
// ── Dashboard PDF Export ──────────────────────────────────────────────────────
function exportDashboardPDF(data: {
  stats: any; projects: any[]; sprints: any[]; recentTasks: any[];
  conflicts: any[]; clientCount: number;
  overdueP: number; completedP: number; revisionP: number; onTimeP: number;
}) {
  const { stats, projects, recentTasks, conflicts, clientCount, overdueP, completedP, revisionP, onTimeP } = data;
  const total = stats?.totalTasks ?? 0;
  const now = new Date().toLocaleString("pt-BR");
  const date = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

  const projectRows = projects.slice(0, 10).map(p => {
    const tc = p.taskCounts ?? {};
    const ptotal = (tc.pending ?? 0) + (tc.in_progress ?? 0) + (tc.shared ?? 0) + (tc.published ?? 0) + (tc.archived ?? 0);
    const pdone = (tc.published ?? 0) + (tc.archived ?? 0);
    const ppct = ptotal > 0 ? Math.round((pdone / ptotal) * 100) : 0;
    return `<tr>
      <td style="padding:5px 8px;border:1px solid #e2e8f0">${p.name}</td>
      <td style="padding:5px 8px;border:1px solid #e2e8f0;text-align:center">${ptotal}</td>
      <td style="padding:5px 8px;border:1px solid #e2e8f0;text-align:center">${pdone}</td>
      <td style="padding:5px 8px;border:1px solid #e2e8f0;text-align:center">
          <div style="background:#e2e8f0;border-radius:99px;height:8px;overflow:hidden">
          <div style="background:#1561ad;height:8px;border-radius:99px;width:${ppct}%"></div>
        </div>
        <span style="font-size:10px;color:#64748b">${ppct}%</span>
      </td>
    </tr>`;
  }).join("");

  const taskRows = recentTasks.slice(0, 10).map(t => {
    const color = STATUS_COLORS[t.status] ?? "#94a3b8";
    const label = STATUS_LABELS[t.status] ?? t.status;
    const isOverdue = t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "published" && t.status !== "archived";
    return `<tr>
      <td style="padding:5px 8px;border:1px solid #e2e8f0">${t.title}${isOverdue ? ' <span style="color:#ef4444;font-size:10px">⚠ Atrasada</span>' : ""}</td>
      <td style="padding:5px 8px;border:1px solid #e2e8f0">${t.projectName ?? "—"}</td>
      <td style="padding:5px 8px;border:1px solid #e2e8f0">
        <span style="background:${color}22;color:${color};padding:2px 8px;border-radius:12px;font-size:10px;font-weight:600">${label}</span>
      </td>
    </tr>`;
  }).join("");

  const conflictRows = conflicts.slice(0, 5).map(c => `<tr>
    <td style="padding:5px 8px;border:1px solid #e2e8f0">${c.projectName ?? "—"}</td>
    <td style="padding:5px 8px;border:1px solid #e2e8f0">${c.task1?.assigneeName ?? "Membro"}</td>
    <td style="padding:5px 8px;border:1px solid #e2e8f0">${c.task1?.title ?? ""} / ${c.task2?.title ?? ""}</td>
  </tr>`).join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Relatório Dashboard — Orbita</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; background: #fff; padding: 0; }
    .header { display: flex; align-items: center; justify-content: space-between; background: #1561ad; color: #ffffff; padding: 18px 28px; border-bottom: 3px solid rgba(0,0,0,0.1); }
    .logo { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff; }
    .logo span { color: #ffffff; }
    .subtitle { font-size: 11px; color: rgba(0,0,0,0.55); margin-top: 2px; }
    .content { padding: 28px; }
    h2 { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
    .meta { font-size: 12px; color: #64748b; margin-bottom: 20px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .kpi { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; text-align: center; }
    .kpi-value { font-size: 28px; font-weight: 800; color: #ffffff; }
    .kpi-label { font-size: 11px; color: #64748b; margin-top: 2px; }
    .gauge-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .gauge { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; }
    .gauge-value { font-size: 22px; font-weight: 800; }
    .gauge-label { font-size: 10px; color: #64748b; margin-top: 2px; }
    section { margin-bottom: 24px; }
    h3 { font-size: 14px; font-weight: 700; margin-bottom: 10px; color: #334155; border-left: 3px solid #1dbab4; padding-left: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #f1f5f9; color: #475569; padding: 7px 8px; text-align: left; border: 1px solid #e2e8f0; font-weight: 600; }
    .footer { margin-top: 32px; background: #1561ad; padding: 12px 28px; font-size: 10px; border-radius: 0 0 8px 8px; display: flex; justify-content: space-between; align-items: center; }
    .ls-badge { display: flex; align-items: center; gap: 8px; }
    .ls-icon { width: 32px; height: 32px; background: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 4px rgba(0,0,0,0.15); }
    .ls-icon span { color: #ffffff; font-weight: 900; font-size: 13px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <div style="display:flex;align-items:center;gap:12px;">
      <img src="https://d2xsxph8kpxj0f.cloudfront.net/310419663029542753/78V7RJAjjEpxvD9o6SGFEZ/ls-logo-oficial_dc9dd153.png" style="width:40px;height:40px;border-radius:50%;object-fit:cover;flex-shrink:0;" alt="LS Solutions">
      <div>
        <div class="logo">Orbita</div>
        <div class="subtitle">Sistema de Gerenciamento de Projetos — LS Solutions</div>
      </div>
    </div>
    <div style="text-align:right">
      <div style="font-size:13px;font-weight:700;color:#ffffff">Relatório do Dashboard</div>
      <div style="font-size:11px;color:rgba(0,0,0,0.55)">Gerado em ${now}</div>
    </div>
  </div>
  <div class="content">
    <h2>Acompanhamento dos Projetos</h2>
    <div class="meta">${date}</div>

    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-value">${projects.length}</div><div class="kpi-label">Total de Projetos</div></div>
      <div class="kpi"><div class="kpi-value">${total}</div><div class="kpi-label">Total de Tarefas</div></div>
      <div class="kpi"><div class="kpi-value">${clientCount}</div><div class="kpi-label">Clientes</div></div>
      <div class="kpi"><div class="kpi-value">${stats?.overdueTasks ?? 0}</div><div class="kpi-label">Tarefas em Atraso</div></div>
    </div>

    <div class="gauge-grid">
      <div class="gauge"><div class="gauge-value" style="color:#ef4444">${overdueP}%</div><div class="gauge-label">Em Atraso</div></div>
      <div class="gauge"><div class="gauge-value" style="color:#22c55e">${completedP}%</div><div class="gauge-label">Concluídas</div></div>
      <div class="gauge"><div class="gauge-value" style="color:#f59e0b">${revisionP}%</div><div class="gauge-label">Em Revisão</div></div>
      <div class="gauge"><div class="gauge-value" style="color:#3b82f6">${onTimeP}%</div><div class="gauge-label">Dentro do Prazo</div></div>
    </div>

    ${projects.length > 0 ? `<section>
      <h3>Projetos Ativos (${projects.length})</h3>
      <table>
        <thead><tr><th>Projeto</th><th style="text-align:center">Total</th><th style="text-align:center">Concluídas</th><th>Progresso</th></tr></thead>
        <tbody>${projectRows}</tbody>
      </table>
    </section>` : ""}

    ${recentTasks.length > 0 ? `<section>
      <h3>Minhas Tarefas Recentes</h3>
      <table>
        <thead><tr><th>Tírulo</th><th>Projeto</th><th>Status</th></tr></thead>
        <tbody>${taskRows}</tbody>
      </table>
    </section>` : ""}

    ${conflicts.length > 0 ? `<section>
      <h3>Alertas de Conflito (${conflicts.length})</h3>
      <table>
        <thead><tr><th>Projeto</th><th>Membro</th><th>Tarefas em Conflito</th></tr></thead>
        <tbody>${conflictRows}</tbody>
      </table>
    </section>` : ""}
  </div>

  <div class="footer">
    <div class="ls-badge">
      <img src="https://d2xsxph8kpxj0f.cloudfront.net/310419663029542753/78V7RJAjjEpxvD9o6SGFEZ/ls-logo-oficial_dc9dd153.png" style="width:32px;height:32px;border-radius:50%;object-fit:cover;" alt="LS Solutions">
      <span style="font-size:13px;font-weight:700;color:#ffffff;">by LS Solutions</span>
    </div>
    <span style="color:rgba(0,0,0,0.55);">Gerado em ${now}</span>
  </div>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) { toast.error("Popup bloqueado. Permita popups para exportar o PDF."); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 500);
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const [exportingPdf, setExportingPdf] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const [filterClient, setFilterClient] = useState("all");

  const statsQ = trpc.dashboard.stats.useQuery();
  // conflictsQ removed - dashboard.conflicts not available
  const conflictsQ = { data: [] as any[], isLoading: false };
  const clientCountQ = trpc.dashboard.stats.useQuery();
  const projectsQ = trpc.crs.list.useQuery();
  const sprintsQ = trpc.sprints.listByCrs.useQuery({ crsId: 0 }, { enabled: false });
  const recentQ = trpc.dashboard.weekDeliveries.useQuery();
  const clientsQ = trpc.clients.list.useQuery();

  const stats = statsQ.data;
  const conflicts = conflictsQ.data ?? [];
  const clientCount = statsQ.data?.totalClients ?? 0;
  const allCrs = (projectsQ.data ?? []) as any[];

  // Show onboarding for new users (no projects and hasn't dismissed before)
  useEffect(() => {
    if (!projectsQ.isLoading && allCrs.length === 0) {
      const dismissed = localStorage.getItem("onboarding_dismissed");
      if (!dismissed) setShowOnboarding(true);
    }
  }, [projectsQ.isLoading, allCrs.length]);

  function handleCloseOnboarding() {
    setShowOnboarding(false);
    localStorage.setItem("onboarding_dismissed", "1");
  }
  const clients = (clientsQ.data ?? []) as any[];
  // Filter projects by selected client
  const projects = filterClient === "all"
    ? allCrs
    : allCrs.filter((p: any) => String(p.clientId ?? "") === filterClient);
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
      <OnboardingWizard open={showOnboarding} onClose={handleCloseOnboarding} />
      <div className="space-y-6">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Acompanhamento dos Projetos</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {clients.length > 0 && (
              <Select value={filterClient} onValueChange={setFilterClient}>
                <SelectTrigger className="w-44 h-9 text-sm">
                  <SelectValue placeholder="Todos os clientes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os clientes</SelectItem>
                  {clients.map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={exportingPdf || isLoading}
              onClick={() => {
                setExportingPdf(true);
                try {
                  exportDashboardPDF({ stats, projects, sprints, recentTasks, conflicts, clientCount, overdueP, completedP, revisionP, onTimeP });
                } finally {
                  setExportingPdf(false);
                }
              }}
            >
              <FileDown className="w-4 h-4" />
              Exportar PDF
            </Button>
          </div>
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
