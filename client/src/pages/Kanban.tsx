import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useParams } from "wouter";
import { toast } from "sonner";
import { useState } from "react";
import {
  Plus, Filter, Search, Calendar, Flag,
  MoreHorizontal, Trash2, Edit2, Eye, AlertCircle, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const COLUMNS = [
  { id: "todo",        label: "A Fazer",      color: "text-slate-600",   dot: "bg-slate-400",   header: "bg-slate-50 border-slate-200",   pill: "bg-slate-100 text-slate-700" },
  { id: "in_progress", label: "Em Progresso", color: "text-blue-700",    dot: "bg-blue-500",    header: "bg-blue-50 border-blue-200",     pill: "bg-blue-100 text-blue-700" },
  { id: "done",        label: "Concluído",    color: "text-emerald-700", dot: "bg-emerald-500", header: "bg-emerald-50 border-emerald-200", pill: "bg-emerald-100 text-emerald-700" },
];

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-slate-100 text-slate-600 border-slate-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  urgent: "bg-red-50 text-red-700 border-red-200",
};
const PRIORITY_LABELS: Record<string, string> = {
  low: "Baixa", medium: "Média", high: "Alta", urgent: "Urgente",
};

function isOverdue(task: any) {
  return task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "done";
}
function isDueSoon(task: any) {
  if (!task.dueDate || task.status === "done") return false;
  const diff = new Date(task.dueDate).getTime() - Date.now();
  return diff > 0 && diff < 24 * 60 * 60 * 1000;
}

// ── Inline Status Bar ─────────────────────────────────────────────────────────
function StatusBar({ status, onStatusChange }: { status: string; onStatusChange: (s: string) => void }) {
  const steps = COLUMNS;
  const currentIdx = steps.findIndex(c => c.id === status);
  return (
    <div
      className="flex items-center gap-0.5 mt-3 pt-3 border-t border-slate-100"
      onClick={(e) => e.stopPropagation()}
    >
      {steps.map((step, idx) => {
        const isActive = idx === currentIdx;
        const isPast = idx < currentIdx;
        return (
          <button
            key={step.id}
            onClick={(e) => { e.stopPropagation(); if (!isActive) onStatusChange(step.id); }}
            title={`Mover para ${step.label}`}
            className={`flex-1 h-1.5 rounded-full transition-all duration-200 ${
              isActive
                ? step.id === "todo" ? "bg-slate-400" : step.id === "in_progress" ? "bg-blue-500" : "bg-emerald-500"
                : isPast
                ? "bg-slate-300"
                : "bg-slate-100 hover:bg-slate-200"
            }`}
          />
        );
      })}
      <span className={`ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${COLUMNS[currentIdx]?.pill ?? ""}`}>
        {COLUMNS[currentIdx]?.label}
      </span>
    </div>
  );
}

// ── Task Card ─────────────────────────────────────────────────────────────────
function TaskCard({ task, onEdit, onDelete, onView, onStatusChange }: any) {
  const overdue = isOverdue(task);
  const dueSoon = isDueSoon(task);
  return (
    <div
      className={`bg-white border rounded-xl p-3.5 hover:shadow-md transition-all duration-150 group cursor-grab active:cursor-grabbing ${
        overdue ? "border-red-200 bg-red-50/30" : dueSoon ? "border-amber-200 bg-amber-50/20" : "border-border hover:border-primary/30"
      }`}
      onClick={onView}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className={`text-sm font-medium leading-snug flex-1 ${task.status === "done" ? "line-through text-muted-foreground" : "text-foreground"}`}>
          {task.title}
        </p>
        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Quick delete button */}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title="Excluir tarefa"
            className="p-1 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <button className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-slate-100 transition-colors">
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(); }}>
                <Eye className="w-4 h-4 mr-2" />Detalhes
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                <Edit2 className="w-4 h-4 mr-2" />Editar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {task.status !== "todo" && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onStatusChange(task.id, "todo"); }}>
                  <span className="w-2 h-2 rounded-full bg-slate-400 mr-2 inline-block" />A Fazer
                </DropdownMenuItem>
              )}
              {task.status !== "in_progress" && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onStatusChange(task.id, "in_progress"); }}>
                  <span className="w-2 h-2 rounded-full bg-blue-500 mr-2 inline-block" />Em Progresso
                </DropdownMenuItem>
              )}
              {task.status !== "done" && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onStatusChange(task.id, "done"); }}>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 inline-block" />Concluído
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
              >
                <Trash2 className="w-4 h-4 mr-2" />Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {task.description && (
        <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{task.description}</p>
      )}

      {/* Badges row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Badge className={`text-[10px] px-1.5 py-0 h-4.5 border font-medium ${PRIORITY_COLORS[task.priority]}`}>
          <Flag className="w-2.5 h-2.5 mr-1" />
          {PRIORITY_LABELS[task.priority]}
        </Badge>
        {task.dueDate && (
          <Badge className={`text-[10px] px-1.5 py-0 h-4.5 border flex items-center gap-1 ${
            overdue ? "bg-red-50 text-red-700 border-red-200" : dueSoon ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-slate-50 text-slate-500 border-slate-200"
          }`}>
            {overdue ? <AlertCircle className="w-2.5 h-2.5" /> : <Calendar className="w-2.5 h-2.5" />}
            {new Date(task.dueDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
          </Badge>
        )}
        {task.revisionsCount > 0 && (
          <Badge className="text-[10px] px-1.5 py-0 h-4.5 border bg-violet-50 text-violet-700 border-violet-200">
            {task.revisionsCount}× rev.
          </Badge>
        )}
        {task.assigneeName && (
          <div className="ml-auto flex items-center gap-1">
            <Avatar className="w-5 h-5">
              <AvatarFallback className="text-[9px] bg-primary/10 text-primary font-semibold">
                {task.assigneeName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
        )}
      </div>

      {/* Inline status bar */}
      <StatusBar
        status={task.status}
        onStatusChange={(newStatus) => onStatusChange(task.id, newStatus)}
      />
    </div>
  );
}

// ── Sortable wrapper ──────────────────────────────────────────────────────────
function SortableTaskCard({ task, onEdit, onDelete, onView, onStatusChange }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} onEdit={onEdit} onDelete={onDelete} onView={onView} onStatusChange={onStatusChange} />
    </div>
  );
}

// ── Main Kanban Page ──────────────────────────────────────────────────────────
export default function Kanban() {
  const { id } = useParams<{ id: string }>();
  const projectId = parseInt(id ?? "0");
  const utils = trpc.useUtils();

  const [filters, setFilters] = useState({ search: "", priority: "" });
  const [showCreate, setShowCreate] = useState<string | null>(null);
  const [editTask, setEditTask] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [activeTask, setActiveTask] = useState<any>(null);
  const [form, setForm] = useState({
    title: "", description: "", priority: "medium" as any,
    assigneeId: undefined as number | undefined, dueDate: "",
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const { data: project } = trpc.projects.get.useQuery({ id: projectId });
  const { data: members = [] } = trpc.projects.members.useQuery({ projectId });
  const { data: tasks = [], isLoading } = trpc.tasks.list.useQuery({
    projectId,
    ...(filters.priority && { priority: filters.priority }),
    ...(filters.search && { search: filters.search }),
  });

  const updateMutation = trpc.tasks.update.useMutation({
    onSuccess: () => utils.tasks.list.invalidate({ projectId }),
    onError: (e) => toast.error(e.message),
  });
  const createMutation = trpc.tasks.create.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate({ projectId });
      utils.projects.list.invalidate();
      setShowCreate(null);
      setForm({ title: "", description: "", priority: "medium", assigneeId: undefined, dueDate: "" });
      toast.success("Tarefa criada!");
    },
    onError: (e) => toast.error(e.message),
  });
  const editMutation = trpc.tasks.update.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate({ projectId });
      setEditTask(null);
      toast.success("Tarefa atualizada!");
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.tasks.delete.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate({ projectId });
      utils.projects.list.invalidate();
      setDeleteId(null);
      toast.success("Tarefa excluída.");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleDragStart = (event: DragStartEvent) => {
    setActiveTask(tasks.find((t) => t.id === event.active.id) ?? null);
  };
  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;
    const taskId = active.id as number;
    const overId = over.id as string | number;
    const targetColumn = COLUMNS.find((c) => c.id === overId);
    if (targetColumn) {
      const task = tasks.find((t) => t.id === taskId);
      if (task && task.status !== targetColumn.id) updateMutation.mutate({ id: taskId, status: targetColumn.id as any });
      return;
    }
    const overTask = tasks.find((t) => t.id === overId);
    if (overTask) {
      const task = tasks.find((t) => t.id === taskId);
      if (task && task.status !== overTask.status) updateMutation.mutate({ id: taskId, status: overTask.status as any });
    }
  };

  const openEdit = (task: any) => {
    setEditTask(task);
    setForm({
      title: task.title,
      description: task.description ?? "",
      priority: task.priority,
      assigneeId: task.assigneeId ?? undefined,
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : "",
    });
  };

  const getColumnTasks = (status: string) => tasks.filter((t) => t.status === status);
  const overdueCount = tasks.filter(isOverdue).length;

  const handleSubmit = () => {
    if (!form.title.trim()) return toast.error("Título é obrigatório");
    const payload = {
      ...form,
      dueDate: form.dueDate ? new Date(form.dueDate) : undefined,
      assigneeId: form.assigneeId ?? undefined,
    };
    if (editTask) {
      editMutation.mutate({ id: editTask.id, ...payload, status: editTask.status });
    } else {
      createMutation.mutate({ projectId, ...payload, status: showCreate as any ?? "todo" });
    }
  };

  return (
    <AppLayout title={project?.name ?? "Kanban"} backHref={`/projects/${projectId}`}>
      <div className="space-y-4">
        {/* Overdue banner */}
        {overdueCount > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span><strong>{overdueCount}</strong> {overdueCount === 1 ? "tarefa está vencida" : "tarefas estão vencidas"}. Revise e atualize os prazos.</span>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar tarefas..."
              value={filters.search}
              onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
              className="pl-9 bg-white border-border"
            />
          </div>
          <Select value={filters.priority || "all"} onValueChange={(v) => setFilters(f => ({ ...f, priority: v === "all" ? "" : v }))}>
            <SelectTrigger className="w-36 bg-white border-border">
              <Filter className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
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
          <Button
            onClick={() => setShowCreate("todo")}
            className="bg-primary hover:bg-primary/90 text-white gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />Nova Tarefa
          </Button>
        </div>

        {/* Kanban Board */}
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {COLUMNS.map((col) => {
              const colTasks = getColumnTasks(col.id);
              return (
                <div key={col.id} id={col.id} className="flex flex-col gap-3 min-h-[300px] rounded-xl p-3 bg-slate-50 border border-slate-200">
                  {/* Column header */}
                  <div className={`flex items-center justify-between px-2 py-2 rounded-lg border ${col.header}`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${col.dot}`} />
                      <span className={`text-sm font-semibold ${col.color}`}>{col.label}</span>
                      <Badge className="bg-white text-muted-foreground border border-border text-xs px-1.5 py-0 h-5 shadow-none">
                        {colTasks.length}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-white"
                      onClick={() => { setShowCreate(col.id); setForm(f => ({ ...f, title: "" })); }}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Task list */}
                  <SortableContext items={colTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                    {isLoading ? (
                      Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)
                    ) : colTasks.length === 0 ? (
                      <div id={col.id} className="flex-1 flex items-center justify-center py-10 border-2 border-dashed border-slate-200 rounded-xl">
                        <p className="text-xs text-muted-foreground/50">Arraste tarefas aqui</p>
                      </div>
                    ) : (
                      colTasks.map((task) => (
                        <SortableTaskCard
                          key={task.id}
                          task={task}
                          onView={() => window.location.href = `/tasks/${task.id}`}
                          onEdit={() => openEdit(task)}
                          onDelete={() => setDeleteId(task.id)}
                          onStatusChange={(taskId: number, status: string) =>
                            updateMutation.mutate({ id: taskId, status: status as any })
                          }
                        />
                      ))
                    )}
                  </SortableContext>

                  {/* Add task shortcut */}
                  <button
                    onClick={() => setShowCreate(col.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-white border border-dashed border-slate-200 hover:border-primary/30 transition-colors mt-auto"
                  >
                    <Plus className="w-3.5 h-3.5" />Adicionar tarefa
                  </button>
                </div>
              );
            })}
          </div>

          <DragOverlay>
            {activeTask ? (
              <div className="rotate-2 scale-105 shadow-xl">
                <TaskCard task={activeTask} onEdit={() => {}} onDelete={() => {}} onView={() => {}} onStatusChange={() => {}} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={!!showCreate || !!editTask} onOpenChange={(o) => { if (!o) { setShowCreate(null); setEditTask(null); } }}>
        <DialogContent className="bg-white border-border max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editTask ? "Editar Tarefa" : `Nova Tarefa — ${COLUMNS.find(c => c.id === showCreate)?.label ?? ""}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                placeholder="Descreva a tarefa..."
                value={form.title}
                onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                className="bg-white border-border"
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                placeholder="Detalhes adicionais..."
                value={form.description}
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                className="bg-white border-border resize-none"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={form.priority} onValueChange={(v: any) => setForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger className="bg-white border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data de Vencimento</Label>
                <Input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm(f => ({ ...f, dueDate: e.target.value }))}
                  className="bg-white border-border"
                />
              </div>
            </div>
            {/* Member assignee selector */}
            <div className="space-y-2">
              <Label>Atribuir a</Label>
              <Select
                value={form.assigneeId?.toString() ?? "none"}
                onValueChange={(v) => setForm(f => ({ ...f, assigneeId: v === "none" ? undefined : parseInt(v) }))}
              >
                <SelectTrigger className="bg-white border-border">
                  <SelectValue placeholder="Selecionar membro..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.userId} value={m.userId.toString()}>
                      <div className="flex items-center gap-2">
                        <Avatar className="w-5 h-5">
                          <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                            {(m.userName ?? "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {m.userName ?? m.userEmail ?? `Usuário ${m.userId}`}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {editTask && (
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editTask.status}
                  onValueChange={(v) => setEditTask((t: any) => ({ ...t, status: v }))}
                >
                  <SelectTrigger className="bg-white border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">A Fazer</SelectItem>
                    <SelectItem value="in_progress">Em Progresso</SelectItem>
                    <SelectItem value="done">Concluído</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(null); setEditTask(null); }}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || editMutation.isPending}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              {editTask ? "Salvar" : "Criar Tarefa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="bg-white border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
              className="bg-destructive hover:bg-destructive/90 text-white"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
