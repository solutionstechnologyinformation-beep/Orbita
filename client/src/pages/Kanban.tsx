import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useParams, Link } from "wouter";
import { toast } from "sonner";
import { useState, useRef } from "react";
import {
  Plus, Filter, Search, Calendar, User2, Flag,
  MoreHorizontal, Trash2, Edit2, Eye,
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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";

const COLUMNS = [
  { id: "todo", label: "A Fazer", color: "text-slate-400", dot: "bg-slate-400" },
  { id: "in_progress", label: "Em Progresso", color: "text-blue-400", dot: "bg-blue-400" },
  { id: "done", label: "Concluído", color: "text-emerald-400", dot: "bg-emerald-400" },
];

const PRIORITY_LABELS: Record<string, string> = {
  low: "Baixa", medium: "Média", high: "Alta", urgent: "Urgente",
};

function TaskCard({ task, onEdit, onDelete, onView }: any) {
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "done";
  return (
    <div className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-all duration-150 group cursor-pointer" onClick={onView}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className={`text-sm font-medium leading-snug flex-1 ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>
          {task.title}
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 flex-shrink-0">
              <MoreHorizontal className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(); }}>
              <Eye className="w-4 h-4 mr-2" />Detalhes
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
              <Edit2 className="w-4 h-4 mr-2" />Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
              <Trash2 className="w-4 h-4 mr-2" />Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {task.description && (
        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{task.description}</p>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <Badge className={`text-xs px-2 py-0 h-5 priority-${task.priority}`}>
          <Flag className="w-2.5 h-2.5 mr-1" />
          {PRIORITY_LABELS[task.priority]}
        </Badge>

        {task.dueDate && (
          <Badge className={`text-xs px-2 py-0 h-5 border ${isOverdue ? "bg-red-500/15 text-red-400 border-red-500/30" : "bg-secondary text-muted-foreground border-border"}`}>
            <Calendar className="w-2.5 h-2.5 mr-1" />
            {new Date(task.dueDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
          </Badge>
        )}

        {task.assigneeName && (
          <div className="flex items-center gap-1 ml-auto">
            <Avatar className="w-5 h-5">
              <AvatarFallback className="text-[9px] bg-primary/20 text-primary">
                {task.assigneeName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Kanban() {
  const { id } = useParams<{ id: string }>();
  const projectId = parseInt(id ?? "0");
  const utils = trpc.useUtils();
  const [, navigate] = [null, (path: string) => window.location.href = path];

  const [filters, setFilters] = useState({ search: "", priority: "", assigneeId: undefined as number | undefined });
  const [showFilters, setShowFilters] = useState(false);
  const [showCreate, setShowCreate] = useState<string | null>(null);
  const [editTask, setEditTask] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [form, setForm] = useState({
    title: "", description: "", priority: "medium" as any,
    assigneeId: undefined as number | undefined, dueDate: "",
  });

  const { data: project } = trpc.projects.get.useQuery({ id: projectId });
  const { data: tasks, isLoading } = trpc.tasks.list.useQuery({
    projectId,
    ...(filters.priority && { priority: filters.priority }),
    ...(filters.assigneeId && { assigneeId: filters.assigneeId }),
    ...(filters.search && { search: filters.search }),
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

  const updateMutation = trpc.tasks.update.useMutation({
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

  const moveTask = (taskId: number, newStatus: string) => {
    updateMutation.mutate({ id: taskId, status: newStatus as any });
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

  const getColumnTasks = (status: string) =>
    (tasks ?? []).filter((t) => t.status === status);

  return (
    <AppLayout title={project?.name ?? "Kanban"} backHref={`/projects/${projectId}`}>
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar tarefas..."
              value={filters.search}
              onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
              className="pl-9 bg-input border-border"
            />
          </div>
          <Select value={filters.priority || "all"} onValueChange={(v) => setFilters(f => ({ ...f, priority: v === "all" ? "" : v }))}>
            <SelectTrigger className="w-36 bg-input border-border">
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
        </div>

        {/* Kanban Board */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COLUMNS.map((col) => {
            const colTasks = getColumnTasks(col.id);
            return (
              <div key={col.id} className="kanban-column">
                {/* Column Header */}
                <div className="flex items-center justify-between mb-1 px-1">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${col.dot}`} />
                    <span className={`text-sm font-semibold ${col.color}`}>{col.label}</span>
                    <Badge className="bg-secondary text-muted-foreground border-0 text-xs px-1.5 py-0 h-5">
                      {colTasks.length}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => { setShowCreate(col.id); setForm(f => ({ ...f, title: "" })); }}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {/* Tasks */}
                {isLoading ? (
                  Array.from({ length: 2 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full rounded-xl" />
                  ))
                ) : colTasks.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center py-8">
                    <p className="text-xs text-muted-foreground/50">Nenhuma tarefa</p>
                  </div>
                ) : (
                  colTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onView={() => window.location.href = `/tasks/${task.id}`}
                      onEdit={() => openEdit(task)}
                      onDelete={() => setDeleteId(task.id)}
                    />
                  ))
                )}

                {/* Add task button at bottom */}
                <button
                  onClick={() => { setShowCreate(col.id); }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors mt-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar tarefa
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Create/Edit Task Dialog */}
      <Dialog open={!!showCreate || !!editTask} onOpenChange={(o) => { if (!o) { setShowCreate(null); setEditTask(null); } }}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle>{editTask ? "Editar Tarefa" : `Nova Tarefa — ${COLUMNS.find(c => c.id === showCreate)?.label ?? ""}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                placeholder="Descreva a tarefa..."
                value={form.title}
                onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                className="bg-input border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                placeholder="Detalhes adicionais..."
                value={form.description}
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                className="bg-input border-border resize-none"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={form.priority} onValueChange={(v: any) => setForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger className="bg-input border-border">
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
                  className="bg-input border-border"
                />
              </div>
            </div>
            {editTask && (
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editTask.status}
                  onValueChange={(v) => setEditTask((t: any) => ({ ...t, status: v }))}
                >
                  <SelectTrigger className="bg-input border-border">
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
              onClick={() => {
                if (!form.title.trim()) return toast.error("Título é obrigatório");
                if (editTask) {
                  updateMutation.mutate({
                    id: editTask.id,
                    ...form,
                    status: editTask.status,
                    dueDate: form.dueDate ? new Date(form.dueDate) : undefined,
                  });
                } else {
                  createMutation.mutate({
                    projectId,
                    ...form,
                    status: showCreate as any ?? "todo",
                    dueDate: form.dueDate ? new Date(form.dueDate) : undefined,
                  });
                }
              }}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="bg-primary hover:bg-primary/90"
            >
              {editTask ? "Salvar" : "Criar Tarefa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
              className="bg-destructive hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
