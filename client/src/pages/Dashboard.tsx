import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import {
  FolderKanban, CheckCircle2, Clock, ListTodo,
  ArrowRight, TrendingUp, AlertCircle, BarChart2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

const PRIORITY_LABELS: Record<string, string> = {
  low: "Baixa", medium: "Média", high: "Alta", urgent: "Urgente",
};
const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-slate-100 text-slate-600 border-slate-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  urgent: "bg-red-50 text-red-700 border-red-200",
};
const STATUS_LABELS: Record<string, string> = {
  todo: "A Fazer", in_progress: "Em Progresso", done: "Concluído",
};

function isOverdue(task: any) {
  return task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "done";
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data: stats, isLoading: statsLoading } = trpc.dashboard.stats.useQuery();
  const { data: recentTasks = [], isLoading: tasksLoading } = trpc.dashboard.recentTasks.useQuery();
  const { data: projects = [], isLoading: projectsLoading } = trpc.projects.list.useQuery();
  const { data: setorStats = [], isLoading: setorLoading } = trpc.dashboard.setorStats.useQuery();

  const completionRate = stats && stats.totalTasks > 0
    ? Math.round((stats.completedTasks / stats.totalTasks) * 100)
    : 0;

  const inProgressCount = stats
    ? stats.totalTasks - stats.completedTasks - (stats.pendingTasks ?? 0)
    : 0;

  const pieData = stats ? [
    { name: "A Fazer", value: Math.max(0, stats.pendingTasks ?? 0), fill: "#6366f1" },
    { name: "Em Progresso", value: Math.max(0, inProgressCount), fill: "#3b82f6" },
    { name: "Concluído", value: stats.completedTasks, fill: "#10b981" },
  ].filter(d => d.value > 0) : [];

  const barData = (projects as any[]).slice(0, 6).map((p: any) => ({
    name: p.name.length > 12 ? p.name.slice(0, 12) + "…" : p.name,
    "A Fazer": p.taskCounts?.todo ?? 0,
    "Em Progresso": p.taskCounts?.in_progress ?? 0,
    "Concluído": p.taskCounts?.done ?? 0,
  }));

  const overdueCount = (recentTasks as any[]).filter(isOverdue).length;

  const statCards = [
    { icon: FolderKanban, label: "Projetos", value: stats?.totalProjects ?? 0, color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-100" },
    { icon: ListTodo, label: "Total de Tarefas", value: stats?.totalTasks ?? 0, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" },
    { icon: CheckCircle2, label: "Concluídas", value: stats?.completedTasks ?? 0, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
    { icon: Clock, label: "Pendentes", value: stats?.pendingTasks ?? 0, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100" },
  ];

  return (
    <AppLayout title="Dashboard">
      <div className="space-y-6">
        {/* Greeting */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              Olá, {user?.name?.split(" ")[0] ?? "usuário"} 👋
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              Aqui está o resumo dos seus projetos e tarefas.
            </p>
          </div>
          <Link href="/projects">
            <Button className="bg-primary hover:bg-primary/90 text-white gap-2 shadow-sm">
              Novo Projeto <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>

        {/* Overdue alert */}
        {overdueCount > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>
              <strong>{overdueCount}</strong> {overdueCount === 1 ? "tarefa está vencida" : "tarefas estão vencidas"}.{" "}
              Acesse o Kanban para atualizar os prazos.
            </span>
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card) => (
            <Card key={card.label} className={`border ${card.border} shadow-sm hover:shadow-md transition-shadow`}>
              <CardContent className="p-4">
                {statsLoading ? (
                  <Skeleton className="h-16 w-full" />
                ) : (
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${card.bg}`}>
                      <card.icon className={`w-5 h-5 ${card.color}`} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{card.value}</p>
                      <p className="text-xs text-muted-foreground">{card.label}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Pie chart */}
          <Card className="border border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-primary" />
                Distribuição de Tarefas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : pieData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                  Nenhuma tarefa ainda
                </div>
              ) : (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "12px" }}
                      />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "12px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
              {!statsLoading && stats && stats.totalTasks > 0 && (
                <div className="mt-3 space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Taxa de conclusão</span>
                    <span className="font-semibold text-emerald-600">{completionRate}%</span>
                  </div>
                  <Progress value={completionRate} className="h-1.5" />
                  <p className="text-xs text-muted-foreground">{stats.completedTasks} de {stats.totalTasks} tarefas concluídas</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bar chart by project */}
          <Card className="border border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Tarefas por Projeto
              </CardTitle>
            </CardHeader>
            <CardContent>
              {projectsLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : barData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                  Nenhum projeto ainda
                </div>
              ) : (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "12px" }}
                      />
                      <Bar dataKey="A Fazer" fill="#6366f1" radius={[3, 3, 0, 0]} maxBarSize={24} />
                      <Bar dataKey="Em Progresso" fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={24} />
                      <Bar dataKey="Concluído" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Setor Metrics */}
        {((setorStats as any[]).length > 0 || setorLoading) && (
          <Card className="border border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-primary" />
                Métricas por Setor / Disciplina
              </CardTitle>
            </CardHeader>
            <CardContent>
              {setorLoading ? (
                <Skeleton className="h-52 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={setorStats as any[]} margin={{ top: 4, right: 4, left: -20, bottom: 44 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="setor"
                      tick={{ fontSize: 10 }}
                      angle={-35}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "12px" }}
                    />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                    <Bar dataKey="pending" name="Para Iniciar" stackId="a" fill="#94a3b8" />
                    <Bar dataKey="in_progress" name="Em Andamento" stackId="a" fill="#3b82f6" />
                    <Bar dataKey="shared" name="Compartilhado" stackId="a" fill="#f59e0b" />
                    <Bar dataKey="completed" name="Concluído" stackId="a" fill="#10b981" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        )}

        {/* Bottom row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Recent tasks */}
          <Card className="border border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Minhas Tarefas Recentes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {tasksLoading ? (
                Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
              ) : (recentTasks as any[]).length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma tarefa atribuída a você.</p>
              ) : (
                (recentTasks as any[]).slice(0, 6).map((task: any) => {
                  const overdue = isOverdue(task);
                  return (
                    <Link key={task.id} href={`/tasks/${task.id}`}>
                      <div className={`flex items-center gap-3 p-3 rounded-lg border hover:bg-slate-50 transition-colors cursor-pointer ${overdue ? "border-red-200 bg-red-50/30" : "border-border"}`}>
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${task.status === "done" ? "bg-emerald-500" : task.status === "in_progress" ? "bg-blue-500" : "bg-slate-400"}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${task.status === "done" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                            {task.title}
                          </p>
                          <p className="text-xs text-muted-foreground">{STATUS_LABELS[task.status]}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {overdue && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                          <Badge className={`text-[10px] px-1.5 py-0 h-4.5 border ${PRIORITY_COLORS[task.priority]}`}>
                            {PRIORITY_LABELS[task.priority]}
                          </Badge>
                        </div>
                      </div>
                    </Link>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Active projects */}
          <Card className="border border-border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Projetos Ativos</CardTitle>
                <Link href="/projects">
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground gap-1">
                    Ver todos <ArrowRight className="w-3 h-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {projectsLoading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
              ) : (projects as any[]).filter((p: any) => p.status === "active").length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-sm text-muted-foreground mb-3">Nenhum projeto ativo.</p>
                  <Link href="/projects">
                    <Button size="sm" className="bg-primary hover:bg-primary/90 text-white">Criar projeto</Button>
                  </Link>
                </div>
              ) : (
                (projects as any[]).filter((p: any) => p.status === "active").slice(0, 5).map((project: any) => {
                  const counts = project.taskCounts ?? { todo: 0, in_progress: 0, done: 0, total: 0 };
                  const rate = counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : 0;
                  return (
                    <Link key={project.id} href={`/projects/${project.id}`}>
                      <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-slate-50 transition-colors cursor-pointer">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{project.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Progress value={rate} className="h-1 flex-1" />
                            <span className="text-[10px] text-muted-foreground flex-shrink-0">{rate}%</span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs font-semibold text-foreground">{counts.total}</p>
                          <p className="text-[10px] text-muted-foreground">tarefas</p>
                        </div>
                      </div>
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
