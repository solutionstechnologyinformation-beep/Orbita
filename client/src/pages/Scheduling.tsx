import AppLayout from "@/components/AppLayout";
import { SplitLayout, SplitPanelHeader, SplitPanelContent } from "@/components/SplitLayout";
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar, User, AlertTriangle, LayoutGrid, Rows, Package } from "lucide-react";
import { useGlobalPeriod, dateRangeOverlapsGlobalPeriod } from "@/contexts/GlobalPeriodContext";

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

const WEEKDAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

type ViewMode = "calendar" | "swimlane";

export default function Scheduling() {
  const { range: globalPeriodRange } = useGlobalPeriod();
  const todayRef = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [filterClientId, setFilterClientId] = useState<number | undefined>(undefined);
  const [projectId, setProjectId] = useState<number | undefined>(undefined);
  const [viewDate, setViewDate] = useState(() => new Date());
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // Clients for cascade filter
  const clientsQ = trpc.clients.list.useQuery();
  const allClients = (clientsQ.data ?? []) as any[];

  // All contracts (filtered by client if selected)
  const projectsQ = trpc.crs.list.useQuery();
  const allProjects = (projectsQ.data ?? []) as any[];
  const filteredProjects = filterClientId
    ? allProjects.filter((p: any) => p.clientId === filterClientId)
    : allProjects;

  // Tasks via listForGantt (supports clientId + crsId filters)
  const schedulingQ = trpc.tasks.listForGantt.useQuery({
    clientId: filterClientId,
    crsId: projectId,
  });
  const allTasks = (schedulingQ.data ?? []) as any[];
  const tasks = useMemo(() => allTasks.filter((task: any) => dateRangeOverlapsGlobalPeriod(task.startDate ?? task.dueDate, task.endDate ?? task.dueDate, globalPeriodRange)), [allTasks, globalPeriodRange]);

  // ── Calendar mode helpers ──────────────────────────────────────────────────
  const { calendarDays, year, month } = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const days: { date: Date; isCurrentMonth: boolean }[] = [];
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({ date: new Date(year, month - 1, daysInPrevMonth - i), isCurrentMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ date: new Date(year, month, d), isCurrentMonth: true });
    }
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      days.push({ date: new Date(year, month + 1, d), isCurrentMonth: false });
    }
    return { calendarDays: days, year, month };
  }, [viewDate]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, typeof tasks>();
    tasks.forEach((t: any) => {
      const addToDate = (d: Date) => {
        const key = d.toDateString();
        if (!map.has(key)) map.set(key, []);
        if (!map.get(key)!.find((x: any) => x.id === t.id)) map.get(key)!.push(t);
      };
      if (t.startDate && t.endDate) {
        const start = new Date(t.startDate);
        const end = new Date(t.endDate);
        const cur = new Date(start);
        while (cur <= end) { addToDate(new Date(cur)); cur.setDate(cur.getDate() + 1); }
      } else if (t.dueDate) {
        addToDate(new Date(t.dueDate));
      } else if (t.startDate) {
        addToDate(new Date(t.startDate));
      }
    });
    return map;
  }, [tasks]);

  // ── Swimlane mode helpers ──────────────────────────────────────────────────
  const weekStart = useMemo(() => {
    const d = new Date(todayRef);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff + weekOffset * 7);
    return d;
  }, [weekOffset, todayRef]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const assignees = useMemo(() => {
    const map = new Map<number | null, { name: string | null; tasks: typeof tasks }>();
    tasks.forEach((t: any) => {
      const key = t.assigneeId ?? null;
      if (!map.has(key)) map.set(key, { name: t.assigneeName ?? "Sem responsável", tasks: [] });
      map.get(key)!.tasks.push(t);
    });
    return Array.from(map.entries()).map(([id, v]) => ({ id, ...v }));
  }, [tasks]);

  // ── Weekly summary: tasks per user within the current week ─────────────────
  const weekSummary = useMemo(() => {
    const weekEnd = new Date(weekDays[6]);
    weekEnd.setHours(23, 59, 59, 999);
    const wStart = new Date(weekDays[0]);
    wStart.setHours(0, 0, 0, 0);

    const map = new Map<number | null, { name: string; items: typeof tasks }>();
    tasks.forEach((t: any) => {
      const start = t.startDate ? new Date(t.startDate) : null;
      const end = t.endDate ? new Date(t.endDate) : t.dueDate ? new Date(t.dueDate) : null;
      if (!start && !end) return;
      const inWeek = (start && start <= weekEnd && (!end || end >= wStart)) ||
                     (end && end >= wStart && end <= weekEnd);
      if (!inWeek) return;
      const key = t.assigneeId ?? null;
      if (!map.has(key)) map.set(key, { name: t.assigneeName ?? "Sem responsável", items: [] });
      map.get(key)!.items.push(t);
    });
    return Array.from(map.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  }, [tasks, weekDays]);

  function getTasksForDayAndAssignee(date: Date, assigneeId: number | null) {
    return tasks.filter((t: any) => {
      if ((t.assigneeId ?? null) !== assigneeId) return false;
      const start = t.startDate ? new Date(t.startDate) : null;
      const end = t.endDate ? new Date(t.endDate) : t.dueDate ? new Date(t.dueDate) : null;
      if (!start && !end) return false;
      const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date); dayEnd.setHours(23, 59, 59, 999);
      if (start && end) return start <= dayEnd && end >= dayStart;
      if (end) return end >= dayStart && end <= dayEnd;
      return false;
    });
  }

  const overdueTasks = tasks.filter((t: any) => {
    const end = t.endDate ? new Date(t.endDate) : t.dueDate ? new Date(t.dueDate) : null;
    return end && end < todayRef && t.status !== "published" && t.status !== "archived";
  });

  const selectedDayTasks = selectedDay ? (tasksByDate.get(selectedDay.toDateString()) ?? []) : [];

  return (
    <AppLayout title="Programação" fullHeight>
      <SplitLayout
        leftWidth="240px"
        left={
          <>
            <SplitPanelHeader title="Filtros" subtitle="Programação" />
            <SplitPanelContent>
              <div className="space-y-3">
                <div className="space-y-2">
            {/* Client filter */}
            <Select
              value={filterClientId?.toString() ?? "all"}
              onValueChange={v => { setFilterClientId(v === "all" ? undefined : Number(v)); setProjectId(undefined); }}
            >
              <SelectTrigger className="w-44 h-9 text-sm">
                <SelectValue placeholder="Todos os clientes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os clientes</SelectItem>
                {allClients.map((c: any) => (
                  <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Contract filter (cascaded from client) */}
            <Select
              value={projectId?.toString() ?? "all"}
              onValueChange={v => setProjectId(v === "all" ? undefined : Number(v))}
            >
              <SelectTrigger className="w-52 h-9 text-sm">
                <SelectValue placeholder="Todos os contratos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os contratos</SelectItem>
                {filteredProjects.map((p: any) => (
                  <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
                </div>
                <div className="flex items-center border rounded-md overflow-hidden">
                  <Button variant={viewMode === "calendar" ? "default" : "ghost"} size="sm" className="h-8 rounded-none gap-1 text-xs flex-1" onClick={() => setViewMode("calendar")}>
                    <LayoutGrid className="h-3 w-3" /> Calendário
                  </Button>
                  <Button variant={viewMode === "swimlane" ? "default" : "ghost"} size="sm" className="h-8 rounded-none gap-1 text-xs flex-1" onClick={() => setViewMode("swimlane")}>
                    <Rows className="h-3 w-3" /> Swimlane
                  </Button>
                </div>
              </div>
            </SplitPanelContent>
          </>
        }
        right={
          <SplitPanelContent noPadding>
            <div className="p-4 space-y-4 overflow-y-auto h-full">

        {/* Overdue alert */}
        {overdueTasks.length > 0 && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-red-500" />
            <div>
              <strong>{overdueTasks.length} tarefa(s) em atraso:</strong>{" "}
              {overdueTasks.slice(0, 3).map((t: any) => t.title).join(", ")}
              {overdueTasks.length > 3 && ` e mais ${overdueTasks.length - 3}...`}
            </div>
          </div>
        )}

        {/* ── CALENDAR VIEW ─────────────────────────────────────────────────── */}
        {viewMode === "calendar" && (
          <>
            {/* Month navigation */}
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => { setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1)); setSelectedDay(null); }}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-lg font-semibold text-gray-800 min-w-[180px] text-center">
                {MONTHS[month]} {year}
              </h2>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => { setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1)); setSelectedDay(null); }}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-8 ml-1" onClick={() => { setViewDate(new Date()); setSelectedDay(null); }}>
                Hoje
              </Button>
            </div>

            <div className="flex gap-5 items-start">
              {/* Calendar grid */}
              <div className="flex-1 min-w-0">
                <Card className="overflow-hidden">
                  <CardContent className="p-0">
                    {/* Weekday headers */}
                    <div className="grid grid-cols-7 bg-gray-50 border-b">
                      {WEEKDAYS_SHORT.map(d => (
                        <div key={d} className="py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          {d}
                        </div>
                      ))}
                    </div>
                    {/* Days */}
                    <div className="grid grid-cols-7">
                      {calendarDays.map(({ date, isCurrentMonth }, idx) => {
                        const key = date.toDateString();
                        const dayTasks = tasksByDate.get(key) ?? [];
                        const isToday = date.toDateString() === todayRef.toDateString();
                        const isSelected = selectedDay?.toDateString() === key;
                        const hasOverdue = dayTasks.some((t: any) => {
                          const end = t.endDate ? new Date(t.endDate) : t.dueDate ? new Date(t.dueDate) : null;
                          return end && end < todayRef && t.status !== "published" && t.status !== "archived";
                        });

                        return (
                          <div
                            key={idx}
                            className={`
                              border-b border-r cursor-pointer transition-colors min-h-[90px] p-1.5
                              ${!isCurrentMonth ? "bg-gray-50/60 text-gray-400" : "bg-white hover:bg-indigo-50/30"}
                              ${isToday ? "bg-indigo-50/50" : ""}
                              ${isSelected ? "ring-2 ring-inset ring-indigo-400" : ""}
                            `}
                            onClick={() => setSelectedDay(isSelected ? null : date)}
                          >
                            <div className={`
                              text-sm font-medium mb-1 w-7 h-7 flex items-center justify-center rounded-full
                              ${isToday ? "bg-indigo-600 text-white" : isCurrentMonth ? "text-gray-800" : "text-gray-400"}
                            `}>
                              {date.getDate()}
                            </div>
                            <div className="space-y-0.5">
                              {dayTasks.slice(0, 3).map((t: any, i: number) => {
                                const isOverdue = (() => {
                                  const end = t.endDate ? new Date(t.endDate) : t.dueDate ? new Date(t.dueDate) : null;
                                  return end && end < todayRef && t.status !== "published" && t.status !== "archived";
                                })();
                                return (
                                  <div
                                    key={i}
                                    className="text-xs px-1.5 py-0.5 rounded text-white truncate"
                                    style={{ backgroundColor: isOverdue ? "#ef4444" : STATUS_COLORS[t.status] ?? "#6366f1" }}
                                    title={t.title}
                                  >
                                    {t.title}
                                  </div>
                                );
                              })}
                              {dayTasks.length > 3 && (
                                <div className="text-xs text-gray-400 pl-1">+{dayTasks.length - 3} mais</div>
                              )}
                              {hasOverdue && dayTasks.length === 0 && (
                                <div className="w-2 h-2 rounded-full bg-red-400 mx-auto" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
              {/* Side panel */}
              <div className="w-64 flex-shrink-0 space-y-3">
                {selectedDay ? (
                  <Card>
                    <CardHeader className="pb-2 pt-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-indigo-500" />
                        {selectedDay.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 pb-3">
                      {selectedDayTasks.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-3">Nenhuma tarefa neste dia.</p>
                      ) : (
                        selectedDayTasks.map((t: any, i: number) => (
                          <div key={i} className="p-2.5 rounded-lg border text-sm">
                            <div className="font-medium text-gray-800 flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_COLORS[t.status] ?? "#6366f1" }} />
                              <span className="truncate">{t.title}</span>
                            </div>
                            <div className="flex items-center gap-1 mt-1">
                              <User className="h-3 w-3 text-gray-400" />
                              <span className="text-xs text-gray-500 truncate">{t.assigneeName ?? "Sem responsável"}</span>
                            </div>
                            {t.projectName && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <Package className="h-3 w-3 text-gray-400" />
                                <span className="text-xs text-gray-400 truncate">{t.projectName}</span>
                              </div>
                            )}
                            <Badge variant="outline" className="text-xs mt-1" style={{ borderColor: STATUS_COLORS[t.status], color: STATUS_COLORS[t.status] }}>
                              {STATUS_LABELS[t.status] ?? t.status}
                            </Badge>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="py-6 text-center text-gray-400">
                      <Calendar className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Clique em um dia para ver detalhes</p>
                    </CardContent>
                  </Card>
                )}
                {/* Legend */}
                <Card>
                  <CardHeader className="pb-1 pt-3">
                    <CardTitle className="text-xs text-gray-500 uppercase tracking-wide">Legenda</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1.5 pb-3">
                    {Object.entries(STATUS_LABELS).map(([key, label]) => (
                      <div key={key} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: STATUS_COLORS[key] }} />
                        <span className="text-xs text-gray-600">{label}</span>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 pt-1 border-t mt-1">
                      <div className="w-3 h-3 rounded-sm bg-red-500 flex-shrink-0" />
                      <span className="text-xs text-gray-600">Atrasado</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}

        {/* ── SWIMLANE VIEW ─────────────────────────────────────────────────── */}
        {viewMode === "swimlane" && (
          <>
            {/* Week navigation */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setWeekOffset(w => w - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)}>Hoje</Button>
                <Button variant="outline" size="sm" onClick={() => setWeekOffset(w => w + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm font-medium text-gray-700">
                {weekDays[0].toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} –{" "}
                {weekDays[6].toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
              </p>
            </div>

            {/* Swimlane grid */}
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
                  <table className="w-full text-sm" style={{ minWidth: 700 }}>
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left p-3 w-44 font-medium text-gray-600">
                          <div className="flex items-center gap-1"><User className="h-3 w-3" /> Responsável</div>
                        </th>
                        {weekDays.map(d => {
                          const isToday = d.toDateString() === todayRef.toDateString();
                          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                          return (
                            <th key={d.toISOString()} className={`text-center p-2 font-medium text-xs ${isToday ? "bg-indigo-50 text-indigo-700" : isWeekend ? "text-gray-400 bg-gray-50/80" : "text-gray-600"}`}>
                              <div>{WEEKDAYS_SHORT[d.getDay()]}</div>
                              <div className={`text-base font-bold ${isToday ? "text-indigo-700" : ""}`}>{d.getDate()}</div>
                              <div className="text-xs font-normal text-gray-400">{d.toLocaleDateString("pt-BR", { month: "short" })}</div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {assignees.map(assignee => (
                        <tr key={assignee.id ?? "none"} className="border-b hover:bg-gray-50/50">
                          <td className="p-3 font-medium text-gray-700 align-top">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                {(assignee.name ?? "?").charAt(0).toUpperCase()}
                              </div>
                              <span className="text-sm truncate max-w-[100px]">{assignee.name ?? "Sem responsável"}</span>
                            </div>
                          </td>
                          {weekDays.map(d => {
                            const dayTasks = getTasksForDayAndAssignee(d, assignee.id);
                            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                            return (
                              <td key={d.toISOString()} className={`p-1 align-top ${isWeekend ? "bg-gray-50/60" : ""}`} style={{ minWidth: 90, minHeight: 60 }}>
                                <div className="space-y-0.5">
                                  {dayTasks.map((t: any) => {
                                    const isOverdue = (() => {
                                      const end = t.endDate ? new Date(t.endDate) : t.dueDate ? new Date(t.dueDate) : null;
                                      return end && end < todayRef && t.status !== "published" && t.status !== "archived";
                                    })();
                                    return (
                                      <div
                                        key={t.id}
                                        className="text-xs px-1.5 py-0.5 rounded text-white truncate"
                                        style={{ backgroundColor: isOverdue ? "#ef4444" : STATUS_COLORS[t.status] ?? "#6366f1" }}
                                        title={`${t.title} (${STATUS_LABELS[t.status] ?? t.status})${isOverdue ? " — ATRASADO" : ""}`}
                                      >
                                        {t.title}
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

            {/* ── Weekly summary per user ──────────────────────────────────── */}
            {weekSummary.length > 0 && (
              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <User className="h-4 w-4 text-indigo-500" />
                  Entregas da Semana por Responsável
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {weekSummary.map(user => {
                    const overdue = user.items.filter((t: any) => {
                      const end = t.endDate ? new Date(t.endDate) : t.dueDate ? new Date(t.dueDate) : null;
                      return end && end < todayRef && t.status !== "published" && t.status !== "archived";
                    });
                    return (
                      <Card key={user.id ?? "none"} className="border">
                        <CardHeader className="pb-2 pt-3">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                              {(user.name ?? "?").charAt(0).toUpperCase()}
                            </div>
                            <span className="truncate">{user.name ?? "Sem responsável"}</span>
                            <Badge variant="outline" className="ml-auto text-xs">{user.items.length} item(s)</Badge>
                            {overdue.length > 0 && (
                              <Badge className="text-xs bg-red-100 text-red-700 border-red-200">{overdue.length} atrasado(s)</Badge>
                            )}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pb-3 space-y-1.5">
                          {user.items.map((t: any, i: number) => {
                            const end = t.endDate ? new Date(t.endDate) : t.dueDate ? new Date(t.dueDate) : null;
                            const isOverdue = end && end < todayRef && t.status !== "published" && t.status !== "archived";
                            return (
                              <div key={i} className={`flex items-start gap-2 p-2 rounded-md text-sm ${isOverdue ? "bg-red-50 border border-red-100" : "bg-gray-50"}`}>
                                <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: isOverdue ? "#ef4444" : STATUS_COLORS[t.status] ?? "#6366f1" }} />
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-gray-800 truncate">{t.title}</p>
                                  {t.projectName && (
                                    <p className="text-xs text-gray-400 truncate flex items-center gap-1">
                                      <Package className="h-2.5 w-2.5" /> {t.projectName}
                                    </p>
                                  )}
                                  {end && (
                                    <p className={`text-xs mt-0.5 ${isOverdue ? "text-red-600 font-medium" : "text-gray-400"}`}>
                                      {isOverdue ? "⚠ Venceu em " : "Até "}
                                      {end.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                                    </p>
                                  )}
                                </div>
                                <Badge variant="outline" className="text-xs flex-shrink-0" style={{ borderColor: STATUS_COLORS[t.status], color: STATUS_COLORS[t.status] }}>
                                  {STATUS_LABELS[t.status] ?? t.status}
                                </Badge>
                              </div>
                            );
                          })}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
            </div>
          </SplitPanelContent>
        }
      />
    </AppLayout>
  );
}
