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
import { Plus, Target, Calendar, CheckCircle2, Trash2, ChevronRight, FileDown } from "lucide-react";
import { toast } from "sonner";

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
  const [crsId, setCrsId] = useState<number | undefined>(undefined);
  const [selectedSprintId, setSelectedSprintId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [form, setForm] = useState({
    name: "",
    goal: "",
    startDate: "",
    endDate: "",
  });

  const burndownChartRef = useRef<HTMLDivElement>(null);

  const crsQ = trpc.crs.list.useQuery();
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

  const sprints = sprintsQ.data ?? [];
  const selectedSprint = sprintDetailQ.data;
  const burndown = burndownQ.data;

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
      const completed = tasks.filter((t: any) => t.status === "published" || t.status === "archived").length;
      const inProgress = tasks.filter((t: any) => t.status === "in_progress").length;
      const blocked = tasks.filter((t: any) => t.status === "blocked").length;
      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

      const crsName = crsQ.data?.find((p: any) => p.id === crsId)?.name ?? "—";
      const startDate = new Date(selectedSprint.startDate).toLocaleDateString("pt-BR");
      const endDate = new Date(selectedSprint.endDate).toLocaleDateString("pt-BR");
      const now = new Date().toLocaleString("pt-BR");

      // Build burndown table rows
      const burndownRows = burndown?.dataPoints?.map((pt: any) => {
        const [y, m, d] = pt.date.split("-");
        return `<tr>
          <td style="padding:4px 8px;border:1px solid #e2e8f0">${d}/${m}/${y}</td>
          <td style="padding:4px 8px;border:1px solid #e2e8f0;text-align:center">${pt.remaining}</td>
          <td style="padding:4px 8px;border:1px solid #e2e8f0;text-align:center">${pt.ideal?.toFixed(1) ?? "—"}</td>
        </tr>`;
      }).join("") ?? "";

      // Build task rows grouped by status
      const taskRows = tasks.map((t: any) => {
        const color = TASK_STATUS_COLORS[t.status] ?? "#94a3b8";
        const label = TASK_STATUS_LABELS[t.status] ?? t.status;
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
    CRS: <strong>${crsName}</strong> &nbsp;|&nbsp;
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

  ${burndownRows ? `<section>
    <h3>Burndown — Dados</h3>
    <table>
      <thead><tr>
        <th>Data</th>
        <th style="text-align:center">Tarefas Restantes</th>
        <th style="text-align:center">Linha Ideal</th>
      </tr></thead>
      <tbody>${burndownRows}</tbody>
    </table>
  </section>` : ""}

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
        <div className="flex gap-2">
          <Select
            value={crsId?.toString() ?? ""}
            onValueChange={v => { setCrsId(Number(v)); setSelectedSprintId(null); }}
          >
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Selecione um CRS" />
            </SelectTrigger>
            <SelectContent>
              {(crsQ.data ?? []).map((p: any) => (
                <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
              ))}
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
            <p>Selecione um projeto para ver as sprints.</p>
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
                          <p className="text-xs text-gray-500">Total</p>
                        </div>
                        <div className="bg-green-50 rounded-lg p-3">
                          <p className="text-2xl font-bold text-green-700">
                            {selectedSprint.tasks?.filter((t: any) => t.status === "published" || t.status === "archived").length ?? 0}
                          </p>
                          <p className="text-xs text-gray-500">Concluídas</p>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-3">
                          <p className="text-2xl font-bold text-blue-700">
                            {selectedSprint.tasks?.filter((t: any) => t.status === "in_progress").length ?? 0}
                          </p>
                          <p className="text-xs text-gray-500">Em andamento</p>
                        </div>
                        <div className="bg-amber-50 rounded-lg p-3">
                          <p className="text-2xl font-bold text-amber-600">
                            {(() => {
                              const total = selectedSprint.tasks?.length ?? 0;
                              const done = selectedSprint.tasks?.filter((t: any) => t.status === "published" || t.status === "archived").length ?? 0;
                              return total > 0 ? `${Math.round((done / total) * 100)}%` : "0%";
                            })()}
                          </p>
                          <p className="text-xs text-gray-500">Conclusão</p>
                        </div>
                      </div>

                      {/* Task list */}
                      {(selectedSprint.tasks ?? []).length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-gray-700">Tarefas da Sprint</h4>
                          {(selectedSprint.tasks ?? []).map((task: any) => (
                            <div key={task.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                              <div
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: TASK_STATUS_COLORS[task.status] ?? "#94a3b8" }}
                              />
                              <span className="text-sm flex-1 truncate">{task.title}</span>
                              <Badge variant="outline" className="text-xs">{task.setor ?? "—"}</Badge>
                              <Badge
                                className="text-xs"
                                style={{
                                  backgroundColor: `${TASK_STATUS_COLORS[task.status]}22`,
                                  color: TASK_STATUS_COLORS[task.status],
                                  border: `1px solid ${TASK_STATUS_COLORS[task.status]}44`,
                                }}
                              >
                                {TASK_STATUS_LABELS[task.status] ?? task.status}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
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
                            const parts = d.split("-");
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
