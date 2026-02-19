import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Calendar, User } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  "para_iniciar": "#94a3b8",
  "em_andamento": "#3b82f6",
  "compartilhado": "#f59e0b",
  "publicado": "#10b981",
  "arquivado": "#6b7280",
  "bloqueado": "#ef4444",
};

const STATUS_LABELS: Record<string, string> = {
  "para_iniciar": "Para Iniciar",
  "em_andamento": "Em Andamento",
  "compartilhado": "Compartilhado",
  "publicado": "Publicado",
  "arquivado": "Arquivado",
  "bloqueado": "Bloqueado",
};

export default function Gantt() {
  const [projectId, setProjectId] = useState<number | undefined>(undefined);
  const projectsQ = trpc.projects.list.useQuery();
  const ganttQ = trpc.gantt.tasks.useQuery({ projectId });
  const conflictsQ = trpc.gantt.conflicts.useQuery({ projectId });

  const tasks = ganttQ.data ?? [];
  const conflicts = conflictsQ.data ?? [];

  // Compute timeline range
  const { minDate, maxDate, totalDays } = useMemo(() => {
    const dates = tasks.flatMap(t => [
      t.startDate ? new Date(t.startDate).getTime() : null,
      t.endDate ? new Date(t.endDate).getTime() : null,
      t.dueDate ? new Date(t.dueDate).getTime() : null,
    ]).filter(Boolean) as number[];
    if (dates.length === 0) {
      const now = Date.now();
      return { minDate: now, maxDate: now + 30 * 86400000, totalDays: 30 };
    }
    const min = Math.min(...dates);
    const max = Math.max(...dates);
    const days = Math.max(7, Math.ceil((max - min) / 86400000) + 2);
    return { minDate: min - 86400000, maxDate: min + days * 86400000, totalDays: days };
  }, [tasks]);

  const conflictTaskIds = new Set(
    conflicts.flatMap(c => [c.task1.id, c.task2.id])
  );

  function getBarStyle(task: typeof tasks[0]) {
    const start = task.startDate ? new Date(task.startDate).getTime() : null;
    const end = task.endDate
      ? new Date(task.endDate).getTime()
      : task.dueDate
      ? new Date(task.dueDate).getTime()
      : null;
    if (!start || !end) return null;
    const left = ((start - minDate) / (maxDate - minDate)) * 100;
    const width = Math.max(0.5, ((end - start) / (maxDate - minDate)) * 100);
    return { left: `${left}%`, width: `${width}%` };
  }

  // Generate week labels
  const weekLabels = useMemo(() => {
    const labels: { label: string; left: string }[] = [];
    const start = new Date(minDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(maxDate);
    const cur = new Date(start);
    while (cur <= end) {
      const pct = ((cur.getTime() - minDate) / (maxDate - minDate)) * 100;
      labels.push({
        label: cur.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
        left: `${pct}%`,
      });
      cur.setDate(cur.getDate() + 7);
    }
    return labels;
  }, [minDate, maxDate]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gráfico de Gantt</h1>
          <p className="text-gray-500 text-sm mt-1">Visualize o cronograma das tarefas e detecte conflitos</p>
        </div>
        <Select
          value={projectId?.toString() ?? "all"}
          onValueChange={v => setProjectId(v === "all" ? undefined : Number(v))}
        >
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Todos os projetos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os projetos</SelectItem>
            {(projectsQ.data ?? []).map(p => (
              <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {conflicts.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>{conflicts.length} conflito(s) detectado(s):</strong>{" "}
            {conflicts.map((c, i) => (
              <span key={i} className="block text-sm mt-1">
                • <strong>{c.task1.assigneeName ?? "Usuário"}</strong> tem tarefas sobrepostas:{" "}
                <em>"{c.task1.title}"</em> e <em>"{c.task2.title}"</em>
              </span>
            ))}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Cronograma de Tarefas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ganttQ.isLoading ? (
            <div className="text-center py-12 text-gray-400">Carregando...</div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhuma tarefa com datas definidas.</p>
              <p className="text-sm mt-1">Defina datas de início e fim nas tarefas para visualizar o Gantt.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {/* Header with dates */}
              <div className="relative h-8 mb-2 border-b" style={{ minWidth: 700 }}>
                {weekLabels.map((w, i) => (
                  <span
                    key={i}
                    className="absolute text-xs text-gray-400 -translate-x-1/2"
                    style={{ left: w.left }}
                  >
                    {w.label}
                  </span>
                ))}
              </div>
              {/* Task bars */}
              <div className="space-y-2" style={{ minWidth: 700 }}>
                {tasks.map(task => {
                  const barStyle = getBarStyle(task);
                  const isConflict = conflictTaskIds.has(task.id);
                  return (
                    <div key={task.id} className="flex items-center gap-2">
                      <div className="w-48 flex-shrink-0 flex items-center gap-2 pr-2">
                        <User className="h-3 w-3 text-gray-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{task.title}</p>
                          <p className="text-xs text-gray-400 truncate">{task.assigneeName ?? "Sem responsável"}</p>
                        </div>
                      </div>
                      <div className="relative flex-1 h-7 bg-gray-100 rounded">
                        {barStyle ? (
                          <div
                            className="absolute h-full rounded flex items-center px-2 text-xs text-white font-medium overflow-hidden"
                            style={{
                              ...barStyle,
                              backgroundColor: isConflict ? "#ef4444" : (STATUS_COLORS[task.status] ?? "#6366f1"),
                            }}
                            title={`${task.title} — ${STATUS_LABELS[task.status] ?? task.status}${isConflict ? " ⚠️ CONFLITO" : ""}`}
                          >
                            <span className="truncate">{task.title}</span>
                            {isConflict && <AlertTriangle className="h-3 w-3 ml-1 flex-shrink-0" />}
                          </div>
                        ) : (
                          <div className="h-full flex items-center px-2">
                            <span className="text-xs text-gray-400 italic">Sem datas</span>
                          </div>
                        )}
                      </div>
                      <div className="w-24 flex-shrink-0">
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
          <AlertTriangle className="h-3 w-3 text-red-500" />
          <span className="text-xs text-gray-600">Conflito de agenda</span>
        </div>
      </div>
    </div>
  );
}
