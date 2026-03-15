import { useState, useMemo, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Plus, ChevronRight, CheckCircle2, Circle, Clock, AlertTriangle,
  User, Calendar, Layers, Search, Filter, ExternalLink, ChevronDown,
  ChevronUp, ListChecks, Pencil, Trash2, FolderKanban,
} from "lucide-react";

// ── Tipo de Obra config ──────────────────────────────────────────────────────
const TIPO_OBRA_MAP: Record<string, string> = {
  implementacao: "Implementação",
  restauracao: "Restauração",
  aumento_capacidade: "Aumento de Capacidade",
  levantamento: "Levantamento",
  outro: "Outro",
};

// ── Priority config ────────────────────────────────────────────────────────────
const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  low:    { label: "Baixa",    color: "#22c55e", bg: "#22c55e20" },
  medium: { label: "Média",    color: "#f59e0b", bg: "#f59e0b20" },
  high:   { label: "Alta",     color: "#fc5226", bg: "#fc522620" },
  urgent: { label: "Urgente",  color: "#ef4444", bg: "#ef444420" },
};

// ── Phase badge ────────────────────────────────────────────────────────────────
function PhaseBadge({ color, name }: { color: string; name: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: color + "25", color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      {name}
    </span>
  );
}

// ── Checklist mini-view ────────────────────────────────────────────────────────
function ChecklistPreview({ items, taskId }: { items: any[]; taskId: number }) {
  const utils = trpc.useUtils();
  const toggleMut = trpc.checklist.updateStatus.useMutation({
    onSuccess: () => utils.tasks.listByCrs.invalidate(),
    onError: (e) => toast.error(e.message),
  });
  const done = items.filter((i) => i.status === "published").length;
  if (!items.length) return null;
  return (
    <div className="mt-2 space-y-1">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <ListChecks className="w-3 h-3" /> {done}/{items.length}
        </span>
        <Progress value={items.length ? (done / items.length) * 100 : 0} className="w-20 h-1" />
      </div>
      {items.slice(0, 3).map((item) => (
        <div key={item.id} className="flex items-center gap-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleMut.mutate({ id: item.id, status: item.status === "published" ? "pending" : "published" });
            }}
            className="flex-shrink-0 text-muted-foreground hover:text-primary transition-colors"
          >
            {item.status === "published"
              ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              : <Circle className="w-3.5 h-3.5" />}
          </button>
          <span className={`text-xs truncate ${item.status === "published" ? "line-through text-muted-foreground" : "text-foreground"}`}>
            {item.title}
          </span>
        </div>
      ))}
      {items.length > 3 && (
        <p className="text-xs text-muted-foreground pl-5">+{items.length - 3} mais...</p>
      )}
    </div>
  );
}

// ── Task Card ─────────────────────────────────────────────────────────────────
function TaskCard({
  task, phases, isAdmin, onEdit, onDelete, onNavigate,
}: {
  task: any; phases: any[]; isAdmin: boolean;
  onEdit: (t: any) => void; onDelete: (id: number) => void; onNavigate: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const p = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium;
  const phase = phases.find((ph) => ph.id === task.phaseId);
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();
  const checklist: any[] = task.checklistItems ?? [];

  return (
    <div className="bg-card border border-border rounded-xl p-3 hover:shadow-md transition-all group">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: p.bg, color: p.color }}>
              {p.label}
            </span>
            {phase && <PhaseBadge color={phase.color} name={phase.name} />}
            {isOverdue && (
              <span className="flex items-center gap-0.5 text-xs text-red-400">
                <AlertTriangle className="w-3 h-3" /> Atrasada
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-foreground leading-tight">{task.title}</p>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button onClick={() => onNavigate(task.id)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
          {isAdmin && (
            <>
              <button onClick={() => onEdit(task)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => onDelete(task.id)} className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {task.progress > 0 && (
        <div className="mb-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-0.5">
            <span>Progresso</span><span>{Math.round(task.progress)}%</span>
          </div>
          <Progress value={task.progress} className="h-1" />
        </div>
      )}

      {/* Meta */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {task.assigneeName && (
          <span className="flex items-center gap-1 truncate">
            <User className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{task.assigneeName}</span>
          </span>
        )}
        {task.dueDate && (
          <span className={`flex items-center gap-1 flex-shrink-0 ${isOverdue ? "text-red-400" : ""}`}>
            <Calendar className="w-3 h-3" />
            {new Date(task.dueDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
          </span>
        )}
      </div>

      {/* Checklist preview */}
      {checklist.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? "Ocultar checklist" : `Ver checklist (${checklist.filter((i: any) => i.status === "published").length}/${checklist.length})`}
          </button>
          {expanded && <ChecklistPreview items={checklist} taskId={task.id} />}
        </>
      )}
    </div>
  );
}

// ── Discipline Column ─────────────────────────────────────────────────────────
function DisciplineColumn({
  discipline, tasks, phases, isAdmin, onAddTask, onEdit, onDelete, onNavigate,
}: {
  discipline: { id: number; name: string; color: string };
  tasks: any[]; phases: any[]; isAdmin: boolean;
  onAddTask: (disciplineId: number, disciplineName: string) => void;
  onEdit: (t: any) => void; onDelete: (id: number) => void; onNavigate: (id: number) => void;
}) {
  // Progresso da coluna = média ponderada dos itens de checklist de todas as tarefas
  // Cada tarefa contribui com (itens concluídos / total de itens) ou progress se não tiver checklist
  const colPct = (() => {
    if (!tasks.length) return 0;
    let totalWeight = 0;
    let totalDone = 0;
    for (const t of tasks) {
      const cl: any[] = t.checklistItems ?? [];
      if (cl.length > 0) {
        // Cada item do checklist vale (1 / totalItems) da tarefa
        // Cada item concluído (status === 'published') vale 1 ponto
        const itemsDone = cl.filter((i: any) => i.status === "published").length;
        totalWeight += cl.length;
        totalDone += itemsDone;
      } else {
        // Sem checklist: usa o campo progress (0-100) como 1 item
        totalWeight += 100;
        totalDone += Math.min(100, t.progress ?? 0);
      }
    }
    return totalWeight > 0 ? Math.round((totalDone / totalWeight) * 100) : 0;
  })();

  return (
    <div className="flex flex-col min-w-[280px] max-w-[320px] bg-secondary/30 rounded-2xl border border-border overflow-hidden">
      {/* Column header */}
      <div className="p-3 border-b border-border" style={{ borderTopColor: discipline.color, borderTopWidth: 3 }}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: discipline.color }} />
            <h3 className="text-sm font-semibold text-foreground">{discipline.name}</h3>
          </div>
          <div className="flex items-center gap-1">
            <Badge variant="secondary" className="text-xs">{tasks.length}</Badge>
            {isAdmin && (
              <button
                onClick={() => onAddTask(discipline.id, discipline.name)}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
        {tasks.length > 0 && (
          <div className="flex items-center gap-2">
            <Progress value={colPct} className="flex-1 h-1" />
            <span className="text-xs text-muted-foreground">{colPct}%</span>
          </div>
        )}
      </div>

      {/* Tasks */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[calc(100vh-280px)]">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Layers className="w-6 h-6 text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">Nenhuma tarefa</p>
            {isAdmin && (
              <button
                onClick={() => onAddTask(discipline.id, discipline.name)}
                className="mt-2 text-xs text-primary hover:underline"
              >
                + Adicionar tarefa
              </button>
            )}
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id} task={task} phases={phases} isAdmin={isAdmin}
              onEdit={onEdit} onDelete={onDelete} onNavigate={onNavigate}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function Kanban() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "master_admin";
  const [, navigate] = useLocation();
  const queryString = useSearch();
  // CRS selector — read ?crs=X from URL
  const urlCrsId = useMemo(() => {
    const params = new URLSearchParams(queryString);
    const v = params.get("crs");
    return v ? parseInt(v, 10) : null;
  }, [queryString]);
  const [selectedCrsId, setSelectedCrsId] = useState<number | null>(null);
  // Pre-select CRS from URL param when data loads
  useEffect(() => {
    if (urlCrsId) setSelectedCrsId(urlCrsId);
  }, [urlCrsId]);;
  const [search, setSearch] = useState("");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [filterPhase, setFilterPhase] = useState("all");
  // Discipline visibility filter: set of discipline names to HIDE (empty = show all)
  const [hiddenDisciplines, setHiddenDisciplines] = useState<Set<string>>(new Set());
  function toggleDiscipline(name: string) {
    setHiddenDisciplines((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  // Dialogs
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [taskForm, setTaskForm] = useState({
    title: "", description: "", priority: "medium", assigneeId: "",
    dueDate: "", setor: "", phaseId: "",
  });
  const [prefillDiscipline, setPrefillDiscipline] = useState<{ id: number; name: string } | null>(null);

  const utils = trpc.useUtils();

  // Queries
  const crsQ = trpc.crs.list.useQuery();
  const crsItems = crsQ.data ?? [];
  const selectedCrs = crsItems.find((c: any) => c.id === selectedCrsId) ?? (crsItems[0] ?? null);
  const effectiveCrsId = selectedCrs?.id ?? null;

  const phasesQ = trpc.kanbanPhases.list.useQuery(
    { crsId: effectiveCrsId! }, { enabled: !!effectiveCrsId }
  );
  const tasksQ = trpc.tasks.listByCrs.useQuery(
    { crsId: effectiveCrsId! }, { enabled: !!effectiveCrsId }
  );
  const disciplinesQ = trpc.disciplines.list.useQuery();
  const membersQ = trpc.users.list.useQuery();

  const phases = phasesQ.data ?? [];
  const allTasks: any[] = tasksQ.data ?? [];
  const disciplines: any[] = disciplinesQ.data ?? [];
  const members: any[] = membersQ.data ?? [];

  // Mutations
  const createTaskMut = trpc.tasks.create.useMutation({
    onSuccess: () => {
      toast.success("Tarefa criada!");
      utils.tasks.listByCrs.invalidate();
      setShowCreateTask(false);
      setTaskForm({ title: "", description: "", priority: "medium", assigneeId: "", dueDate: "", setor: "", phaseId: "" });
      setPrefillDiscipline(null);
    },
    onError: (e) => toast.error(e.message),
  });
  const updateTaskMut = trpc.tasks.update.useMutation({
    onSuccess: () => {
      toast.success("Tarefa atualizada!");
      utils.tasks.listByCrs.invalidate();
      setEditingTask(null);
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteTaskMut = trpc.tasks.delete.useMutation({
    onSuccess: () => { toast.success("Tarefa excluída."); utils.tasks.listByCrs.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return allTasks.filter((t) => {
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterPriority !== "all" && t.priority !== filterPriority) return false;
      if (filterAssignee !== "all" && String(t.assigneeId) !== filterAssignee) return false;
      if (filterPhase !== "all" && String(t.phaseId) !== filterPhase) return false;
      return true;
    });
  }, [allTasks, search, filterPriority, filterAssignee, filterPhase]);

  // Group tasks by discipline (setor)
  const tasksByDiscipline = useMemo(() => {
    const map: Record<string, any[]> = {};
    disciplines.forEach((d) => { map[d.name] = []; });
    map["Sem Disciplina"] = [];
    filteredTasks.forEach((t) => {
      const key = t.setor && map[t.setor] !== undefined ? t.setor : "Sem Disciplina";
      map[key].push(t);
    });
    return map;
  }, [filteredTasks, disciplines]);

  // All available discipline columns (for filter chips)
  const allColumns = useMemo(() => {
    const cols = disciplines.map((d) => ({ id: d.id, name: d.name, color: d.color ?? "#6366f1" }));
    if ((tasksByDiscipline["Sem Disciplina"] ?? []).length > 0) {
      cols.push({ id: -1, name: "Sem Disciplina", color: "#94a3b8" });
    }
    return cols;
  }, [disciplines, tasksByDiscipline]);

  // Columns filtered by hiddenDisciplines
  const columnsToShow = useMemo(() => {
    return allColumns.filter((d) => !hiddenDisciplines.has(d.name));
  }, [allColumns, hiddenDisciplines]);

  function openAddTask(disciplineId: number, disciplineName: string) {
    const disc = disciplines.find((d) => d.id === disciplineId);
    setPrefillDiscipline({ id: disciplineId, name: disciplineName });
    setTaskForm({
      title: "", description: "", priority: "medium", assigneeId: "",
      dueDate: "", setor: disciplineName, phaseId: phases[0]?.id ? String(phases[0].id) : "",
    });
    setShowCreateTask(true);
  }

  function handleCreateTask() {
    if (!effectiveCrsId) return toast.error("Selecione um CRS.");
    if (!taskForm.title.trim()) return toast.error("Título é obrigatório.");
    if (!taskForm.phaseId) return toast.error("Selecione uma fase.");
    createTaskMut.mutate({
      crsId: effectiveCrsId,
      phaseId: parseInt(taskForm.phaseId),
      title: taskForm.title.trim(),
      description: taskForm.description.trim() || undefined,
      priority: taskForm.priority as any,
      assigneeId: taskForm.assigneeId ? parseInt(taskForm.assigneeId) : undefined,
      dueDate: taskForm.dueDate ? new Date(taskForm.dueDate) : undefined,
      setor: taskForm.setor || undefined,
    });
  }

  function openEditTask(task: any) {
    setEditingTask(task);
    setTaskForm({
      title: task.title, description: task.description ?? "",
      priority: task.priority, assigneeId: task.assigneeId ? String(task.assigneeId) : "",
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : "",
      setor: task.setor ?? "", phaseId: String(task.phaseId),
    });
  }

  function handleUpdateTask() {
    if (!editingTask) return;
    updateTaskMut.mutate({
      id: editingTask.id,
      title: taskForm.title.trim() || undefined,
      description: taskForm.description.trim() || undefined,
      priority: taskForm.priority as any,
      assigneeId: taskForm.assigneeId ? parseInt(taskForm.assigneeId) : null,
      dueDate: taskForm.dueDate ? new Date(taskForm.dueDate) : null,
      setor: taskForm.setor || null,
      phaseId: taskForm.phaseId ? parseInt(taskForm.phaseId) : undefined,
    });
  }

  const isLoading = crsQ.isLoading || tasksQ.isLoading || disciplinesQ.isLoading;

  return (
    <AppLayout title="Kanban">
      <div className="flex flex-col h-full">
        {/* ── Toolbar ── */}
        <div className="px-4 py-3 border-b border-border bg-background/80 backdrop-blur sticky top-0 z-10">
          <div className="flex flex-wrap items-center gap-3">
            {/* CRS selector */}
            <div className="flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-muted-foreground" />
              <Select
                value={selectedCrsId ? String(selectedCrsId) : (crsItems[0] ? String(crsItems[0].id) : "")}
                onValueChange={(v) => setSelectedCrsId(parseInt(v))}
              >
                <SelectTrigger className="w-52 h-8 text-sm">
                  <SelectValue placeholder="Selecione um CRS" />
                </SelectTrigger>
                <SelectContent>
                  {crsItems.map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.clientName ? `${c.clientName} — ` : ""}{c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input placeholder="Buscar tarefa..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
            </div>

            {/* Filters */}
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-36 h-8 text-sm">
                <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterAssignee} onValueChange={setFilterAssignee}>
              <SelectTrigger className="w-40 h-8 text-sm">
                <User className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {members.map((m: any) => (
                  <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {phases.length > 0 && (
              <Select value={filterPhase} onValueChange={setFilterPhase}>
                <SelectTrigger className="w-40 h-8 text-sm">
                  <Layers className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder="Fase" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as fases</SelectItem>
                  {phases.map((ph: any) => (
                    <SelectItem key={ph.id} value={String(ph.id)}>
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: ph.color }} />
                        {ph.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="ml-auto flex items-center gap-2">
              {selectedCrs?.tipoObra && (
                <span className="text-xs px-2 py-1 rounded-full border border-border text-muted-foreground">
                  {TIPO_OBRA_MAP[selectedCrs.tipoObra] ?? selectedCrs.tipoObra}
                </span>
              )}
              {isAdmin && effectiveCrsId && (
                <Button size="sm" onClick={() => {
                  setTaskForm({ title: "", description: "", priority: "medium", assigneeId: "", dueDate: "", setor: "", phaseId: phases[0]?.id ? String(phases[0].id) : "" });
                  setPrefillDiscipline(null);
                  setShowCreateTask(true);
                }} className="gap-1.5 h-8">
                  <Plus className="w-3.5 h-3.5" /> Nova Tarefa
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* ── Discipline Filter Chips ── */}
        {allColumns.length > 1 && (
          <div className="px-4 py-2 border-b border-border bg-background/60 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground font-medium flex-shrink-0">Disciplinas:</span>
            <button
              onClick={() => setHiddenDisciplines(new Set())}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
                hiddenDisciplines.size === 0
                  ? "bg-primary text-white border-primary"
                  : "bg-transparent text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
              }`}
            >
              Todas
            </button>
            {allColumns.map((disc) => {
              const isHidden = hiddenDisciplines.has(disc.name);
              return (
                <button
                  key={disc.id}
                  onClick={() => toggleDiscipline(disc.name)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
                    isHidden
                      ? "bg-transparent text-muted-foreground/50 border-border/50 line-through"
                      : "border-transparent text-white"
                  }`}
                  style={!isHidden ? { backgroundColor: disc.color, borderColor: disc.color } : {}}
                >
                  {!isHidden && <span className="w-1.5 h-1.5 rounded-full bg-white/70 flex-shrink-0" />}
                  {disc.name}
                  <span className="opacity-70">({(tasksByDiscipline[disc.name] ?? []).length})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Board ── */}
        {!effectiveCrsId ? (
          <div className="flex flex-col items-center justify-center flex-1 py-20 text-center">
            <FolderKanban className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground font-medium">Nenhum CRS disponível</p>
            <p className="text-sm text-muted-foreground/60 mt-1">Crie um CRS na página de Projetos para começar.</p>
          </div>
        ) : isLoading ? (
          <div className="flex gap-4 p-4 overflow-x-auto">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="min-w-[280px]">
                <Skeleton className="h-12 rounded-t-2xl mb-2" />
                {Array.from({ length: 3 }).map((_, j) => <Skeleton key={j} className="h-28 rounded-xl mb-2" />)}
              </div>
            ))}
          </div>
        ) : columnsToShow.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 py-20 text-center">
            <Layers className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground font-medium">Nenhuma disciplina cadastrada</p>
            <p className="text-sm text-muted-foreground/60 mt-1">Acesse Admin → Disciplinas para criar as disciplinas do projeto.</p>
          </div>
        ) : (
          <div className="flex gap-4 p-4 overflow-x-auto flex-1">
            {columnsToShow.map((disc) => (
              <DisciplineColumn
                key={disc.id}
                discipline={disc}
                tasks={tasksByDiscipline[disc.name] ?? []}
                phases={phases}
                isAdmin={isAdmin}
                onAddTask={openAddTask}
                onEdit={openEditTask}
                onDelete={(id) => { if (confirm("Excluir tarefa?")) deleteTaskMut.mutate({ id }); }}
                onNavigate={(id) => navigate(`/tasks/${id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Create Task Dialog ── */}
      <Dialog open={showCreateTask} onOpenChange={(o) => { if (!o) { setShowCreateTask(false); setPrefillDiscipline(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Tarefa{prefillDiscipline ? ` — ${prefillDiscipline.name}` : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Título *</Label>
              <Input className="mt-1" placeholder="Ex: Levantamento topográfico" value={taskForm.title} onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea className="mt-1" rows={2} value={taskForm.description} onChange={(e) => setTaskForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fase *</Label>
                <Select value={taskForm.phaseId} onValueChange={(v) => setTaskForm((f) => ({ ...f, phaseId: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {phases.map((ph: any) => (
                      <SelectItem key={ph.id} value={String(ph.id)}>
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: ph.color }} />
                          {ph.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select value={taskForm.priority} onValueChange={(v) => setTaskForm((f) => ({ ...f, priority: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Disciplina</Label>
                <Select value={taskForm.setor || "_none"} onValueChange={(v) => setTaskForm((f) => ({ ...f, setor: v === "_none" ? "" : v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Sem disciplina</SelectItem>
                    {disciplines.map((d: any) => (
                      <SelectItem key={d.id} value={d.name}>
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: d.color ?? "#6366f1" }} />
                          {d.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Responsável</Label>
                <Select value={taskForm.assigneeId || "_none"} onValueChange={(v) => setTaskForm((f) => ({ ...f, assigneeId: v === "_none" ? "" : v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Nenhum</SelectItem>
                    {members.map((m: any) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Prazo</Label>
              <Input type="date" className="mt-1" value={taskForm.dueDate} onChange={(e) => setTaskForm((f) => ({ ...f, dueDate: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateTask(false); setPrefillDiscipline(null); }}>Cancelar</Button>
            <Button onClick={handleCreateTask} disabled={createTaskMut.isPending}>
              {createTaskMut.isPending ? "Criando..." : "Criar Tarefa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Task Dialog ── */}
      <Dialog open={!!editingTask} onOpenChange={(o) => !o && setEditingTask(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Editar Tarefa</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Título</Label>
              <Input className="mt-1" value={taskForm.title} onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea className="mt-1" rows={2} value={taskForm.description} onChange={(e) => setTaskForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fase</Label>
                <Select value={taskForm.phaseId} onValueChange={(v) => setTaskForm((f) => ({ ...f, phaseId: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {phases.map((ph: any) => (
                      <SelectItem key={ph.id} value={String(ph.id)}>
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: ph.color }} />
                          {ph.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select value={taskForm.priority} onValueChange={(v) => setTaskForm((f) => ({ ...f, priority: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Disciplina</Label>
                <Select value={taskForm.setor || "_none"} onValueChange={(v) => setTaskForm((f) => ({ ...f, setor: v === "_none" ? "" : v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Sem disciplina</SelectItem>
                    {disciplines.map((d: any) => (
                      <SelectItem key={d.id} value={d.name}>
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: d.color ?? "#6366f1" }} />
                          {d.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Responsável</Label>
                <Select value={taskForm.assigneeId || "_none"} onValueChange={(v) => setTaskForm((f) => ({ ...f, assigneeId: v === "_none" ? "" : v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Nenhum</SelectItem>
                    {members.map((m: any) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Prazo</Label>
              <Input type="date" className="mt-1" value={taskForm.dueDate} onChange={(e) => setTaskForm((f) => ({ ...f, dueDate: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTask(null)}>Cancelar</Button>
            <Button onClick={handleUpdateTask} disabled={updateTaskMut.isPending}>
              {updateTaskMut.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
