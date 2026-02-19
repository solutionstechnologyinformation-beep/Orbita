import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useParams, Link } from "wouter";
import { toast } from "sonner";
import { useState } from "react";
import {
  Users, Kanban, Bot, UserPlus, UserMinus,
  Crown, Shield, Eye, User,
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const ROLE_ICONS: Record<string, any> = {
  owner: Crown, admin: Shield, member: User, viewer: Eye,
};
const ROLE_LABELS: Record<string, string> = {
  owner: "Dono", admin: "Admin", member: "Membro", viewer: "Visualizador",
};

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const projectId = parseInt(id ?? "0");
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const { data: project, isLoading } = trpc.projects.get.useQuery({ id: projectId });
  const [showInvite, setShowInvite] = useState(false);
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
      toast.success("Membro adicionado!");
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

  return (
    <AppLayout title={project.name} backHref="/projects">
      <div className="space-y-6">
        {/* Project Header */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${project.color}20` }}
            >
              <div className="w-6 h-6 rounded-full" style={{ backgroundColor: project.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold mb-1">{project.name}</h2>
              {project.description && (
                <p className="text-muted-foreground">{project.description}</p>
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
          <div className="flex gap-3 mt-6">
            <Link href={`/projects/${projectId}/kanban`}>
              <Button className="gap-2 bg-primary hover:bg-primary/90">
                <Kanban className="w-4 h-4" />
                Abrir Kanban
              </Button>
            </Link>
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
          </div>
        </div>

        {/* Members */}
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Membros ({(project.members?.length ?? 0) + 1})
              </CardTitle>
              {isOwner && (
                <Button
                  size="sm"
                  onClick={() => setShowInvite(true)}
                  className="gap-2 bg-primary hover:bg-primary/90"
                >
                  <UserPlus className="w-4 h-4" />
                  Convidar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {/* Owner */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
              <Avatar className="w-9 h-9">
                <AvatarFallback className="bg-primary/20 text-primary text-sm font-semibold">
                  {project.name?.[0]?.toUpperCase() ?? "O"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Dono do Projeto</p>
                <p className="text-xs text-muted-foreground">ID: {project.ownerId}</p>
              </div>
              <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/30 text-xs">
                <Crown className="w-3 h-3 mr-1" />
                Dono
              </Badge>
            </div>

            {/* Members */}
            {project.members?.map((member) => {
              const RoleIcon = ROLE_ICONS[member.role] ?? User;
              const initials = member.userName
                ? member.userName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
                : "M";
              return (
                <div key={member.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/30 transition-colors">
                  <Avatar className="w-9 h-9">
                    <AvatarFallback className="bg-secondary text-foreground text-sm font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{member.userName ?? "Usuário"}</p>
                    <p className="text-xs text-muted-foreground truncate">{member.userEmail ?? ""}</p>
                  </div>
                  <Badge className="bg-secondary text-secondary-foreground border border-border text-xs">
                    <RoleIcon className="w-3 h-3 mr-1" />
                    {ROLE_LABELS[member.role]}
                  </Badge>
                  {isOwner && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => removeMemberMutation.mutate({ projectId, userId: member.userId })}
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Invite Dialog */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Convidar Membro</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Buscar usuário</Label>
              <Input
                placeholder="Nome ou e-mail..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-input border-border"
              />
              {searchResults && searchResults.length > 0 && (
                <div className="border border-border rounded-lg overflow-hidden">
                  {searchResults.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => { setSelectedUserId(u.id); setSearchQuery(u.name ?? u.email ?? ""); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-secondary transition-colors text-left ${selectedUserId === u.id ? "bg-primary/10" : ""}`}
                    >
                      <Avatar className="w-7 h-7">
                        <AvatarFallback className="text-xs bg-secondary">
                          {(u.name ?? "U")[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{u.name ?? "Usuário"}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Função</Label>
              <Select value={selectedRole} onValueChange={(v: any) => setSelectedRole(v)}>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="member">Membro</SelectItem>
                  <SelectItem value="viewer">Visualizador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvite(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!selectedUserId) return toast.error("Selecione um usuário");
                addMemberMutation.mutate({ projectId, userId: selectedUserId, role: selectedRole });
              }}
              disabled={addMemberMutation.isPending}
              className="bg-primary hover:bg-primary/90"
            >
              Convidar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
