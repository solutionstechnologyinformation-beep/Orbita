import AppLayout from "@/components/AppLayout";
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Calendar, User, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";

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

type ViewMode = "project" | "custom";

export default function Gantt() {
  const [projectId, setProjectId] = useState<number | undefined>(undefined);
  const [viewMode, setViewMode] = useState<ViewMode>("project");
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [customEnd, setCustomEnd] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 2);
    d.setDate(0);
    return d.toISOString().slice(0, 10);
  });
  const [zoom, setZoom] = useState<"week" | "month" | "quarter">("month");

  const projectsQ = trpc.projects.list.useQuery();
  const ganttQ = trpc.gantt.tasks.useQuery({ projectId });
  const conflictsQ = trpc.gantt.conflicts.useQuery({ projectId });

  const tasks = ganttQ.data ?? [];
  const conflicts = conflictsQ.data ?? [];

  // Compute timeline range based on view mode
  const { minDate, maxDate } = useMemo(() => {
    if (viewMode === "custom") {
      return {
        minDate: new Date(customStart).getTime(),
        maxDate: new Date(customEnd).getTime() + 86400000,
      };
    }
    // Project mode: fit all tasks
    const dates = tasks.flatMap(t => [
      t.startDate ? new Date(t.startDate).getTime() : null,
      t.endDate ? new Date(t.endDate).getTime() : null,
      t.dueDate ? new Date(t.dueDate).getTime() : null,
    ]).filter(Boolean) as number[];
    if (dates.length === 0) {
      const now = new Date();
      now.setDate(1);
      const end = new Date(now);
      end.setMonth(end.getMonth() + 2);
      return { minDate: now.getTime(), maxDate: end.getTime() };
    }
    const min = Math.min(...dates);
    const max = Math.max(...dates);
    // Add padding
    return { minDate: min - 2 * 86400000, maxDate: max + 5 * 86400000 };
  }, [viewMode, customStart, customEnd, tasks]);

  const totalMs = maxDate - minDate;

  const conflictTaskIds = new Set(
    conflicts.flatMap((c: any) => [c.task1.id, c.task2.id])
  );

  function getBarStyle(task: any) {
    const start = task.startDate ? new Date(task.startDate).getTime() : null;
    const end = task.endDate
      ? new Date(task.endDate).getTime()
      : task.dueDate
      ? new Date(task.dueDate).getTime()
      : null;
    if (!start || !end) return null;
    const clampedStart = Math.max(start, minDate);
    const clampedEnd = Math.min(end, maxDate);
    if (clampedStart >= clampedEnd) return null;
    const left = ((clampedStart - minDate) / totalMs) * 100;
    const width = Math.max(0.3, ((clampedEnd - clampedStart) / totalMs) * 100);
    return { left: `${left}%`, width: `${width}%` };
  }

  // Generate date labels based on zoom
  const dateLabels = useMemo(() => {
    const labels: { label: string; left: number; isMonth?: boolean }[] = [];
    const cur = new Date(minDate);
    cur.setHours(0, 0, 0, 0);
    const end = new Date(maxDate);

    if (zoom === "week") {
      // Daily labels
      while (cur <= end) {
        const pct = ((cur.getTime() - minDate) / totalMs) * 100;
        const isMonday = cur.getDay() === 1;
        labels.push({
          label: cur.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
          left: pct,
          isMonth: isMonday,
        });
        cur.setDate(cur.getDate() + 1);
      }
    } else if (zoom === "month") {
      // Weekly labels
      // Align to Monday
      const dayOfWeek = cur.getDay();
      const daysToMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
      cur.setDate(cur.getDate() + daysToMonday);
      while (cur <= end) {
        const pct = ((cur.getTime() - minDate) / totalMs) * 100;
        const isFirst = cur.getDate() <= 7;
        labels.push({
          label: cur.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
          left: pct,
          isMonth: isFirst,
        });
        cur.setDate(cur.getDate() + 7);
      }
    } else {
      // Monthly labels
      cur.setDate(1);
      while (cur <= end) {
        const pct = ((cur.getTime() - minDate) / totalMs) * 100;
        labels.push({
          label: cur.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
          left: pct,
          isMonth: true,
        });
        cur.setMonth(cur.getMonth() + 1);
      }
    }
    return labels;
  }, [minDate, maxDate, totalMs, zoom]);

  // Today marker
  const todayPct = ((Date.now() - minDate) / totalMs) * 100;
  const showToday = todayPct >= 0 && todayPct <= 100;

  // Min width based on zoom
  const minWidth = zoom === "week" ? 1400 : zoom === "month" ? 900 : 700;

  return (
    <AppLayout title="Gráfico de Gantt">
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gráfico de Gantt</h1>
            <p className="text-gray-500 text-sm mt-1">Cronograma de tarefas com detecção de conflitos</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Project filter */}
            <Select
              value={projectId?.toString() ?? "all"}
              onValueChange={v => setProjectId(v === "all" ? undefined : Number(v))}
            >
              <SelectTrigger className="w-48 h-9 text-sm">
                <SelectValue placeholder="Todos os projetos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os projetos</SelectItem>
                {(projectsQ.data ?? []).map((p: any) => (
                  <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* View mode */}
            <Select value={viewMode} onValueChange={v => setViewMode(v as ViewMode)}>
              <SelectTrigger className="w-44 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="project">Período do projeto</SelectItem>
                <SelectItem value="custom">Intervalo personalizado</SelectItem>
              </SelectContent>
            </Select>
            {/* Zoom */}
            <div className="flex items-center gap-1 border rounded-md p-0.5">
              <Button
                variant={zoom === "week" ? "default" : "ghost"}
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => setZoom("week")}
              >Semana</Button>
              <Button
                variant={zoom === "month" ? "default" : "ghost"}
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => setZoom("month")}
              >Mês</Button>
              <Button
                variant={zoom === "quarter" ? "default" : "ghost"}
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => setZoom("quarter")}
              >Trimestre</Button>
            </div>
          </div>
        </div>

        {/* Custom date range */}
        {viewMode === "custom" && (
          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
            <Calendar className="h-4 w-4 text-blue-500 flex-shrink-0" />
            <span className="text-sm text-blue-700 font-medium">Intervalo:</span>
            <Input
              type="date"
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
              className="h-8 w-40 text-sm"
            />
            <span className="text-sm text-gray-500">até</span>
            <Input
              type="date"
              value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
              className="h-8 w-40 text-sm"
            />
          </div>
        )}

        {/* Conflicts alert */}
        {conflicts.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>{conflicts.length} conflito(s) detectado(s):</strong>
              {(conflicts as any[]).map((c: any, i: number) => (
                <span key={i} className="block text-sm mt-1">
                  • <strong>{c.task1.assigneeName ?? "Usuário"}</strong>: "{c.task1.title}" e "{c.task2.title}" se sobrepõem
                </span>
              ))}
            </AlertDescription>
          </Alert>
        )}

        {/* Gantt Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Cronograma
              {tasks.length > 0 && (
                <span className="text-muted-foreground font-normal ml-1">
                  — {tasks.length} tarefa{tasks.length !== 1 ? "s" : ""}
                  {" "}({new Date(minDate).toLocaleDateString("pt-BR")} – {new Date(maxDate).toLocaleDateString("pt-BR")})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {ganttQ.isLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : tasks.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Calendar className="h-14 w-14 mx-auto mb-3 opacity-20" />
                <p className="font-medium">Nenhuma tarefa com datas definidas</p>
                <p className="text-sm mt-1">Defina datas de início e/ou fim nas tarefas para visualizar o Gantt.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div style={{ minWidth: minWidth }}>
                  {/* Date header */}
                  <div className="relative h-10 border-b bg-gray-50 flex-shrink-0">
                    <div className="absolute inset-y-0 left-0 w-52 border-r bg-gray-50 flex items-center px-3">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tarefa</span>
                    </div>
                    <div className="absolute inset-y-0" style={{ left: 208, right: 0 }}>
                      <div className="relative h-full">
                        {dateLabels.map((w, i) => (
                          <div
                            key={i}
                            className="absolute top-0 h-full flex flex-col justify-center"
                            style={{ left: `${w.left}%` }}
                          >
                            <div className={`h-full border-l ${w.isMonth ? "border-gray-300" : "border-gray-100"}`} />
                            <span className={`absolute top-1 text-xs -translate-x-1/2 whitespace-nowrap ${w.isMonth ? "text-gray-600 font-medium" : "text-gray-400"}`}>
                              {w.label}
                            </span>
                          </div>
                        ))}
                        {/* Today */}
                        {showToday && (
                          <div
                            className="absolute top-0 h-full border-l-2 border-red-400 z-10"
                            style={{ left: `${todayPct}%` }}
                          >
                            <span className="absolute top-1 text-xs text-red-500 font-bold -translate-x-1/2 bg-white px-0.5">Hoje</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Task rows */}
                  <div>
                    {tasks.map((task: any, idx: number) => {
                      const barStyle = getBarStyle(task);
                      const isConflict = conflictTaskIds.has(task.id);
                      return (
                        <div
                          key={task.id}
                          className={`flex border-b hover:bg-gray-50 transition-colors ${idx % 2 === 0 ? "" : "bg-gray-50/50"}`}
                          style={{ height: 44 }}
                        >
                          {/* Task info */}
                          <div className="w-52 flex-shrink-0 flex items-center gap-2 px-3 border-r">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium truncate text-gray-800">{task.title}</p>
                              <p className="text-xs text-gray-400 truncate flex items-center gap-1">
                                <User className="h-2.5 w-2.5" />
                                {task.assigneeName ?? "Sem responsável"}
                              </p>
                            </div>
                            {isConflict && <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />}
                          </div>
                          {/* Bar area */}
                          <div className="relative flex-1">
                            {/* Grid lines */}
                            {dateLabels.map((w, i) => (
                              <div
                                key={i}
                                className={`absolute top-0 h-full border-l ${w.isMonth ? "border-gray-200" : "border-gray-100"}`}
                                style={{ left: `${w.left}%` }}
                              />
                            ))}
                            {/* Today line */}
                            {showToday && (
                              <div
                                className="absolute top-0 h-full border-l-2 border-red-300 z-10 opacity-60"
                                style={{ left: `${todayPct}%` }}
                              />
                            )}
                            {/* Task bar */}
                            {barStyle ? (
                              <div
                                className="absolute top-1/2 -translate-y-1/2 h-6 rounded flex items-center px-2 text-xs text-white font-medium overflow-hidden shadow-sm cursor-default"
                                style={{
                                  ...barStyle,
                                  backgroundColor: isConflict ? "#ef4444" : (STATUS_COLORS[task.status] ?? "#6366f1"),
                                  minWidth: 4,
                                }}
                                title={`${task.title}\nStatus: ${STATUS_LABELS[task.status] ?? task.status}\nResponsável: ${task.assigneeName ?? "—"}${isConflict ? "\n⚠️ CONFLITO DE AGENDA" : ""}`}
                              >
                                <span className="truncate">{task.title}</span>
                              </div>
                            ) : (
                              <div className="absolute inset-0 flex items-center px-3">
                                <span className="text-xs text-gray-300 italic">Sem datas</span>
                              </div>
                            )}
                          </div>
                          {/* Status badge */}
                          <div className="w-28 flex-shrink-0 flex items-center justify-center border-l px-2">
                            <Badge
                              variant="outline"
                              className="text-xs"
                              style={{ borderColor: STATUS_COLORS[task.status], color: STATUS_COLORS[task.status] }}
                            >
                              {STATUS_LABELS[task.status] ?? task.status}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs text-gray-500">
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: STATUS_COLORS[key] }} />
              <span>{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div className="w-0.5 h-4 bg-red-400" />
            <span>Hoje</span>
          </div>
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3 text-red-500" />
            <span>Conflito de agenda</span>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
