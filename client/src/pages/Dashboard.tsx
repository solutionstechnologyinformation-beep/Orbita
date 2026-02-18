import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import {
  FolderKanban,
  CheckCircle2,
  Clock,
  ListTodo,
  ArrowRight,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const PRIORITY_LABELS: Record<string, string> = {
  low: "Baixa", medium: "Média", high: "Alta", urgent: "Urgente",
};
const STATUS_LABELS: Record<string, string> = {
  todo: "A fazer", in_progress: "Em progresso", done: "Concluída",
};

export default function Dashboard() {
  const { user } = useAuth();
  const { data: stats, isLoading: statsLoading } = trpc.dashboard.stats.useQuery();
  const { data: recentTasks, isLoading: tasksLoading } = trpc.dashboard.recentTasks.useQuery();
  const { data: projects, isLoading: projectsLoading } = trpc.projects.list.useQuery();

  const completionRate = stats && stats.totalTasks > 0
    ? Math.round((stats.completedTasks / stats.totalTasks) * 100)
    : 0;

  const statCards = [
    {
      icon: FolderKanban,
      label: "Projetos",
      value: stats?.totalProjects ?? 0,
      color: "text-violet-400",
      bg: "bg-violet-500/10",
    },
    {
      icon: ListTodo,
      label: "Total de Tarefas",
      value: stats?.totalTasks ?? 0,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      icon: CheckCircle2,
      label: "Concluídas",
      value: stats?.completedTasks ?? 0,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      icon: Clock,
      label: "Pendentes",
      value: stats?.pendingTasks ?? 0,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
    },
  ];

  return (
    <AppLayout title="Dashboard">
      <div className="space-y-6">
        {/* Welcome */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">
              Olá, {user?.name?.split(" ")[0] ?? "Usuário"} 👋
            </h2>
            <p className="text-muted-foreground mt-1">
              Aqui está um resumo do seu trabalho hoje.
            </p>
          </div>
          <Link href="/projects">
            <Button className="gap-2 bg-primary hover:bg-primary/90">
              Novo Projeto
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map(({ icon: Icon, label, value, color, bg }) => (
            <Card key={label} className="bg-card border-border">
              <CardContent className="p-5">
                {statsLoading ? (
                  <Skeleton className="h-16 w-full" />
                ) : (
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">{label}</p>
                      <p className="text-3xl font-bold">{value}</p>
                    </div>
                    <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${color}`} />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Progress Bar */}
        {!statsLoading && stats && stats.totalTasks > 0 && (
          <Card className="bg-card border-border">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <span className="font-medium">Taxa de Conclusão Geral</span>
                </div>
                <span className="text-2xl font-bold text-primary">{completionRate}%</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-700"
                  style={{ width: `${completionRate}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {stats.completedTasks} de {stats.totalTasks} tarefas concluídas
              </p>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Tasks */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Minhas Tarefas Recentes</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {tasksLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))
              ) : !recentTasks?.length ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <CheckCircle2 className="w-10 h-10 text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground text-sm">Nenhuma tarefa atribuída a você.</p>
                </div>
              ) : (
                recentTasks.slice(0, 6).map((task) => (
                  <Link key={task.id} href={`/tasks/${task.id}`}>
                    <a className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/50 transition-colors group">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        task.status === "done" ? "bg-emerald-400" :
                        task.status === "in_progress" ? "bg-blue-400" : "bg-slate-400"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                          {task.title}
                        </p>
                        <p className="text-xs text-muted-foreground">{STATUS_LABELS[task.status]}</p>
                      </div>
                      <Badge className={`text-xs px-2 py-0 h-5 priority-${task.priority}`}>
                        {PRIORITY_LABELS[task.priority]}
                      </Badge>
                    </a>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          {/* Projects Overview */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Projetos Ativos</CardTitle>
                <Link href="/projects">
                  <a className="text-xs text-primary hover:underline flex items-center gap-1">
                    Ver todos <ArrowRight className="w-3 h-3" />
                  </a>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {projectsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))
              ) : !projects?.length ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <FolderKanban className="w-10 h-10 text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground text-sm">Nenhum projeto ainda.</p>
                  <Link href="/projects">
                    <Button variant="ghost" size="sm" className="mt-2 text-primary">
                      Criar projeto
                    </Button>
                  </Link>
                </div>
              ) : (
                projects.filter(p => p.status === "active").slice(0, 5).map((project) => {
                  const rate = project.taskCounts.total > 0
                    ? Math.round((project.taskCounts.done / project.taskCounts.total) * 100)
                    : 0;
                  return (
                    <Link key={project.id} href={`/projects/${project.id}/kanban`}>
                      <a className="block p-3 rounded-lg hover:bg-secondary/50 transition-colors group">
                        <div className="flex items-center gap-3 mb-2">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: project.color }}
                          />
                          <span className="text-sm font-medium flex-1 truncate">{project.name}</span>
                          <span className="text-xs text-muted-foreground">{rate}%</span>
                        </div>
                        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${rate}%`, backgroundColor: project.color }}
                          />
                        </div>
                        <div className="flex gap-3 mt-1.5 text-xs text-muted-foreground">
                          <span>{project.taskCounts.done} concluídas</span>
                          <span>·</span>
                          <span>{project.taskCounts.in_progress} em progresso</span>
                          <span>·</span>
                          <span>{project.taskCounts.todo} a fazer</span>
                        </div>
                      </a>
                    </Link>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
