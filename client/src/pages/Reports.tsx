import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileDown, BarChart2, Zap, FolderKanban, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

// ─── PDF helpers (re-used from other pages) ───────────────────────────────────

const YELLOW = "#FFBE00";
const BLACK = "#1a1a1a";
const LIGHT_GRAY = "#f8fafc";

function pdfHeader(title: string, subtitle?: string) {
  return `
    <div style="background:${YELLOW};color:${BLACK};padding:28px 36px 20px;border-radius:10px 10px 0 0;border-bottom:3px solid rgba(0,0,0,0.1);">
      <div style="display:flex;align-items:center;gap:16px;">
        <div style="background:#fff;color:${BLACK};font-weight:900;font-size:18px;width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,0.15);">LS</div>
        <div>
          <div style="font-size:20px;font-weight:800;color:${BLACK};">${title}</div>
          ${subtitle ? `<div style="font-size:12px;color:rgba(0,0,0,0.6);margin-top:2px;">${subtitle}</div>` : ""}
        </div>
        <div style="margin-left:auto;text-align:right;font-size:11px;color:rgba(0,0,0,0.55);">
          Gerado em ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
        </div>
      </div>
    </div>`;
}

function pdfFooter() {
  return `
    <div style="margin-top:40px;padding:14px 36px;background:${YELLOW};border-radius:0 0 10px 10px;display:flex;align-items:center;gap:10px;">
      <div style="background:#fff;color:${BLACK};font-weight:900;font-size:13px;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 1px 4px rgba(0,0,0,0.15);">LS</div>
      <span style="font-size:13px;font-weight:700;color:${BLACK};">by LS Solutions</span>
      <span style="margin-left:auto;font-size:11px;color:rgba(0,0,0,0.55);">Relatório gerado automaticamente</span>
    </div>`;
}

function openPrint(html: string, title: string) {
  const w = window.open("", "_blank");
  if (!w) { toast.error("Pop-up bloqueado. Permita pop-ups para exportar."); return; }
  w.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
    <style>
      body{font-family:Inter,sans-serif;margin:0;padding:24px;background:#f0f2f5;}
      table{border-collapse:collapse;width:100%;}
      th,td{padding:8px 12px;text-align:left;border-bottom:1px solid #e2e8f0;font-size:12px;}
      th{background:#f1f5f9;font-weight:600;color:#475569;}
      @media print{body{padding:0;background:#fff;}button{display:none!important;}}
    </style></head><body>
    <div style="max-width:900px;margin:0 auto;">
      ${html}
      <div style="text-align:center;margin-top:20px;">
        <button onclick="window.print()" style="background:${YELLOW};color:${BLACK};border:none;padding:10px 28px;border-radius:6px;cursor:pointer;font-size:14px;font-weight:700;">Imprimir / Salvar PDF</button>
      </div>
    </div></body></html>`);
  w.document.close();
}

// ─── Dashboard Report ─────────────────────────────────────────────────────────
function exportDashboardReport(projects: any[], stats: any, sprints: any[]) {
  const total = projects.reduce((s: number, p: any) => s + (p.taskCounts?.total ?? 0), 0);
  const done = projects.reduce((s: number, p: any) => s + (p.taskCounts?.published ?? 0) + (p.taskCounts?.archived ?? 0), 0);
  const inprog = projects.reduce((s: number, p: any) => s + (p.taskCounts?.inProgress ?? 0), 0);
  const blocked = projects.reduce((s: number, p: any) => s + (p.taskCounts?.blocked ?? 0), 0);
  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

  const kpiRow = (label: string, value: string | number, color = BLACK) =>
    `<div style="background:#f8fafc;border-radius:8px;padding:16px 20px;text-align:center;border:1px solid #e2e8f0;">
      <div style="font-size:28px;font-weight:800;color:${color};">${value}</div>
      <div style="font-size:11px;color:#64748b;margin-top:4px;">${label}</div>
    </div>`;

  const projectRows = projects.map((p: any) => {
    const t = p.taskCounts?.total ?? 0;
    const d = (p.taskCounts?.published ?? 0) + (p.taskCounts?.archived ?? 0);
    const rate = t > 0 ? Math.round((d / t) * 100) : 0;
    return `<tr>
      <td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color ?? BLACK};margin-right:8px;"></span>${p.name}</td>
      <td>${p.status ?? "—"}</td>
      <td>${t}</td>
      <td>${d}</td>
      <td><span style="background:${rate >= 80 ? "#dcfce7" : rate >= 50 ? "#fef9c3" : "#fee2e2"};color:${rate >= 80 ? "#166534" : rate >= 50 ? "#854d0e" : "#991b1b"};padding:2px 8px;border-radius:12px;font-size:11px;">${rate}%</span></td>
    </tr>`;
  }).join("");

  const html = `
    ${pdfHeader("Relatório do Dashboard", "Visão geral de projetos e tarefas")}
    <div style="padding:24px 36px;">
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px;">
        ${kpiRow("Projetos", projects.length)}
        ${kpiRow("Total de Tarefas", total)}
        ${kpiRow("Concluídas", done, "#16a34a")}
        ${kpiRow("Taxa de Conclusão", completionRate + "%", completionRate >= 70 ? "#16a34a" : "#dc2626")}
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:28px;">
        ${kpiRow("Em Andamento", inprog, "#2563eb")}
        ${kpiRow("Bloqueadas", blocked, "#dc2626")}
        ${kpiRow("Sprints Ativas", sprints.filter((s: any) => s.status === "active").length, "#7c3aed")}
      </div>
      <h3 style="font-size:14px;font-weight:600;color:${BLACK};margin-bottom:12px;">Projetos</h3>
      <table>
        <thead><tr><th>Projeto</th><th>Status</th><th>Total</th><th>Concluídas</th><th>Taxa</th></tr></thead>
        <tbody>${projectRows}</tbody>
      </table>
    </div>
    ${pdfFooter()}`;
  openPrint(html, "Relatório do Dashboard");
}

// ─── Sprint Report ─────────────────────────────────────────────────────────────
function exportSprintReport(sprint: any, tasks: any[]) {
  const total = tasks.length;
  const done = tasks.filter((t: any) => t.status === "published" || t.status === "archived").length;
  const inprog = tasks.filter((t: any) => t.status === "in_progress").length;
  const blocked = tasks.filter((t: any) => t.status === "blocked").length;
  const rate = total > 0 ? Math.round((done / total) * 100) : 0;

  const statusLabel: Record<string, string> = {
    pending: "Para Iniciar", in_progress: "Em Andamento", shared: "Compartilhado",
    published: "Publicado", archived: "Arquivado", blocked: "Bloqueado",
  };
  const statusColor: Record<string, string> = {
    pending: "#94a3b8", in_progress: "#3b82f6", shared: "#f59e0b",
    published: "#22c55e", archived: "#6b7280", blocked: "#ef4444",
  };

  const taskRows = tasks.map((t: any) => `
    <tr>
      <td>${t.title}</td>
      <td><span style="background:${statusColor[t.status] ?? "#94a3b8"}22;color:${statusColor[t.status] ?? "#94a3b8"};padding:2px 8px;border-radius:12px;font-size:11px;">${statusLabel[t.status] ?? t.status}</span></td>
      <td>${t.priority ?? "—"}</td>
      <td>${t.assigneeName ?? "—"}</td>
    </tr>`).join("");

  const html = `
    ${pdfHeader(`Sprint: ${sprint.name}`, `${new Date(sprint.startDate).toLocaleDateString("pt-BR")} → ${new Date(sprint.endDate).toLocaleDateString("pt-BR")}`)}
    <div style="padding:24px 36px;">
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:28px;">
        <div style="background:#f8fafc;border-radius:8px;padding:16px;text-align:center;border:1px solid #e2e8f0;">
          <div style="font-size:28px;font-weight:800;color:${BLACK};">${total}</div>
          <div style="font-size:11px;color:#64748b;margin-top:4px;">Total de Tarefas</div>
        </div>
        <div style="background:#f8fafc;border-radius:8px;padding:16px;text-align:center;border:1px solid #e2e8f0;">
          <div style="font-size:28px;font-weight:800;color:#16a34a;">${done}</div>
          <div style="font-size:11px;color:#64748b;margin-top:4px;">Concluídas</div>
        </div>
        <div style="background:#f8fafc;border-radius:8px;padding:16px;text-align:center;border:1px solid #e2e8f0;">
          <div style="font-size:28px;font-weight:800;color:#2563eb;">${inprog}</div>
          <div style="font-size:11px;color:#64748b;margin-top:4px;">Em Andamento</div>
        </div>
        <div style="background:#f8fafc;border-radius:8px;padding:16px;text-align:center;border:1px solid #e2e8f0;">
          <div style="font-size:28px;font-weight:800;color:${rate >= 70 ? "#16a34a" : "#dc2626"};">${rate}%</div>
          <div style="font-size:11px;color:#64748b;margin-top:4px;">Taxa de Conclusão</div>
        </div>
      </div>
      <h3 style="font-size:14px;font-weight:600;color:${BLACK};margin-bottom:12px;">Tarefas da Sprint</h3>
      <table>
        <thead><tr><th>Título</th><th>Status</th><th>Prioridade</th><th>Responsável</th></tr></thead>
        <tbody>${taskRows}</tbody>
      </table>
    </div>
    ${pdfFooter()}`;
  openPrint(html, `Sprint - ${sprint.name}`);
}

// ─── Projects Report ──────────────────────────────────────────────────────────
function exportProjectsReport(projects: any[], clients: any[]) {
  const clientMap = Object.fromEntries((clients ?? []).map((c: any) => [c.id, c.name]));
  const rows = projects.map((p: any) => {
    const t = p.taskCounts?.total ?? 0;
    const d = (p.taskCounts?.published ?? 0) + (p.taskCounts?.archived ?? 0);
    const rate = t > 0 ? Math.round((d / t) * 100) : 0;
    return `<tr>
      <td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color ?? BLACK};margin-right:8px;"></span>${p.name}</td>
      <td>${clientMap[p.clientId] ?? "—"}</td>
      <td>${p.status ?? "—"}</td>
      <td>${t}</td>
      <td>${d}</td>
      <td><span style="background:${rate >= 80 ? "#dcfce7" : rate >= 50 ? "#fef9c3" : "#fee2e2"};color:${rate >= 80 ? "#166534" : rate >= 50 ? "#854d0e" : "#991b1b"};padding:2px 8px;border-radius:12px;font-size:11px;">${rate}%</span></td>
    </tr>`;
  }).join("");

  const html = `
    ${pdfHeader("Relatório de Projetos", `${projects.length} projetos cadastrados`)}
    <div style="padding:24px 36px;">
      <table>
        <thead><tr><th>Projeto</th><th>Cliente</th><th>Status</th><th>Total</th><th>Concluídas</th><th>Taxa</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    ${pdfFooter()}`;
  openPrint(html, "Relatório de Projetos");
}

// ─── Blocked Tasks Report ─────────────────────────────────────────────────────
function exportBlockedReport(blockedTasks: any[]) {
  const priorityLabel: Record<string, string> = { low: "Baixa", medium: "Média", high: "Alta", urgent: "Urgente" };
  const priorityColor: Record<string, string> = { low: "#64748b", medium: "#f59e0b", high: "#ef4444", urgent: "#7c3aed" };

  const rows = blockedTasks.map(t => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-weight:500">${t.title}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#64748b">${t.projectName ?? "—"}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#64748b">${t.assigneeName ?? "Não atribuído"}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:${priorityColor[t.priority] ?? BLACK};font-weight:600">${priorityLabel[t.priority] ?? t.priority}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#ef4444">${t.blockReason ?? "Motivo não informado"}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#94a3b8;font-size:11px">${t.statusChangedAt ? new Date(t.statusChangedAt).toLocaleDateString("pt-BR") : "—"}</td>
    </tr>`).join("");

  const html = `
    ${pdfHeader("Relatório de Tarefas Bloqueadas", "LS Solutions — Orbita")}
    <div style="padding:28px 36px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
        <div style="background:#fee2e2;color:#ef4444;border-radius:8px;padding:12px 20px;font-size:24px;font-weight:800;">${blockedTasks.length}</div>
        <div>
          <div style="font-size:16px;font-weight:700;color:${BLACK}">Tarefas Bloqueadas</div>
          <div style="font-size:12px;color:#64748b">Gerado em ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</div>
        </div>
      </div>
      ${blockedTasks.length === 0
        ? `<div style="text-align:center;padding:40px;color:#64748b;">Nenhuma tarefa bloqueada no momento.</div>`
        : `<table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:8px 12px;text-align:left;font-weight:600;color:#475569;border-bottom:2px solid #e2e8f0">Tarefa</th>
            <th style="padding:8px 12px;text-align:left;font-weight:600;color:#475569;border-bottom:2px solid #e2e8f0">Projeto</th>
            <th style="padding:8px 12px;text-align:left;font-weight:600;color:#475569;border-bottom:2px solid #e2e8f0">Responsável</th>
            <th style="padding:8px 12px;text-align:left;font-weight:600;color:#475569;border-bottom:2px solid #e2e8f0">Prioridade</th>
            <th style="padding:8px 12px;text-align:left;font-weight:600;color:#475569;border-bottom:2px solid #e2e8f0">Motivo do Bloqueio</th>
            <th style="padding:8px 12px;text-align:left;font-weight:600;color:#475569;border-bottom:2px solid #e2e8f0">Bloqueado em</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`}
    </div>
    ${pdfFooter()}`;
  openPrint(html, "Tarefas Bloqueadas — Orbita");
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Reports() {
  const [selectedSprint, setSelectedSprint] = useState("none");
  const [loadingReport, setLoadingReport] = useState<string | null>(null);

  const projectsQ = trpc.projects.list.useQuery();
  const sprintsQ = trpc.sprints.listAll.useQuery();
  const statsQ = trpc.dashboard.stats.useQuery();
  const clientsQ = trpc.clients.list.useQuery();
  const blockedTasksQ = trpc.tasks.listBlocked.useQuery();

  const projects = (projectsQ.data ?? []) as any[];
  const sprints = (sprintsQ.data ?? []) as any[];
  const stats = statsQ.data;
  const clients = (clientsQ.data ?? []) as any[];

  const isLoading = projectsQ.isLoading || sprintsQ.isLoading;

  // Sprint detail query (only when sprint selected) - includes tasks
  const sprintDetailQ = trpc.sprints.get.useQuery(
    { id: Number(selectedSprint) },
    { enabled: selectedSprint !== "none" && !isNaN(Number(selectedSprint)) }
  );

  const selectedSprintObj = useMemo(
    () => sprints.find((s: any) => String(s.id) === selectedSprint),
    [sprints, selectedSprint]
  );

  function handleExport(type: string) {
    setLoadingReport(type);
    try {
      if (type === "dashboard") {
        exportDashboardReport(projects, stats, sprints);
      } else if (type === "projects") {
        exportProjectsReport(projects, clients);
      } else if (type === "sprint") {
        if (!selectedSprintObj) { toast.error("Selecione uma sprint primeiro."); return; }
        const sprintData = sprintDetailQ.data as any;
        const sprintTasks = (sprintData?.tasks ?? []) as any[];
        exportSprintReport(selectedSprintObj, sprintTasks);
      } else if (type === "blocked") {
        exportBlockedReport((blockedTasksQ.data ?? []) as any[]);
      }
    } catch (e) {
      toast.error("Erro ao gerar relatório.");
    } finally {
      setLoadingReport(null);
    }
  }

  const reportCards = [
    {
      id: "dashboard",
      icon: BarChart2,
      title: "Relatório do Dashboard",
      description: "Visão geral de todos os projetos: KPIs, taxa de conclusão, tarefas por status e lista completa de projetos.",
      badge: "Visão Geral",
      badgeColor: "bg-blue-100 text-blue-700",
      extra: null,
    },
    {
      id: "projects",
      icon: FolderKanban,
      title: "Relatório de Projetos",
      description: "Lista detalhada de todos os projetos com cliente vinculado, status, total de tarefas e taxa de conclusão.",
      badge: "Projetos",
      badgeColor: "bg-indigo-100 text-indigo-700",
      extra: null,
    },
    {
      id: "blocked",
      icon: ShieldAlert,
      title: "Tarefas Bloqueadas",
      description: "Lista todas as tarefas com status Bloqueado: motivo do bloqueio, responsável, projeto, prioridade e data de bloqueio.",
      badge: "Impedimentos",
      badgeColor: "bg-red-100 text-red-700",
      extra: blockedTasksQ.data && blockedTasksQ.data.length > 0 ? (
        <div className="mt-2 text-sm text-red-600 font-semibold">{blockedTasksQ.data.length} tarefa{blockedTasksQ.data.length !== 1 ? "s" : ""} bloqueada{blockedTasksQ.data.length !== 1 ? "s" : ""}</div>
      ) : null,
    },
    {
      id: "sprint",
      icon: Zap,
      title: "Relatório de Sprint",
      description: "Relatório completo de uma sprint específica: KPIs, burndown e lista de tarefas com status e responsável.",
      badge: "Sprint",
      badgeColor: "bg-violet-100 text-violet-700",
      extra: (
        <div className="mt-3">
          <Select value={selectedSprint} onValueChange={setSelectedSprint}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Selecionar sprint..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Selecionar sprint...</SelectItem>
              {sprints.map((s: any) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ),
    },
  ];

  return (
    <AppLayout title="Relatórios">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold">Relatórios</h2>
          <p className="text-muted-foreground mt-1">
            Gere e exporte relatórios em PDF para análise e compartilhamento.
          </p>
        </div>

        {/* Report Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {reportCards.map(({ id, icon: Icon, title, description, badge, badgeColor, extra }) => (
            <Card key={id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{title}</CardTitle>
                    </div>
                  </div>
                  <Badge className={`text-xs ${badgeColor} border-0 flex-shrink-0`}>{badge}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col flex-1 gap-4">
                <CardDescription className="text-sm leading-relaxed">
                  {description}
                </CardDescription>
                {extra}
                <div className="mt-auto">
                  <Button
                    className="w-full gap-2"
                    disabled={
                      isLoading ||
                      loadingReport === id ||
                      (id === "sprint" && selectedSprint === "none") ||
                      (id === "sprint" && sprintDetailQ.isLoading && selectedSprint !== "none")
                    }
                    onClick={() => handleExport(id)}
                  >
                    {loadingReport === id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FileDown className="w-4 h-4" />
                    )}
                    Exportar PDF
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Info box */}
        <div className="rounded-xl border border-border bg-muted/40 p-5">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Como funciona:</strong> Ao clicar em "Exportar PDF", uma nova aba será aberta com o relatório formatado. 
            Use o botão "Imprimir / Salvar PDF" na nova aba ou o atalho <kbd className="px-1.5 py-0.5 rounded bg-muted border text-xs">Ctrl+P</kbd> para salvar como PDF.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
