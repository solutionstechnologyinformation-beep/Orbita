import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import {
  Shield, Users, FolderKanban, Activity, Crown, User,
  CheckCircle2, Clock, ListTodo,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

const ACTION_LABELS: Record<string, string> = {
  created_project: "Criou projeto",
  updated_project: "Atualizou projeto",
  deleted_project: "Excluiu projeto",
  created_task: "Criou tarefa",
  updated_task: "Atualizou tarefa",
  deleted_task: "Excluiu tarefa",
  uploaded_attachment: "Fez upload de anexo",
  added_comment: "Adicionou comentário",
};

export default function Admin() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && isAuthenticated && user?.role !== "admin") {
      navigate("/dashboard");
    }
  }, [loading, isAuthenticated, user]);

  const { data: allUsers, isLoading: usersLoading } = trpc.admin.users.useQuery();
  const { data: allProjects, isLoading: projectsLoading } = trpc.admin.allProjects.useQuery();
  const { data: logs, isLoading: logsLoading } = trpc.admin.activityLogs.useQuery({ limit: 50, offset: 0 });

  if (loading || !isAuthenticated) return null;
  if (user?.role !== "admin") return null;

  return (
    <AppLayout title="Painel Administrativo">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
            <Shield className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Painel Administrativo</h2>
            <p className="text-muted-foreground">Gerencie usuários, projetos e monitore atividades.</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Users, label: "Usuários", value: allUsers?.length ?? 0, color: "text-blue-400", bg: "bg-blue-500/10" },
            { icon: FolderKanban, label: "Projetos", value: allProjects?.length ?? 0, color: "text-violet-400", bg: "bg-violet-500/10" },
            { icon: Activity, label: "Atividades", value: logs?.length ?? 0, color: "text-emerald-400", bg: "bg-emerald-500/10" },
            { icon: Crown, label: "Admins", value: allUsers?.filter((u: any) => u.role === "admin").length ?? 0, color: "text-amber-400", bg: "bg-amber-500/10" },
          ].map(({ icon: Icon, label, value, color, bg }) => (
            <Card key={label} className="bg-card border-border">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{label}</p>
                    <p className="text-3xl font-bold">{value}</p>
                  </div>
                  <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="users">
          <TabsList className="bg-secondary border border-border">
            <TabsTrigger value="users" className="gap-2">
              <Users className="w-4 h-4" />
              Usuários
            </TabsTrigger>
            <TabsTrigger value="projects" className="gap-2">
              <FolderKanban className="w-4 h-4" />
              Projetos
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-2">
              <Activity className="w-4 h-4" />
              Logs
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="mt-4">
            <Card className="bg-card border-border">
              <CardContent className="p-0">
                {usersLoading ? (
                  <div className="p-4 space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-14 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {allUsers?.map((u: any) => {
                      const initials = u.name
                        ? u.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
                        : "U";
                      return (
                        <div key={u.id} className="flex items-center gap-4 p-4 hover:bg-secondary/30 transition-colors">
                          <Avatar className="w-10 h-10">
                            <AvatarFallback className={`text-sm font-semibold ${u.role === "admin" ? "bg-amber-500/20 text-amber-400" : "bg-primary/20 text-primary"}`}>
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{u.name ?? "Usuário"}</p>
                            <p className="text-sm text-muted-foreground truncate">{u.email ?? u.openId}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={u.role === "admin"
                              ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                              : "bg-secondary text-muted-foreground border border-border"
                            }>
                              {u.role === "admin" ? <Crown className="w-3 h-3 mr-1" /> : <User className="w-3 h-3 mr-1" />}
                              {u.role === "admin" ? "Admin" : "Usuário"}
                            </Badge>
                            <span className="text-xs text-muted-foreground hidden md:block">
                              {new Date(u.createdAt).toLocaleDateString("pt-BR")}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Projects Tab */}
          <TabsContent value="projects" className="mt-4">
            <Card className="bg-card border-border">
              <CardContent className="p-0">
                {projectsLoading ? (
                  <div className="p-4 space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-14 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {allProjects?.map((p: any) => (
                      <div key={p.id} className="flex items-center gap-4 p-4 hover:bg-secondary/30 transition-colors">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${p.color}20` }}
                        >
                          <FolderKanban className="w-5 h-5" style={{ color: p.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{p.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Dono ID: {p.ownerId} · {new Date(p.createdAt).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                        <Badge className={
                          p.status === "active"
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                            : "bg-secondary text-muted-foreground border border-border"
                        }>
                          {p.status === "active" ? "Ativo" : p.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs" className="mt-4">
            <Card className="bg-card border-border">
              <CardContent className="p-0">
                {logsLoading ? (
                  <div className="p-4 space-y-3">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : !logs?.length ? (
                  <div className="flex flex-col items-center py-12 text-center">
                    <Activity className="w-10 h-10 text-muted-foreground/20 mb-3" />
                    <p className="text-muted-foreground">Nenhuma atividade registrada.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {logs.map((log: any) => (
                      <div key={log.id} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors">
                        <div className="w-2 h-2 rounded-full bg-primary/60 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">
                            <span className="font-medium">{log.userName ?? `Usuário #${log.userId}`}</span>
                            {" "}
                            <span className="text-muted-foreground">{ACTION_LABELS[log.action] ?? log.action}</span>
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {new Date(log.createdAt).toLocaleDateString("pt-BR", {
                            day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
