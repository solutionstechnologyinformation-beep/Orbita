import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar, User, AlertTriangle } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  pending: "#94a3b8",
  in_progress: "#3b82f6",
  shared: "#f59e0b",
  published: "#10b981",
  archived: "#6b7280",
  blocked: "#ef4444",
};
const STATUS_LABELS: Record<string, string> = {
  pending: "Para Iniciar",
  in_progress: "Em Andamento",
  shared: "Compartilhado",
  published: "Publicado",
  archived: "Arquivado",
  blocked: "Bloqueado",
};
const PRIORITY_COLORS: Record<string, string> = {
  low: "#10b981",
  medium: "#f59e0b",
  high: "#ef4444",
  critical: "#7c3aed",
};

export default function Scheduling() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [weekOffset, setWeekOffset] = useState(0);
  const [projectId, setProjectId] = useState<number | undefined>(undefined);
  const [viewMode, setViewMode] = useState<"week" | "month">("week");

  const projectsQ = trpc.projects.list.useQuery();
  const schedulingQ = trpc.scheduling.tasks.useQuery({ projectId });

  const tasks = schedulingQ.data ?? [];

  // Compute week start (Monday)
  const weekStart = useMemo(() => {
    const d = new Date(today);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff + weekOffset * 7);
    return d;
  }, [weekOffset]);

  const weekDays = useMemo(() => {
    return Array.from({ length: viewMode === "week" ? 7 : 30 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart, viewMode]);

  function getTasksForDay(date: Date) {
    return tasks.filter(t => {
      const start = t.startDate ? new Date(t.startDate) : null;
      const end = t.endDate ? new Date(t.endDate) : t.dueDate ? new Date(t.dueDate) : null;
      if (!start && !end) return false;
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);
      if (start && end) {
        return start <= dayEnd && end >= dayStart;
      }
      if (end) {
        return end >= dayStart && end <= dayEnd;
      }
      return false;
    });
  }

  // Group tasks by assignee for weekly view
  const assignees = useMemo(() => {
    const map = new Map<number | null, { name: string | null; tasks: typeof tasks }>();
    tasks.forEach(t => {
      const key = t.assigneeId ?? null;
      if (!map.has(key)) {
        map.set(key, { name: t.assigneeName ?? "Sem responsável", tasks: [] });
      }
      map.get(key)!.tasks.push(t);
    });
    return Array.from(map.entries()).map(([id, v]) => ({ id, ...v }));
  }, [tasks]);

  // Stats
  const overdueTasks = tasks.filter(t => {
    const end = t.endDate ? new Date(t.endDate) : t.dueDate ? new Date(t.dueDate) : null;
    return end && end < today && t.status !== "published" && t.status !== "archived";
  });

  const thisWeekTasks = tasks.filter(t => {
    const end = t.endDate ? new Date(t.endDate) : t.dueDate ? new Date(t.dueDate) : null;
    if (!end) return false;
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    return end >= weekStart && end <= weekEnd;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Programação</h1>
          <p className="text-gray-500 text-sm mt-1">Visualize a carga de trabalho da equipe por período</p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={projectId?.toString() ?? "all"}
            onValueChange={v => setProjectId(v === "all" ? undefined : Number(v))}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Todos os projetos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os projetos</SelectItem>
              {(projectsQ.data ?? []).map(p => (
                <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex rounded-lg border overflow-hidden">
            <button
              className={`px-3 py-1.5 text-sm ${viewMode === "week" ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
              onClick={() => setViewMode("week")}
            >
              Semana
            </button>
            <button
              className={`px-3 py-1.5 text-sm ${viewMode === "month" ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
              onClick={() => setViewMode("month")}
            >
              Mês
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-gray-900">{tasks.length}</p>
            <p className="text-xs text-gray-500">Total de Tarefas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-blue-600">{thisWeekTasks.length}</p>
            <p className="text-xs text-gray-500">Entregas esta semana</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-red-600">{overdueTasks.length}</p>
            <p className="text-xs text-gray-500">Em atraso</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-green-600">
              {tasks.filter(t => t.status === "published").length}
            </p>
            <p className="text-xs text-gray-500">Publicadas</p>
          </CardContent>
        </Card>
      </div>

      {/* Overdue alert */}
      {overdueTasks.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <h3 className="text-sm font-semibold text-red-700">{overdueTasks.length} tarefa(s) em atraso</h3>
            </div>
            <div className="space-y-1">
              {overdueTasks.slice(0, 5).map(t => (
                <div key={t.id} className="flex items-center gap-2 text-sm text-red-600">
                  <span className="truncate">{t.title}</span>
                  <span className="text-xs text-red-400 flex-shrink-0">
                    — {t.assigneeName ?? "Sem responsável"}
                  </span>
                </div>
              ))}
              {overdueTasks.length > 5 && (
                <p className="text-xs text-red-400">+{overdueTasks.length - 5} mais...</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timeline navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setWeekOffset(w => w - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)}>
            Hoje
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekOffset(w => w + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-sm font-medium text-gray-700">
          {weekDays[0].toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} –{" "}
          {weekDays[weekDays.length - 1].toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
        </p>
      </div>

      {/* Schedule grid */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {schedulingQ.isLoading ? (
            <div className="text-center py-12 text-gray-400">Carregando...</div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhuma tarefa com datas definidas.</p>
            </div>
          ) : (
            <table className="w-full text-sm" style={{ minWidth: viewMode === "week" ? 700 : 1200 }}>
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 w-40 font-medium text-gray-600">
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" /> Responsável
                    </div>
                  </th>
                  {weekDays.map(d => {
                    const isToday = d.toDateString() === today.toDateString();
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    return (
                      <th
                        key={d.toISOString()}
                        className={`text-center p-2 font-medium text-xs ${
                          isToday ? "bg-indigo-50 text-indigo-700" :
                          isWeekend ? "text-gray-400 bg-gray-50" : "text-gray-600"
                        }`}
                      >
                        <div>{["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][d.getDay()]}</div>
                        <div className={`text-base font-bold ${isToday ? "text-indigo-700" : ""}`}>
                          {d.getDate()}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {assignees.map(assignee => (
                  <tr key={assignee.id ?? "none"} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-medium text-gray-700 align-top">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {(assignee.name ?? "?").charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm truncate max-w-24">{assignee.name ?? "Sem responsável"}</span>
                      </div>
                    </td>
                    {weekDays.map(d => {
                      const dayTasks = getTasksForDay(d).filter(t => t.assigneeId === assignee.id);
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                      return (
                        <td
                          key={d.toISOString()}
                          className={`p-1 align-top ${isWeekend ? "bg-gray-50" : ""}`}
                          style={{ minWidth: viewMode === "week" ? 80 : 40 }}
                        >
                          <div className="space-y-0.5">
                            {dayTasks.map(t => {
                              const isOverdue = (() => {
                                const end = t.endDate ? new Date(t.endDate) : t.dueDate ? new Date(t.dueDate) : null;
                                return end && end < today && t.status !== "published" && t.status !== "archived";
                              })();
                              return (
                                <div
                                  key={t.id}
                                  className="text-xs px-1.5 py-0.5 rounded text-white truncate"
                                  style={{
                                    backgroundColor: isOverdue ? "#ef4444" : STATUS_COLORS[t.status] ?? "#6366f1",
                                  }}
                                  title={`${t.title} — ${STATUS_LABELS[t.status] ?? t.status}${isOverdue ? " (ATRASADO)" : ""}`}
                                >
                                  {viewMode === "week" ? t.title : "●"}
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: STATUS_COLORS[key] }} />
            <span className="text-xs text-gray-600">{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-red-500" />
          <span className="text-xs text-gray-600">Atrasado</span>
        </div>
      </div>
    </div>
  );
}
