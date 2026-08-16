import { useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { ORBITA_LOGO_URL } from "@/branding";
import { buildVisualGanttReportHtml, type GanttReportRow } from "./gantt-report-utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Link2,
  MoreHorizontal,
  Search,
  SlidersHorizontal,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

const LEFT_WIDTH = 350;
const GROUP_ROW_HEIGHT = 46;
const TASK_ROW_HEIGHT = 50;
const CHECKLIST_ROW_HEIGHT = 36;
const MONTH_COUNT = 3;

type GroupMode = "discipline" | "crs" | "user";
type ZoomLevel = "month" | "week" | "day";

type TaskItem = {
  id: number;
  title: string;
  priority?: string | null;
  status?: string | null;
  phaseName?: string | null;
  phaseColor?: string | null;
  phaseIsTerminal?: boolean;
  assigneeId?: number | null;
  assigneeName?: string | null;
  assigneeAvatar?: string | null;
  projectName?: string | null;
  setor?: string | null;
  dueDate?: Date | string | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  checklistItems?: ChecklistItem[];
  progress?: number | null;
  predecessorId?: number | null;
};

type ChecklistItem = {
  id: number;
  title: string;
  status?: string | null;
  assigneeName?: string | null;
  assigneeAvatar?: string | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
};

type TimelineGroup = {
  key: string;
  label: string;
  subgroups: Array<{ key: string; label: string; tasks: TaskItem[] }>;
};

type TimelineRow =
  | { kind: "group"; key: string; label: string }
  | { kind: "subgroup"; key: string; label: string; parentKey: string }
  | { kind: "task"; key: string; task: TaskItem; index: number }
  | { kind: "checklist"; key: string; item: ChecklistItem; taskId: number };

function asDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? new Date(value) : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function addDays(value: Date, amount: number) {
  const result = new Date(value);
  result.setDate(result.getDate() + amount);
  return result;
}

function addMonths(value: Date, amount: number) {
  const result = new Date(value);
  result.setMonth(result.getMonth() + amount);
  return result;
}

function dayDistance(from: Date, to: Date) {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86400000);
}

function initials(name?: string | null) {
  return name ? name.split(" ").map((part) => part[0]).join("").toUpperCase().slice(0, 2) : "?";
}

function formatMonth(value: Date) {
  return value.toLocaleDateString("pt-BR", { month: "short", year: "numeric" }).replace(" de ", "/");
}

function formatShortDate(value: Date | string | null | undefined) {
  const date = asDate(value);
  return date ? date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "Sem data";
}

function taskRange(task: TaskItem | ChecklistItem) {
  const start = asDate(task.startDate) ?? asDate(" ");
  const end = asDate(task.endDate) ?? start;
  return { start, end };
}

function getBarColor(task: TaskItem | ChecklistItem, today: Date) {
  const maybeTask = task as TaskItem;
  const dueDate = asDate(maybeTask.dueDate);
  if (dueDate && dueDate < today && !maybeTask.phaseIsTerminal && maybeTask.phaseName !== "Concluído") return "#64748b";
  if (task.status === "published" || task.status === "archived" || maybeTask.phaseIsTerminal) return "#35b779";
  return maybeTask.phaseColor || "#2f80ed";
}

function getTaskStatusLabel(task: TaskItem, today: Date) {
  const dueDate = asDate(task.dueDate);
  if (task.phaseIsTerminal || task.status === "published" || task.status === "archived" || task.phaseName === "Concluído") return "Concluída";
  if (dueDate && dueDate < today) return "Atrasada";
  return task.phaseName || "Em andamento";
}

export default function Gantt() {
  const [filterClientId, setFilterClientId] = useState<number | undefined>();
  const [filterCrsId, setFilterCrsId] = useState<number | undefined>();
  const [filterSetor, setFilterSetor] = useState<string | undefined>();
  const [filterUserId, setFilterUserId] = useState<number | undefined>();
  const [groupMode, setGroupMode] = useState<GroupMode>("discipline");
  const [zoom, setZoom] = useState<ZoomLevel>("month");
  const [search, setSearch] = useState("");
  const [timelineStart, setTimelineStart] = useState(() => startOfMonth(new Date()));
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [autoAligned, setAutoAligned] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);

  const clientsQ = trpc.clients.list.useQuery();
  const crsQ = trpc.crs.list.useQuery();
  const usersQ = trpc.users.list.useQuery();
  const ganttInput = useMemo(() => ({
    clientId: filterClientId,
    crsId: filterCrsId,
    setor: filterSetor,
    assigneeId: filterUserId,
  }), [filterClientId, filterCrsId, filterSetor, filterUserId]);
  const ganttQ = trpc.tasks.listForGantt.useQuery(ganttInput);
  const allTasks = useMemo(() => (ganttQ.data ?? []) as TaskItem[], [ganttQ.data]);
  const today = useMemo(() => startOfDay(new Date()), []);

  const filteredTasks = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase();
    if (!normalized) return allTasks;
    return allTasks.filter((task) => [task.title, task.projectName, task.assigneeName, task.setor, task.phaseName]
      .filter(Boolean)
      .some((value) => String(value).toLocaleLowerCase().includes(normalized)));
  }, [allTasks, search]);

  const availableClients = useMemo(() => (clientsQ.data ?? []) as Array<{ id: number; name: string }>, [clientsQ.data]);
  const availableCrs = useMemo(() => {
    const contracts = (crsQ.data ?? []) as Array<{ id: number; name: string; clientId?: number | null }>;
    return filterClientId ? contracts.filter((contract) => contract.clientId === filterClientId) : contracts;
  }, [crsQ.data, filterClientId]);
  const availableSetores = useMemo(() => Array.from(new Set(allTasks.map((task) => task.setor).filter(Boolean))).sort() as string[], [allTasks]);
  const availableUsers = useMemo(() => {
    const map = new Map<number, string>();
    allTasks.forEach((task) => {
      if (task.assigneeId && task.assigneeName) map.set(task.assigneeId, task.assigneeName);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [allTasks]);

  useEffect(() => {
    if (autoAligned || filteredTasks.length === 0) return;
    const dates = filteredTasks.flatMap((task) => [asDate(task.startDate), asDate(task.endDate), asDate(task.dueDate)].filter(Boolean) as Date[]);
    if (dates.length > 0) {
      setTimelineStart(startOfMonth(new Date(Math.min(...dates.map((date) => date.getTime())))));
      setAutoAligned(true);
    }
  }, [autoAligned, filteredTasks]);

  const dayWidth = zoom === "month" ? 14 : zoom === "week" ? 30 : 58;
  const timelineEnd = addMonths(timelineStart, MONTH_COUNT);
  const totalDays = Math.max(1, dayDistance(timelineStart, timelineEnd));
  const days = useMemo(() => Array.from({ length: totalDays }, (_, index) => addDays(timelineStart, index)), [timelineStart, totalDays]);
  const totalTimelineWidth = totalDays * dayWidth;
  const todayColumn = dayDistance(timelineStart, today);

  const monthGroups = useMemo(() => {
    const groups: Array<{ label: string; start: number; count: number }> = [];
    days.forEach((day, index) => {
      const label = formatMonth(day);
      const current = groups[groups.length - 1];
      if (!current || current.label !== label) groups.push({ label, start: index, count: 1 });
      else current.count += 1;
    });
    return groups;
  }, [days]);

  const grouped = useMemo<TimelineGroup[]>(() => {
    const groups = new Map<string, Map<string, TaskItem[]>>();
    filteredTasks.forEach((task) => {
      const groupLabel = groupMode === "discipline" ? (task.setor || "Sem disciplina") : groupMode === "crs" ? (task.projectName || "Sem contrato") : (task.assigneeName || "Sem responsável");
      const subgroupLabel = groupMode === "discipline" ? (task.assigneeName || "Sem responsável") : "";
      if (!groups.has(groupLabel)) groups.set(groupLabel, new Map());
      const subgroupMap = groups.get(groupLabel)!;
      if (!subgroupMap.has(subgroupLabel)) subgroupMap.set(subgroupLabel, []);
      subgroupMap.get(subgroupLabel)!.push(task);
    });
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([groupLabel, subgroupMap]) => ({
      key: groupLabel,
      label: groupLabel,
      subgroups: Array.from(subgroupMap.entries()).map(([subgroupLabel, tasks]) => ({
        key: `${groupLabel}::${subgroupLabel}`,
        label: subgroupLabel,
        tasks: tasks.sort((a, b) => a.title.localeCompare(b.title)),
      })),
    }));
  }, [filteredTasks, groupMode]);

  const rows = useMemo<TimelineRow[]>(() => {
    const result: TimelineRow[] = [];
    let index = 0;
    grouped.forEach((group) => {
      result.push({ kind: "group", key: group.key, label: group.label });
      if (collapsed.has(group.key)) return;
      group.subgroups.forEach((subgroup) => {
        if (subgroup.label) result.push({ kind: "subgroup", key: subgroup.key, label: subgroup.label, parentKey: group.key });
        if (collapsed.has(subgroup.key)) return;
        subgroup.tasks.forEach((task) => {
          result.push({ kind: "task", key: `task-${task.id}`, task, index: ++index });
          const checklistKey = `checklist-${task.id}`;
          if (task.checklistItems?.length && !collapsed.has(checklistKey)) {
            task.checklistItems.forEach((item) => result.push({ kind: "checklist", key: `checklist-${item.id}`, item, taskId: task.id }));
          }
        });
      });
    });
    return result;
  }, [collapsed, grouped]);

  function toggle(key: string) {
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function moveTimeline(months: number) {
    setTimelineStart((current) => addMonths(current, months));
    setAutoAligned(true);
  }

  function resetToday() {
    setTimelineStart(startOfMonth(new Date()));
    setAutoAligned(true);
  }

  function getBar(task: TaskItem | ChecklistItem) {
    const range = taskRange(task);
    if (!range.start) return null;
    const end = range.end ?? range.start;
    const left = dayDistance(timelineStart, range.start) * dayWidth;
    const width = Math.max(dayWidth * 0.9, (dayDistance(range.start, end) + 1) * dayWidth - 5);
    return { left, width, color: getBarColor(task, today), milestone: dayDistance(range.start, end) === 0 };
  }

  function exportTimeline() {
    const popup = window.open("", "_blank");
    if (!popup) return;

    const reportRows: GanttReportRow[] = rows.map((row) => {
      if (row.kind === "group") return { kind: "group", key: row.key, label: row.label };
      if (row.kind === "subgroup") return { kind: "subgroup", key: row.key, label: row.label };
      const source = row.kind === "task" ? row.task : row.item;
      const taskSource = source as TaskItem;
      const bar = getBar(source);
      return {
        kind: "task",
        key: row.key,
        label: source.title,
        index: row.kind === "task" ? row.index : 0,
        task: {
          id: row.kind === "task" ? source.id : source.id,
          title: source.title,
          startDate: source.startDate,
          endDate: source.endDate,
          dueDate: taskSource.dueDate ?? null,
          assigneeName: taskSource.assigneeName ?? null,
          phaseName: taskSource.phaseName ?? null,
          status: source.status,
          color: bar?.color ?? "#94a3b8",
          progress: taskSource.progress ?? 0,
          predecessorId: taskSource.predecessorId ?? null,
          milestone: bar?.milestone ?? false,
        },
      };
    });

    popup.document.write(buildVisualGanttReportHtml({
      title: "Gantt Chart — Linha do tempo de atividades",
      logoUrl: ORBITA_LOGO_URL,
      rows: reportRows,
      rangeStart: timelineStart,
      rangeEnd: timelineEnd,
    }));
    popup.document.close();
    popup.focus();
    setTimeout(() => popup.print(), 500);
  }

  const gridBackground = `repeating-linear-gradient(to right, transparent 0, transparent ${Math.max(dayWidth - 1, 1)}px, rgba(148,163,184,.22) ${Math.max(dayWidth - 1, 1)}px, rgba(148,163,184,.22) ${dayWidth}px)`;

  return (
    <AppLayout title="Linha do tempo" fullHeight>
      <div className="gantt-page h-full min-h-0 bg-background text-foreground p-3 sm:p-4 lg:p-6 flex flex-col gap-3 sm:gap-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500 font-semibold">Planejamento visual</p>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Linha do tempo</h1>
            </div>
            <div className="flex w-full items-center justify-end gap-1.5 sm:w-auto">
              <Button variant="outline" size="sm" className="h-10 gap-1.5 px-3 sm:h-9" onClick={resetToday}><CalendarDays className="w-4 h-4" /><span className="hidden sm:inline">Hoje</span></Button>
              <Button variant="outline" size="sm" onClick={() => moveTimeline(-1)} aria-label="Período anterior"><ChevronLeft className="w-4 h-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => moveTimeline(1)} aria-label="Próximo período"><ChevronRight className="w-4 h-4" /></Button>
              <Button variant="outline" size="sm" className="h-10 gap-1.5 px-3 sm:h-9" onClick={exportTimeline}><Download className="w-4 h-4" /><span className="hidden sm:inline">PDF</span></Button>
              <Button variant="ghost" size="icon" aria-label="Mais opções"><MoreHorizontal className="w-4 h-4" /></Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 w-full flex-1 sm:min-w-[220px] sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar tarefas" className="pl-9 bg-white" />
            </div>
            <Button variant={showFilters ? "default" : "outline"} size="sm" className="gap-1.5" onClick={() => setShowFilters((current) => !current)}><SlidersHorizontal className="w-4 h-4" />Filtros</Button>
            <div className="flex w-full items-center rounded-md border border-slate-200 bg-white p-0.5 sm:w-auto">
              {(["month", "week", "day"] as ZoomLevel[]).map((level) => (
                <button key={level} onClick={() => setZoom(level)} className={`px-2.5 py-1.5 rounded text-xs font-semibold transition-colors ${zoom === level ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-100"}`}>
                  {level === "month" ? "Mês" : level === "week" ? "Semana" : "Dia"}
                </button>
              ))}
            </div>
            <div className="hidden items-center gap-1 ml-auto text-xs text-slate-500 sm:flex"><ZoomOut className="w-3.5 h-3.5" />{dayWidth}px<ZoomIn className="w-3.5 h-3.5" /></div>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex sm:flex-wrap">
              <Filter className="w-4 h-4 text-slate-400" />
              <Select value={filterClientId?.toString() ?? "_all"} onValueChange={(value) => { setFilterClientId(value === "_all" ? undefined : Number(value)); setFilterCrsId(undefined); }}>
                <SelectTrigger className="h-10 w-full text-xs sm:h-8 sm:w-44"><SelectValue placeholder="Todos os clientes" /></SelectTrigger>
                <SelectContent><SelectItem value="_all">Todos os clientes</SelectItem>{availableClients.map((client) => <SelectItem key={client.id} value={String(client.id)}>{client.name}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={filterCrsId?.toString() ?? "_all"} onValueChange={(value) => setFilterCrsId(value === "_all" ? undefined : Number(value))}>
                <SelectTrigger className="h-10 w-full text-xs sm:h-8 sm:w-48"><SelectValue placeholder="Todos os contratos" /></SelectTrigger>
                <SelectContent><SelectItem value="_all">Todos os contratos</SelectItem>{availableCrs.map((contract) => <SelectItem key={contract.id} value={String(contract.id)}>{contract.name}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={filterSetor ?? "_all"} onValueChange={(value) => setFilterSetor(value === "_all" ? undefined : value)}>
                <SelectTrigger className="h-10 w-full text-xs sm:h-8 sm:w-40"><SelectValue placeholder="Todas as disciplinas" /></SelectTrigger>
                <SelectContent><SelectItem value="_all">Todas as disciplinas</SelectItem>{availableSetores.map((setor) => <SelectItem key={setor} value={setor}>{setor}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={filterUserId?.toString() ?? "_all"} onValueChange={(value) => setFilterUserId(value === "_all" ? undefined : Number(value))}>
                <SelectTrigger className="h-10 w-full text-xs sm:h-8 sm:w-40"><SelectValue placeholder="Todos os usuários" /></SelectTrigger>
                <SelectContent><SelectItem value="_all">Todos os usuários</SelectItem>{availableUsers.map((user) => <SelectItem key={user.id} value={String(user.id)}>{user.name}</SelectItem>)}</SelectContent>
              </Select>
              <div className="flex w-full items-center rounded-md border border-slate-200 overflow-hidden sm:ml-auto sm:w-auto">
                {(["discipline", "crs", "user"] as GroupMode[]).map((mode) => <button key={mode} onClick={() => setGroupMode(mode)} className={`flex-1 px-2.5 py-1.5 text-xs font-medium ${groupMode === mode ? "bg-slate-900 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}><span className="flex-1 text-center">{mode === "discipline" ? "Disciplina" : mode === "crs" ? "Contrato" : "Usuário"}</span></button>)}
              </div>
            </div>
          )}
        </div>

        {!ganttQ.isLoading && filteredTasks.length > 0 && (
          <section className="space-y-3 md:hidden" aria-label="Resumo mobile do Gantt">
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Período visível</p>
                <p className="mt-1 truncate text-sm font-bold text-slate-800">{formatMonth(timelineStart)} — {formatMonth(addMonths(timelineStart, 2))}</p>
                <p className="mt-0.5 text-xs text-slate-500">{filteredTasks.length} tarefa{filteredTasks.length === 1 ? "" : "s"} no escopo atual</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => moveTimeline(-1)} aria-label="Período anterior"><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => moveTimeline(1)} aria-label="Próximo período"><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-900" role="status" aria-live="polite">
              <span className="font-semibold">Resumo de execução</span>
              <span>{filteredTasks.filter((task) => getTaskStatusLabel(task, today) === "Concluída").length} concluída{filteredTasks.filter((task) => getTaskStatusLabel(task, today) === "Concluída").length === 1 ? "" : "s"}</span>
            </div>

            <div className="space-y-2.5">
              {filteredTasks.map((task, index) => {
                const statusLabel = getTaskStatusLabel(task, today);
                const progress = Math.min(100, Math.max(0, Number(task.progress ?? 0)));
                const groupLabel = groupMode === "discipline" ? task.setor || "Sem disciplina" : groupMode === "crs" ? task.projectName || "Sem contrato" : task.assigneeName || "Sem responsável";
                const isCompleted = statusLabel === "Concluída";
                const isLate = statusLabel === "Atrasada";
                return (
                  <article key={`mobile-task-${task.id}`} className="rounded-2xl border border-slate-200 border-l-4 bg-white p-3 shadow-sm" style={{ borderLeftColor: getBarColor(task, today) }}>
                    <div className="flex items-start gap-2.5">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-500">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-800">{task.title}</p>
                            <p className="mt-0.5 truncate text-[11px] text-slate-500">{groupLabel}</p>
                          </div>
                          <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${isCompleted ? "bg-emerald-100 text-emerald-700" : isLate ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>{statusLabel}</span>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                          <div className="min-w-0"><span className="block text-[9px] font-bold uppercase tracking-wide text-slate-400">Período</span><span className="block truncate">{formatShortDate(task.startDate)} → {formatShortDate(task.endDate)}</span></div>
                          <div className="min-w-0"><span className="block text-[9px] font-bold uppercase tracking-wide text-slate-400">Responsável</span><span className="block truncate">{task.assigneeName || "Não atribuído"}</span></div>
                        </div>

                        <div className="mt-3">
                          <div className="mb-1 flex items-center justify-between text-[10px] font-semibold text-slate-500"><span>Progresso</span><span>{progress}%</span></div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={`Progresso de ${task.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><div className="h-full rounded-full transition-[width] duration-200" style={{ width: `${progress}%`, backgroundColor: getBarColor(task, today) }} /></div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                          {task.dueDate && <span className={isLate ? "font-bold text-red-600" : ""}>Vence {formatShortDate(task.dueDate)}</span>}
                          {task.priority && <span className="rounded-full bg-slate-100 px-2 py-1 capitalize">Prioridade {task.priority}</span>}
                          {task.predecessorId && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-amber-700"><Link2 className="h-3 w-3" /> Dependência</span>}
                          {task.checklistItems?.length ? <span className="rounded-full bg-slate-100 px-2 py-1">Checklist {task.checklistItems.length}</span> : null}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {ganttQ.isLoading && <div className="space-y-2"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>}
        {!ganttQ.isLoading && filteredTasks.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">Nenhuma tarefa encontrada para os filtros atuais.</div>}

        {!ganttQ.isLoading && filteredTasks.length > 0 && (
          <div className="hidden flex-1 min-h-0 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden md:block">
            <div ref={timelineRef} className="h-full overflow-auto">
              <div style={{ width: LEFT_WIDTH + totalTimelineWidth, minWidth: "100%" }}>
                <div className="grid border-b border-slate-200" style={{ gridTemplateColumns: `${LEFT_WIDTH}px ${totalTimelineWidth}px` }}>
                  <div className="sticky left-0 z-30 flex items-center gap-2 border-r border-slate-200 bg-[#f8fafc] px-4 text-xs font-bold uppercase tracking-wide text-slate-500">Tarefa <span className="font-normal normal-case text-slate-400">({filteredTasks.length})</span></div>
                  <div className="relative overflow-hidden">
                    <div className="flex h-12 bg-[#f8fafc]">
                      {monthGroups.map((month) => <div key={month.label} className="flex items-center justify-center border-r border-slate-200 text-xs font-bold uppercase text-slate-500" style={{ width: month.count * dayWidth }}>{month.label}</div>)}
                    </div>
                    <div className="absolute inset-x-0 bottom-0 flex h-6 border-t border-slate-200" style={{ backgroundImage: gridBackground }}>
                      {days.map((day, index) => <div key={index} className={`shrink-0 flex items-center justify-center text-[9px] ${day.getDay() === 0 || day.getDay() === 6 ? "text-slate-300" : "text-slate-500"}`} style={{ width: dayWidth }}>{zoom === "month" ? (day.getDate() === 1 || day.getDay() === 1 ? day.getDate() : "") : day.getDate()}</div>)}
                    </div>
                  </div>
                </div>

                {rows.map((row) => {
                  const isGroup = row.kind === "group";
                  const isSubgroup = row.kind === "subgroup";
                  const rowHeight = isGroup ? GROUP_ROW_HEIGHT : row.kind === "checklist" ? CHECKLIST_ROW_HEIGHT : TASK_ROW_HEIGHT;
                  const task = row.kind === "task" ? row.task : row.kind === "checklist" ? row.item : null;
                  const bar = task ? getBar(task) : null;
                  const isCollapsed = collapsed.has(row.key);
                  return (
                    <div key={row.key} className="grid border-b border-slate-100" style={{ gridTemplateColumns: `${LEFT_WIDTH}px ${totalTimelineWidth}px`, height: rowHeight }}>
                      <div className={`sticky left-0 z-20 flex items-center gap-2 border-r border-slate-200 px-3 ${isGroup ? "bg-[#eef5ff]" : isSubgroup ? "bg-[#f8fafc]" : row.kind === "checklist" ? "bg-white pl-14" : "bg-white pl-5"}`}>
                        {isGroup && <button className="rounded p-1 hover:bg-blue-100" onClick={() => toggle(row.key)} aria-label={isCollapsed ? "Expandir grupo" : "Recolher grupo"}>{isCollapsed ? <ChevronRight className="w-4 h-4 text-blue-600" /> : <ChevronDown className="w-4 h-4 text-blue-600" />}</button>}
                        {isSubgroup && <button className="rounded p-1 hover:bg-slate-200" onClick={() => toggle(row.key)} aria-label={isCollapsed ? "Expandir responsável" : "Recolher responsável"}>{isCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}</button>}
                        {isGroup && <span className="w-2 h-2 rounded-full bg-blue-500" />}
                        {isSubgroup && <Avatar className="w-6 h-6"><AvatarFallback className="text-[9px] bg-slate-200 text-slate-700">{initials(row.label)}</AvatarFallback></Avatar>}
                        {row.kind === "task" && <button className="rounded p-1 hover:bg-slate-100" onClick={() => row.task.checklistItems?.length && toggle(`checklist-${row.task.id}`)} aria-label={row.task.checklistItems?.length ? "Expandir checklist" : "Sem checklist"}>{row.task.checklistItems?.length ? (isCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />) : <span className="w-3.5" />}</button>}
                        {row.kind === "task" && <span className="flex h-4 w-4 items-center justify-center rounded border border-slate-300 text-[9px] text-slate-500">{row.index}</span>}
                        {row.kind === "checklist" && <span className={`h-3 w-3 rounded-sm border ${row.item.status === "published" || row.item.status === "archived" ? "border-green-500 bg-green-500" : "border-slate-300 bg-white"}`} />}
                        <Tooltip><TooltipTrigger asChild><span className={`${isGroup ? "text-sm font-bold text-slate-800" : isSubgroup ? "text-xs font-semibold text-slate-700" : row.kind === "checklist" ? "text-[11px] text-slate-500" : "text-xs text-slate-700"} truncate`}>{row.kind === "task" ? row.task.title : row.kind === "checklist" ? row.item.title : row.label}</span></TooltipTrigger><TooltipContent side="right">{row.kind === "task" ? <><p className="font-semibold">{row.task.title}</p><p className="text-xs text-muted-foreground">{row.task.projectName || "Sem contrato"}</p></> : <p>{row.kind === "checklist" ? row.item.title : row.label}</p>}</TooltipContent></Tooltip>
                        {row.kind === "task" && <span className="ml-auto hidden shrink-0 text-[10px] text-slate-400 xl:inline">TBT-{row.task.id}</span>}
                      </div>
                      <div className={`relative overflow-hidden ${isGroup ? "bg-[#eef5ff]" : isSubgroup ? "bg-[#f8fafc]" : "bg-white"}`} style={{ backgroundImage: gridBackground }}>
                        {todayColumn >= 0 && todayColumn < totalDays && <div className="absolute inset-y-0 z-10 w-px bg-blue-500/60" style={{ left: todayColumn * dayWidth + dayWidth / 2 }} />}
                        {task && bar && <Tooltip><TooltipTrigger asChild><div className={`absolute z-20 flex items-center gap-1 overflow-hidden rounded-md px-2 shadow-sm transition-all hover:brightness-105 ${bar.milestone ? "rounded-full" : ""}`} style={{ left: bar.left, width: bar.milestone ? Math.max(18, dayWidth) : bar.width, height: row.kind === "checklist" ? 18 : 28, top: row.kind === "checklist" ? 9 : 11, backgroundColor: bar.color }}>
                          {row.kind === "task" && bar.width > 54 && <Avatar className="h-5 w-5 shrink-0 border border-white/70"><AvatarImage src={row.task.assigneeAvatar ?? undefined} /><AvatarFallback className="bg-white/30 text-[8px] text-white">{initials(row.task.assigneeName)}</AvatarFallback></Avatar>}
                          <span className="truncate text-[10px] font-semibold text-white">{row.kind === "task" ? row.task.phaseName || "Atividade" : row.kind === "checklist" ? row.item.title : ""}</span>
                          {row.kind === "task" && row.task.predecessorId && <Link2 className="ml-auto h-3 w-3 shrink-0 text-white/80" />}
                        </div></TooltipTrigger><TooltipContent><p className="font-semibold">{task.title}</p><p className="text-xs">{formatShortDate(task.startDate)} → {formatShortDate(task.endDate)}</p>{row.kind === "task" && row.task.assigneeName && <p className="text-xs text-muted-foreground">{row.task.assigneeName}</p>}</TooltipContent></Tooltip>}
                      </div>
                    </div>
                  );
                })}
                <div className="sticky left-0 flex h-10 items-center gap-2 border-t border-slate-100 bg-white px-4 text-xs font-semibold text-slate-500"><span className="text-lg leading-none">+</span> Adicionar tarefa</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
