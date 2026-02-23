import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  FolderKanban, Plus, Kanban, MoreHorizontal, Trash2,
  Edit2, Users, CheckCircle2, Clock, ListTodo, Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const PROJECT_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#14b8a6",
];

const STATUS_MAP: Record<string, { label: string; class: string }> = {
  active: { label: "Ativo", class: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  archived: { label: "Arquivado", class: "bg-slate-500/15 text-slate-400 border-slate-500/30" },
  completed: { label: "Concluído", class: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
};

export default function Projects() {
  const utils = trpc.useUtils();
  const { data: projects, isLoading } = trpc.projects.list.useQuery();
  const { data: clients } = trpc.clients.list.useQuery();

  const [showCreate, setShowCreate] = useState(false);
  const [editProject, setEditProject] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", description: "", color: "#6366f1", clientId: "" });

  const createMutation = trpc.projects.create.useMutation({
    onSuccess: () => {
      utils.projects.list.invalidate();
      setShowCreate(false);
      setForm({ name: "", description: "", color: "#6366f1", clientId: "" });
      toast.success("Projeto criado com sucesso!");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.projects.update.useMutation({
    onSuccess: () => {
      utils.projects.list.invalidate();
      setEditProject(null);
      toast.success("Projeto atualizado!");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.projects.delete.useMutation({
    onSuccess: () => {
      utils.projects.list.invalidate();
      setDeleteId(null);
      toast.success("Projeto excluído.");
    },
    onError: (e) => toast.error(e.message),
  });

  const openEdit = (p: any) => {
    setEditProject(p);
    setForm({
      name: p.name,
      description: p.description ?? "",
      color: p.color,
      clientId: p.clientId ? String(p.clientId) : "",
    });
  };

  const handleSubmit = () => {
    if (!form.name.trim()) return toast.error("Nome é obrigatório");
    const clientId = form.clientId ? Number(form.clientId) : undefined;
    if (editProject) {
      updateMutation.mutate({
        id: editProject.id,
        name: form.name,
        description: form.description || undefined,
        color: form.color,
        clientId: clientId ?? null,
      });
    } else {
      createMutation.mutate({
        name: form.name,
        description: form.description || undefined,
        color: form.color,
        clientId,
      });
    }
  };

  // Find client name by id
  const getClientName = (clientId?: number | null) => {
    if (!clientId || !clients) return null;
    return clients.find((c: { id: number; name: string }) => c.id === clientId)?.name ?? null;
  };

  return (
    <AppLayout title="Projetos">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Projetos</h2>
            <p className="text-muted-foreground mt-1">
              {projects?.length ?? 0} projeto{projects?.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="gap-2 bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4" />
            Novo Projeto
          </Button>
        </div>

        {/* Projects Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-48 rounded-xl bg-card border border-border animate-pulse" />
            ))}
          </div>
        ) : !projects?.length ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FolderKanban className="w-16 h-16 text-muted-foreground/20 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum projeto ainda</h3>
            <p className="text-muted-foreground mb-6">Crie seu primeiro projeto para começar.</p>
            <Button onClick={() => setShowCreate(true)} className="gap-2 bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4" />
              Criar Projeto
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {projects.map((project) => {
              const rate = project.taskCounts.total > 0
                ? Math.round(((project.taskCounts.published + project.taskCounts.archived) / project.taskCounts.total) * 100)
                : 0;
              const statusInfo = STATUS_MAP[project.status];
              const clientName = getClientName((project as any).clientId);
              return (
                <Card key={project.id} className="bg-card border-border hover:border-primary/30 transition-all duration-200 group overflow-hidden">
                  <div className="h-1 w-full" style={{ backgroundColor: project.color }} />
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${project.color}20` }}
                        >
                          <FolderKanban className="w-5 h-5" style={{ color: project.color }} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold truncate">{project.name}</h3>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <Badge className={`text-xs border ${statusInfo.class}`}>
                              {statusInfo.label}
                            </Badge>
                            {clientName && (
                              <Badge variant="outline" className="text-xs gap-1 border-border text-muted-foreground">
                                <Building2 className="w-3 h-3" />
                                {clientName}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(project)}>
                            <Edit2 className="w-4 h-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => (window.location.href = `/projects/${project.id}`)}>
                            <Users className="w-4 h-4 mr-2" />
                            Membros
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteId(project.id)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {project.description && (
                      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{project.description}</p>
                    )}

                    {/* Progress */}
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                        <span>Progresso</span>
                        <span className="font-medium" style={{ color: project.color }}>{rate}%</span>
                      </div>
                      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${rate}%`, backgroundColor: project.color }}
                        />
                      </div>
                    </div>

                    {/* Task counts */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
                      <div className="flex items-center gap-1">
                        <ListTodo className="w-3.5 h-3.5" />
                        {project.taskCounts.pending}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-blue-400" />
                        {project.taskCounts.in_progress}
                      </div>
                      <div className="flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        {(project.taskCounts.published ?? 0) + (project.taskCounts.archived ?? 0)}
                      </div>
                    </div>

                    {/* Actions */}
                    <Link
                      href={`/projects/${project.id}/kanban`}
                      className="flex w-full items-center justify-center gap-2 border border-border rounded-md px-3 py-1.5 text-sm font-medium hover:bg-secondary transition-colors"
                    >
                      <Kanban className="w-4 h-4" />
                      Abrir Kanban
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreate || !!editProject} onOpenChange={(o) => {
        if (!o) { setShowCreate(false); setEditProject(null); }
      }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>{editProject ? "Editar Projeto" : "Novo Projeto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome do Projeto</Label>
              <Input
                placeholder="Ex: Site Corporativo"
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                className="bg-input border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Textarea
                placeholder="Descreva o objetivo do projeto..."
                value={form.description}
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                className="bg-input border-border resize-none"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Cliente (opcional)</Label>
              <Select
                value={form.clientId}
                onValueChange={(v) => setForm(f => ({ ...f, clientId: v }))}
              >
                <SelectTrigger className="bg-input border-border">
                  <SelectValue placeholder="Selecionar cliente..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum cliente</SelectItem>
                  {clients?.map((c: { id: number; name: string; company?: string | null }) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}{c.company ? ` — ${c.company}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cor do Projeto</Label>
              <div className="flex gap-2 flex-wrap">
                {PROJECT_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setForm(f => ({ ...f, color }))}
                    className={`w-8 h-8 rounded-lg transition-all ${form.color === color ? "ring-2 ring-white ring-offset-2 ring-offset-card scale-110" : "hover:scale-105"}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); setEditProject(null); }}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="bg-primary hover:bg-primary/90"
            >
              {editProject ? "Salvar" : "Criar Projeto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir projeto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todas as tarefas e dados do projeto serão removidos permanentemente.
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
