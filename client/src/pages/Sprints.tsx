import AppLayout from "@/components/AppLayout";
import { useState } from "react";
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
import { Plus, Target, Calendar, CheckCircle2, Trash2, ChevronRight } from "lucide-react";
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

export default function Sprints() {
  const [projectId, setProjectId] = useState<number | undefined>(undefined);
  const [selectedSprintId, setSelectedSprintId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: "",
    goal: "",
    startDate: "",
    endDate: "",
  });

  const projectsQ = trpc.projects.list.useQuery();
  const sprintsQ = trpc.sprints.list.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId }
  );
  const sprintDetailQ = trpc.sprints.get.useQuery(
    { id: selectedSprintId! },
    { enabled: !!selectedSprintId }
  );
  const burndownQ = trpc.burndown.data.useQuery(
    { sprintId: selectedSprintId! },
    { enabled: !!selectedSprintId }
  );

  const utils = trpc.useUtils();
  const createMut = trpc.sprints.create.useMutation({
    onSuccess: () => {
      utils.sprints.list.invalidate();
      setShowCreate(false);
      setForm({ name: "", goal: "", startDate: "", endDate: "" });
      toast.success("Sprint criada com sucesso!");
    },
  });
  const deleteMut = trpc.sprints.delete.useMutation({
    onSuccess: () => {
      utils.sprints.list.invalidate();
      if (selectedSprintId) setSelectedSprintId(null);
      toast.success("Sprint removida.");
    },
  });
  const updateStatusMut = trpc.sprints.update.useMutation({
    onSuccess: () => {
      utils.sprints.list.invalidate();
      utils.sprints.get.invalidate();
    },
  });

  const sprints = sprintsQ.data ?? [];
  const selectedSprint = sprintDetailQ.data;
  const burndown = burndownQ.data;

  function handleCreate() {
    if (!projectId || !form.name || !form.startDate || !form.endDate) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }
    createMut.mutate({
      projectId,
      name: form.name,
      goal: form.goal || undefined,
      startDate: new Date(form.startDate).getTime(),
      endDate: new Date(form.endDate).getTime(),
    });
  }

  function sprintProgress(sprint: typeof sprints[0]) {
    // We don't have task count here, so show status-based progress
    if (sprint.status === "completed") return 100;
    if (sprint.status === "active") return 50;
    return 0;
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
            value={projectId?.toString() ?? ""}
            onValueChange={v => { setProjectId(Number(v)); setSelectedSprintId(null); }}
          >
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Selecione um projeto" />
            </SelectTrigger>
            <SelectContent>
              {(projectsQ.data ?? []).map(p => (
                <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {projectId && (
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-1" /> Nova Sprint
            </Button>
          )}
        </div>
      </div>

      {!projectId ? (
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
              sprints.map(sprint => (
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
          <div className="lg:col-span-2 space-y-4">
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
                        <div className="flex gap-2">
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
                      <div className="grid grid-cols-3 gap-4 text-center mb-4">
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-2xl font-bold text-gray-900">{selectedSprint.tasks?.length ?? 0}</p>
                          <p className="text-xs text-gray-500">Tarefas</p>
                        </div>
                        <div className="bg-green-50 rounded-lg p-3">
                          <p className="text-2xl font-bold text-green-700">
                            {selectedSprint.tasks?.filter(t => t.status === "published").length ?? 0}
                          </p>
                          <p className="text-xs text-gray-500">Concluídas</p>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-3">
                          <p className="text-2xl font-bold text-blue-700">
                            {selectedSprint.tasks?.filter(t => t.status === "in_progress").length ?? 0}
                          </p>
                          <p className="text-xs text-gray-500">Em andamento</p>
                        </div>
                      </div>

                      {/* Task list */}
                      {(selectedSprint.tasks ?? []).length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-gray-700">Tarefas da Sprint</h4>
                          {(selectedSprint.tasks ?? []).map(task => (
                            <div key={task.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                              <div
                                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                  task.status === "published" ? "bg-green-500" :
                                  task.status === "in_progress" ? "bg-blue-500" :
                                  task.status === "archived" ? "bg-red-500" : "bg-gray-400"
                                }`}
                              />
                              <span className="text-sm flex-1 truncate">{task.title}</span>
                              <Badge variant="outline" className="text-xs">{task.setor ?? "—"}</Badge>
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
