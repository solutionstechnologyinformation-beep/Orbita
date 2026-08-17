import { useState, useMemo, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDroppable,
  closestCenter, type DragStartEvent, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { trpc } from "@/lib/trpc";
import { matchesKanbanTaskSearch } from "../../../shared/kanban-search";
import { getKanbanCompanyOptions, matchesKanbanCompanyFilter } from "../../../shared/kanban-company-filter";
import { isCompletedKanbanPhase } from "../../../shared/kanban-completion";
import { isBlockedPhaseName } from "../../../shared/kanban-block";
import { getKanbanPhaseDropId, parseKanbanPhaseDropId } from "../../../shared/kanban-dnd";
import { getKanbanPhaseDisplayName } from "../../../shared/kanban-labels";
import { isKanbanTaskCompleted, isKanbanTaskOverdue } from "../../../shared/kanban-card-state";
import { filterKanbanCrsByClient, getKanbanClientOptions } from "../../../shared/kanban-client-filter";
import { buildKanbanUrl, buildTaskDetailUrl, parseKanbanUrlState } from "../../../shared/kanban-navigation";
import { formatDateInput, formatDateOnly, parseDateInput } from "../../../shared/date-only";
import { useAuth } from "@/_core/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { SplitLayout, SplitPanelHeader, SplitPanelList, SplitPanelItem, SplitPanelEmpty } from "@/components/SplitLayout";
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
  Plus, CheckCircle2, Circle, AlertTriangle,
  User, Calendar, Layers, Search, Filter, ExternalLink, ChevronDown,
  ChevronUp, ListChecks, Pencil, Trash2, FolderKanban, GripVertical,
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

// ── Checklist Preview ─────────────────────────────────────────────────────────
function ChecklistPreview({ items, isTaskCompleted = false }: { items: any[]; isTaskCompleted?: boolean }) {
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
        const isOverdue = !isTaskCompleted && endDate && endDate < new Date() && !isDone;
        const visuallyCompleted = isTaskCompleted || isDone;
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
              <span className={`text-xs leading-tight ${visuallyCompleted ? "line-through text-muted-foreground" : "text-foreground"}`}>
                {item.title}
              </span>
            </div>
            {(endDate || item.assigneeName || item.assigneeCompany) && (
              <div className="flex items-center gap-2 pl-5">
                {(item.assigneeName || item.assigneeCompany) && (
                  <span className="flex min-w-0 items-start gap-0.5 text-[10px] text-muted-foreground">
                    <User className="mt-0.5 w-2.5 h-2.5 flex-shrink-0" />
                    <span className="min-w-0 truncate">
                      <span className="block truncate">{item.assigneeName ?? "Responsável"}</span>
                      {item.assigneeCompany && <span className="block truncate text-[9px] text-muted-foreground/80">{item.assigneeCompany}</span>}
                    </span>
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

// ── Sortable Task Card ─────────────────────────────────────────────────────────
function SortableTaskCard({
  task, phases, isAdmin, onEdit, onDelete, onNavigate, isDragging,
}: {
  task: any; phases: any[]; isAdmin: boolean;
  onEdit: (t: any) => void; onDelete: (id: number) => void; onNavigate: (id: number) => void;
  isDragging?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: `task-${task.id}`,
    data: { type: "task", task },
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
    opacity: isDragging ? 0.4 : 1,
  };
  const [expanded, setExpanded] = useState(false);
  const p = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium;
  const phase = phases.find((ph) => ph.id === task.phaseId);
  const isTaskCompleted = isKanbanTaskCompleted(task, phase);
  const isOverdue = isKanbanTaskOverdue(task, phase);
  const checklist: any[] = task.checklistItems ?? [];

  return (
    <div ref={setNodeRef} style={style} data-completed={isTaskCompleted ? "true" : "false"} className={`border rounded-xl p-3 hover:shadow-lg transition-all duration-200 group hover:scale-[1.02] active:scale-[0.98] ${isTaskCompleted ? "bg-muted/60 border-border/70 opacity-75 grayscale-[0.12]" : "bg-card border-border"}`}>
      {/* Drag handle + header */}
      <div className="flex items-start gap-1.5">
        <button
          {...attributes} {...listeners}
          className="mt-0.5 flex-shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors touch-none"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                <span className="text-xs font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: p.bg, color: p.color }}>
                  {p.label}
                </span>
                {isOverdue && (
                  <span className="flex items-center gap-0.5 text-xs text-red-400">
                    <AlertTriangle className="w-3 h-3" /> Atrasada
                  </span>
                )}
              </div>
              <p className={`text-sm font-medium leading-tight ${isTaskCompleted ? "text-muted-foreground" : "text-foreground"}`}>{task.title}</p>
              {(task.crsName || task.crsCode) && (
                <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground truncate">
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary truncate">OS: {task.crsName ?? "—"}</span>
                  {task.crsCode && <span className="rounded bg-muted px-1.5 py-0.5 font-mono truncate">CRS: {task.crsCode}</span>}
                </div>
              )}
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

          {/* Progress */}
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
            {(task.assigneeName || task.assigneeCompany) && (
              <span className="flex min-w-0 items-start gap-1" title={task.assigneeCompany ? `${task.assigneeName ?? "Responsável"} · ${task.assigneeCompany}` : task.assigneeName ?? "Responsável"}>
                <User className="mt-0.5 w-3 h-3 flex-shrink-0" />
                <span className="min-w-0 truncate">
                  <span className="block truncate">{task.assigneeName ?? "Responsável"}</span>
                  {task.assigneeCompany && <span className="block truncate text-[10px] text-muted-foreground/80">{task.assigneeCompany}</span>}
                </span>
              </span>
            )}
            {task.dueDate && (
              <span className={`flex items-center gap-1 flex-shrink-0 ${isOverdue ? "text-red-400" : ""}`}>
                <Calendar className="w-3 h-3" />
                {formatDateOnly(task.dueDate)}
              </span>
            )}
          </div>

          {/* Checklist */}
          {checklist.length > 0 && (
            <>
              <button
                onClick={() => setExpanded(!expanded)}
                className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
              >
                {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {expanded ? "Ocultar checklist" : `Ver checklist (${checklist.filter((i: any) => i.status === "published").length}/${checklist.length})`}
              </button>
              {expanded && <ChecklistPreview items={checklist} isTaskCompleted={isTaskCompleted} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Phase Column (droppable) ───────────────────────────────────────────────────
function PhaseColumn({
  phase, tasks, isAdmin, onAddTask, onEdit, onDelete, onNavigate, activeTaskId,
}: {
  phase: { id: number; name: string; color: string };
  tasks: any[]; isAdmin: boolean;
  onAddTask: (phaseId: number) => void;
  onEdit: (t: any) => void; onDelete: (id: number) => void; onNavigate: (id: number) => void;
  activeTaskId: string | null;
}) {
  const taskIds = tasks.map((t) => `task-${t.id}`);
  const { isOver, setNodeRef: setDropRef } = useDroppable({
    id: getKanbanPhaseDropId(phase.id),
    data: { type: "phase", phase },
  });
  return (
    <div className={`flex flex-col bg-secondary/30 rounded-2xl border border-border overflow-hidden h-full transition-colors duration-200 ${isOver ? "ring-2 ring-primary/50 bg-primary/5" : ""}`}>
      {/* Header */}
      <div className="p-3 border-b border-border flex-shrink-0" style={{ borderTopColor: phase.color, borderTopWidth: 3 }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: phase.color }} />
            <h3 className="text-sm font-semibold text-foreground">{getKanbanPhaseDisplayName(phase.name)}</h3>
          </div>
          <div className="flex items-center gap-1">
            <Badge variant="secondary" className="text-xs">{tasks.length}</Badge>
            {isAdmin && (
              <button
                onClick={() => onAddTask(phase.id)}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Droppable task list */}
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div ref={setDropRef} className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[80px] transition-colors duration-200 hover:bg-primary/5 rounded-lg">
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center border-2 border-dashed border-border/40 rounded-xl">
              <p className="text-xs text-muted-foreground">Arraste tarefas aqui</p>
              {isAdmin && (
                <button onClick={() => onAddTask(phase.id)} className="mt-1 text-xs text-primary hover:underline">
                  + Adicionar
                </button>
              )}
            </div>
          ) : (
            tasks.map((task) => (
              <SortableTaskCard
                key={`task-${task.id}`}
                task={task}
                phases={[phase]}
                isAdmin={isAdmin}
                onEdit={onEdit}
                onDelete={onDelete}
                onNavigate={onNavigate}
                isDragging={activeTaskId === `task-${task.id}`}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function Kanban() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "master_admin";
  const [, navigate] = useLocation();
  const queryString = useSearch();

  const urlState = useMemo(() => parseKanbanUrlState(queryString), [queryString]);
  const [selectedCrsId, setSelectedCrsId] = useState<number | null>(urlState.crsId);
  const [search, setSearch] = useState(urlState.search);
  const [filterPriority, setFilterPriority] = useState(urlState.priority);
  const [filterAssignee, setFilterAssignee] = useState(urlState.assignee);
  const [filterCompany, setFilterCompany] = useState(urlState.company);
  const [filterClient, setFilterClient] = useState(urlState.client);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const restoredScrollKeyRef = useRef<string | null>(null);

  useEffect(() => {
    setSelectedCrsId(urlState.crsId);
    setSearch(urlState.search);
    setFilterPriority(urlState.priority);
    setFilterAssignee(urlState.assignee);
    setFilterCompany(urlState.company);
    setFilterClient(urlState.client);
    if (urlState.disciplines.length > 0) {
      setSelectedDisciplines(urlState.disciplines);
      setAutoSelected(true);
    } else {
      setSelectedDisciplines([]);
      setAutoSelected(false);
    }
  }, [urlState]);

  // Discipline selectors (max 2)
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>([]);
  const [autoSelected, setAutoSelected] = useState(false);

  // DnD state
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [blockedMove, setBlockedMove] = useState<{ taskId: number; phaseId: number; title: string } | null>(null);
  const [blockReason, setBlockReason] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // Dialogs
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [taskForm, setTaskForm] = useState({
    title: "", description: "", priority: "medium", assigneeId: "",
    dueDate: "", setor: "", phaseId: "", crsId: "",
  });
  const [prefillPhaseId, setPrefillPhaseId] = useState<number | null>(null);

  const utils = trpc.useUtils();

  // Queries
  const crsQ = trpc.crs.list.useQuery();
  const allCrsItems: any[] = crsQ.data ?? [];
  const clientOptions = useMemo(() => getKanbanClientOptions(allCrsItems), [allCrsItems]);
  const crsItems = useMemo(
    () => filterKanbanCrsByClient(allCrsItems, filterClient),
    [allCrsItems, filterClient],
  );
  useEffect(() => {
    if (selectedCrsId != null && !crsItems.some((crs) => crs.id === selectedCrsId)) {
      setSelectedCrsId(crsItems[0]?.id ?? null);
    }
  }, [crsItems, selectedCrsId]);
  const selectedCrs = crsItems.find((c: any) => c.id === selectedCrsId) ?? (crsItems[0] ?? null);
  const effectiveCrsId = selectedCrs?.id ?? null;

  const phasesQ = trpc.kanbanPhases.list.useQuery({ crsId: effectiveCrsId! }, { enabled: !!effectiveCrsId });
  const tasksQ = trpc.tasks.listByCrsWithChecklist.useQuery({ crsId: effectiveCrsId! }, { enabled: !!effectiveCrsId });
  const disciplinesQ = trpc.disciplines.list.useQuery();
  const membersQ = trpc.users.list.useQuery();
  const myDisciplinesQ = trpc.users.getDisciplines.useQuery({ userId: user?.id }, { enabled: !!user?.id });

  const phases = phasesQ.data ?? [];
  const allTasks: any[] = tasksQ.data ?? [];
  const disciplines: any[] = disciplinesQ.data ?? [];
  const members: any[] = membersQ.data ?? [];
  const myDisciplineNames: string[] = (myDisciplinesQ.data ?? []).map((d: any) => d.disciplineName);
  const hasRestrictedDisciplines = !isAdmin && myDisciplineNames.length > 0;

  // Available disciplines
  const availableColumns = useMemo(() => {
    const cols = disciplines.map((d) => ({ id: d.id, name: d.name, color: d.color ?? "#6366f1" }));
    if (hasRestrictedDisciplines) return cols.filter((c) => myDisciplineNames.includes(c.name));
    return cols;
  }, [disciplines, hasRestrictedDisciplines, myDisciplineNames]);

  // Auto-select first discipline
  useEffect(() => {
    if (!autoSelected && availableColumns.length > 0) {
      setSelectedDisciplines([availableColumns[0].name]);
      setAutoSelected(true);
    }
  }, [availableColumns.length]);

  // Mutations
  const moveTaskMut = trpc.tasks.movePhase.useMutation({
    onSuccess: (_result, variables) => {
      utils.tasks.listByCrsWithChecklist.invalidate();
      const targetPhase = phases.find((phase: any) => phase.id === variables.phaseId);
      const isCompletedPhase = isCompletedKanbanPhase(targetPhase);
      const movedTask = allTasks.find((task) => task.id === variables.id);
      if (isCompletedPhase) {
        toast.success("Card concluído!", {
          description: movedTask?.title ? `“${movedTask.title}” foi movido para a etapa Concluído.` : "O card foi movido para a etapa Concluído.",
          duration: 3500,
          icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
        });
      } else {
        toast.success("Tarefa movida com sucesso!", {
          duration: 2000,
          icon: "✓",
        });
      }
    },
    onError: (e) => { toast.error(e.message); utils.tasks.listByCrsWithChecklist.invalidate(); },
  });
  const createTaskMut = trpc.tasks.create.useMutation({
    onSuccess: () => {
      toast.success("Tarefa criada!");
      utils.tasks.listByCrsWithChecklist.invalidate();
      setShowCreateTask(false);
      setTaskForm({ title: "", description: "", priority: "medium", assigneeId: "", dueDate: "", setor: "", phaseId: "", crsId: "" });
    },
    onError: (e) => toast.error(e.message),
  });
  const updateTaskMut = trpc.tasks.update.useMutation({
    onSuccess: () => { toast.success("Tarefa atualizada!"); utils.tasks.listByCrsWithChecklist.invalidate(); setEditingTask(null); },
    onError: (e) => toast.error(e.message),
  });
  const deleteTaskMut = trpc.tasks.delete.useMutation({
    onSuccess: () => { toast.success("Tarefa excluída."); utils.tasks.listByCrsWithChecklist.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const companyOptions = useMemo(() => getKanbanCompanyOptions(allTasks), [allTasks]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return allTasks.filter((t) => {
      if (!matchesKanbanTaskSearch(t, search)) return false;
      if (filterPriority !== "all" && t.priority !== filterPriority) return false;
      if (filterAssignee !== "all" && String(t.assigneeId) !== filterAssignee) return false;
      if (!matchesKanbanCompanyFilter(t, filterCompany)) return false;
      return true;
    });
  }, [allTasks, search, filterPriority, filterAssignee, filterCompany]);

  // Tasks grouped by discipline then by phase
  const tasksByDiscAndPhase = useMemo(() => {
    const result: Record<string, Record<number, any[]>> = {};
    for (const disc of availableColumns) {
      result[disc.name] = {};
      for (const ph of phases) result[disc.name][ph.id] = [];
    }
    for (const t of filteredTasks) {
      const discName = t.setor && result[t.setor] !== undefined ? t.setor : null;
      if (!discName) continue;
      const phId = t.phaseId;
      if (result[discName] && result[discName][phId] !== undefined) {
        result[discName][phId].push(t);
      }
    }
    return result;
  }, [filteredTasks, availableColumns, phases]);

  // Columns to render (max 2)
  const columnsToRender = useMemo(() => {
    return selectedDisciplines
      .filter(Boolean)
      .map((name) => availableColumns.find((c) => c.name === name))
      .filter(Boolean) as { id: number; name: string; color: string }[];
  }, [selectedDisciplines, availableColumns]);

  function getBoardScrollPosition() {
    return {
      scrollTop: boardRef.current?.scrollTop ?? 0,
      scrollLeft: boardRef.current?.scrollLeft ?? 0,
    };
  }

  function navigateWithKanbanContext(overrides: { crsId?: number | null; disciplines?: string[]; scrollTop?: number; scrollLeft?: number } = {}) {
    const scroll = getBoardScrollPosition();
    navigate(buildKanbanUrl({
      crsId: overrides.crsId ?? effectiveCrsId,
      disciplines: overrides.disciplines ?? selectedDisciplines,
      search,
      priority: filterPriority,
      assignee: filterAssignee,
      company: filterCompany,
      client: filterClient,
      scrollTop: overrides.scrollTop ?? scroll.scrollTop,
      scrollLeft: overrides.scrollLeft ?? scroll.scrollLeft,
    }));
  }

  function buildTaskReturnUrl(taskId: number) {
    return buildTaskDetailUrl(taskId, {
      crsId: effectiveCrsId,
      disciplines: selectedDisciplines,
      search,
      priority: filterPriority,
      assignee: filterAssignee,
      company: filterCompany,
      client: filterClient,
      ...getBoardScrollPosition(),
    });
  }

  function handleCrsSelection(crsId: number) {
    setSelectedCrsId(crsId);
    setSelectedDisciplines([]);
    setAutoSelected(false);
    navigateWithKanbanContext({ crsId, disciplines: [] });
  }

  function setSlotDiscipline(slot: 0 | 1, name: string) {
    const next = [...selectedDisciplines];
    next[slot] = name;
    const normalized = next.slice(0, 2).filter(Boolean);
    setSelectedDisciplines(next.slice(0, 2));
    navigateWithKanbanContext({ disciplines: normalized });
  }

  // DnD handlers
  function handleDragStart(event: DragStartEvent) {
    setActiveTaskId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTaskId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find source task
    const taskId = parseInt(activeId.replace("task-", ""));
    const task = allTasks.find((t) => t.id === taskId);
    if (!task) return;

    // Determine target phase
    let targetPhaseId: number | null = null;
    if (overId.startsWith("phase-")) {
      targetPhaseId = parseKanbanPhaseDropId(overId);
    } else if (overId.startsWith("task-")) {
      const overTaskId = parseInt(overId.replace("task-", ""));
      const overTask = allTasks.find((t) => t.id === overTaskId);
      if (overTask) targetPhaseId = overTask.phaseId;
    }

    if (targetPhaseId && targetPhaseId !== task.phaseId) {
      const targetPhase = phases.find((phase: any) => phase.id === targetPhaseId);
      if (isBlockedPhaseName(targetPhase?.name)) {
        setBlockedMove({ taskId, phaseId: targetPhaseId, title: task.title });
        setBlockReason("");
        return;
      }
      moveTaskMut.mutate({ id: taskId, phaseId: targetPhaseId });
    }
  }

  function confirmBlockedMove() {
    if (!blockedMove) return;
    const reason = blockReason.trim();
    if (!reason) {
      toast.error("Informe o motivo do bloqueio.");
      return;
    }
    moveTaskMut.mutate(
      { id: blockedMove.taskId, phaseId: blockedMove.phaseId, blockReason: reason },
      { onSuccess: () => { setBlockedMove(null); setBlockReason(""); } },
    );
  }

  function openAddTask(phaseId: number) {
    setPrefillPhaseId(phaseId);
    setTaskForm({
      title: "", description: "", priority: "medium", assigneeId: "",
      dueDate: "", setor: selectedDisciplines[0] ?? "", phaseId: String(phaseId), crsId: String(effectiveCrsId ?? ""),
    });
    setShowCreateTask(true);
  }

  function handleCreateTask() {
    if (!taskForm.crsId) return toast.error("Selecione um CRS.");
    if (!taskForm.title.trim()) return toast.error("Título é obrigatório.");
    if (!taskForm.phaseId) return toast.error("Selecione uma fase.");
    createTaskMut.mutate({
      crsId: parseInt(taskForm.crsId),
      phaseId: parseInt(taskForm.phaseId),
      title: taskForm.title.trim(),
      description: taskForm.description.trim() || undefined,
      priority: taskForm.priority as any,
      assigneeId: taskForm.assigneeId ? parseInt(taskForm.assigneeId) : undefined,
      dueDate: taskForm.dueDate ? parseDateInput(taskForm.dueDate) ?? undefined : undefined,
      setor: taskForm.setor || undefined,
    });
  }

  function openEditTask(task: any) {
    setEditingTask(task);
    setTaskForm({
      title: task.title, description: task.description ?? "",
      priority: task.priority, assigneeId: task.assigneeId ? String(task.assigneeId) : "", crsId: String(task.crsId ?? effectiveCrsId ?? ""),
      dueDate: formatDateInput(task.dueDate),
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
      dueDate: taskForm.dueDate ? parseDateInput(taskForm.dueDate) : null,
      setor: taskForm.setor || null,
      phaseId: taskForm.phaseId ? parseInt(taskForm.phaseId) : undefined,
    });
  }

  const isLoading = crsQ.isLoading || tasksQ.isLoading || disciplinesQ.isLoading;

  useEffect(() => {
    const hasScrollToRestore = urlState.scrollTop > 0 || urlState.scrollLeft > 0;
    if (!hasScrollToRestore || isLoading || !effectiveCrsId || columnsToRender.length === 0) return;
    if (restoredScrollKeyRef.current === queryString) return;
    const board = boardRef.current;
    if (!board) return;

    const frame = window.requestAnimationFrame(() => {
      board.scrollTo({
        top: urlState.scrollTop,
        left: urlState.scrollLeft,
        behavior: "auto",
      });
      restoredScrollKeyRef.current = queryString;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [columnsToRender.length, effectiveCrsId, isLoading, queryString, urlState.scrollLeft, urlState.scrollTop]);

  // Active task for DragOverlay
  const activeTask = activeTaskId
    ? allTasks.find((t) => `task-${t.id}` === activeTaskId)
    : null;

  // ── Discipline Selector widget ────────────────────────────────────────────
  function DisciplineSelector({ slot, value, onChange }: { slot: 0 | 1; value: string; onChange: (v: string) => void }) {
    const disc = availableColumns.find((c) => c.name === value);
    const taskCount = value ? (tasksByDiscAndPhase[value] ? Object.values(tasksByDiscAndPhase[value]).flat().length : 0) : 0;
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
            {availableColumns.map((c) => {
              const cnt = tasksByDiscAndPhase[c.name] ? Object.values(tasksByDiscAndPhase[c.name]).flat().length : 0;
              return (
                <SelectItem key={`slot${slot}-${c.id}`} value={c.name}>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                    <span>{c.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">({cnt})</span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <AppLayout title="Kanban" fullHeight>
      <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
      <SplitLayout
        leftWidth="240px"
        left={
          <>
            <SplitPanelHeader
              title="Contratos"
              subtitle={`${crsItems.length} contrato${crsItems.length !== 1 ? 's' : ''}${filterClient !== "all" ? " filtrado(s)" : ""}`}
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
                    <SplitPanelItem key={c.id} active={isSelected} onClick={() => handleCrsSelection(c.id)}>
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

            {/* Discipline selectors */}
            {effectiveCrsId && availableColumns.length > 0 && (
              <div className="border-t border-border pt-2 pb-2">
                <p className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Disciplinas</p>
                <DisciplineSelector slot={0} value={selectedDisciplines[0] ?? ""} onChange={(v) => setSlotDiscipline(0, v)} />
                <DisciplineSelector slot={1} value={selectedDisciplines[1] ?? ""} onChange={(v) => setSlotDiscipline(1, v)} />
              </div>
            )}
          </>
        }
        right={
          <div className="flex flex-col h-full overflow-hidden">
            {/* Toolbar */}
            <div className="px-4 py-3 border-b border-border bg-background/80 backdrop-blur flex-shrink-0">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[180px] max-w-xs">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input aria-label="Buscar card ou responsável" placeholder="Buscar card ou responsável..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
                </div>
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
                {clientOptions.length > 0 && (
                  <Select value={filterClient} onValueChange={setFilterClient}>
                    <SelectTrigger className="w-44 h-8 text-sm" aria-label="Filtrar por cliente">
                      <FolderKanban className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                      <SelectValue placeholder="Cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os clientes</SelectItem>
                      {clientOptions.map((client) => (
                        <SelectItem key={client.id} value={String(client.id)}>
                          <span className="flex items-center gap-2">
                            {client.color && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: client.color }} />}
                            <span className="truncate">{client.name}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {companyOptions.length > 0 && (
                  <div className="flex max-w-full flex-wrap items-center gap-1" role="group" aria-label="Filtrar por empresa">
                    <span className="mr-1 text-xs text-muted-foreground">Empresa:</span>
                    <Button type="button" size="sm" variant={filterCompany === "all" ? "default" : "outline"} className="h-7 rounded-full px-2.5 text-xs" onClick={() => setFilterCompany("all")}>Todas</Button>
                    {companyOptions.map((company) => (
                      <Button key={company} type="button" size="sm" variant={filterCompany === company ? "default" : "outline"} className="h-7 max-w-40 rounded-full px-2.5 text-xs" onClick={() => setFilterCompany(company)} title={company}>
                        <span className="truncate">{company}</span>
                      </Button>
                    ))}
                  </div>
                )}
                <div className="ml-auto flex items-center gap-2">
                  {selectedCrs?.tipoObra && (
                    <span className="text-xs px-2 py-1 rounded-full border border-border text-muted-foreground">
                      {TIPO_OBRA_MAP[selectedCrs.tipoObra] ?? selectedCrs.tipoObra}
                    </span>
                  )}
                  {isAdmin && effectiveCrsId && (
                    <Button size="sm" onClick={() => {
                      setTaskForm({ title: "", description: "", priority: "medium", assigneeId: "", dueDate: "", setor: selectedDisciplines[0] ?? "", phaseId: phases[0]?.id ? String(phases[0].id) : "", crsId: String(effectiveCrsId ?? "") });
                      setPrefillPhaseId(null);
                      setShowCreateTask(true);
                    }} className="gap-1.5 h-8">
                      <Plus className="w-3.5 h-3.5" /> Nova Tarefa
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Board */}
            {!effectiveCrsId ? (
              <div className="flex flex-col items-center justify-center flex-1 py-20 text-center">
                <FolderKanban className="w-12 h-12 text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground font-medium">Nenhum Contrato disponível</p>
              </div>
            ) : isLoading ? (
              <div className="flex gap-4 p-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex-1">
                    <Skeleton className="h-12 rounded-t-2xl mb-2" />
                    {Array.from({ length: 2 }).map((_, j) => <Skeleton key={j} className="h-24 rounded-xl mb-2" />)}
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
              <div ref={boardRef} data-kanban-board-scroll className="flex-1 overflow-auto p-4">
                {columnsToRender.map((disc) => (
                  <div key={`disc-${disc.id}`} className="mb-6">
                    {/* Discipline header */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: disc.color }} />
                      <h2 className="text-sm font-bold text-foreground">{disc.name}</h2>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                    {/* Phase columns */}
                    {phases.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhuma fase configurada para este contrato.</p>
                    ) : (
                      <div className={`grid gap-3 ${phases.length <= 3 ? `grid-cols-${phases.length}` : "grid-cols-4"}`}
                        style={{ gridTemplateColumns: `repeat(${Math.min(phases.length, 5)}, minmax(0, 1fr))` }}>
                        {phases.map((ph: any) => (
                          <PhaseColumn
                            key={`ph-${disc.id}-${ph.id}`}
                            phase={ph}
                            tasks={(tasksByDiscAndPhase[disc.name] ?? {})[ph.id] ?? []}
                            isAdmin={isAdmin}
                            onAddTask={openAddTask}
                            onEdit={openEditTask}
                            onDelete={(id) => { if (confirm("Excluir tarefa?")) deleteTaskMut.mutate({ id }); }}
                            onNavigate={(id) => navigate(buildTaskReturnUrl(id))}
                            activeTaskId={activeTaskId}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        }
      />

      {/* DragOverlay */}
      <DragOverlay>
        {activeTask ? (
          <div className="bg-card border border-primary/50 rounded-xl p-3 shadow-2xl rotate-2 opacity-95">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded"
                style={{ backgroundColor: (PRIORITY_CONFIG[activeTask.priority] ?? PRIORITY_CONFIG.medium).bg, color: (PRIORITY_CONFIG[activeTask.priority] ?? PRIORITY_CONFIG.medium).color }}>
                {(PRIORITY_CONFIG[activeTask.priority] ?? PRIORITY_CONFIG.medium).label}
              </span>
            </div>
            <p className="text-sm font-medium text-foreground">{activeTask.title}</p>
          </div>
        ) : null}
      </DragOverlay>
      </DndContext>

      {/* Block reason dialog */}
      <Dialog open={!!blockedMove} onOpenChange={(open) => { if (!open && !moveTaskMut.isPending) setBlockedMove(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Motivo do bloqueio</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Informe por que “{blockedMove?.title ?? "esta tarefa"}” não pode continuar.</p>
            <Textarea
              value={blockReason}
              onChange={(event) => setBlockReason(event.target.value)}
              placeholder="Descreva o impedimento..."
              rows={4}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockedMove(null)} disabled={moveTaskMut.isPending}>Cancelar</Button>
            <Button onClick={confirmBlockedMove} disabled={moveTaskMut.isPending || !blockReason.trim()}>
              {moveTaskMut.isPending ? "Salvando..." : "Bloquear tarefa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Task Dialog */}
      <Dialog open={showCreateTask} onOpenChange={(o) => { if (!o) setShowCreateTask(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Tarefa</DialogTitle>
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
            <div>
              <Label>CRS *</Label>
              <Select value={taskForm.crsId} onValueChange={(v) => setTaskForm((f) => ({ ...f, crsId: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione o CRS" /></SelectTrigger>
                <SelectContent>
                  {crsItems.map((crs: any) => (
                    <SelectItem key={crs.id} value={String(crs.id)}>{crs.code ? `${crs.code} — ${crs.name}` : crs.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                          {getKanbanPhaseDisplayName(ph.name)}
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
            <Button variant="outline" onClick={() => setShowCreateTask(false)}>Cancelar</Button>
            <Button onClick={handleCreateTask} disabled={createTaskMut.isPending}>
              {createTaskMut.isPending ? "Criando..." : "Criar Tarefa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Task Dialog */}
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
                          {getKanbanPhaseDisplayName(ph.name)}
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
