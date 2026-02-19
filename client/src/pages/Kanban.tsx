import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useParams } from "wouter";
import { Link } from "wouter";
import { toast } from "sonner";
import { useState, useCallback } from "react";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus, GripVertical, MoreHorizontal, Trash2, Eye, AlertCircle,
  CheckCircle2, Clock, Share2, BookOpen, Archive, Info, Shield,
  User2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";

// ── Types ──────────────────────────────────────────────────────────────────────
type TaskStatus = "pending" | "in_progress" | "shared" | "published" | "archived";
type TaskPriority = "low" | "medium" | "high" | "urgent";

interface Task {
  id: number;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId?: number | null;
  assigneeName?: string | null;
  dueDate?: Date | null;
  position: number;
  revisionsCount?: number | null;
  openedAt?: Date | null;
  completedAt?: Date | null;
}

// ── Column Definitions ─────────────────────────────────────────────────────────
const COLUMNS: {
  id: TaskStatus;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  badgeClass: string;
  barColor: string;
  leaderOnly: boolean;
}[] = [
  {
    id: "pending",
    label: "Para Iniciar",
    description: "Atividades sem atribuição de responsável e sem iniciar.",
    icon: BookOpen,
    color: "text-slate-600",
    bgColor: "bg-slate-50",
    borderColor: "border-slate-200",
    badgeClass: "bg-slate-100 text-slate-600 border-slate-200",
    barColor: "bg-slate-400",
    leaderOnly: false,
  },
  {
    id: "in_progress",
    label: "Em Andamento",
    description: "Atividades com atribuição de responsável e iniciadas.",
    icon: Clock,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    badgeClass: "bg-blue-100 text-blue-700 border-blue-200",
    barColor: "bg-blue-500",
    leaderOnly: false,
  },
  {
    id: "shared",
    label: "Compartilhado",
    description: "Atividades finalizadas aguardando aprovação do Líder da equipe.",
    icon: Share2,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
    barColor: "bg-amber-500",
    leaderOnly: false,
  },
  {
    id: "published",
    label: "Publicado",
    description: "Atividades finalizadas e aprovadas pelo Líder. Somente o Líder pode mover para cá.",
    icon: CheckCircle2,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    badgeClass: "bg-emerald-100 text-emerald-700 border-emerald-200",
    barColor: "bg-emerald-500",
    leaderOnly: true,
  },
  {
    id: "archived",
    label: "Arquivado",
    description: "Atividades aprovadas e finalizadas definitivamente. Somente o Líder pode arquivar.",
    icon: Archive,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
    badgeClass: "bg-purple-100 text-purple-700 border-purple-200",
    barColor: "bg-purple-500",
    leaderOnly: true,
  },
];

const STATUS_ORDER: TaskStatus[] = ["pending", "in_progress", "shared", "published", "archived"];

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; dot: string }> = {
  low:    { label: "Baixa",   dot: "bg-slate-400" },
  medium: { label: "Média",   dot: "bg-blue-500" },
  high:   { label: "Alta",    dot: "bg-orange-500" },
  urgent: { label: "Urgente", dot: "bg-red-500" },
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function isOverdue(task: Task) {
  if (!task.dueDate) return false;
  if (task.status === "published" || task.status === "archived") return false;
  return new Date(task.dueDate) < new Date();
}

function isDueSoon(task: Task) {
  if (!task.dueDate || isOverdue(task)) return false;
  if (task.status === "published" || task.status === "archived") return false;
  return new Date(task.dueDate).getTime() - Date.now() < 24 * 60 * 60 * 1000;
}

// Allowed transitions based on role
function getAllowedTransitions(from: TaskStatus, isLeader: boolean): TaskStatus[] {
  if (from === "pending") return ["in_progress"];
  if (from === "in_progress") return ["shared"];
  if (from === "shared") {
    return isLeader ? ["published", "archived", "in_progress"] : [];
  }
  if (from === "published") return isLeader ? ["archived", "in_progress"] : [];
  if (from === "archived") return isLeader ? ["in_progress"] : [];
  return [];
}

// ── Status Progress Bar ────────────────────────────────────────────────────────
function StatusProgressBar({ status, isLeader, onStatusChange }: {
  status: TaskStatus;
  isLeader: boolean;
  onStatusChange: (s: TaskStatus) => void;
}) {
  const currentIdx = STATUS_ORDER.indexOf(status);
  const allowed = getAllowedTransitions(status, isLeader);

  return (
    <div className="flex items-center gap-0.5 mt-2.5 pt-2.5 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
      {STATUS_ORDER.map((s, i) => {
        const col = COLUMNS.find((c) => c.id === s)!;
        const isActive = i === currentIdx;
        const isPast = i < currentIdx;
        const canClick = allowed.includes(s);
        return (
          <Tooltip key={s}>
            <TooltipTrigger asChild>
              <button
                onClick={(e) => { e.stopPropagation(); if (canClick) onStatusChange(s); }}
                disabled={!canClick}
                className={`flex-1 h-1.5 rounded-full transition-all duration-200 ${
                  isActive ? col.barColor :
                  isPast ? "bg-gray-300" :
                  canClick ? `${col.barColor} opacity-30 hover:opacity-60 cursor-pointer` :
                  "bg-gray-100 cursor-not-allowed"
                }`}
              />
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {canClick ? `Mover para ${col.label}` : isActive ? col.label : col.leaderOnly && !isLeader ? `${col.label} (somente Líder)` : col.label}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

// ── TaskCard ───────────────────────────────────────────────────────────────────
function TaskCard({
  task, isLeader, onStatusChange, onDelete, isDragging = false,
}: {
  task: Task; isLeader: boolean;
  onStatusChange: (id: number, status: TaskStatus) => void;
  onDelete: (id: number) => void;
  isDragging?: boolean;
}) {
  const overdue = isOverdue(task);
  const dueSoon = isDueSoon(task);
  const prio = PRIORITY_CONFIG[task.priority];
  const transitions = getAllowedTransitions(task.status, isLeader);

  return (
    <div className={`bg-white border rounded-xl p-3.5 shadow-sm hover:shadow-md transition-all duration-200 group
      ${isDragging ? "opacity-50 rotate-1 scale-105 shadow-xl" : ""}
      ${overdue ? "border-red-300 bg-red-50/30" : dueSoon ? "border-amber-300 bg-amber-50/20" : "border-gray-200"}
    `}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <Link href={`/tasks/${task.id}`}>
          <p className={`text-sm font-medium leading-snug hover:text-primary transition-colors cursor-pointer line-clamp-2
            ${task.status === "archived" ? "line-through text-muted-foreground" : "text-gray-800"}
          `}>
            {task.title}
          </p>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem asChild>
              <Link href={`/tasks/${task.id}`}>
                <Eye className="w-3.5 h-3.5 mr-2" />Ver detalhes
              </Link>
            </DropdownMenuItem>
            {transitions.length > 0 && <DropdownMenuSeparator />}
            {transitions.map((s) => {
              const c = COLUMNS.find((x) => x.id === s)!;
              const Icon = c.icon;
              return (
                <DropdownMenuItem key={s} onClick={() => onStatusChange(task.id, s)}>
                  <Icon className="w-3.5 h-3.5 mr-2" />Mover para {c.label}
                </DropdownMenuItem>
              );
            })}
            {task.status === "shared" && !isLeader && (
              <DropdownMenuItem disabled className="text-muted-foreground text-xs opacity-60">
                <Shield className="w-3.5 h-3.5 mr-2" />Somente o Líder pode aprovar
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(task.id)}>
              <Trash2 className="w-3.5 h-3.5 mr-2" />Excluir tarefa
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Footer row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={`w-2 h-2 rounded-full ${prio.dot} shrink-0`} />
            </TooltipTrigger>
            <TooltipContent side="bottom">{prio.label}</TooltipContent>
          </Tooltip>

          {task.dueDate && (
            <span className={`text-[10px] flex items-center gap-0.5 font-medium ${overdue ? "text-red-500" : dueSoon ? "text-amber-600" : "text-muted-foreground"}`}>
              {overdue && <AlertCircle className="w-2.5 h-2.5" />}
              {new Date(task.dueDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
            </span>
          )}

          {(task.revisionsCount ?? 0) > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge className="text-[9px] h-4 px-1.5 bg-orange-100 text-orange-700 border border-orange-200 font-semibold">
                  {task.revisionsCount}R
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="bottom">{task.revisionsCount} revisão(ões) — retornou de Compartilhado para Em Andamento</TooltipContent>
            </Tooltip>
          )}
        </div>

        {task.assigneeName ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Avatar className="w-6 h-6 shrink-0">
                <AvatarFallback className="text-[9px] bg-primary/10 text-primary font-semibold">
                  {task.assigneeName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent side="bottom">{task.assigneeName}</TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-6 h-6 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center shrink-0">
                <User2 className="w-3 h-3 text-gray-400" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">Sem responsável</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Status progress bar */}
      <StatusProgressBar
        status={task.status}
        isLeader={isLeader}
        onStatusChange={(s) => onStatusChange(task.id, s)}
      />
    </div>
  );
}

// ── SortableTaskCard ───────────────────────────────────────────────────────────
function SortableTaskCard({ task, isLeader, onStatusChange, onDelete }: {
  task: Task; isLeader: boolean;
  onStatusChange: (id: number, status: TaskStatus) => void;
  onDelete: (id: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} className="relative group/sortable">
      <div
        {...attributes}
        {...listeners}
        className="absolute left-1 top-4 cursor-grab active:cursor-grabbing opacity-0 group-hover/sortable:opacity-40 hover:!opacity-70 transition-opacity z-10 p-1"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="w-3 h-3 text-gray-400" />
      </div>
      <TaskCard task={task} isLeader={isLeader} onStatusChange={onStatusChange} onDelete={onDelete} isDragging={isDragging} />
    </div>
  );
}

// ── DroppableColumn ────────────────────────────────────────────────────────────
function DroppableColumn({ column, tasks, isLeader, onAddTask, onStatusChange, onDelete }: {
  column: typeof COLUMNS[number];
  tasks: Task[];
  isLeader: boolean;
  onAddTask: (status: TaskStatus) => void;
  onStatusChange: (id: number, status: TaskStatus) => void;
  onDelete: (id: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const Icon = column.icon;
  const [showLegend, setShowLegend] = useState(false);
  const canReceiveDrop = !column.leaderOnly || isLeader;

  return (
    <div className={`flex flex-col min-w-[272px] max-w-[272px] rounded-2xl border-2 transition-all duration-200
      ${isOver && canReceiveDrop ? `${column.borderColor} shadow-lg scale-[1.01]` : "border-gray-200"}
      bg-white
    `}>
      {/* Column Header */}
      <div className={`px-3.5 pt-3.5 pb-3 border-b-2 ${isOver && canReceiveDrop ? column.borderColor : "border-gray-100"} rounded-t-2xl ${column.bgColor}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className={`w-4 h-4 ${column.color}`} />
            <span className={`text-sm font-semibold ${column.color}`}>{column.label}</span>
            <Badge className={`text-xs h-5 px-1.5 border font-semibold ${column.badgeClass}`}>{tasks.length}</Badge>
          </div>
          <div className="flex items-center gap-1">
            {column.leaderOnly && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Shield className="w-3.5 h-3.5 text-amber-500" />
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Somente o Líder pode mover tarefas para cá</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowLegend(!showLegend)}>
                  <Info className="w-3 h-3 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">Ver descrição desta etapa</TooltipContent>
            </Tooltip>
          </div>
        </div>
        {showLegend && (
          <p className="text-[11px] text-muted-foreground leading-relaxed mt-2 pb-0.5 border-t border-gray-200 pt-2">
            {column.description}
          </p>
        )}
      </div>

      {/* Tasks */}
      <div ref={setNodeRef} className="flex-1 p-3 space-y-2 min-h-[100px]">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              isLeader={isLeader}
              onStatusChange={onStatusChange}
              onDelete={onDelete}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center opacity-50">
            <Icon className={`w-7 h-7 ${column.color} mb-2`} />
            <p className="text-xs text-muted-foreground">Sem tarefas aqui</p>
          </div>
        )}
      </div>

      {/* Add button — only for non-leader-only columns */}
      {!column.leaderOnly && (
        <div className="p-3 pt-1">
          <Button
            variant="ghost"
            size="sm"
            className={`w-full gap-1.5 text-xs justify-start ${column.color} hover:bg-gray-100`}
            onClick={() => onAddTask(column.id)}
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar tarefa
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Main Kanban ────────────────────────────────────────────────────────────────
export default function Kanban() {
  const { id } = useParams<{ id: string }>();
  const projectId = parseInt(id ?? "0");
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createStatus, setCreateStatus] = useState<TaskStatus>("pending");
  const [form, setForm] = useState({
    title: "", description: "", priority: "medium" as TaskPriority,
    assigneeId: "", dueDate: "",
  });
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterSearch, setFilterSearch] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const { data: project } = trpc.projects.get.useQuery({ id: projectId });
  const { data: rawTasks = [], isLoading } = trpc.tasks.list.useQuery({ projectId });
  const { data: members = [] } = trpc.projects.members.useQuery({ projectId });

  // Determine if current user is leader/owner
  const isLeader = (() => {
    if (!user) return false;
    if ((project as any)?.ownerId === user.id) return true;
    const me = (members as any[]).find((m) => m.userId === user.id);
    return me?.role === "admin" || me?.projectRole === "leader";
  })();

  const tasks = (rawTasks as Task[]).filter((t) => {
    if (filterPriority !== "all" && t.priority !== filterPriority) return false;
    if (filterSearch && !t.title.toLowerCase().includes(filterSearch.toLowerCase())) return false;
    return true;
  });

  const createMutation = trpc.tasks.create.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate({ projectId });
      setShowCreate(false);
      setForm({ title: "", description: "", priority: "medium", assigneeId: "", dueDate: "" });
      toast.success("Tarefa criada com sucesso!");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.tasks.update.useMutation({
    onSuccess: () => utils.tasks.list.invalidate({ projectId }),
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.tasks.delete.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate({ projectId });
      setDeleteId(null);
      toast.success("Tarefa excluída.");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleStatusChange = useCallback((taskId: number, newStatus: TaskStatus) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // Enforce leader-only for published/archived
    if ((newStatus === "published" || newStatus === "archived") && !isLeader) {
      toast.error("Somente o Líder da equipe pode aprovar esta transição.");
      return;
    }
    if (task.status === "shared" && !isLeader) {
      toast.error("Somente o Líder pode mover tarefas de Compartilhado.");
      return;
    }

    updateMutation.mutate({ id: taskId, status: newStatus });
  }, [tasks, isLeader, updateMutation]);

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;
    const taskId = active.id as number;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const overCol = COLUMNS.find((c) => c.id === over.id);
    const overTask = tasks.find((t) => t.id === over.id);
    const targetStatus = (overCol?.id ?? overTask?.status) as TaskStatus | undefined;
    if (targetStatus && targetStatus !== task.status) {
      handleStatusChange(taskId, targetStatus);
    }
  };

  const openCreate = (status: TaskStatus) => {
    setCreateStatus(status);
    setShowCreate(true);
  };

  const handleCreate = () => {
    if (!form.title.trim()) return toast.error("Título obrigatório.");
    createMutation.mutate({
      projectId,
      title: form.title.trim(),
      description: form.description || undefined,
      status: createStatus,
      priority: form.priority,
      assigneeId: form.assigneeId ? parseInt(form.assigneeId) : undefined,
      dueDate: form.dueDate ? new Date(form.dueDate) : undefined,
    });
  };

  const tasksByStatus = COLUMNS.reduce((acc, col) => {
    acc[col.id] = tasks.filter((t) => t.status === col.id).sort((a, b) => a.position - b.position);
    return acc;
  }, {} as Record<TaskStatus, Task[]>);

  const overdueCount = tasks.filter(isOverdue).length;

  return (
    <AppLayout title={project ? `Kanban — ${(project as any).name}` : "Kanban"} backHref="/projects">
      {/* Overdue banner */}
      {overdueCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 mb-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span><strong>{overdueCount}</strong> {overdueCount === 1 ? "tarefa está vencida" : "tarefas estão vencidas"}. Revise os prazos.</span>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Input
          placeholder="Buscar tarefas..."
          value={filterSearch}
          onChange={(e) => setFilterSearch(e.target.value)}
          className="w-52 h-9 bg-white border-gray-200 text-sm"
        />
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-36 h-9 bg-white border-gray-200 text-sm">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="urgent">Urgente</SelectItem>
            <SelectItem value="high">Alta</SelectItem>
            <SelectItem value="medium">Média</SelectItem>
            <SelectItem value="low">Baixa</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 ml-auto">
          {isLeader && (
            <Badge className="bg-amber-100 text-amber-700 border border-amber-200 text-xs gap-1.5 px-2.5 py-1">
              <Shield className="w-3 h-3" />Líder
            </Badge>
          )}
          <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90 h-9" onClick={() => openCreate("pending")}>
            <Plus className="w-4 h-4" />Nova Tarefa
          </Button>
        </div>
      </div>

      {/* Legend row */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        {COLUMNS.map((col) => {
          const Icon = col.icon;
          return (
            <Tooltip key={col.id}>
              <TooltipTrigger asChild>
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border cursor-help font-medium ${col.badgeClass}`}>
                  <Icon className="w-3 h-3" />{col.label}
                  {col.leaderOnly && <Shield className="w-2.5 h-2.5 opacity-60" />}
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs text-xs">{col.description}</TooltipContent>
            </Tooltip>
          );
        })}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border bg-orange-100 text-orange-700 border-orange-200 cursor-help font-semibold">
              <span>R</span>Revisão
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs text-xs">
            Contador de revisões: incrementa toda vez que uma tarefa volta de <strong>Compartilhado</strong> para <strong>Em Andamento</strong>.
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Board */}
      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((col) => (
            <div key={col.id} className="min-w-[272px]">
              <Skeleton className="h-14 w-full mb-3 rounded-2xl" />
              <Skeleton className="h-28 w-full mb-2 rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
            </div>
          ))}
        </div>
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-6">
            {COLUMNS.map((col) => (
              <DroppableColumn
                key={col.id}
                column={col}
                tasks={tasksByStatus[col.id]}
                isLeader={isLeader}
                onAddTask={openCreate}
                onStatusChange={handleStatusChange}
                onDelete={(id) => setDeleteId(id)}
              />
            ))}
          </div>
          <DragOverlay>
            {activeTask && (
              <TaskCard
                task={activeTask}
                isLeader={isLeader}
                onStatusChange={() => {}}
                onDelete={() => {}}
                isDragging
              />
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* Create Task Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-white border-gray-200 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              {(() => {
                const col = COLUMNS.find((c) => c.id === createStatus)!;
                const Icon = col.icon;
                return <><Icon className={`w-4 h-4 ${col.color}`} /><span>Nova tarefa em <span className={col.color}>{col.label}</span></span></>;
              })()}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Título <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Descreva a tarefa..."
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="bg-gray-50 border-gray-200"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Descrição</Label>
              <Textarea
                placeholder="Detalhes opcionais..."
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="bg-gray-50 border-gray-200 resize-none"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Prioridade</Label>
                <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v as TaskPriority }))}>
                  <SelectTrigger className="bg-gray-50 border-gray-200"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Vencimento</Label>
                <Input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                  className="bg-gray-50 border-gray-200"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Responsável</Label>
              <Select
                value={form.assigneeId || "none"}
                onValueChange={(v) => setForm((f) => ({ ...f, assigneeId: v === "none" ? "" : v }))}
              >
                <SelectTrigger className="bg-gray-50 border-gray-200">
                  <SelectValue placeholder="Selecionar membro..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem responsável</SelectItem>
                  {(members as any[]).map((m) => (
                    <SelectItem key={m.userId} value={String(m.userId)}>
                      {m.userName ?? `Usuário ${m.userId}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending || !form.title.trim()}
              className="bg-primary hover:bg-primary/90"
            >
              {createMutation.isPending ? "Criando..." : "Criar tarefa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="bg-white border-gray-200 max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir tarefa?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Esta ação não pode ser desfeita. A tarefa e todos os seus comentários e anexos serão removidos permanentemente.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
