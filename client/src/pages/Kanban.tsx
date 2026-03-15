import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Link } from "wouter";
import {
  Plus, Search, Filter, Layers, AlertCircle, Clock, Zap, ArrowUp,
  Trash2, Settings, BarChart2,
} from "lucide-react";

type Priority = "low" | "medium" | "high" | "urgent";
type Task = {
  id: number; crsId: number; phaseId: number; title: string;
  description?: string | null; priority: Priority; assigneeId?: number | null;
  dueDate?: Date | null; setor?: string | null; progress: number;
  assigneeName?: string | null; assigneeAvatarUrl?: string | null;
  revisionsCount: number; createdAt: Date;
};
type Phase = { id: number; crsId: number; name: string; color: string; position: number; isTerminal: boolean };
type CrsItem = { id: number; clientId: number; name: string; code?: string | null; clientName?: string | null; clientColor?: string | null; progress: number };

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string }> = {
  low:    { label: "Baixa",   color: "bg-slate-100 text-slate-600" },
  medium: { label: "Média",   color: "bg-blue-100 text-blue-700" },
  high:   { label: "Alta",    color: "bg-orange-100 text-orange-700" },
  urgent: { label: "Urgente", color: "bg-red-100 text-red-700" },
};

function TaskCard({ task, phases, onMove, onDelete, isAdmin }: {
  task: Task; phases: Phase[];
  onMove: (taskId: number, phaseId: number) => void;
  onDelete: (id: number) => void;
  isAdmin: boolean;
}) {
  const pConfig = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium;
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();
  return (
    <div
      className="bg-card border border-border rounded-lg p-3 shadow-sm hover:shadow-md transition-all group cursor-pointer"
      draggable
      onDragStart={(e) => e.dataTransfer.setData("taskId", String(task.id))}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <Link href={`/tarefas/${task.id}`} className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground leading-snug hover:text-primary line-clamp-2">{task.title}</p>
        </Link>
        {isAdmin && (
          <button onClick={(e) => { e.stopPropagation(); onDelete(task.id); }} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {task.setor && <Badge variant="outline" className="text-xs mb-2 font-normal">{task.setor}</Badge>}
      {task.progress > 0 && (
        <div className="mb-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Progresso</span><span>{task.progress}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${task.progress}%` }} />
          </div>
        </div>
      )}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1.5">
          <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium ${pConfig.color}`}>{pConfig.label}</span>
          {task.revisionsCount > 0 && <span className="text-xs text-orange-600 font-medium">{task.revisionsCount}R</span>}
        </div>
        <div className="flex items-center gap-1.5">
          {task.dueDate && (
            <span className={`text-xs ${isOverdue ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
              {new Date(task.dueDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
            </span>
          )}
          {task.assigneeName && (
            <Avatar className="w-5 h-5">
              <AvatarFallback className="text-xs bg-primary/20 text-primary">{task.assigneeName[0]}</AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>
      {isAdmin && (
        <div className="mt-2 pt-2 border-t border-border/50">
          <Select value={String(task.phaseId)} onValueChange={(v) => onMove(task.id, Number(v))}>
            <SelectTrigger className="h-6 text-xs border-0 bg-muted/50 px-2"><SelectValue /></SelectTrigger>
            <SelectContent>
              {phases.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />{p.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

export default function Kanban() {
  const { user } = useAuth();
  
  const isAdmin = user?.role === "admin" || user?.role === "master_admin";

  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [selectedCrsId, setSelectedCrsId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [filterPriority, setFilterPriority] = useState("all");
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showManagePhases, setShowManagePhases] = useState(false);
  const [newTaskPhaseId, setNewTaskPhaseId] = useState<number | null>(null);
  const [dragOverPhaseId, setDragOverPhaseId] = useState<number | null>(null);
  const [newTask, setNewTask] = useState({ title: "", description: "", priority: "medium" as Priority, assigneeId: "", dueDate: "", setor: "" });
  const [newPhaseName, setNewPhaseName] = useState("");
  const [newPhaseColor, setNewPhaseColor] = useState("#6366f1");

  const clientsQ = trpc.clients.list.useQuery();
  const crsQ = trpc.crs.list.useQuery();
  const usersQ = trpc.users.list.useQuery();
  const disciplinesQ = trpc.disciplines.list.useQuery();
  const phasesQ = trpc.kanbanPhases.list.useQuery({ crsId: selectedCrsId! }, { enabled: !!selectedCrsId });
  const tasksQ = trpc.tasks.listByCrs.useQuery({ crsId: selectedCrsId! }, { enabled: !!selectedCrsId });
  const utils = trpc.useUtils();

  const createTaskM = trpc.tasks.create.useMutation({
    onSuccess: () => {
      utils.tasks.listByCrs.invalidate();
      setShowCreateTask(false);
      setNewTask({ title: "", description: "", priority: "medium", assigneeId: "", dueDate: "", setor: "" });
      toast.success("Tarefa criada!");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
  const moveTaskM = trpc.tasks.movePhase.useMutation({
    onMutate: async ({ id, phaseId }) => {
      await utils.tasks.listByCrs.cancel();
      const prev = utils.tasks.listByCrs.getData({ crsId: selectedCrsId! });
      utils.tasks.listByCrs.setData({ crsId: selectedCrsId! }, (old: any) => old?.map((t: Task) => t.id === id ? { ...t, phaseId } : t));
      return { prev };
    },
    onError: (_e: any, _v: any, ctx: any) => { if (ctx?.prev) utils.tasks.listByCrs.setData({ crsId: selectedCrsId! }, ctx.prev); },
    onSettled: () => utils.tasks.listByCrs.invalidate(),
  });
  const deleteTaskM = trpc.tasks.delete.useMutation({
    onSuccess: () => { utils.tasks.listByCrs.invalidate(); toast.success("Tarefa excluída"); },
  });
  const createPhaseM = trpc.kanbanPhases.create.useMutation({
    onSuccess: () => { utils.kanbanPhases.list.invalidate(); setNewPhaseName(""); toast.success("Fase criada!"); },
  });
  const deletePhaseM = trpc.kanbanPhases.delete.useMutation({
    onSuccess: () => utils.kanbanPhases.list.invalidate(),
  });

  const phases: Phase[] = (phasesQ.data ?? []) as Phase[];
  const allTasks: Task[] = (tasksQ.data ?? []) as Task[];
  const filteredTasks = allTasks.filter((t) => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterPriority !== "all" && t.priority !== filterPriority) return false;
    return true;
  });
  const tasksByPhase = phases.reduce((acc, phase) => {
    acc[phase.id] = filteredTasks.filter((t) => t.phaseId === phase.id);
    return acc;
  }, {} as Record<number, Task[]>);

  const handleDrop = (e: React.DragEvent, phaseId: number) => {
    e.preventDefault();
    const taskId = Number(e.dataTransfer.getData("taskId"));
    if (taskId && selectedCrsId) moveTaskM.mutate({ id: taskId, phaseId });
    setDragOverPhaseId(null);
  };

  const handleCreateTask = () => {
    if (!newTask.title.trim() || !selectedCrsId) return;
    const phaseId = newTaskPhaseId ?? phases[0]?.id;
    if (!phaseId) return;
    createTaskM.mutate({
      crsId: selectedCrsId, phaseId, title: newTask.title,
      description: newTask.description || undefined, priority: newTask.priority,
      assigneeId: newTask.assigneeId && newTask.assigneeId !== "none" ? Number(newTask.assigneeId) : undefined,
      dueDate: newTask.dueDate ? new Date(newTask.dueDate) : undefined,
      setor: newTask.setor && newTask.setor !== "none" ? newTask.setor : undefined,
    });
  };

  const clients = (clientsQ.data ?? []) as any[];
  const crsList = (crsQ.data ?? []) as CrsItem[];
  const filteredCrs = selectedClientId ? crsList.filter((c) => c.clientId === selectedClientId) : crsList;
  const selectedCrs = crsList.find((c) => c.id === selectedCrsId);

  return (
    <AppLayout>
      <div className="flex flex-col h-full">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10 flex-wrap gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" />Kanban
            </h1>
            <Select value={selectedClientId ? String(selectedClientId) : "all"} onValueChange={(v) => { setSelectedClientId(v === "all" ? null : Number(v)); setSelectedCrsId(null); }}>
              <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Cliente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os clientes</SelectItem>
                {clients.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedCrsId ? String(selectedCrsId) : ""} onValueChange={(v) => setSelectedCrsId(Number(v))}>
              <SelectTrigger className="h-8 w-52 text-xs"><SelectValue placeholder="Selecionar CRS" /></SelectTrigger>
              <SelectContent>
                {filteredCrs.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: c.clientColor ?? "#1561ad" }} />
                      {c.code ? `${c.code} — ` : ""}{c.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedCrsId && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="h-8 pl-7 w-36 text-xs" />
              </div>
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger className="h-8 w-32 text-xs">
                  <Filter className="w-3.5 h-3.5 mr-1" /><SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Prioridade</SelectItem>
                  {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {isAdmin && (
                <>
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowManagePhases(true)}>
                    <Settings className="w-3.5 h-3.5 mr-1" />Fases
                  </Button>
                  <Button size="sm" className="h-8 text-xs" onClick={() => { setNewTaskPhaseId(phases[0]?.id ?? null); setShowCreateTask(true); }}>
                    <Plus className="w-3.5 h-3.5 mr-1" />Nova Tarefa
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {/* CRS info bar */}
        {selectedCrs && (
          <div className="px-4 py-2 bg-primary/5 border-b border-border flex items-center gap-4 text-sm flex-wrap">
            <span className="font-medium text-foreground">{selectedCrs.clientName} → {selectedCrs.name}</span>
            {selectedCrs.code && <Badge variant="outline" className="text-xs">{selectedCrs.code}</Badge>}
            <div className="flex items-center gap-2 ml-auto">
              <BarChart2 className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Progresso geral:</span>
              <span className="text-xs font-bold text-primary">{selectedCrs.progress}%</span>
            </div>
          </div>
        )}

        {/* Board */}
        {!selectedCrsId ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Layers className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Selecione um CRS</h3>
              <p className="text-muted-foreground text-sm">Escolha um contrato acima para visualizar o Kanban</p>
            </div>
          </div>
        ) : phasesQ.isLoading ? (
          <div className="flex-1 flex items-center justify-center"><div className="text-muted-foreground">Carregando...</div></div>
        ) : (
          <div className="flex-1 overflow-x-auto p-4">
            <div className="flex gap-4 h-full min-h-[600px]" style={{ minWidth: `${phases.length * 280}px` }}>
              {phases.map((phase) => {
                const phaseTasks = tasksByPhase[phase.id] ?? [];
                const isDragOver = dragOverPhaseId === phase.id;
                return (
                  <div
                    key={phase.id}
                    className={`flex flex-col rounded-xl border transition-all ${isDragOver ? "border-primary/50 bg-primary/5" : "border-border bg-muted/30"}`}
                    style={{ minWidth: 260, width: 260 }}
                    onDragOver={(e) => { e.preventDefault(); setDragOverPhaseId(phase.id); }}
                    onDragLeave={() => setDragOverPhaseId(null)}
                    onDrop={(e) => handleDrop(e, phase.id)}
                  >
                    <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/50">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: phase.color }} />
                        <span className="text-sm font-semibold text-foreground">{phase.name}</span>
                        <span className="text-xs text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">{phaseTasks.length}</span>
                      </div>
                      {isAdmin && (
                        <button onClick={() => { setNewTaskPhaseId(phase.id); setShowCreateTask(true); }} className="text-muted-foreground hover:text-primary transition-colors">
                          <Plus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                      {phaseTasks.map((task) => (
                        <TaskCard key={task.id} task={task} phases={phases}
                          onMove={(taskId, phaseId) => moveTaskM.mutate({ id: taskId, phaseId })}
                          onDelete={(id) => { if (confirm("Excluir tarefa?")) deleteTaskM.mutate({ id }); }}
                          isAdmin={isAdmin}
                        />
                      ))}
                      {phaseTasks.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground/50 text-xs">Arraste tarefas aqui</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Create Task Dialog */}
      <Dialog open={showCreateTask} onOpenChange={setShowCreateTask}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nova Tarefa</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Título *</Label><Input value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} placeholder="Título da tarefa" /></div>
            <div><Label>Descrição</Label><Textarea value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} rows={3} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fase</Label>
                <Select value={newTaskPhaseId ? String(newTaskPhaseId) : ""} onValueChange={(v) => setNewTaskPhaseId(Number(v))}>
                  <SelectTrigger><SelectValue placeholder="Fase" /></SelectTrigger>
                  <SelectContent>{phases.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select value={newTask.priority} onValueChange={(v) => setNewTask({ ...newTask, priority: v as Priority })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(PRIORITY_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Responsável</Label>
                <Select value={newTask.assigneeId} onValueChange={(v) => setNewTask({ ...newTask, assigneeId: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {(usersQ.data ?? []).map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Prazo</Label><Input type="date" value={newTask.dueDate} onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })} /></div>
            </div>
            <div>
              <Label>Disciplina/Setor</Label>
              <Select value={newTask.setor} onValueChange={(v) => setNewTask({ ...newTask, setor: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar disciplina" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {(disciplinesQ.data ?? []).map((d: any) => (
                    <SelectItem key={d.id} value={d.name}>
                      <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ background: d.color }} />{d.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateTask(false)}>Cancelar</Button>
            <Button onClick={handleCreateTask} disabled={!newTask.title.trim() || createTaskM.isPending}>
              {createTaskM.isPending ? "Criando..." : "Criar Tarefa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Phases Dialog */}
      <Dialog open={showManagePhases} onOpenChange={setShowManagePhases}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Gerenciar Fases — {selectedCrs?.name}</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {phases.map((phase) => (
              <div key={phase.id} className="flex items-center gap-2 p-2 rounded-lg border border-border">
                <span className="w-4 h-4 rounded-full shrink-0" style={{ background: phase.color }} />
                <span className="flex-1 text-sm font-medium">{phase.name}</span>
                {phase.isTerminal && <Badge variant="outline" className="text-xs">Terminal</Badge>}
                <button onClick={() => deletePhaseM.mutate({ id: phase.id })} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="border-t border-border pt-4">
            <p className="text-sm font-medium mb-2">Adicionar nova fase</p>
            <div className="flex gap-2">
              <Input value={newPhaseName} onChange={(e) => setNewPhaseName(e.target.value)} placeholder="Nome da fase" className="flex-1" />
              <input type="color" value={newPhaseColor} onChange={(e) => setNewPhaseColor(e.target.value)} className="w-10 h-9 rounded border border-border cursor-pointer" />
              <Button size="sm" onClick={() => { if (newPhaseName.trim() && selectedCrsId) createPhaseM.mutate({ crsId: selectedCrsId, name: newPhaseName, color: newPhaseColor }); }} disabled={!newPhaseName.trim()}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowManagePhases(false)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
