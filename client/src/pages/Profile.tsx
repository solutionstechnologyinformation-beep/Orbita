import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown, User, Mail, Calendar, FolderKanban, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Profile() {
  const { user } = useAuth();
  const { data: stats } = trpc.dashboard.stats.useQuery();
  const { data: projects } = trpc.projects.list.useQuery();

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  return (
    <AppLayout title="Meu Perfil">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Profile Card */}
        <Card className="bg-card border-border">
          <CardContent className="p-8">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              <Avatar className="w-20 h-20">
                <AvatarFallback className="bg-primary/20 text-primary text-2xl font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-center sm:text-left">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                  <h2 className="text-2xl font-bold">{user?.name ?? "Usuário"}</h2>
                  {user?.role === "admin" && (
                    <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/30 w-fit mx-auto sm:mx-0">
                      <Crown className="w-3 h-3 mr-1" />
                      Admin
                    </Badge>
                  )}
                </div>
                <div className="space-y-1.5 text-sm text-muted-foreground">
                  {user?.email && (
                    <div className="flex items-center gap-2 justify-center sm:justify-start">
                      <Mail className="w-4 h-4" />
                      {user.email}
                    </div>
                  )}
                  {user?.createdAt && (
                    <div className="flex items-center gap-2 justify-center sm:justify-start">
                      <Calendar className="w-4 h-4" />
                      Membro desde {new Date(user.createdAt).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                    </div>
                  )}
                  <div className="flex items-center gap-2 justify-center sm:justify-start">
                    <User className="w-4 h-4" />
                    {user?.loginMethod ?? "Manus OAuth"}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-5 text-center">
              <FolderKanban className="w-8 h-8 text-violet-400 mx-auto mb-2" />
              <p className="text-3xl font-bold">{stats?.totalProjects ?? 0}</p>
              <p className="text-sm text-muted-foreground mt-1">Projetos</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-5 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-3xl font-bold">{stats?.completedTasks ?? 0}</p>
              <p className="text-sm text-muted-foreground mt-1">Tarefas Concluídas</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Projects */}
        {projects && projects.length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base">Meus Projetos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {projects.slice(0, 5).map((p) => {
                const rate = p.taskCounts.total > 0
                  ? Math.round((p.taskCounts.done / p.taskCounts.total) * 100)
                  : 0;
                return (
                  <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                    <span className="text-sm font-medium flex-1 truncate">{p.name}</span>
                    <span className="text-xs text-muted-foreground">{rate}%</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
