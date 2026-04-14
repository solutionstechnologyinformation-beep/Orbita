import AppLayout from "@/components/AppLayout";
import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Plus, Target, Calendar, CheckCircle2, Trash2, ChevronRight, FileDown, ListChecks, X, User, Search } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const STATUS_COLORS: Record<string, string> = {
  planned: "bg-gray-100 text-gray-700",
  active: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
};
const STATUS_LABELS: Record<string, string> = {
  planned: "Planejado",
  active: "Ativo",
  completed: "Concluído",
};

const TASK_STATUS_LABELS: Record<string, string> = {
  pending: "Para Iniciar",
  in_progress: "Em Andamento",
  shared: "Compartilhado",
  published: "Publicado",
  archived: "Arquivado",
  blocked: "Bloqueado",
};

const TASK_STATUS_COLORS: Record<string, string> = {
  pending: "#94a3b8",
  in_progress: "#3b82f6",
  shared: "#8b5cf6",
  published: "#22c55e",
  archived: "#6b7280",
  blocked: "#ef4444",
};

export default function Sprints() {
  const [filterClientId, setFilterClientId] = useState<number | undefined>(undefined);
  const [crsId, setCrsId] = useState<number | undefined>(undefined);
  const [selectedSprintId, setSelectedSprintId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [checklistSearch, setChecklistSearch] = useState("");
  const [checklistFilterClientId, setChecklistFilterClientId] = useState<number | undefined>(undefined);
  const [checklistFilterCrsId, setChecklistFilterCrsId] = useState<number | undefined>(undefined);
  const [taskSearch, setTaskSearch] = useState("");
  const [form, setForm] = useState({
    name: "",
    goal: "",
    startDate: "",
    endDate: "",
  });

  const burndownChartRef = useRef<HTMLDivElement>(null);

  const clientsQ = trpc.clients.list.useQuery();
  const crsQ = trpc.crs.list.useQuery();
  // Filter contracts by selected client
  const filteredCrs = (crsQ.data ?? []).filter((c: any) =>
    filterClientId ? c.clientId === filterClientId : true
  );
  const sprintsQ = trpc.sprints.listByCrs.useQuery(
    { crsId: crsId! },
    { enabled: !!crsId }
  );
  const sprintDetailQ = trpc.sprints.get.useQuery(
    { id: selectedSprintId! },
    { enabled: !!selectedSprintId }
  );
  const burndownQ = trpc.sprints.get.useQuery(
    { id: selectedSprintId! },
    { enabled: !!selectedSprintId }
  );
  // Checklist items already in this sprint
  const sprintChecklistQ = trpc.sprints.listChecklistItems.useQuery(
    { sprintId: selectedSprintId! },
    { enabled: !!selectedSprintId }
  );
  // All checklist items (filterable by client/contract for adding to sprint)
  const allChecklistQ = trpc.sprints.listAvailableChecklistItems.useQuery(
    { crsId: checklistFilterCrsId, clientId: checklistFilterClientId },
    { enabled: !!selectedSprintId }
  );
  // Filtered contracts for checklist filter
  const checklistFilteredCrs = (crsQ.data ?? []).filter((c: any) =>
    checklistFilterClientId ? c.clientId === checklistFilterClientId : true
  );

  const utils = trpc.useUtils();
  const createMut = trpc.sprints.create.useMutation({
    onSuccess: () => {
      utils.sprints.listByCrs.invalidate();
      setShowCreate(false);
      setForm({ name: "", goal: "", startDate: "", endDate: "" });
      toast.success("Sprint criada com sucesso!");
    },
  });
  const deleteMut = trpc.sprints.delete.useMutation({
    onSuccess: () => {
      utils.sprints.listByCrs.invalidate();
      if (selectedSprintId) setSelectedSprintId(null);
      toast.success("Sprint removida.");
    },
  });
  const updateStatusMut = trpc.sprints.update.useMutation({
    onSuccess: () => {
      utils.sprints.listByCrs.invalidate();
      utils.sprints.get.invalidate();
    },
  });
  const addChecklistItemMut = trpc.sprints.addChecklistItem.useMutation({
    onSuccess: () => {
      utils.sprints.listChecklistItems.invalidate();
      toast.success("Item adicionado à sprint!");
    },
    onError: (e) => toast.error(e.message),
  });
  const removeChecklistItemMut = trpc.sprints.removeChecklistItem.useMutation({
    onSuccess: () => {
      utils.sprints.listChecklistItems.invalidate();
      toast.success("Item removido da sprint.");
    },
    onError: (e) => toast.error(e.message),
  });
  const addTaskMut = trpc.sprints.addTask.useMutation({
    onSuccess: () => {
      utils.sprints.get.invalidate();
      toast.success("Tarefa adicionada à sprint!");
    },
    onError: (e) => toast.error(e.message),
  });
  const removeTaskMut = trpc.sprints.removeTask.useMutation({
    onSuccess: () => {
      utils.sprints.get.invalidate();
      toast.success("Tarefa removida da sprint.");
    },
    onError: (e) => toast.error(e.message),
  });
  // Tasks from the selected CRS for adding to sprint
  const crsTasksQ = trpc.tasks.listByCrs.useQuery(
    { crsId: crsId! },
    { enabled: !!crsId && !!selectedSprintId }
  );

  const sprints = sprintsQ.data ?? [];
  const selectedSprint = sprintDetailQ.data;
  const burndown = burndownQ.data;
  const sprintChecklistItems = sprintChecklistQ.data ?? [];
  const allChecklistItems = allChecklistQ.data ?? [];
  // IDs already in sprint for quick lookup
  const inSprintIds = new Set(sprintChecklistItems.map((i: any) => i.checklistItemId));
  // Filter available items not yet in sprint, matching search
  const availableItems = allChecklistItems.filter((i: any) => {
    if (inSprintIds.has(i.id)) return false;
    if (!checklistSearch.trim()) return true;
    const q = checklistSearch.toLowerCase();
    return (
      i.title?.toLowerCase().includes(q) ||
      i.taskTitle?.toLowerCase().includes(q) ||
      i.taskSetor?.toLowerCase().includes(q) ||
      i.crsName?.toLowerCase().includes(q) ||
      i.clientName?.toLowerCase().includes(q)
    );
  });

  function handleCreate() {
    if (!crsId || !form.name || !form.startDate || !form.endDate) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }
    createMut.mutate({
      crsId: crsId!,
      name: form.name,
      goal: form.goal || undefined,
      startDate: new Date(new Date(form.startDate).getTime()),
      endDate: new Date(new Date(form.endDate).getTime()),
    });
  }

  function sprintProgress(sprint: typeof sprints[0]) {
    if (sprint.status === "completed") return 100;
    if (sprint.status === "active") return 50;
    return 0;
  }

  async function exportPdf() {
    if (!selectedSprint) return;
    setExportingPdf(true);
    try {
      const tasks = selectedSprint.tasks ?? [];
      const total = tasks.length;
      const completed = tasks.filter((t: any) => t.phaseIsTerminal).length;
      const inProgress = tasks.filter((t: any) => !t.phaseIsTerminal && t.phaseName !== "Para Iniciar" && t.phaseName !== "Bloqueado").length;
      const blocked = tasks.filter((t: any) => t.phaseName === "Bloqueado").length;
      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

      const crsName = crsQ.data?.find((p: any) => p.id === crsId)?.name ?? "—";
      const startDate = new Date(selectedSprint.startDate).toLocaleDateString("pt-BR");
      const endDate = new Date(selectedSprint.endDate).toLocaleDateString("pt-BR");
      const now = new Date().toLocaleString("pt-BR");

      // Build burndown table rows
      const burndownRows = burndown?.dataPoints?.map((pt: any) => {
        const dateStr = typeof pt.date === 'string' ? pt.date : new Date(pt.date).toISOString().slice(0, 10);
        const [y, m, d] = dateStr.split("-");
        return `<tr>
          <td style="padding:4px 8px;border:1px solid #e2e8f0">${d}/${m}/${y}</td>
          <td style="padding:4px 8px;border:1px solid #e2e8f0;text-align:center">${pt.remaining}</td>
          <td style="padding:4px 8px;border:1px solid #e2e8f0;text-align:center">${pt.ideal?.toFixed(1) ?? "—"}</td>
        </tr>`;
      }).join("") ?? "";

      // Build task rows grouped by status
      const taskRows = tasks.map((t: any) => {
        const color = t.phaseColor ?? "#94a3b8";
        const label = t.phaseName ?? "—";
        return `<tr>
          <td style="padding:5px 8px;border:1px solid #e2e8f0">${t.title}</td>
          <td style="padding:5px 8px;border:1px solid #e2e8f0">
            <span style="background:${color}22;color:${color};padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600">${label}</span>
          </td>
          <td style="padding:5px 8px;border:1px solid #e2e8f0;font-size:11px;color:#64748b">${t.setor ?? "—"}</td>
        </tr>`;
      }).join("");

      const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Relatório Sprint — ${selectedSprint.name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; background: #fff; padding: 32px; }
    .header { display: flex; align-items: center; justify-content: space-between; background: #1561ad; color: #ffffff; padding: 16px 24px; border-radius: 8px 8px 0 0; margin-bottom: 24px; border-bottom: 3px solid rgba(0,0,0,0.1); }
    .logo { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff; }
    .logo span { color: #ffffff; }
    .subtitle { font-size: 11px; color: rgba(0,0,0,0.55); margin-top: 2px; }
    h2 { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
    .meta { font-size: 12px; color: #64748b; margin-bottom: 20px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .kpi { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; text-align: center; }
    .kpi-value { font-size: 28px; font-weight: 800; }
    .kpi-label { font-size: 11px; color: #64748b; margin-top: 2px; }
    .kpi-completed .kpi-value { color: #22c55e; }
    .kpi-progress .kpi-value { color: #3b82f6; }
    .kpi-blocked .kpi-value { color: #ef4444; }
    .kpi-rate .kpi-value { color: #1dbab4; }
    .progress-bar { background: #e2e8f0; border-radius: 99px; height: 10px; margin: 8px 0 20px; overflow: hidden; }
    .progress-fill { height: 100%; border-radius: 99px; background: linear-gradient(90deg, #1561ad, #1dbab4); }
    section { margin-bottom: 24px; }
    h3 { font-size: 14px; font-weight: 700; margin-bottom: 10px; color: #334155; border-left: 3px solid #1dbab4; padding-left: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #f1f5f9; padding: 6px 8px; text-align: left; border: 1px solid #e2e8f0; font-weight: 600; color: #475569; }
    .footer { margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div style="display:flex;align-items:center;gap:12px;">
      <div>
        <div class="logo">Orbita</div>
        <div class="subtitle">Sistema de Gerenciamento de Projetos</div>
      </div>
    </div>
    <div style="text-align:right">
      <div style="font-size:13px;font-weight:700;color:#ffffff">Relatório de Sprint</div>
      <div style="font-size:11px;color:rgba(0,0,0,0.55)">Gerado em ${now}</div>
    </div>
  </div>

  <h2>${selectedSprint.name}</h2>
  <div class="meta">
    Contrato: <strong>${crsName}</strong> &nbsp;|&nbsp;
    Período: <strong>${startDate} – ${endDate}</strong> &nbsp;|&nbsp;
    Status: <strong>${STATUS_LABELS[selectedSprint.status] ?? selectedSprint.status}</strong>
  </div>

  ${selectedSprint.goal ? `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin-bottom:20px;font-size:12px"><strong>Meta da Sprint:</strong> ${selectedSprint.goal}</div>` : ""}

  <div class="kpi-grid">
    <div class="kpi">
      <div class="kpi-value">${total}</div>
      <div class="kpi-label">Total de Tarefas</div>
    </div>
    <div class="kpi kpi-completed">
      <div class="kpi-value">${completed}</div>
      <div class="kpi-label">Concluídas</div>
    </div>
    <div class="kpi kpi-progress">
      <div class="kpi-value">${inProgress}</div>
      <div class="kpi-label">Em Andamento</div>
    </div>
    <div class="kpi kpi-rate">
      <div class="kpi-value">${completionRate}%</div>
      <div class="kpi-label">Taxa de Conclusão</div>
    </div>
  </div>

  <div class="progress-bar">
    <div class="progress-fill" style="width:${completionRate}%"></div>
  </div>

  <section>
    <h3>Tarefas da Sprint (${total})</h3>
    ${tasks.length === 0
      ? '<p style="font-size:12px;color:#94a3b8;font-style:italic">Nenhuma tarefa nesta sprint.</p>'
      : `<table>
          <thead><tr>
            <th>Título</th>
            <th>Status</th>
            <th>Setor</th>
          </tr></thead>
          <tbody>${taskRows}</tbody>
        </table>`
    }
  </section>

  ${burndown?.dataPoints?.length > 0 ? (() => {
        const pts = burndown.dataPoints;
        const maxY = Math.max(...pts.map((p: any) => Math.max(p.remaining ?? 0, p.ideal ?? 0)), 1);
        const svgW = 680; const svgH = 220;
        const padL = 40; const padR = 20; const padT = 20; const padB = 40;
        const chartW = svgW - padL - padR;
        const chartH = svgH - padT - padB;
        const n = pts.length;
        const xStep = n > 1 ? chartW / (n - 1) : chartW;
        const yScale = (v: number) => chartH - (v / maxY) * chartH;
        const remainingPath = pts.map((p: any, i: number) => `${i === 0 ? 'M' : 'L'}${padL + i * xStep},${padT + yScale(p.remaining ?? 0)}`).join(' ');
        const idealPath = pts.map((p: any, i: number) => `${i === 0 ? 'M' : 'L'}${padL + i * xStep},${padT + yScale(p.ideal ?? 0)}`).join(' ');
        const xLabels = pts.filter((_: any, i: number) => n <= 14 || i % Math.ceil(n / 10) === 0).map((p: any, _: number, arr: any[]) => {
          const origIdx = pts.indexOf(p);
          const dateStr2 = typeof p.date === 'string' ? p.date : new Date(p.date).toISOString().slice(0, 10);
          const [y2, m2, d2] = dateStr2.split('-');
          return `<text x="${padL + origIdx * xStep}" y="${svgH - 8}" text-anchor="middle" font-size="9" fill="#64748b">${d2}/${m2}</text>`;
        }).join('');
        const yLabels = [0, 0.25, 0.5, 0.75, 1].map(f => {
          const v = Math.round(maxY * f);
          return `<text x="${padL - 6}" y="${padT + yScale(v) + 4}" text-anchor="end" font-size="9" fill="#64748b">${v}</text><line x1="${padL}" y1="${padT + yScale(v)}" x2="${padL + chartW}" y2="${padT + yScale(v)}" stroke="#f0f0f0" stroke-width="1"/>`;
        }).join('');
        return `<section>
    <h3>Burndown Chart</h3>
    <svg width="${svgW}" height="${svgH}" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto">
      ${yLabels}
      <path d="${idealPath}" fill="none" stroke="#94a3b8" stroke-width="2" stroke-dasharray="6,4"/>
      <path d="${remainingPath}" fill="none" stroke="#6366f1" stroke-width="2.5"/>
      ${pts.map((p: any, i: number) => `<circle cx="${padL + i * xStep}" cy="${padT + yScale(p.remaining ?? 0)}" r="3" fill="#6366f1"/>`).join('')}
      ${xLabels}
      <text x="${padL + chartW / 2}" y="${svgH}" text-anchor="middle" font-size="10" fill="#94a3b8">Data</text>
      <text x="14" y="${padT + chartH / 2}" text-anchor="middle" font-size="10" fill="#94a3b8" transform="rotate(-90 14 ${padT + chartH / 2})">Tarefas</text>
      <rect x="${padL + chartW - 160}" y="${padT}" width="155" height="38" fill="white" stroke="#e2e8f0" rx="4"/>
      <line x1="${padL + chartW - 152}" y1="${padT + 12}" x2="${padL + chartW - 132}" y2="${padT + 12}" stroke="#6366f1" stroke-width="2.5"/>
      <text x="${padL + chartW - 126}" y="${padT + 16}" font-size="10" fill="#1e293b">Tarefas Restantes</text>
      <line x1="${padL + chartW - 152}" y1="${padT + 28}" x2="${padL + chartW - 132}" y2="${padT + 28}" stroke="#94a3b8" stroke-width="2" stroke-dasharray="6,4"/>
      <text x="${padL + chartW - 126}" y="${padT + 32}" font-size="10" fill="#1e293b">Linha Ideal</text>
    </svg>
  </section>`;
      })() : ''}

  <div style="margin-top:32px;padding:12px 24px;background:#1561ad;border-radius:0 0 8px 8px;display:flex;align-items:center;gap:10px;">
    <span style="font-size:13px;font-weight:700;color:#ffffff;">Orbita</span>
    <span style="margin-left:auto;font-size:11px;color:rgba(0,0,0,0.55);">Sprint: ${selectedSprint.name} | ${startDate} – ${endDate}</span>
  </div>
</body>
</html>`;

      // Open print dialog
      const win = window.open("", "_blank");
      if (!win) {
        toast.error("Popup bloqueado. Permita popups para exportar o PDF.");
        return;
      }
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => {
        win.print();
      }, 500);
    } catch (err) {
      toast.error("Erro ao gerar PDF.");
      console.error(err);
    } finally {
      setExportingPdf(false);
    }
  }

  return (
    <AppLayout title="Sprints">
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sprints</h1>
          <p className="text-gray-500 text-sm mt-1">Gerencie ciclos semanais de trabalho com metas e tarefas</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Filtro: Cliente */}
          <Select
            value={filterClientId?.toString() ?? "all"}
            onValueChange={v => {
              const id = (v && v !== "all") ? Number(v) : undefined;
              setFilterClientId(id);
              setCrsId(undefined);
              setSelectedSprintId(null);
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Todos os clientes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os clientes</SelectItem>
              {(clientsQ.data ?? []).map((c: any) => (
                <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Filtro: Contrato */}
          <Select
            value={crsId?.toString() ?? ""}
            onValueChange={v => { setCrsId(Number(v)); setSelectedSprintId(null); }}
          >
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Selecione um Contrato" />
            </SelectTrigger>
            <SelectContent>
              {filteredCrs.length === 0 ? (
                <SelectItem value="none" disabled>Nenhum Contrato encontrado</SelectItem>
              ) : (
                filteredCrs.map((p: any) => (
                  <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {crsId && (
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-1" /> Nova Sprint
            </Button>
          )}
        </div>
      </div>

      {!crsId ? (
        <Card>
          <CardContent className="py-16 text-center text-gray-400">
            <Target className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Selecione um Contrato para ver as sprints.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sprint list */}
          <div className="lg:col-span-1 space-y-3">
            {sprintsQ.isLoading ? (
              <div className="text-center py-8 text-gray-400">Carregando...</div>
            ) : sprints.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-gray-400">
                  <Target className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhuma sprint criada.</p>
                </CardContent>
              </Card>
            ) : (
              sprints.map((sprint: any) => (
                <Card
                  key={sprint.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${selectedSprintId === sprint.id ? "ring-2 ring-indigo-500" : ""}`}
                  onClick={() => setSelectedSprintId(sprint.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-sm">{sprint.name}</h3>
                      <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    </div>
                    {sprint.goal && (
                      <p className="text-xs text-gray-500 mb-2 line-clamp-2">{sprint.goal}</p>
                    )}
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={`text-xs ${STATUS_COLORS[sprint.status]}`}>
                        {STATUS_LABELS[sprint.status]}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Calendar className="h-3 w-3" />
                      <span>
                        {new Date(sprint.startDate).toLocaleDateString("pt-BR")} –{" "}
                        {new Date(sprint.endDate).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    <Progress value={sprintProgress(sprint)} className="mt-2 h-1.5" />
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Sprint detail */}
          <div className="lg:col-span-2 space-y-4" ref={burndownChartRef}>
            {!selectedSprintId ? (
              <Card>
                <CardContent className="py-16 text-center text-gray-400">
                  <p>Selecione uma sprint para ver os detalhes.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {selectedSprint && (
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{selectedSprint.name}</CardTitle>
                          {selectedSprint.goal && (
                            <p className="text-sm text-gray-500 mt-1">{selectedSprint.goal}</p>
                          )}
                        </div>
                        <div className="flex gap-2 flex-wrap justify-end">
                          {selectedSprint.status === "planned" && (
                            <Button
                              size="sm"
                              onClick={() => updateStatusMut.mutate({ id: selectedSprint.id, status: "active" })}
                            >
                              Iniciar Sprint
                            </Button>
                          )}
                          {selectedSprint.status === "active" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateStatusMut.mutate({ id: selectedSprint.id, status: "completed" })}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" /> Concluir
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                            onClick={exportPdf}
                            disabled={exportingPdf}
                          >
                            <FileDown className="h-4 w-4" />
                            {exportingPdf ? "Gerando..." : "Exportar PDF"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => deleteMut.mutate({ id: selectedSprint.id })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {/* KPI row */}
                      <div className="grid grid-cols-4 gap-3 text-center mb-4">
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-2xl font-bold text-gray-900">{selectedSprint.tasks?.length ?? 0}</p>
                          <p className="text-xs text-gray-500">Tarefas</p>
                        </div>
                        <div className="bg-green-50 rounded-lg p-3">
                          <p className="text-2xl font-bold text-green-700">
                            {selectedSprint.tasks?.filter((t: any) => t.phaseIsTerminal).length ?? 0}
                          </p>
                          <p className="text-xs text-gray-500">Concluídas</p>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-3">
                          <p className="text-2xl font-bold text-blue-700">
                            {sprintChecklistItems.length}
                          </p>
                          <p className="text-xs text-gray-500">Itens Checklist</p>
                        </div>
                        <div className="bg-amber-50 rounded-lg p-3">
                          <p className="text-2xl font-bold text-amber-600">
                            {(() => {
                              const total = selectedSprint.tasks?.length ?? 0;
                              const done = selectedSprint.tasks?.filter((t: any) => t.phaseIsTerminal).length ?? 0;
                              return total > 0 ? `${Math.round((done / total) * 100)}%` : "0%";
                            })()}
                          </p>
                          <p className="text-xs text-gray-500">Conclusão</p>
                        </div>
                      </div>

                      {/* Tabs: Tarefas | Checklist */}
                      <Tabs defaultValue="tasks">
                        <TabsList className="mb-3">
                          <TabsTrigger value="tasks">Tarefas ({selectedSprint.tasks?.length ?? 0})</TabsTrigger>
                          <TabsTrigger value="checklist">
                            <ListChecks className="h-3.5 w-3.5 mr-1" />
                            Checklist ({sprintChecklistItems.length})
                          </TabsTrigger>
                        </TabsList>

                        {/* Tab: Tarefas */}
                        <TabsContent value="tasks">
                          <div className="space-y-3">
                            {/* Tasks already in sprint */}
                            {(selectedSprint.tasks ?? []).length === 0 ? (
                              <p className="text-sm text-gray-400 text-center py-4">Nenhuma tarefa nesta sprint.</p>
                            ) : (
                              <div className="space-y-2">
                                {(selectedSprint.tasks ?? []).map((task: any) => (
                                  <div key={task.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                                    <div
                                      className="w-2 h-2 rounded-full flex-shrink-0"
                                      style={{ backgroundColor: task.phaseColor ?? "#94a3b8" }}
                                    />
                                    <span className="text-sm flex-1 truncate">{task.title}</span>
                                    <Badge variant="outline" className="text-xs">{task.setor ?? "—"}</Badge>
                                    <Badge
                                      className="text-xs"
                                      style={{
                                        backgroundColor: `${task.phaseColor ?? "#94a3b8"}22`,
                                        color: task.phaseColor ?? "#94a3b8",
                                        border: `1px solid ${task.phaseColor ?? "#94a3b8"}44`,
                                      }}
                                    >
                                      {task.phaseName ?? "—"}
                                    </Badge>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6 text-red-400 hover:text-red-600 shrink-0"
                                      onClick={() => removeTaskMut.mutate({ sprintId: selectedSprint.id, taskId: task.id })}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                            {/* Add tasks section */}
                            <div className="border-t pt-3">
                              <p className="text-xs font-medium text-gray-600 mb-2">Adicionar tarefas do contrato</p>
                              <div className="relative mb-2">
                                <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-gray-400" />
                                <input
                                  className="w-full pl-7 pr-2 py-1 text-xs border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300"
                                  placeholder="Buscar tarefa..."
                                  value={taskSearch}
                                  onChange={e => setTaskSearch(e.target.value)}
                                />
                              </div>
                              {crsTasksQ.isLoading ? (
                                <p className="text-xs text-gray-400 text-center py-2">Carregando...</p>
                              ) : (() => {
                                const inSprintTaskIds = new Set((selectedSprint.tasks ?? []).map((t: any) => t.id));
                                const available = (crsTasksQ.data ?? []).filter((t: any) => {
                                  if (inSprintTaskIds.has(t.id)) return false;
                                  if (!taskSearch.trim()) return true;
                                  const q = taskSearch.toLowerCase();
                                  return t.title?.toLowerCase().includes(q) || t.setor?.toLowerCase().includes(q);
                                });
                                if (available.length === 0) return <p className="text-xs text-gray-400 text-center py-2">Todas as tarefas já estão na sprint.</p>;
                                return (
                                  <div className="space-y-1 max-h-48 overflow-y-auto">
                                    {available.map((t: any) => (
                                      <div key={t.id} className="flex items-center gap-2 p-1.5 hover:bg-gray-50 rounded cursor-pointer group">
                                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: t.phaseColor ?? "#94a3b8" }} />
                                        <span className="text-xs flex-1 truncate">{t.title}</span>
                                        <Badge variant="outline" className="text-xs shrink-0">{t.setor ?? "—"}</Badge>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-6 w-6 text-green-500 hover:text-green-700 shrink-0 opacity-0 group-hover:opacity-100"
                                          onClick={() => addTaskMut.mutate({ sprintId: selectedSprint.id, taskId: t.id })}
                                        >
                                          <Plus className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        </TabsContent>

                        {/* Tab: Checklist Items */}
                        <TabsContent value="checklist">
                          <div className="space-y-3">
                            {/* Items already in sprint */}
                            {sprintChecklistItems.length === 0 ? (
                              <p className="text-sm text-gray-400 text-center py-2">Nenhum item de checklist nesta sprint.</p>
                            ) : (
                              <div className="space-y-1.5">
                                {sprintChecklistItems.map((item: any) => (
                                  <div key={item.id} className="flex items-start gap-2 p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold truncate">{item.title}</p>
                                      {/* Origin info: client > contract > discipline > task */}
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {item.clientName && (
                                          <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{item.clientName}</span>
                                        )}
                                        {item.crsName && (
                                          <span className="text-xs bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">
                                            {item.crsCode ? `${item.crsCode} — ` : ""}{item.crsName}
                                          </span>
                                        )}
                                        {item.taskSetor && (
                                          <span className="text-xs bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded">{item.taskSetor}</span>
                                        )}
                                        {item.taskTitle && (
                                          <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded truncate max-w-[160px]">{item.taskTitle}</span>
                                        )}
                                      </div>
                                      {item.assigneeName && (
                                        <span className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                                          <User className="h-3 w-3" />{item.assigneeName}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <Badge variant="outline" className="text-xs">{TASK_STATUS_LABELS[item.status] ?? item.status}</Badge>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 text-red-400 hover:text-red-600"
                                        onClick={() => removeChecklistItemMut.mutate({ sprintId: selectedSprint.id, checklistItemId: item.checklistItemId })}
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Add items section */}
                            <div className="border-t pt-3">
                              <p className="text-xs font-medium text-gray-600 mb-2">Adicionar itens de checklist</p>
                              {/* Cascade filters: Client → Contract */}
                              <div className="grid grid-cols-2 gap-2 mb-2">
                                <Select
                                  value={checklistFilterClientId?.toString() ?? "all"}
                                  onValueChange={v => {
                                    const id = v === "all" ? undefined : Number(v);
                                    setChecklistFilterClientId(id);
                                    setChecklistFilterCrsId(undefined);
                                  }}
                                >
                                  <SelectTrigger className="h-7 text-xs">
                                    <SelectValue placeholder="Todos os clientes" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="all">Todos os clientes</SelectItem>
                                    {(clientsQ.data ?? []).map((c: any) => (
                                      <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Select
                                  value={checklistFilterCrsId?.toString() ?? "all"}
                                  onValueChange={v => setChecklistFilterCrsId(v === "all" ? undefined : Number(v))}
                                >
                                  <SelectTrigger className="h-7 text-xs">
                                    <SelectValue placeholder="Todos os contratos" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="all">Todos os contratos</SelectItem>
                                    {checklistFilteredCrs.map((c: any) => (
                                      <SelectItem key={c.id} value={c.id.toString()}>
                                        {c.code ? `${c.code} — ` : ""}{c.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="relative mb-2">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                                <input
                                  type="text"
                                  placeholder="Buscar por título, disciplina, contrato..."
                                  className="w-full pl-7 pr-3 h-8 text-xs border border-border rounded-md bg-background"
                                  value={checklistSearch}
                                  onChange={e => setChecklistSearch(e.target.value)}
                                />
                              </div>
                              {allChecklistQ.isLoading ? (
                                <p className="text-xs text-gray-400 text-center py-2">Carregando itens...</p>
                              ) : availableItems.length === 0 ? (
                                <p className="text-xs text-gray-400 text-center py-2">
                                  {allChecklistItems.length === 0 ? "Nenhum item de checklist encontrado." : "Todos os itens já estão na sprint."}
                                </p>
                              ) : (
                                <div className="space-y-1 max-h-52 overflow-y-auto">
                                  {availableItems.map((item: any) => (
                                    <div key={item.id} className="flex items-start gap-2 p-1.5 hover:bg-gray-50 rounded group">
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium truncate">{item.title}</p>
                                        <div className="flex flex-wrap gap-1 mt-0.5">
                                          {item.clientName && (
                                            <span className="text-xs text-blue-600">{item.clientName}</span>
                                          )}
                                          {item.crsName && (
                                            <span className="text-xs text-gray-400">• {item.crsCode ? `${item.crsCode} ` : ""}{item.crsName}</span>
                                          )}
                                          {item.taskSetor && (
                                            <span className="text-xs text-purple-500">• {item.taskSetor}</span>
                                          )}
                                        </div>
                                        <p className="text-xs text-gray-400 truncate">{item.taskTitle}</p>
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-6 text-xs px-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => addChecklistItemMut.mutate({ sprintId: selectedSprint.id, checklistItemId: item.id })}
                                        disabled={addChecklistItemMut.isPending}
                                      >
                                        <Plus className="h-3 w-3 mr-0.5" /> Adicionar
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  </Card>
                )}

                {/* Burndown Chart */}
                {burndown && burndown.dataPoints.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Burndown Chart</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={burndown.dataPoints}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => {
                            const dStr = typeof d === 'string' ? d : new Date(d).toISOString().slice(0, 10);
        const parts = dStr.split("-");
                            return `${parts[2]}/${parts[1]}`;
                          }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip
                            formatter={(val: number, name: string) => [val, name === "remaining" ? "Restantes" : "Ideal"]}
                            labelFormatter={l => `Data: ${l}`}
                          />
                          <Legend formatter={v => v === "remaining" ? "Tarefas Restantes" : "Linha Ideal"} />
                          <Line type="monotone" dataKey="remaining" stroke="#6366f1" strokeWidth={2} dot={false} name="remaining" />
                          <Line type="monotone" dataKey="ideal" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={false} name="ideal" />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Create Sprint Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Sprint</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome da Sprint *</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Sprint 1 — Semana 08/02"
              />
            </div>
            <div>
              <Label>Meta da Sprint</Label>
              <Textarea
                value={form.goal}
                onChange={e => setForm(f => ({ ...f, goal: e.target.value }))}
                placeholder="Descreva o objetivo desta sprint..."
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data de Início *</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div>
                <Label>Data de Fim *</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createMut.isPending}>
              {createMut.isPending ? "Criando..." : "Criar Sprint"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </AppLayout>
  );
}
