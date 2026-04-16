import { useState, useMemo, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { SplitLayout, SplitPanelHeader, SplitPanelList, SplitPanelItem, SplitPanelContent, SplitPanelEmpty } from "@/components/SplitLayout";
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
  Plus, CheckCircle2, Circle, Clock, AlertTriangle,
  User, Calendar, Layers, Search, Filter, ExternalLink, ChevronDown,
  ChevronUp, ListChecks, Pencil, Trash2, FolderKanban, ChevronRight,
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

// ── Checklist Preview (expanded with date + assignee) ─────────────────────────
function ChecklistPreview({ items, taskId }: { items: any[]; taskId: number }) {
  const utils = trpc.useUtils();
  const toggleMut = trpc.checklist.updateStatus.useMutation({
    onSuccess: () => utils.tasks.listByCrsWithChecklist.invalidate(),
    onError: (e) => toast.error(e.message),
  });
  const done = items.filter((i) => i.status === "published").length;
  if (!items.length) return null;
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <ListChecks className="w-3 h-3" /> {done}/{items.length}
        </span>
        <Progress value={items.length ? (done / items.length) * 100 : 0} className="w-20 h-1" />
      </div>
      {items.map((item) => {
        const isDone = item.status === "published";
        const endDate = item.endDate ? new Date(item.endDate) : null;
        const isOverdue = endDate && endDate < new Date() && !isDone;
        return (
          <div key={`ci-${item.id}`} className="flex flex-col gap-0.5 pl-0.5">
            <div className="flex items-start gap-1.5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMut.mutate({ id: item.id, status: isDone ? "pending" : "published" });
                }}
                className="flex-shrink-0 mt-0.5 text-muted-foreground hover:text-primary transition-colors"
              >
                {isDone
                  ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  : <Circle className="w-3.5 h-3.5" />}
              </button>
              <span className={`text-xs leading-tight ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>
                {item.title}
              </span>
            </div>
            {/* Date + Assignee row */}
            {(endDate || item.assigneeName) && (
              <div className="flex items-center gap-2 pl-5">
                {item.assigneeName && (
                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                    <User className="w-2.5 h-2.5" />
                    {item.assigneeName}
                  </span>
                )}
                {endDate && (
                  <span className={`flex items-center gap-0.5 text-[10px] ${isOverdue ? "text-red-400" : "text-muted-foreground"}`}>
                    <Calendar className="w-2.5 h-2.5" />
                    {endDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
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
  const colPct = (() => {
    if (!tasks.length) return 0;
    let totalWeight = 0;
    let totalDone = 0;
    for (const t of tasks) {
      const cl: any[] = t.checklistItems ?? [];
      if (cl.length > 0) {
        const itemsDone = cl.filter((i: any) => i.status === "published").length;
        totalWeight += cl.length;
        totalDone += itemsDone;
      } else {
        totalWeight += 100;
        totalDone += Math.min(100, t.progress ?? 0);
      }
    }
    return totalWeight > 0 ? Math.round((totalDone / totalWeight) * 100) : 0;
  })();

  return (
    <div className="flex flex-col bg-secondary/30 rounded-2xl border border-border overflow-hidden h-full">
      {/* Column header */}
      <div className="p-3 border-b border-border flex-shrink-0" style={{ borderTopColor: discipline.color, borderTopWidth: 3 }}>
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
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
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
              key={`task-${task.id}`} task={task} phases={phases} isAdmin={isAdmin}
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

  // CRS selector
  const urlCrsId = useMemo(() => {
    const params = new URLSearchParams(queryString);
    const v = params.get("crs");
    return v ? parseInt(v, 10) : null;
  }, [queryString]);
  const [selectedCrsId, setSelectedCrsId] = useState<number | null>(null);
  useEffect(() => {
    if (urlCrsId) setSelectedCrsId(urlCrsId);
  }, [urlCrsId]);

  const [search, setSearch] = useState("");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [filterPhase, setFilterPhase] = useState("all");

  // ── NEW: up to 2 selected disciplines shown side by side ──────────────────
  // selectedDisciplines: array of discipline names (max 2)
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>([]);
  // dropdownOpen state for each slot
  const [slot1Open, setSlot1Open] = useState(false);
  const [slot2Open, setSlot2Open] = useState(false);

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
  const tasksQ = trpc.tasks.listByCrsWithChecklist.useQuery(
    { crsId: effectiveCrsId! }, { enabled: !!effectiveCrsId }
  );
  const disciplinesQ = trpc.disciplines.list.useQuery();
  const membersQ = trpc.users.list.useQuery();
  const myDisciplinesQ = trpc.users.getDisciplines.useQuery({ userId: user?.id }, { enabled: !!user?.id });

  const phases = phasesQ.data ?? [];
  const allTasks: any[] = tasksQ.data ?? [];
  const disciplines: any[] = disciplinesQ.data ?? [];
  const members: any[] = membersQ.data ?? [];
  const myDisciplineNames: string[] = (myDisciplinesQ.data ?? []).map((d: any) => d.disciplineName);
  const hasRestrictedDisciplines = !isAdmin && myDisciplineNames.length > 0;

  // Auto-select first discipline when data loads
  const [autoSelected, setAutoSelected] = useState(false);
  useEffect(() => {
    if (!autoSelected && disciplines.length > 0) {
      if (hasRestrictedDisciplines && myDisciplineNames.length > 0) {
        setSelectedDisciplines([myDisciplineNames[0]]);
      } else if (disciplines[0]) {
        setSelectedDisciplines([disciplines[0].name]);
      }
      setAutoSelected(true);
    }
  }, [disciplines.length, hasRestrictedDisciplines, myDisciplineNames.join(",")]);

  // Mutations
  const createTaskMut = trpc.tasks.create.useMutation({
    onSuccess: () => {
      toast.success("Tarefa criada!");
      utils.tasks.listByCrsWithChecklist.invalidate();
      setShowCreateTask(false);
      setTaskForm({ title: "", description: "", priority: "medium", assigneeId: "", dueDate: "", setor: "", phaseId: "" });
      setPrefillDiscipline(null);
    },
    onError: (e) => toast.error(e.message),
  });
  const updateTaskMut = trpc.tasks.update.useMutation({
    onSuccess: () => {
      toast.success("Tarefa atualizada!");
      utils.tasks.listByCrsWithChecklist.invalidate();
      setEditingTask(null);
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteTaskMut = trpc.tasks.delete.useMutation({
    onSuccess: () => { toast.success("Tarefa excluída."); utils.tasks.listByCrsWithChecklist.invalidate(); },
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

  // All available discipline columns
  const allColumns = useMemo(() => {
    const cols = disciplines.map((d) => ({ id: d.id, name: d.name, color: d.color ?? "#6366f1" }));
    if ((tasksByDiscipline["Sem Disciplina"] ?? []).length > 0) {
      cols.push({ id: -1, name: "Sem Disciplina", color: "#94a3b8" });
    }
    return cols;
  }, [disciplines, tasksByDiscipline]);

  // Available disciplines for restricted users
  const availableColumns = useMemo(() => {
    if (hasRestrictedDisciplines) {
      return allColumns.filter((d) => myDisciplineNames.includes(d.name));
    }
    return allColumns;
  }, [allColumns, hasRestrictedDisciplines, myDisciplineNames]);

  // Columns to render (max 2)
  const columnsToRender = useMemo(() => {
    return selectedDisciplines
      .filter(Boolean)
      .map((name) => availableColumns.find((c) => c.name === name))
      .filter(Boolean) as { id: number; name: string; color: string }[];
  }, [selectedDisciplines, availableColumns]);

  function setSlotDiscipline(slot: 0 | 1, name: string) {
    setSelectedDisciplines((prev) => {
      const next = [...prev];
      next[slot] = name;
      return next.slice(0, 2);
    });
  }

  function openAddTask(disciplineId: number, disciplineName: string) {
    setPrefillDiscipline({ id: disciplineId, name: disciplineName });
    setTaskForm({
      title: "", description: "", priority: "medium", assigneeId: "",
      dueDate: "", setor: disciplineName, phaseId: phases[0]?.id ? String(phases[0].id) : "",
    });
    setShowCreateTask(true);
  }

  function handleCreateTask() {
    if (!effectiveCrsId) return toast.error("Selecione um Contrato.");
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

  // ── Discipline Selector (sidebar widget) ────────────────────────────────────
  function DisciplineSelector({ slot, value, onChange }: { slot: 0 | 1; value: string; onChange: (v: string) => void }) {
    const disc = availableColumns.find((c) => c.name === value);
    const taskCount = value ? (tasksByDiscipline[value] ?? []).length : 0;
    return (
      <div className="px-4 py-2">
        <p className="text-xs font-medium text-muted-foreground mb-1">
          {slot === 0 ? "Disciplina 1" : "Disciplina 2"}
        </p>
        <Select value={value || "_none"} onValueChange={(v) => onChange(v === "_none" ? "" : v)}>
          <SelectTrigger className="h-9 text-sm w-full">
            {disc ? (
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: disc.color }} />
                <span className="truncate">{disc.name}</span>
                <Badge variant="secondary" className="ml-auto text-xs flex-shrink-0">{taskCount}</Badge>
              </div>
            ) : (
              <span className="text-muted-foreground">Selecionar...</span>
            )}
          </SelectTrigger>
          <SelectContent>
            {slot === 1 && <SelectItem value="_none">— Nenhuma —</SelectItem>}
            {availableColumns.map((c) => (
              <SelectItem key={`slot${slot}-${c.id}`} value={c.name}>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                  <span>{c.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">({(tasksByDiscipline[c.name] ?? []).length})</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <AppLayout title="Kanban" fullHeight>
      <>
      <SplitLayout
        leftWidth="240px"
        left={
          <>
            <SplitPanelHeader
              title="Contratos"
              subtitle={`${crsItems.length} contrato${crsItems.length !== 1 ? 's' : ''}`}
            />
            <SplitPanelList>
              {crsQ.isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="px-4 py-3 border-b border-border/50">
                    <Skeleton className="h-4 w-3/4 mb-1" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))
              ) : crsItems.length === 0 ? (
                <SplitPanelEmpty
                  icon={<FolderKanban className="w-5 h-5" />}
                  title="Nenhum contrato"
                  description="Crie um contrato na página de Projetos."
                />
              ) : (
                crsItems.map((c: any) => {
                  const isSelected = c.id === effectiveCrsId;
                  return (
                    <SplitPanelItem key={c.id} active={isSelected} onClick={() => setSelectedCrsId(c.id)}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          {c.clientName && (
                            <div className="flex items-center gap-1 mb-0.5">
                              {c.clientColor && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: c.clientColor }} />}
                              <p className="text-xs text-muted-foreground truncate">{c.clientName}</p>
                            </div>
                          )}
                          <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                          {c.state && <p className="text-xs text-muted-foreground">{c.state}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-bold text-primary">{c.progress}%</p>
                          <div className="w-10 h-1 bg-muted rounded-full mt-1">
                            <div className="h-full rounded-full" style={{ width: `${c.progress}%`, backgroundColor: '#3b82f6' }} />
                          </div>
                        </div>
                      </div>
                    </SplitPanelItem>
                  );
                })
              )}
            </SplitPanelList>

            {/* ── Discipline selectors ── */}
            {effectiveCrsId && availableColumns.length > 0 && (
              <div className="border-t border-border pt-2 pb-2">
                <p className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Disciplinas</p>
                <DisciplineSelector
                  slot={0}
                  value={selectedDisciplines[0] ?? ""}
                  onChange={(v) => setSlotDiscipline(0, v)}
                />
                <DisciplineSelector
                  slot={1}
                  value={selectedDisciplines[1] ?? ""}
                  onChange={(v) => setSlotDiscipline(1, v)}
                />
              </div>
            )}
          </>
        }
        right={
          <div className="flex flex-col h-full overflow-hidden">
            {/* ── Toolbar ── */}
            <div className="px-4 py-3 border-b border-border bg-background/80 backdrop-blur flex-shrink-0">
              <div className="flex flex-wrap items-center gap-3">
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
                      setTaskForm({ title: "", description: "", priority: "medium", assigneeId: "", dueDate: "", setor: selectedDisciplines[0] ?? "", phaseId: phases[0]?.id ? String(phases[0].id) : "" });
                      setPrefillDiscipline(null);
                      setShowCreateTask(true);
                    }} className="gap-1.5 h-8">
                      <Plus className="w-3.5 h-3.5" /> Nova Tarefa
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* ── Board ── */}
            {!effectiveCrsId ? (
              <div className="flex flex-col items-center justify-center flex-1 py-20 text-center">
                <FolderKanban className="w-12 h-12 text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground font-medium">Nenhum Contrato disponível</p>
                <p className="text-sm text-muted-foreground/60 mt-1">Crie um Contrato na página de Projetos para começar.</p>
              </div>
            ) : isLoading ? (
              <div className="flex gap-4 p-4 overflow-x-auto">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="flex-1">
                    <Skeleton className="h-12 rounded-t-2xl mb-2" />
                    {Array.from({ length: 3 }).map((_, j) => <Skeleton key={j} className="h-28 rounded-xl mb-2" />)}
                  </div>
                ))}
              </div>
            ) : columnsToRender.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 py-20 text-center">
                <Layers className="w-12 h-12 text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground font-medium">Selecione uma disciplina</p>
                <p className="text-sm text-muted-foreground/60 mt-1">Use os seletores na barra lateral para escolher qual disciplina visualizar.</p>
              </div>
            ) : (
              <div className={`grid gap-4 p-4 flex-1 overflow-y-auto ${columnsToRender.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
                {columnsToRender.map((disc) => (
                  <DisciplineColumn
                    key={`col-${disc.id}`}
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
        }
      />

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
      </>
    </AppLayout>
  );
}
