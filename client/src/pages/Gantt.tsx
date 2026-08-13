import { useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
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
    const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;", "'": "&#39;" }[character] ?? character));
    const rowsHtml = rows.map((row) => {
      if (row.kind === "group") return `<tr class="group"><td colspan="5">${escapeHtml(row.label)}</td></tr>`;
      if (row.kind === "subgroup") return `<tr class="subgroup"><td colspan="5">↳ ${escapeHtml(row.label)}</td></tr>`;
      const task = row.kind === "task" ? row.task : row.item;
      const range = getBar(task);
      const dueDate = asDate((task as TaskItem).dueDate);
      const isTerminal = Boolean((task as TaskItem).phaseIsTerminal) || task.status === "published" || task.status === "archived";
      const alert = !range ? "Sem datas" : dueDate && dueDate < today && !isTerminal ? "Atrasada" : isTerminal ? "Concluída" : "—";
      const status = (task as TaskItem).phaseName ?? (isTerminal ? "Concluído" : "Em andamento");
      const responsible = (task as TaskItem).assigneeName ?? "Sem responsável";
      return `<tr><td>${row.kind === "task" ? row.index + ". " : "↳ "}${escapeHtml(task.title)}</td><td>${range ? `${formatShortDate(task.startDate)} → ${formatShortDate(task.endDate)}` : "Sem datas"}</td><td>${escapeHtml(responsible)}</td><td>${escapeHtml(status)}</td><td class="${alert === "Atrasada" ? "alert" : ""}">${alert}</td></tr>`;
    }).join("");
    popup.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Timeline — Orbita</title><style>body{font-family:Arial,sans-serif;color:#172033;padding:24px}h1{color:#0f172a}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border-bottom:1px solid #e5e7eb;padding:8px;text-align:left}th{background:#f1f5f9;font-size:11px;text-transform:uppercase;color:#475569}.group{background:#eaf2ff;font-weight:700}.subgroup{background:#f8fafc;font-weight:600}.alert{color:#b91c1c;font-weight:700}</style></head><body><h1>Timeline de atividades — Orbita</h1><p>Gerado em ${new Date().toLocaleString("pt-BR")}</p><table><thead><tr><th>Tarefa</th><th>Período</th><th>Responsável</th><th>Status</th><th>Alerta</th></tr></thead><tbody>${rowsHtml}</tbody></table></body></html>`);
    popup.document.close();
    popup.focus();
    setTimeout(() => popup.print(), 500);
  }

  const gridBackground = `repeating-linear-gradient(to right, transparent 0, transparent ${Math.max(dayWidth - 1, 1)}px, rgba(148,163,184,.22) ${Math.max(dayWidth - 1, 1)}px, rgba(148,163,184,.22) ${dayWidth}px)`;

  return (
    <AppLayout title="Linha do tempo" fullHeight>
      <div className="h-full min-h-0 bg-[#f6f8fb] p-4 lg:p-6 flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500 font-semibold">Planejamento visual</p>
              <h1 className="text-2xl font-bold text-slate-900">Linha do tempo</h1>
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={resetToday}><CalendarDays className="w-4 h-4" />Hoje</Button>
              <Button variant="outline" size="sm" onClick={() => moveTimeline(-1)} aria-label="Período anterior"><ChevronLeft className="w-4 h-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => moveTimeline(1)} aria-label="Próximo período"><ChevronRight className="w-4 h-4" /></Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={exportTimeline}><Download className="w-4 h-4" />PDF</Button>
              <Button variant="ghost" size="icon" aria-label="Mais opções"><MoreHorizontal className="w-4 h-4" /></Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar tarefas" className="pl-9 bg-white" />
            </div>
            <Button variant={showFilters ? "default" : "outline"} size="sm" className="gap-1.5" onClick={() => setShowFilters((current) => !current)}><SlidersHorizontal className="w-4 h-4" />Filtros</Button>
            <div className="flex items-center rounded-md border border-slate-200 bg-white p-0.5">
              {(["month", "week", "day"] as ZoomLevel[]).map((level) => (
                <button key={level} onClick={() => setZoom(level)} className={`px-2.5 py-1.5 rounded text-xs font-semibold transition-colors ${zoom === level ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-100"}`}>
                  {level === "month" ? "Mês" : level === "week" ? "Semana" : "Dia"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 ml-auto text-xs text-slate-500"><ZoomOut className="w-3.5 h-3.5" />{dayWidth}px<ZoomIn className="w-3.5 h-3.5" /></div>
          </div>

          {showFilters && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <Filter className="w-4 h-4 text-slate-400" />
              <Select value={filterClientId?.toString() ?? "_all"} onValueChange={(value) => { setFilterClientId(value === "_all" ? undefined : Number(value)); setFilterCrsId(undefined); }}>
                <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Todos os clientes" /></SelectTrigger>
                <SelectContent><SelectItem value="_all">Todos os clientes</SelectItem>{availableClients.map((client) => <SelectItem key={client.id} value={String(client.id)}>{client.name}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={filterCrsId?.toString() ?? "_all"} onValueChange={(value) => setFilterCrsId(value === "_all" ? undefined : Number(value))}>
                <SelectTrigger className="w-48 h-8 text-xs"><SelectValue placeholder="Todos os contratos" /></SelectTrigger>
                <SelectContent><SelectItem value="_all">Todos os contratos</SelectItem>{availableCrs.map((contract) => <SelectItem key={contract.id} value={String(contract.id)}>{contract.name}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={filterSetor ?? "_all"} onValueChange={(value) => setFilterSetor(value === "_all" ? undefined : value)}>
                <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Todas as disciplinas" /></SelectTrigger>
                <SelectContent><SelectItem value="_all">Todas as disciplinas</SelectItem>{availableSetores.map((setor) => <SelectItem key={setor} value={setor}>{setor}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={filterUserId?.toString() ?? "_all"} onValueChange={(value) => setFilterUserId(value === "_all" ? undefined : Number(value))}>
                <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Todos os usuários" /></SelectTrigger>
                <SelectContent><SelectItem value="_all">Todos os usuários</SelectItem>{availableUsers.map((user) => <SelectItem key={user.id} value={String(user.id)}>{user.name}</SelectItem>)}</SelectContent>
              </Select>
              <div className="flex items-center rounded-md border border-slate-200 overflow-hidden ml-auto">
                {(["discipline", "crs", "user"] as GroupMode[]).map((mode) => <button key={mode} onClick={() => setGroupMode(mode)} className={`px-2.5 py-1.5 text-xs font-medium ${groupMode === mode ? "bg-slate-900 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>{mode === "discipline" ? "Disciplina" : mode === "crs" ? "Contrato" : "Usuário"}</button>)}
              </div>
            </div>
          )}
        </div>

        {ganttQ.isLoading && <div className="space-y-2"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>}
        {!ganttQ.isLoading && filteredTasks.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">Nenhuma tarefa encontrada para os filtros atuais.</div>}

        {!ganttQ.isLoading && filteredTasks.length > 0 && (
          <div className="flex-1 min-h-0 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
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
