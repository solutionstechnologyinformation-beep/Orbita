import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import { useState, useMemo } from "react";
import jsPDF from "jspdf";
import { toast } from "sonner";
import {
  FolderKanban, CheckCircle2, Clock, ListTodo,
  ArrowRight, TrendingUp, AlertCircle, BarChart2, RefreshCw, Filter, Download,
  Target,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

const PRIORITY_LABELS: Record<string, string> = {
  low: "Baixa", medium: "Média", high: "Alta", urgent: "Urgente",
};
const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-slate-100 text-slate-600 border-slate-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  urgent: "bg-red-50 text-red-700 border-red-200",
};
const STATUS_LABELS: Record<string, string> = {
  pending: "Para Iniciar",
  in_progress: "Em Andamento",
  shared: "Compartilhado",
  published: "Publicado",
  archived: "Arquivado",
};
const STATUS_COLORS: Record<string, string> = {
  pending: "#6366f1",
  in_progress: "#3b82f6",
  shared: "#f59e0b",
  published: "#10b981",
  archived: "#6b7280",
};
const SETORES = ["Geometria","Geoprocessamento","Drenagem","Sinalização","Geotecnia","Hidrologia","Geologia","Orçamento"];

function isOverdue(task: any) {
  return task.dueDate && new Date(task.dueDate) < new Date()
    && task.status !== "published" && task.status !== "archived";
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data: projects = [], isLoading: projectsLoading } = trpc.projects.list.useQuery();

  const [filterProjectId, setFilterProjectId] = useState<number | undefined>(undefined);
  const [filterSetor, setFilterSetor] = useState<string | undefined>(undefined);

  const filterInput = useMemo(() => ({
    projectId: filterProjectId,
    setor: filterSetor,
  }), [filterProjectId, filterSetor]);

  const { data: stats, isLoading: statsLoading } = trpc.dashboard.stats.useQuery(filterInput);
  const { data: activeSprints = [] } = trpc.sprints.listAll.useQuery();
  const { data: recentTasks = [], isLoading: tasksLoading } = trpc.dashboard.recentTasks.useQuery(filterInput);
  const { data: setorStats = [], isLoading: setorLoading } = trpc.dashboard.setorStats.useQuery(
    { projectId: filterProjectId }
  );

  const completionRate = stats && stats.totalTasks > 0
    ? Math.round((stats.completedTasks / stats.totalTasks) * 100)
    : 0;

  const pieData = stats ? [
    { name: "Para Iniciar", value: stats.pendingTasks ?? 0, fill: STATUS_COLORS.pending },
    { name: "Em Andamento", value: stats.inProgressTasks ?? 0, fill: STATUS_COLORS.in_progress },
    { name: "Compartilhado", value: stats.sharedTasks ?? 0, fill: STATUS_COLORS.shared },
    { name: "Publicado", value: stats.publishedTasks ?? 0, fill: STATUS_COLORS.published },
    { name: "Arquivado", value: stats.archivedTasks ?? 0, fill: STATUS_COLORS.archived },
  ].filter(d => d.value > 0) : [];

  const barData = (projects as any[]).slice(0, 6).map((p: any) => {
    const counts = p.taskCounts ?? {};
    return {
      name: p.name.length > 12 ? p.name.slice(0, 12) + "…" : p.name,
      "Para Iniciar": counts.pending ?? 0,
      "Em Andamento": counts.in_progress ?? 0,
      "Compartilhado": counts.shared ?? 0,
      "Publicado": counts.published ?? 0,
      "Arquivado": counts.archived ?? 0,
    };
  });

  const overdueTasks = (recentTasks as any[]).filter(isOverdue);

  // ── Export Dashboard as PDF ──────────────────────────────────────────────
  function exportDashboardToPDF() {
    if (!stats) { toast.error("Aguarde os dados carregarem."); return; }
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 16;
    const maxW = pageW - margin * 2;

    // Header
    doc.setFillColor(30, 45, 90);
    doc.rect(0, 0, pageW, 44, "F");
    doc.setFillColor(100, 160, 255);
    doc.circle(margin + 5, 14, 5, "F");
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.7);
    doc.circle(margin + 5, 14, 3.2, "S");
    doc.setFillColor(255, 255, 255);
    doc.circle(margin + 5, 14, 0.9, "F");
    doc.setLineWidth(0.2);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("ORBITA", margin + 13, 12);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(160, 190, 255);
    doc.text("Plataforma de Gestão de Projetos", margin + 13, 17);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Relatório do Dashboard", margin, 32);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(200, 220, 255);
    const filterLabel = [
      filterProjectId ? (projects as any[]).find((p: any) => p.id === filterProjectId)?.name : null,
      filterSetor ?? null,
    ].filter(Boolean).join(" · ") || "Todos os projetos";
    doc.text(`Filtro: ${filterLabel}  |  Gerado em: ${new Date().toLocaleString("pt-BR")}`, margin, 40);

    let y = 54;

    // KPIs
    const kpis = [
      { label: "Projetos",      value: stats.totalProjects ?? 0 },
      { label: "Total Tarefas", value: stats.totalTasks ?? 0 },
      { label: "Concluídas",    value: stats.completedTasks ?? 0 },
      { label: "Para Iniciar",  value: stats.pendingTasks ?? 0 },
      { label: "Revisões",      value: stats.totalRevisions ?? 0 },
      { label: "Em Atraso",     value: stats.overdueTasks ?? 0 },
    ];
    const kpiW = maxW / kpis.length;
    kpis.forEach((k, i) => {
      const kx = margin + i * kpiW;
      doc.setFillColor(245, 247, 255);
      doc.roundedRect(kx, y, kpiW - 2, 20, 2, 2, "F");
      doc.setTextColor(30, 45, 90);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(String(k.value), kx + kpiW / 2 - 1, y + 10, { align: "center" });
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 110, 140);
      doc.text(k.label, kx + kpiW / 2 - 1, y + 16, { align: "center" });
    });
    y += 26;

    // Completion rate bar
    if (stats.totalTasks > 0) {
      const rate = Math.round((stats.completedTasks / stats.totalTasks) * 100);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 45, 90);
      doc.text(`Taxa de Conclusão: ${rate}%`, margin, y + 5);
      doc.setFillColor(230, 235, 255);
      doc.roundedRect(margin, y + 7, maxW, 5, 2, 2, "F");
      doc.setFillColor(16, 185, 129);
      doc.roundedRect(margin, y + 7, maxW * (rate / 100), 5, 2, 2, "F");
      y += 18;
    }

    // Status distribution
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 45, 90);
    doc.text("Distribuição por Status", margin, y + 5);
    y += 8;
    const statusItems: { label: string; value: number; color: [number,number,number] }[] = ([
      { label: "Para Iniciar",  value: stats.pendingTasks ?? 0,    color: [99, 102, 241] as [number,number,number] },
      { label: "Em Andamento",  value: stats.inProgressTasks ?? 0, color: [59, 130, 246] as [number,number,number] },
      { label: "Compartilhado", value: stats.sharedTasks ?? 0,     color: [245, 158, 11] as [number,number,number] },
      { label: "Publicado",     value: stats.publishedTasks ?? 0,  color: [16, 185, 129] as [number,number,number] },
      { label: "Arquivado",     value: stats.archivedTasks ?? 0,   color: [107, 114, 128] as [number,number,number] },
    ] as { label: string; value: number; color: [number,number,number] }[]).filter(s => s.value > 0);
    const totalStatus = statusItems.reduce((a, s) => a + s.value, 0) || 1;
    let bx = margin;
    statusItems.forEach(s => {
      const bw = (s.value / totalStatus) * maxW;
      doc.setFillColor(...s.color);
      doc.rect(bx, y, bw, 8, "F");
      bx += bw;
    });
    y += 11;
    let lx = margin;
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    statusItems.forEach(s => {
      doc.setFillColor(...s.color);
      doc.rect(lx, y, 3, 3, "F");
      doc.setTextColor(60, 70, 90);
      doc.text(`${s.label} (${s.value})`, lx + 4, y + 2.5);
      lx += 38;
      if (lx > pageW - margin - 38) { lx = margin; y += 6; }
    });
    y += 10;

    // Projects bar chart
    if ((projects as any[]).length > 0) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 45, 90);
      doc.text("Tarefas por Projeto", margin, y + 5);
      y += 10;
      const chartH = 40;
      const projItems = (projects as any[]).slice(0, 8);
      const colW = maxW / projItems.length;
      const maxVal = Math.max(...projItems.map((p: any) => {
        const c = p.taskCounts ?? {};
        return (c.pending ?? 0) + (c.in_progress ?? 0) + (c.shared ?? 0) + (c.published ?? 0) + (c.archived ?? 0);
      }), 1);
      projItems.forEach((p: any, i: number) => {
        const c = p.taskCounts ?? {};
        const segs: { v: number; color: [number,number,number] }[] = [
          { v: c.pending ?? 0,     color: [99, 102, 241] },
          { v: c.in_progress ?? 0, color: [59, 130, 246] },
          { v: c.shared ?? 0,      color: [245, 158, 11] },
          { v: c.published ?? 0,   color: [16, 185, 129] },
          { v: c.archived ?? 0,    color: [107, 114, 128] },
        ];
        const totalSeg = segs.reduce((a, s) => a + s.v, 0);
        const barMaxH = chartH - 8;
        const bw2 = colW - 4;
        const bx2 = margin + i * colW + 2;
        let by = y + chartH - 8;
        segs.forEach(s => {
          if (s.v === 0) return;
          const sh = (s.v / maxVal) * barMaxH;
          by -= sh;
          doc.setFillColor(...s.color);
          doc.rect(bx2, by, bw2, sh, "F");
        });
        doc.setFontSize(5.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(60, 70, 90);
        const shortName = p.name.length > 8 ? p.name.slice(0, 8) + "…" : p.name;
        doc.text(shortName, bx2 + bw2 / 2, y + chartH - 2, { align: "center" });
        if (totalSeg > 0) {
          doc.setFontSize(6);
          doc.setTextColor(30, 45, 90);
          doc.text(String(totalSeg), bx2 + bw2 / 2, y + chartH - 8 - (totalSeg / maxVal) * barMaxH - 1, { align: "center" });
        }
      });
      y += chartH + 6;
    }

    // Setor chart
    if ((setorStats as any[]).length > 0) {
      if (y > pageH - 60) { doc.addPage(); y = 20; }
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 45, 90);
      doc.text("Tarefas por Disciplina/Setor", margin, y + 5);
      y += 10;
      const setorH = 35;
      const sItems = (setorStats as any[]).slice(0, 8);
      const sColW = maxW / sItems.length;
      const sMaxVal = Math.max(...sItems.map((s: any) => s.total ?? 0), 1);
      sItems.forEach((s: any, i: number) => {
        const bw2 = sColW - 4;
        const bx2 = margin + i * sColW + 2;
        const bh = ((s.total ?? 0) / sMaxVal) * (setorH - 8);
        doc.setFillColor(79, 70, 229);
        doc.rect(bx2, y + setorH - 8 - bh, bw2, bh, "F");
        doc.setFontSize(5.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(60, 70, 90);
        const shortS = s.setor.length > 8 ? s.setor.slice(0, 8) + "…" : s.setor;
        doc.text(shortS, bx2 + bw2 / 2, y + setorH - 2, { align: "center" });
        if (s.total > 0) {
          doc.setFontSize(6);
          doc.setTextColor(30, 45, 90);
          doc.text(String(s.total), bx2 + bw2 / 2, y + setorH - 8 - bh - 1, { align: "center" });
        }
      });
      y += setorH + 6;
    }

    // Overdue table
    if (overdueTasks.length > 0) {
      if (y > pageH - 50) { doc.addPage(); y = 20; }
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(185, 28, 28);
      doc.text(`Tarefas em Atraso (${overdueTasks.length})`, margin, y + 5);
      y += 10;
      doc.setFillColor(254, 242, 242);
      doc.rect(margin, y, maxW, 7, "F");
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(120, 30, 30);
      doc.text("Tarefa", margin + 2, y + 4.5);
      doc.text("Projeto", margin + 80, y + 4.5);
      doc.text("Vencimento", margin + 130, y + 4.5);
      y += 8;
      overdueTasks.slice(0, 10).forEach((t: any, i: number) => {
        if (y > pageH - 15) { doc.addPage(); y = 20; }
        if (i % 2 === 0) { doc.setFillColor(255, 250, 250); doc.rect(margin, y - 1, maxW, 7, "F"); }
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(60, 70, 90);
        const title = t.title.length > 40 ? t.title.slice(0, 40) + "…" : t.title;
        doc.text(title, margin + 2, y + 4);
        doc.text(t.projectName ?? "-", margin + 80, y + 4);
        doc.text(t.dueDate ? new Date(t.dueDate).toLocaleDateString("pt-BR") : "-", margin + 130, y + 4);
        y += 7;
      });
    }

    // Footer on all pages
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let pg = 1; pg <= totalPages; pg++) {
      doc.setPage(pg);
      doc.setFillColor(245, 247, 255);
      doc.rect(0, pageH - 10, pageW, 10, "F");
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120, 130, 160);
      doc.text("Orbita — Plataforma de Gestão de Projetos", margin, pageH - 4);
      doc.text(`Página ${pg} de ${totalPages}`, pageW - margin, pageH - 4, { align: "right" });
    }

    doc.save(`orbita-dashboard-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("Dashboard exportado com sucesso!");
  }

  const statCards = [
    { icon: FolderKanban, label: "Projetos", value: stats?.totalProjects ?? 0, color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-100" },
    { icon: ListTodo, label: "Total de Tarefas", value: stats?.totalTasks ?? 0, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" },
    { icon: CheckCircle2, label: "Concluídas", value: stats?.completedTasks ?? 0, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
    { icon: Clock, label: "Para Iniciar", value: stats?.pendingTasks ?? 0, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100" },
    { icon: RefreshCw, label: "Revisões", value: stats?.totalRevisions ?? 0, color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-100" },
    { icon: AlertCircle, label: "Em Atraso", value: stats?.overdueTasks ?? 0, color: "text-red-600", bg: "bg-red-50", border: "border-red-100" },
  ];

  return (
    <AppLayout title="Dashboard">
      <div className="space-y-6">
        {/* Greeting + Filters */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              Olá, {user?.name?.split(" ")[0] ?? "usuário"} 👋
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              Aqui está o resumo dos seus projetos e tarefas.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select
              value={filterProjectId ? String(filterProjectId) : "all"}
              onValueChange={(v) => setFilterProjectId(v === "all" ? undefined : parseInt(v))}
            >
              <SelectTrigger className="w-44 h-9 text-sm">
                <SelectValue placeholder="Todos os projetos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os projetos</SelectItem>
                {(projects as any[]).map((p: any) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filterSetor ?? "all"}
              onValueChange={(v) => setFilterSetor(v === "all" ? undefined : v)}
            >
              <SelectTrigger className="w-44 h-9 text-sm">
                <SelectValue placeholder="Todas as disciplinas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as disciplinas</SelectItem>
                {SETORES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(filterProjectId || filterSetor) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 text-xs text-muted-foreground"
                onClick={() => { setFilterProjectId(undefined); setFilterSetor(undefined); }}
              >
                Limpar filtros
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-2 text-sm border-border"
              onClick={exportDashboardToPDF}
              disabled={statsLoading}
            >
              <Download className="w-4 h-4" />
              Exportar PDF
            </Button>
            <Link href="/projects">
              <Button className="bg-primary hover:bg-primary/90 text-white gap-2 shadow-sm h-9">
                Novo Projeto <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Overdue alert banner */}
        {(stats?.overdueTasks ?? 0) > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>
              <strong>{stats!.overdueTasks}</strong>{" "}
              {stats!.overdueTasks === 1 ? "tarefa está vencida" : "tarefas estão vencidas"}.{" "}
              Acesse o Kanban para atualizar os prazos.
            </span>
          </div>
        )}

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {statsLoading
            ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
            : statCards.map(({ icon: Icon, label, value, color, bg, border }) => (
              <Card key={label} className={`border ${border} shadow-sm`}>
                <CardContent className="p-4">
                  <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mb-2`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                  </div>
                  <p className="text-2xl font-bold text-foreground">{value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                </CardContent>
              </Card>
            ))}
        </div>

        {/* Completion Rate */}
        {!statsLoading && (stats?.totalTasks ?? 0) > 0 && (
          <Card className="border border-border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  Taxa de conclusão geral
                </span>
                <span className="text-sm font-bold text-emerald-600">{completionRate}%</span>
              </div>
              <Progress value={completionRate} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1.5">
                {stats?.completedTasks} de {stats?.totalTasks} tarefas concluídas
              </p>
            </CardContent>
          </Card>
        )}

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Pie */}
          <Card className="border border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-primary" />
                Distribuição de Tarefas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : pieData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
                  Nenhuma tarefa encontrada
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                        {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                      </Pie>
                      <Tooltip formatter={(v: any, name: any) => [`${v} tarefa${v !== 1 ? "s" : ""}`, name]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center mt-2">
                    {pieData.map((d) => (
                      <div key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.fill }} />
                        {d.name} ({d.value})
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Bar by Project */}
          <Card className="border border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Tarefas por Projeto
              </CardTitle>
            </CardHeader>
            <CardContent>
              {projectsLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : barData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
                  Nenhum projeto encontrado
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={barData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="Para Iniciar" stackId="a" fill={STATUS_COLORS.pending} />
                    <Bar dataKey="Em Andamento" stackId="a" fill={STATUS_COLORS.in_progress} />
                    <Bar dataKey="Compartilhado" stackId="a" fill={STATUS_COLORS.shared} />
                    <Bar dataKey="Publicado" stackId="a" fill={STATUS_COLORS.published} />
                    <Bar dataKey="Arquivado" stackId="a" fill={STATUS_COLORS.archived} radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Setor Stats */}
        {!setorLoading && (setorStats as any[]).length > 0 && (
          <Card className="border border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-primary" />
                Desempenho por Disciplina / Setor
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={setorStats as any[]} margin={{ top: 4, right: 4, left: -20, bottom: 44 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="setor" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="pending" name="Para Iniciar" stackId="a" fill={STATUS_COLORS.pending} />
                  <Bar dataKey="in_progress" name="Em Andamento" stackId="a" fill={STATUS_COLORS.in_progress} />
                  <Bar dataKey="shared" name="Compartilhado" stackId="a" fill={STATUS_COLORS.shared} />
                  <Bar dataKey="completed" name="Concluído" stackId="a" fill={STATUS_COLORS.published} radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Overdue Tasks */}
          <Card className="border border-red-100 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-red-700">
                <AlertCircle className="w-4 h-4" />
                Tarefas em Atraso
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {tasksLoading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
              ) : overdueTasks.length === 0 ? (
                <div className="py-6 text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhuma tarefa em atraso!</p>
                </div>
              ) : (
                overdueTasks.slice(0, 5).map((task: any) => (
                  <Link key={task.id} href={`/tasks/${task.id}`}>
                    <div className="flex items-center gap-3 p-3 rounded-lg border border-red-200 bg-red-50/40 hover:bg-red-50 transition-colors cursor-pointer">
                      <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate text-foreground">{task.title}</p>
                        <p className="text-xs text-red-600 mt-0.5">
                          Venceu em {new Date(task.dueDate).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <Badge className={`text-[10px] px-1.5 py-0 h-4 border flex-shrink-0 ${PRIORITY_COLORS[task.priority]}`}>
                        {PRIORITY_LABELS[task.priority]}
                      </Badge>
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          {/* Recent Tasks */}
          <Card className="border border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Tarefas Recentes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {tasksLoading ? (
                Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
              ) : (recentTasks as any[]).filter(t => !isOverdue(t)).length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma tarefa atribuída a você.</p>
              ) : (
                (recentTasks as any[]).filter(t => !isOverdue(t)).slice(0, 5).map((task: any) => (
                  <Link key={task.id} href={`/tasks/${task.id}`}>
                    <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-slate-50 transition-colors cursor-pointer">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_COLORS[task.status] ?? "#6b7280" }} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${task.status === "published" || task.status === "archived" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                          {task.title}
                        </p>
                        <p className="text-xs text-muted-foreground">{STATUS_LABELS[task.status]}</p>
                      </div>
                      <Badge className={`text-[10px] px-1.5 py-0 h-4 border flex-shrink-0 ${PRIORITY_COLORS[task.priority]}`}>
                        {PRIORITY_LABELS[task.priority]}
                      </Badge>
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          {/* Active Projects */}
          <Card className="border border-border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Projetos Ativos</CardTitle>
                <Link href="/projects">
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground gap-1">
                    Ver todos <ArrowRight className="w-3 h-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {projectsLoading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
              ) : (projects as any[]).filter((p: any) => p.status === "active").length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-sm text-muted-foreground mb-3">Nenhum projeto ativo.</p>
                  <Link href="/projects">
                    <Button size="sm" className="bg-primary hover:bg-primary/90 text-white">Criar projeto</Button>
                  </Link>
                </div>
              ) : (
                (projects as any[]).filter((p: any) => p.status === "active").slice(0, 5).map((project: any) => {
                  const counts = project.taskCounts ?? {};
                  const total = (counts.pending ?? 0) + (counts.in_progress ?? 0) + (counts.shared ?? 0) + (counts.published ?? 0) + (counts.archived ?? 0);
                  const done = (counts.published ?? 0) + (counts.archived ?? 0);
                  const rate = total > 0 ? Math.round((done / total) * 100) : 0;
                  return (
                    <Link key={project.id} href={`/projects/${project.id}`}>
                      <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-slate-50 transition-colors cursor-pointer">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{project.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Progress value={rate} className="h-1 flex-1" />
                            <span className="text-[10px] text-muted-foreground flex-shrink-0">{rate}%</span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs font-semibold text-foreground">{total}</p>
                          <p className="text-[10px] text-muted-foreground">tarefas</p>
                        </div>
                      </div>
                    </Link>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* Active Sprints Widget */}
        {activeSprints.filter((s: any) => s.status === "active").length > 0 && (
          <Card className="border border-border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Target className="w-4 h-4 text-indigo-500" />
                  Sprints Ativas
                </CardTitle>
                <Link href="/sprints">
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground gap-1">
                    Ver todas <ArrowRight className="w-3 h-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeSprints.filter((s: any) => s.status === "active").slice(0, 3).map((sprint: any) => {
                  const total = sprint.taskCount ?? 0;
                  const done = sprint.completedCount ?? 0;
                  const rate = total > 0 ? Math.round((done / total) * 100) : 0;
                  const end = new Date(sprint.endDate);
                  const daysLeft = Math.ceil((end.getTime() - Date.now()) / 86400000);
                  return (
                    <Link key={sprint.id} href="/sprints">
                      <div className="p-3 rounded-lg border border-indigo-100 bg-indigo-50/50 hover:bg-indigo-50 transition-colors cursor-pointer">
                        <div className="flex items-start justify-between mb-2">
                          <p className="text-sm font-medium text-gray-900 truncate">{sprint.name}</p>
                          <Badge className="text-xs bg-blue-100 text-blue-700 ml-2 flex-shrink-0">Ativa</Badge>
                        </div>
                        {sprint.goal && (
                          <p className="text-xs text-gray-500 mb-2 line-clamp-1">{sprint.goal}</p>
                        )}
                        <Progress value={rate} className="h-1.5 mb-1" />
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>{done}/{total} tarefas</span>
                          <span className={daysLeft < 0 ? "text-red-500 font-medium" : daysLeft <= 2 ? "text-amber-600" : ""}>
                            {daysLeft < 0 ? `${Math.abs(daysLeft)}d atrasado` : `${daysLeft}d restantes`}
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
