import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useParams, Link } from "wouter";
import { toast } from "sonner";
import { useState } from "react";
import {
  Users, Kanban, Bot, UserPlus, UserMinus,
  Crown, Shield, Eye, User, LayoutDashboard, RefreshCw,
  ChevronRight, AlertCircle, Archive, ArchiveRestore, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ROLE_ICONS: Record<string, any> = {
  owner: Crown, admin: Shield, member: User, viewer: Eye,
};
const ROLE_LABELS: Record<string, string> = {
  owner: "Dono", admin: "Admin", member: "Membro", viewer: "Visualizador",
};
const STATUS_LABELS: Record<string, string> = {
  pending: "Para Iniciar",
  in_progress: "Em Andamento",
  shared: "Compartilhado",
  published: "Publicado",
  archived: "Arquivado",
};
const PRIORITY_LABELS: Record<string, string> = {
  low: "Baixa", medium: "Média", high: "Alta", urgent: "Urgente",
};
const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-amber-50 text-amber-700",
  high: "bg-orange-50 text-orange-700",
  urgent: "bg-red-50 text-red-700",
};

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const projectId = parseInt(id ?? "0");
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const { data: project, isLoading } = trpc.projects.get.useQuery({ id: projectId });
  const { data: tasks = [], isLoading: tasksLoading } = trpc.tasks.list.useQuery(
    { projectId },
    { enabled: !!projectId }
  );

  const [showInvite, setShowInvite] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedRole, setSelectedRole] = useState<"admin" | "member" | "viewer">("member");

  const { data: searchResults } = trpc.users.search.useQuery(
    { query: searchQuery },
    { enabled: searchQuery.length >= 2 }
  );

  const addMemberMutation = trpc.projects.addMember.useMutation({
    onSuccess: () => {
      utils.projects.get.invalidate({ id: projectId });
      setShowInvite(false);
      setSearchQuery("");
      setSelectedUserId(null);
      toast.success("Membro adicionado! Uma notificação foi enviada para ele.");
    },
    onError: (e) => toast.error(e.message),
  });

  const removeMemberMutation = trpc.projects.removeMember.useMutation({
    onSuccess: () => {
      utils.projects.get.invalidate({ id: projectId });
      toast.success("Membro removido.");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateProjectMutation = trpc.projects.update.useMutation({
    onSuccess: () => {
      utils.projects.get.invalidate({ id: projectId });
      utils.projects.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteProjectMutation = trpc.projects.delete.useMutation({
    onSuccess: () => {
      toast.success("Projeto excluído.");
      window.location.href = "/projects";
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <AppLayout title="Projeto" backHref="/projects">
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!project) {
    return (
      <AppLayout title="Projeto não encontrado" backHref="/projects">
        <p className="text-muted-foreground">Projeto não encontrado.</p>
      </AppLayout>
    );
  }

  const isOwner = project.ownerId === user?.id;
  const isArchived = project.status === "archived";

  // Tasks with revisions (revisionsCount > 0)
  const tasksWithRevisions = (tasks as any[])
    .filter((t: any) => (t.revisionsCount ?? 0) > 0)
    .sort((a: any, b: any) => (b.revisionsCount ?? 0) - (a.revisionsCount ?? 0));

  // All members including owner
  const ownerEntry = {
    id: -1,
    userId: project.ownerId,
    userName: (project as any).ownerName ?? "Dono do Projeto",
    userEmail: (project as any).ownerEmail ?? "",
    role: "owner" as const,
  };
  const allMembers = [ownerEntry, ...(project.members ?? [])];

  return (
    <AppLayout title={project.name} backHref="/projects">
      <div className="space-y-6">
        {/* Project Header */}
        <div className={`bg-white border rounded-2xl p-6 shadow-sm ${isArchived ? "border-amber-200 bg-amber-50/30" : "border-slate-200"}`}>
          <div className="flex items-start gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${project.color}20` }}
            >
              <div className="w-6 h-6 rounded-full" style={{ backgroundColor: project.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-bold">{project.name}</h2>
                {isArchived && (
                  <Badge className="bg-amber-100 text-amber-700 border-amber-300 border gap-1">
                    <Archive className="w-3 h-3" />
                    Arquivado
                  </Badge>
                )}
              </div>
              {project.description && (
                <p className="text-muted-foreground mt-1">{project.description}</p>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            {[
              { label: "Para Iniciar", value: project.taskCounts.pending, color: "text-slate-400" },
              { label: "Em Andamento", value: project.taskCounts.in_progress, color: "text-blue-400" },
              { label: "Publicadas", value: (project.taskCounts.published ?? 0) + (project.taskCounts.archived ?? 0), color: "text-emerald-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center p-3 rounded-xl bg-secondary/50">
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-muted-foreground mt-1">{label}</p>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6 flex-wrap items-center">
            {!isArchived && (
              <Link href={`/projects/${projectId}/kanban`}>
                <Button className="gap-2 bg-primary hover:bg-primary/90">
                  <Kanban className="w-4 h-4" />
                  Abrir Kanban
                </Button>
              </Link>
            )}
            <Link href={`/chat/${projectId}`}>
              <Button variant="outline" className="gap-2 border-border">
                <Bot className="w-4 h-4" />
                Chat IA
              </Button>
            </Link>
            <Link href={`/projects/${projectId}/roles`}>
              <Button variant="outline" className="gap-2 border-border">
                <Shield className="w-4 h-4" />
                Funções
              </Button>
            </Link>

            {/* Archive / Reactivate */}
            {isOwner && (
              <div className="ml-auto flex gap-2">
                {isArchived ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                    onClick={() => {
                      updateProjectMutation.mutate({ id: projectId, status: "active" });
                      toast.success("Projeto reativado com sucesso!");
                    }}
                    disabled={updateProjectMutation.isPending}
                  >
                    <ArchiveRestore className="w-4 h-4" />
                    Reativar Projeto
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
                    onClick={() => setShowArchiveConfirm(true)}
                    disabled={updateProjectMutation.isPending}
                  >
                    <Archive className="w-4 h-4" />
                    Arquivar Projeto
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-red-300 text-red-600 hover:bg-red-50"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="w-4 h-4" />
                  Excluir
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full justify-start border-b border-border bg-transparent rounded-none h-auto p-0 gap-1 mb-0">
            <TabsTrigger
              value="overview"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent px-4 py-2.5 text-sm font-medium gap-2"
            >
              <LayoutDashboard className="w-4 h-4" />
              Visão Geral
            </TabsTrigger>
            <TabsTrigger
              value="members"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent px-4 py-2.5 text-sm font-medium gap-2"
            >
              <Users className="w-4 h-4" />
              Membros
              <Badge variant="secondary" className="ml-0.5 h-4 px-1.5 text-xs">{allMembers.length}</Badge>
            </TabsTrigger>
            <TabsTrigger
              value="revisions"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent px-4 py-2.5 text-sm font-medium gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Revisões
              {tasksWithRevisions.length > 0 && (
                <Badge className="ml-0.5 h-4 px-1.5 text-xs bg-indigo-100 text-indigo-700 border-0">
                  {tasksWithRevisions.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Overview Tab ─────────────────────────────────────────── */}
          <TabsContent value="overview" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Recent tasks */}
              <Card className="border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Kanban className="w-4 h-4 text-primary" />
                    Tarefas Recentes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {tasksLoading ? (
                    Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
                  ) : (tasks as any[]).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhuma tarefa ainda.</p>
                  ) : (
                    (tasks as any[]).slice(0, 6).map((t: any) => (
                      <Link key={t.id} href={`/tasks/${t.id}`}>
                        <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-secondary/40 transition-colors cursor-pointer group">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{t.title}</p>
                            <p className="text-xs text-muted-foreground">{STATUS_LABELS[t.status] ?? t.status}</p>
                          </div>
                          <Badge className={`text-xs border-0 ${PRIORITY_COLORS[t.priority] ?? ""}`}>
                            {PRIORITY_LABELS[t.priority] ?? t.priority}
                          </Badge>
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </Link>
                    ))
                  )}
                  {(tasks as any[]).length > 6 && (
                    <Link href={`/projects/${projectId}/kanban`}>
                      <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground mt-1">
                        Ver todas as tarefas →
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>

              {/* Summary */}
              <Card className="border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <LayoutDashboard className="w-4 h-4 text-primary" />
                    Resumo do Projeto
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: "Para Iniciar",  value: project.taskCounts.pending,       color: "bg-slate-400" },
                    { label: "Em Andamento",  value: project.taskCounts.in_progress,   color: "bg-blue-500" },
                    { label: "Compartilhado", value: project.taskCounts.shared ?? 0,   color: "bg-amber-500" },
                    { label: "Publicado",     value: project.taskCounts.published ?? 0, color: "bg-emerald-500" },
                    { label: "Arquivado",     value: project.taskCounts.archived ?? 0, color: "bg-gray-400" },
                  ].map(({ label, value, color }) => {
                    const total = Object.values(project.taskCounts).reduce((a: number, v: any) => a + (v ?? 0), 0) || 1;
                    const pct = Math.round(((value ?? 0) / total) * 100);
                    return (
                      <div key={label}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-medium">{value ?? 0}</span>
                        </div>
                        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  <div className="pt-2 border-t border-border">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Membros</span>
                      <span className="font-medium">{allMembers.length}</span>
                    </div>
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-muted-foreground">Total de Revisões</span>
                      <span className="font-medium text-indigo-600">
                        {(tasks as any[]).reduce((a: number, t: any) => a + (t.revisionsCount ?? 0), 0)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── Members Tab ──────────────────────────────────────────── */}
          <TabsContent value="members" className="mt-4">
            <Card className="border-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="w-5 h-5 text-primary" />
                    Membros do Projeto
                    <Badge variant="secondary" className="ml-1">{allMembers.length}</Badge>
                  </CardTitle>
                  {isOwner && !isArchived && (
                    <Button
                      size="sm"
                      onClick={() => setShowInvite(true)}
                      className="gap-2 bg-primary hover:bg-primary/90"
                    >
                      <UserPlus className="w-4 h-4" />
                      Adicionar Membro
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {allMembers.map((member) => {
                  const RoleIcon = ROLE_ICONS[member.role] ?? User;
                  const initials = member.userName
                    ? member.userName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
                    : "M";
                  const isProjectOwner = member.role === "owner";
                  return (
                    <div key={member.userId} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-secondary/20 transition-colors">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className={`text-sm font-semibold ${isProjectOwner ? "bg-amber-100 text-amber-700" : "bg-primary/10 text-primary"}`}>
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{member.userName ?? "Usuário"}</p>
                        {member.userEmail && (
                          <p className="text-xs text-muted-foreground truncate">{member.userEmail}</p>
                        )}
                      </div>
                      <Badge className={`text-xs border gap-1 ${isProjectOwner ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-secondary text-secondary-foreground border-border"}`}>
                        <RoleIcon className="w-3 h-3" />
                        {ROLE_LABELS[member.role]}
                      </Badge>
                      {isOwner && !isProjectOwner && !isArchived && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => removeMemberMutation.mutate({ projectId, userId: member.userId })}
                          title="Remover membro"
                        >
                          <UserMinus className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  );
                })}
                {allMembers.length === 1 && (
                  <div className="text-center py-6 text-sm text-muted-foreground">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>Nenhum membro adicionado ainda.</p>
                    {isOwner && !isArchived && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-3 gap-2"
                        onClick={() => setShowInvite(true)}
                      >
                        <UserPlus className="w-4 h-4" />
                        Adicionar primeiro membro
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Revisions Tab ─────────────────────────────────────────── */}
          <TabsContent value="revisions" className="mt-4">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <RefreshCw className="w-5 h-5 text-primary" />
                  Histórico de Revisões
                  <Badge variant="secondary" className="ml-1">
                    {(tasks as any[]).reduce((a: number, t: any) => a + (t.revisionsCount ?? 0), 0)} revisões
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {tasksLoading ? (
                  Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full mb-2" />)
                ) : tasksWithRevisions.length === 0 ? (
                  <div className="text-center py-10">
                    <RefreshCw className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
                    <p className="text-sm text-muted-foreground">Nenhuma tarefa foi revisada ainda.</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Revisões ocorrem quando uma tarefa retorna de "Compartilhado" para "Em Andamento".
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Header */}
                    <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-secondary/40 rounded-lg text-xs font-semibold text-muted-foreground">
                      <div className="col-span-5">Tarefa</div>
                      <div className="col-span-2 text-center">Revisões</div>
                      <div className="col-span-2">Status Atual</div>
                      <div className="col-span-2">Prioridade</div>
                      <div className="col-span-1"></div>
                    </div>
                    {tasksWithRevisions.map((t: any) => (
                      <div key={t.id} className="grid grid-cols-12 gap-2 items-center px-3 py-3 rounded-lg border border-border hover:bg-secondary/20 transition-colors">
                        <div className="col-span-5 min-w-0">
                          <p className="text-sm font-medium truncate">{t.title}</p>
                          {t.setor && (
                            <p className="text-xs text-muted-foreground">{t.setor}</p>
                          )}
                        </div>
                        <div className="col-span-2 flex justify-center">
                          <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 border gap-1 text-xs">
                            <RefreshCw className="w-3 h-3" />
                            {t.revisionsCount}x
                          </Badge>
                        </div>
                        <div className="col-span-2">
                          <span className="text-xs text-muted-foreground">
                            {STATUS_LABELS[t.status] ?? t.status}
                          </span>
                        </div>
                        <div className="col-span-2">
                          <Badge className={`text-xs border-0 ${PRIORITY_COLORS[t.priority] ?? ""}`}>
                            {PRIORITY_LABELS[t.priority] ?? t.priority}
                          </Badge>
                        </div>
                        <div className="col-span-1 flex justify-end">
                          <Link href={`/tasks/${t.id}`}>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <ChevronRight className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    ))}

                    {/* Info note */}
                    <div className="mt-4 p-3 bg-indigo-50 border border-indigo-100 rounded-lg flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-indigo-700">
                        Uma revisão é contabilizada sempre que uma tarefa retorna do status <strong>Compartilhado</strong> para <strong>Em Andamento</strong>.
                        Tarefas com muitas revisões podem indicar necessidade de alinhamento entre equipe e líder.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Member Dialog */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              Adicionar Membro ao Projeto
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Buscar usuário por nome ou e-mail</Label>
              <Input
                placeholder="Digite nome ou e-mail..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setSelectedUserId(null); }}
                className="bg-input border-border"
                autoFocus
              />
              {searchQuery.length >= 2 && searchResults !== undefined && (
                <div className="border border-border rounded-lg overflow-hidden">
                  {searchResults.length === 0 ? (
                    <div className="px-3 py-3 text-sm text-muted-foreground text-center">
                      Nenhum usuário encontrado.
                    </div>
                  ) : (
                    searchResults.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => { setSelectedUserId(u.id); setSearchQuery(u.name ?? u.email ?? ""); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-secondary transition-colors text-left ${selectedUserId === u.id ? "bg-primary/10 border-l-2 border-primary" : ""}`}
                      >
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                            {(u.name ?? "U")[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{u.name ?? "Usuário"}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                        {selectedUserId === u.id && (
                          <Badge className="ml-auto bg-primary/10 text-primary border-0 text-xs">Selecionado</Badge>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
              {selectedUserId && (
                <p className="text-xs text-emerald-600 flex items-center gap-1">
                  ✓ Usuário selecionado. O membro receberá uma notificação ao ser adicionado.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Função no projeto</Label>
              <Select value={selectedRole} onValueChange={(v: any) => setSelectedRole(v)}>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin — pode gerenciar tarefas e membros</SelectItem>
                  <SelectItem value="member">Membro — pode criar e editar tarefas</SelectItem>
                  <SelectItem value="viewer">Visualizador — somente leitura</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowInvite(false); setSearchQuery(""); setSelectedUserId(null); }}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!selectedUserId) return toast.error("Selecione um usuário da lista");
                addMemberMutation.mutate({ projectId, userId: selectedUserId, role: selectedRole });
              }}
              disabled={addMemberMutation.isPending || !selectedUserId}
              className="bg-primary hover:bg-primary/90 gap-2"
            >
              <UserPlus className="w-4 h-4" />
              {addMemberMutation.isPending ? "Adicionando..." : "Adicionar Membro"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation */}
      <AlertDialog open={showArchiveConfirm} onOpenChange={setShowArchiveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Archive className="w-5 h-5 text-amber-600" />
              Arquivar Projeto?
            </AlertDialogTitle>
            <AlertDialogDescription>
              O projeto <strong>"{project.name}"</strong> será arquivado. As tarefas e dados serão preservados,
              mas o projeto ficará inativo e não aparecerá no Kanban. Você pode reativar a qualquer momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => {
                updateProjectMutation.mutate({ id: projectId, status: "archived" });
                setShowArchiveConfirm(false);
                toast.success("Projeto arquivado com sucesso.");
              }}
            >
              Arquivar Projeto
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-600" />
              Excluir Projeto Permanentemente?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é <strong>irreversível</strong>. O projeto <strong>"{project.name}"</strong>,
              todas as suas tarefas, comentários e anexos serão excluídos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                deleteProjectMutation.mutate({ id: projectId });
                setShowDeleteConfirm(false);
              }}
            >
              Excluir Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
