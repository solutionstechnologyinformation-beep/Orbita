import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import { ORBITA_LOGO_URL } from "@/branding";
import {
  addGanttDays as addDays,
  asGanttDate as asDate,
  formatGanttExactDate as formatExactDate,
  formatGanttWeekLabel as formatWeekLabel,
  ganttDayDistance as dayDistance,
  getGanttDurationDays,
  getGanttTaskRange,
  getGanttWeekStart as getWeekStart,
  startOfGanttDay as startOfDay,
} from "@/lib/gantt-time";
import { buildVisualGanttReportHtml, type GanttReportRow, type ReportOrientation, type ReportScale } from "./gantt-report-utils";
import { formatDateInput, parseDateInput } from "../../../shared/date-only";
import { getCriticalTaskIds } from "@/lib/gantt-critical";
import { calculateDateEditRange, canCreateDependency } from "@/lib/gantt-interaction";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  Route,
  GripVertical,
  History,
} from "lucide-react";

const LEFT_WIDTH = 350;
const GROUP_ROW_HEIGHT = 46;
const TASK_ROW_HEIGHT = 50;
const CHECKLIST_ROW_HEIGHT = 36;
const MONTH_COUNT = 3;
const WEEK_COUNT = 14;

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
  dependencies?: Array<{ id: number; predecessorTaskId: number; successorTaskId: number; dependencyType: string }>;
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

type DependencyDraft = { predecessorTaskId: number; x: number; y: number };
type DateEditMode = "move" | "resize-start" | "resize-end";
type DateEditDraft = { taskId: number; mode: DateEditMode; initialStart: string; initialEnd: string; pointerStartX: number; previewStart: string; previewEnd: string };
type GanttAuditEntry = { id: number; taskId: number; relatedTaskId: number | null; changedById: number; operation: "dates_updated" | "dependency_created" | "dependency_deleted"; beforeData: string | null; afterData: string | null; createdAt: Date | string; taskTitle: string | null; relatedTaskTitle: string | null; changedByName: string | null; changedByEmail: string | null };

type TimelineRow =
  | { kind: "group"; key: string; label: string }
  | { kind: "subgroup"; key: string; label: string; parentKey: string }
  | { kind: "task"; key: string; task: TaskItem; index: number }
  | { kind: "checklist"; key: string; item: ChecklistItem; taskId: number };

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function addMonths(value: Date, amount: number) {
  const result = new Date(value);
  result.setMonth(result.getMonth() + amount);
  return result;
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
  return getGanttTaskRange(task.startDate, task.endDate);
}

function getTaskDurationDays(task: TaskItem | ChecklistItem) {
  return getGanttDurationDays(task.startDate, task.endDate);
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

function parseAuditData(value: string | null | undefined) {
  if (!value) return null;
  try { return JSON.parse(value) as Record<string, unknown>; } catch { return null; }
}

function auditDate(value: unknown) {
  if (!value) return "sem data";
  const date = asDate(String(value));
  return date ? formatShortDate(date) : String(value);
}

function describeGanttAudit(entry: { operation: string; beforeData?: string | null; afterData?: string | null }) {
  const before = parseAuditData(entry.beforeData);
  const after = parseAuditData(entry.afterData);
  if (entry.operation === "dates_updated") return `Datas: ${auditDate(before?.startDate)} → ${auditDate(after?.startDate)}; final ${auditDate(before?.endDate)} → ${auditDate(after?.endDate)}`;
  const dependency = after ?? before;
  return `Dependência: tarefa #${String(dependency?.predecessorTaskId ?? "?")} → tarefa #${String(dependency?.successorTaskId ?? "?")} (${String(dependency?.dependencyType ?? "finish_to_start")})`;
}

export default function Gantt() {
  const [filterClientId, setFilterClientId] = useState<number | undefined>();
  const [filterCrsId, setFilterCrsId] = useState<number | undefined>();
  const [filterSetor, setFilterSetor] = useState<string | undefined>();
  const [filterUserId, setFilterUserId] = useState<number | undefined>();
  const [groupMode, setGroupMode] = useState<GroupMode>("discipline");
  const [zoom, setZoom] = useState<ZoomLevel>("week");
  const [customUnitWidth, setCustomUnitWidth] = useState<number | null>(null);
  const [dependencyDraft, setDependencyDraft] = useState<DependencyDraft | null>(null);
  const [dependencyPointer, setDependencyPointer] = useState<{ x: number; y: number } | null>(null);
  const [dateEditDraft, setDateEditDraft] = useState<DateEditDraft | null>(null);
  const [criticalPathEnabled, setCriticalPathEnabled] = useState(true);
  const [search, setSearch] = useState("");
  const [timelineStart, setTimelineStart] = useState(() => getWeekStart(startOfMonth(new Date())));
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [autoAligned, setAutoAligned] = useState(false);
  const [showPrintOptions, setShowPrintOptions] = useState(false);
  const [showGanttHistory, setShowGanttHistory] = useState(false);
  const [historyOperation, setHistoryOperation] = useState<"all" | "dates_updated" | "dependency_created" | "dependency_deleted">("all");
  const [printOrientation, setPrintOrientation] = useState<ReportOrientation>("landscape");
  const [printScale, setPrintScale] = useState<ReportScale>("standard");
  const [, navigate] = useLocation();
  const timelineRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();
  const updateTaskDates = trpc.tasks.updateDatesCascade.useMutation({
    onSuccess: (result) => {
      toast.success(result.propagatedCount > 0 ? `Datas atualizadas; ${result.propagatedCount} sucessora(s) propagada(s).` : "Datas da tarefa atualizadas.");
      setDateEditDraft(null);
      utils.tasks.listForGantt.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Não foi possível atualizar as datas.");
      setDateEditDraft(null);
    },
  });
  const createDependency = trpc.tasks.dependencies.create.useMutation({
    onSuccess: (result) => {
      toast.success(result.created ? "Dependência criada entre as tarefas." : "Essa dependência já existia.");
      setDependencyDraft(null);
      setDependencyPointer(null);
      utils.tasks.listForGantt.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Não foi possível criar a dependência.");
      setDependencyDraft(null);
      setDependencyPointer(null);
    },
  });

  useEffect(() => {
    if (!dependencyDraft) return;
    const handlePointerMove = (event: PointerEvent) => {
      const rect = timelineRef.current?.getBoundingClientRect();
      if (!rect) return;
      setDependencyPointer({ x: event.clientX - rect.left + timelineRef.current!.scrollLeft, y: event.clientY - rect.top + timelineRef.current!.scrollTop });
    };
    const handlePointerUp = (event: PointerEvent) => {
      const element = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-gantt-task-id]");
      const successorTaskId = element ? Number(element.dataset.ganttTaskId) : NaN;
      const predecessorTaskId = dependencyDraft.predecessorTaskId;
      setDependencyDraft(null);
      setDependencyPointer(null);
      if (!canCreateDependency(predecessorTaskId, successorTaskId)) {
        toast.error("Solte a seta sobre outra atividade para criar a dependência.");
        return;
      }
      createDependency.mutate({ predecessorTaskId, successorTaskId, dependencyType: "finish_to_start" });
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dependencyDraft]);

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
  const ganttHistoryInput = useMemo(() => ({ limit: 300, operation: historyOperation === "all" ? undefined : historyOperation }), [historyOperation]);
  const ganttHistoryQ = trpc.registros.ganttHistory.useQuery(ganttHistoryInput, { enabled: showGanttHistory });
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
      const firstDate = new Date(Math.min(...dates.map((date) => date.getTime())));
      setTimelineStart(zoom === "week" ? getWeekStart(firstDate) : startOfMonth(firstDate));
      setAutoAligned(true);
    }
  }, [autoAligned, filteredTasks, zoom]);

  const defaultUnitWidth = zoom === "day" ? 56 : zoom === "week" ? 136 : 260;
  const timelineUnitWidth = customUnitWidth ?? defaultUnitWidth;
  const timelineEnd = zoom === "day" ? addDays(timelineStart, 35) : zoom === "week" ? addDays(timelineStart, WEEK_COUNT * 7) : addMonths(timelineStart, MONTH_COUNT);
  const totalDays = Math.max(1, dayDistance(timelineStart, timelineEnd));
  const days = useMemo(() => Array.from({ length: totalDays }, (_, index) => addDays(timelineStart, index)), [timelineStart, totalDays]);

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

  const dayGroups = useMemo(() => {
    const groups: Array<{ key: string; label: string; start: number; count: number }> = [];
    days.forEach((day, index) => {
      const key = day.toISOString().slice(0, 10);
      groups.push({ key, label: day.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), start: index, count: 1 });
    });
    return groups;
  }, [days]);

  const weekGroups = useMemo(() => {
    const groups: Array<{ key: string; label: string; start: number; count: number }> = [];
    days.forEach((day, index) => {
      const weekStart = getWeekStart(day);
      const weekEnd = addDays(weekStart, 6);
      const key = weekStart.toISOString().slice(0, 10);
      const current = groups[groups.length - 1];
      if (!current || current.key !== key) groups.push({ key, label: formatWeekLabel(weekStart, weekEnd), start: index, count: 1 });
      else current.count += 1;
    });
    return groups;
  }, [days]);

  const timelineGroups = zoom === "day" ? dayGroups : zoom === "week" ? weekGroups : monthGroups;
  const totalTimelineWidth = timelineGroups.length * timelineUnitWidth;

  const getTimelineX = (value: Date) => {
    const offset = Math.max(0, Math.min(totalDays - 1, dayDistance(timelineStart, value)));
    const groupIndex = timelineGroups.findIndex((group: { start: number; count: number }) => offset >= group.start && offset < group.start + group.count);
    const safeGroupIndex = groupIndex >= 0 ? groupIndex : timelineGroups.length - 1;
    const group = timelineGroups[safeGroupIndex];
    if (!group) return 0;
    const withinGroup = Math.max(0, offset - group.start);
    return safeGroupIndex * timelineUnitWidth + (withinGroup / Math.max(1, group.count)) * timelineUnitWidth;
  };

  const todayX = getTimelineX(today);
  const getTimelineDate = (x: number) => {
    const clampedX = Math.max(0, Math.min(totalTimelineWidth - 1, x));
    const groupIndex = Math.max(0, Math.min(timelineGroups.length - 1, Math.floor(clampedX / Math.max(1, timelineUnitWidth))));
    const group = timelineGroups[groupIndex] as { start: number; count: number } | undefined;
    if (!group) return timelineStart;
    const within = clampedX - groupIndex * timelineUnitWidth;
    const dayOffset = Math.round(group.start + (within / Math.max(1, timelineUnitWidth)) * group.count);
    return addDays(timelineStart, Math.max(0, Math.min(totalDays - 1, dayOffset)));
  };

  useEffect(() => {
    if (!dateEditDraft) return;
    const handlePointerMove = (event: PointerEvent) => {
      const timeline = timelineRef.current;
      if (!timeline) return;
      const rect = timeline.getBoundingClientRect();
      const currentX = event.clientX - rect.left + timeline.scrollLeft - LEFT_WIDTH;
      const pointerDate = getTimelineDate(currentX);
      const initialStart = parseDateInput(dateEditDraft.initialStart);
      const initialEnd = parseDateInput(dateEditDraft.initialEnd) ?? initialStart;
      if (!initialStart || !initialEnd) return;
      const pointerStartDate = getTimelineDate(dateEditDraft.pointerStartX);
      const nextRange = calculateDateEditRange(initialStart, initialEnd, pointerStartDate, pointerDate, dateEditDraft.mode);
      setDateEditDraft((current) => current ? { ...current, previewStart: formatDateInput(nextRange.start), previewEnd: formatDateInput(nextRange.end) } : current);
    };
    const handlePointerUp = () => {
      const current = dateEditDraft;
      if (!current || updateTaskDates.isPending) return;
      const startDate = parseDateInput(current.previewStart);
      const endDate = parseDateInput(current.previewEnd);
      if (!startDate || !endDate || endDate < startDate) {
        toast.error("A data final não pode ser anterior à data inicial.");
        setDateEditDraft(null);
        return;
      }
      const changed = current.previewStart !== current.initialStart || current.previewEnd !== current.initialEnd;
      if (!changed) {
        setDateEditDraft(null);
        return;
      }
      updateTaskDates.mutate({ id: current.taskId, startDate, endDate });
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDateEditDraft(null);
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [dateEditDraft, getTimelineDate, updateTaskDates]);

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
    setTimelineStart((current) => zoom === "week" ? addDays(current, months * 28) : addMonths(current, months));
    setAutoAligned(true);
  }

  function resetToday() {
    const current = new Date();
    setTimelineStart(zoom === "week" ? getWeekStart(current) : startOfMonth(current));
    setAutoAligned(true);
  }

  function getBar(task: TaskItem | ChecklistItem) {
    const isEditingTask = "id" in task && dateEditDraft?.taskId === task.id;
    const range = isEditingTask
      ? { start: parseDateInput(dateEditDraft.previewStart), end: parseDateInput(dateEditDraft.previewEnd) }
      : taskRange(task);
    if (!range.start) return null;
    const end = range.end ?? range.start;
    const left = getTimelineX(range.start);
    const width = Math.max(zoom === "week" ? 18 : 28, getTimelineX(addDays(end, 1)) - left - 5);
    return { left, width, color: getBarColor(task, today), milestone: dayDistance(range.start, end) === 0 };
  }

  const criticalTaskIds = useMemo(() => getCriticalTaskIds(filteredTasks), [filteredTasks]);

  const rowYByTaskId = useMemo(() => {
    const positions = new Map<number, number>();
    let top = 48;
    for (const row of rows) {
      const rowHeight = row.kind === "group" ? GROUP_ROW_HEIGHT : row.kind === "checklist" ? CHECKLIST_ROW_HEIGHT : TASK_ROW_HEIGHT;
      if (row.kind === "task") positions.set(row.task.id, top + rowHeight / 2);
      top += rowHeight;
    }
    return positions;
  }, [rows]);

  const dependencyLines = useMemo(() => {
    const taskById = new Map(filteredTasks.map((task) => [task.id, task]));
    const lines: Array<{ id: number; x1: number; y1: number; x2: number; y2: number }> = [];
    for (const successor of filteredTasks) {
      for (const dependency of successor.dependencies ?? []) {
        const predecessor = taskById.get(dependency.predecessorTaskId);
        const fromY = rowYByTaskId.get(dependency.predecessorTaskId);
        const toY = rowYByTaskId.get(dependency.successorTaskId);
        if (!predecessor || fromY == null || toY == null) continue;
        const predecessorBar = getBar(predecessor);
        const successorBar = getBar(successor);
        if (!predecessorBar || !successorBar) continue;
        lines.push({ id: dependency.id, x1: predecessorBar.left + predecessorBar.width, y1: fromY, x2: successorBar.left, y2: toY });
      }
    }
    return lines;
  }, [filteredTasks, rowYByTaskId, timelineUnitWidth, timelineStart, totalDays, zoom]);

  const timelineContentHeight = 48 + rows.reduce((height, row) => height + (row.kind === "group" ? GROUP_ROW_HEIGHT : row.kind === "checklist" ? CHECKLIST_ROW_HEIGHT : TASK_ROW_HEIGHT), 0) + 40;

  function beginDateEdit(event: React.PointerEvent<HTMLElement>, task: TaskItem, mode: DateEditMode) {
    if (mode === "move" && event.target instanceof HTMLElement && event.target.closest("button")) return;
    const start = formatDateInput(task.startDate) || formatDateInput(task.endDate);
    const end = formatDateInput(task.endDate) || start;
    if (!start || !end) {
      toast.error("A tarefa precisa ter data inicial e final para ser editada no Gantt.");
      return;
    }
    const timeline = timelineRef.current;
    if (!timeline) return;
    const rect = timeline.getBoundingClientRect();
    const x = event.clientX - rect.left + timeline.scrollLeft - LEFT_WIDTH;
    event.preventDefault();
    event.stopPropagation();
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* alguns navegadores não capturam ponteiros sintéticos */ }
    setDateEditDraft({ taskId: task.id, mode, initialStart: start, initialEnd: end, pointerStartX: x, previewStart: start, previewEnd: end });
  }

  function exportTimeline(orientation: ReportOrientation = printOrientation, scale: ReportScale = printScale) {
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
      orientation,
      scale,
    }));
    popup.document.close();
    popup.focus();
    setTimeout(() => popup.print(), 500);
  }

  const gridBackground = `repeating-linear-gradient(to right, transparent 0, transparent ${Math.max(timelineUnitWidth - 1, 1)}px, rgba(59,130,246,.24) ${Math.max(timelineUnitWidth - 1, 1)}px, rgba(59,130,246,.24) ${timelineUnitWidth}px)`;

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
              <Button variant="outline" size="sm" className="h-10 gap-1.5 px-3 sm:h-9" onClick={() => setShowPrintOptions(true)}><Download className="w-4 h-4" /><span className="hidden sm:inline">PDF</span></Button>
              <Button variant="outline" size="sm" className="h-10 gap-1.5 px-3 sm:h-9" onClick={() => setShowGanttHistory(true)}><History className="w-4 h-4" /><span className="hidden sm:inline">Histórico</span></Button>
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
                <button key={level} type="button" aria-pressed={zoom === level} title={level === "day" ? "Mostrar os dias individualmente" : undefined} onClick={() => { setZoom(level); if (level === "week" || level === "day") setTimelineStart(getWeekStart(timelineStart)); }} className={`px-2.5 py-1.5 rounded text-xs font-semibold transition-colors ${zoom === level ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-100"}`}>
                  {level === "month" ? "Mês" : level === "week" ? "Semana" : "Dias"}
                </button>
              ))}
            </div>
            <div className="hidden items-center gap-1.5 ml-auto text-xs text-slate-500 sm:flex">
              <Button variant="outline" size="sm" className="h-7 text-xs px-2 gap-1" onClick={() => setCustomUnitWidth((w) => Math.max(40, (w ?? defaultUnitWidth) - 24))} title="Reduzir zoom"><ZoomOut className="w-3.5 h-3.5" /> Menos</Button>
              <span className="font-semibold text-slate-700">{zoom === "day" ? "Dias" : zoom === "week" ? "Semanas" : "Meses"} ({timelineUnitWidth}px)</span>
              <Button variant="outline" size="sm" className="h-7 text-xs px-2 gap-1" onClick={() => setCustomUnitWidth((w) => Math.min(240, (w ?? defaultUnitWidth) + 24))} title="Ampliar zoom"><ZoomIn className="w-3.5 h-3.5" /> Mais</Button>
              <Button variant={criticalPathEnabled ? "default" : "outline"} size="sm" className="h-7 text-xs px-2 gap-1" onClick={() => setCriticalPathEnabled((enabled) => !enabled)} title="Alternar destaque do caminho crítico"><Route className="w-3.5 h-3.5" /> Caminho crítico</Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-600 ring-2 ring-red-200" /> {criticalPathEnabled ? `${criticalTaskIds.size} tarefa(s) no caminho crítico` : "Caminho crítico oculto"}</span>
            <span className="inline-flex items-center gap-1.5"><GripVertical className="h-3.5 w-3.5 text-slate-500" /> Arraste a barra para mover as datas.</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-1 rounded bg-slate-500" /> Arraste as extremidades para redimensionar.</span>
          </div>

          {dateEditDraft && <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">Editando datas: {dateEditDraft.previewStart} → {dateEditDraft.previewEnd}. Solte para salvar ou pressione Esc para cancelar.</div>}

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

            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm" aria-label="Legenda de status do Gantt">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Legenda de status</p>
              <div className="flex flex-wrap gap-2.5 text-[10px] font-semibold text-slate-600">
                <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-blue-500" aria-hidden="true" />Em andamento</span>
                <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden="true" />Concluída</span>
                <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden="true" />Atrasada</span>
              </div>
            </div>

            <div className="space-y-2.5">
              {filteredTasks.map((task, index) => {
                const statusLabel = getTaskStatusLabel(task, today);
                const progress = Math.min(100, Math.max(0, Number(task.progress ?? 0)));
                const groupLabel = groupMode === "discipline" ? task.setor || "Sem disciplina" : groupMode === "crs" ? task.projectName || "Sem contrato" : task.assigneeName || "Sem responsável";
                const isCompleted = statusLabel === "Concluída";
                const isLate = statusLabel === "Atrasada";
                return (
                  <button type="button" key={`mobile-task-${task.id}`} onClick={() => navigate(`/tasks/${task.id}`)} aria-label={`Abrir detalhes da tarefa ${task.title}`} className="block w-full touch-manipulation rounded-2xl border border-slate-200 border-l-4 bg-white p-3 text-left shadow-sm transition-[transform,box-shadow] duration-150 hover:shadow-md active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2" style={{ borderLeftColor: getBarColor(task, today) }}>
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
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {ganttQ.isLoading && <div className="space-y-2"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>}
        {!ganttQ.isLoading && filteredTasks.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">Nenhuma tarefa encontrada para os filtros atuais.</div>}

        {!ganttQ.isLoading && filteredTasks.length > 0 && (
          <div className="hidden min-w-0 flex-1 min-h-0 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden md:block">
            <div ref={timelineRef} className="relative isolate h-full min-w-0 overflow-auto overscroll-contain">
              <div className="relative" style={{ width: LEFT_WIDTH + totalTimelineWidth, minWidth: "100%", minHeight: timelineContentHeight }}>
                <svg className="pointer-events-none absolute left-0 top-0 z-[24]" width={LEFT_WIDTH + totalTimelineWidth} height={timelineContentHeight} aria-hidden="true">
                  <defs><marker id="gantt-dependency-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#2563eb" /></marker></defs>
                  <g transform={`translate(${LEFT_WIDTH}, 0)`}>
                    {dependencyLines.map((line) => <path key={line.id} d={`M ${line.x1} ${line.y1} C ${line.x1 + 24} ${line.y1}, ${line.x2 - 24} ${line.y2}, ${line.x2} ${line.y2}`} fill="none" stroke="#2563eb" strokeWidth="1.5" strokeDasharray="4 3" markerEnd="url(#gantt-dependency-arrow)" />)}
                    {dependencyDraft && dependencyPointer && <path d={`M ${dependencyDraft.x} ${dependencyDraft.y} C ${dependencyDraft.x + 24} ${dependencyDraft.y}, ${dependencyPointer.x - LEFT_WIDTH - 24} ${dependencyPointer.y}, ${dependencyPointer.x - LEFT_WIDTH} ${dependencyPointer.y}`} fill="none" stroke="#f59e0b" strokeWidth="2" strokeDasharray="5 4" />}
                  </g>
                </svg>
                <div className="sticky top-0 z-40 grid border-b border-slate-200 bg-[#f8fafc]" style={{ gridTemplateColumns: `${LEFT_WIDTH}px ${totalTimelineWidth}px` }}>
                  <div className="sticky left-0 top-0 z-50 flex items-center gap-2 border-r border-slate-200 bg-[#f8fafc] px-4 text-xs font-bold uppercase tracking-wide text-slate-500 shadow-[3px_0_8px_rgba(15,23,42,0.08)]">Tarefa <span className="font-normal normal-case text-slate-400">({filteredTasks.length})</span></div>
                  <div className="relative z-40 overflow-hidden bg-[#f8fafc]" aria-label={zoom === "day" ? "Escala diária" : zoom === "week" ? "Escala semanal" : "Escala mensal"}>
                    <div className="flex h-12 bg-[#f8fafc]" style={{ backgroundImage: gridBackground }}>
                      {timelineGroups.map((group: { start: number; count: number; label: string; key?: string }, index: number) => <div key={`${zoom}-${group.start}-${index}`} className="flex shrink-0 items-center justify-center border-r border-blue-200 px-2 text-[10px] font-bold uppercase text-slate-600" style={{ width: timelineUnitWidth }}>{zoom === "day" && group.key ? `${group.key.slice(8, 10)}/${group.key.slice(5, 7)}` : group.label}</div>)}
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
                      <div className={`sticky left-0 z-20 flex items-center gap-2 border-r border-slate-200 px-3 shadow-[3px_0_8px_rgba(15,23,42,0.06)] ${isGroup ? "bg-[#eef5ff]" : isSubgroup ? "bg-[#f8fafc]" : row.kind === "checklist" ? "bg-white pl-14" : "bg-white pl-5"}`}>
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
                        {row.kind === "group" && null}
                        {todayX >= 0 && todayX < totalTimelineWidth && <div className="absolute inset-y-0 z-10 w-px bg-blue-500/60" style={{ left: todayX }} />}
                        {isGroup && row.kind === "group" && null}
                        {task && bar && <Tooltip><TooltipTrigger asChild><div aria-label={`${task.title}: início ${formatExactDate(task.startDate)}, término ${formatExactDate(task.endDate)}, duração de ${getTaskDurationDays(task)} dias`} onPointerDown={(event) => { if (row.kind === "task") beginDateEdit(event, row.task, "move"); }} className={`absolute z-20 flex touch-none select-none items-center gap-1 overflow-visible rounded-md px-2 shadow-sm transition-all hover:brightness-105 ${bar.milestone ? "rounded-full" : ""} ${row.kind === "task" && criticalPathEnabled && criticalTaskIds.has(row.task.id) ? "ring-2 ring-red-500 ring-offset-1 ring-offset-white" : ""}`} data-critical={row.kind === "task" && criticalPathEnabled && criticalTaskIds.has(row.task.id) ? "true" : "false"} data-gantt-task-id={row.kind === "task" ? row.task.id : undefined} style={{ left: bar.left, width: bar.milestone ? Math.max(18, timelineUnitWidth * 0.18) : bar.width, height: row.kind === "checklist" ? 18 : 28, top: row.kind === "checklist" ? 9 : 11, backgroundColor: row.kind === "task" && criticalPathEnabled && criticalTaskIds.has(row.task.id) ? "#dc2626" : bar.color }}>
                          {row.kind === "task" && bar.width > 54 && <Avatar className="h-5 w-5 shrink-0 border border-white/70"><AvatarImage src={row.task.assigneeAvatar ?? undefined} /><AvatarFallback className="bg-white/30 text-[8px] text-white">{initials(row.task.assigneeName)}</AvatarFallback></Avatar>}
                          <span className="truncate text-[10px] font-semibold text-white">{row.kind === "task" ? row.task.phaseName || "Atividade" : row.kind === "checklist" ? row.item.title : ""}</span>
                          {row.kind === "task" && row.task.predecessorId && <Link2 className="ml-auto h-3 w-3 shrink-0 text-white/80" />}
                          {row.kind === "task" && !bar.milestone && <><button type="button" aria-label={`Redimensionar início de ${row.task.title}`} title="Arraste para alterar a data inicial" className="absolute -left-1 top-0 z-30 h-full w-2 touch-none cursor-ew-resize rounded-l-md border-0 bg-transparent hover:bg-white/40" onPointerDown={(event) => beginDateEdit(event, row.task, "resize-start")} /><button type="button" aria-label={`Redimensionar final de ${row.task.title}`} title="Arraste para alterar a data final" className="absolute -right-1 top-0 z-30 h-full w-2 touch-none cursor-ew-resize rounded-r-md border-0 bg-transparent hover:bg-white/40" onPointerDown={(event) => beginDateEdit(event, row.task, "resize-end")} /></>}
                          {row.kind === "task" && <button type="button" aria-label={`Criar dependência a partir de ${row.task.title}`} title="Arraste para outra barra para criar dependência" className="absolute -right-2 top-1/2 z-30 h-4 w-4 -translate-y-1/2 touch-none cursor-crosshair rounded-full border-2 border-white bg-blue-700 shadow-md hover:scale-110" onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* fallback para navegadores sem captura */ } const y = rowYByTaskId.get(row.task.id) ?? 0; setDependencyDraft({ predecessorTaskId: row.task.id, x: bar.left + bar.width, y }); setDependencyPointer({ x: bar.left + bar.width, y }); }} onPointerUp={() => undefined} />}
                        </div></TooltipTrigger><TooltipContent side="top" className="max-w-xs"><p className="font-semibold">{task.title}</p><p className="text-xs">Início: {formatExactDate(task.startDate)}</p><p className="text-xs">Término: {formatExactDate(task.endDate)}</p><p className="text-xs">Duração: {getTaskDurationDays(task)} dia(s)</p>{row.kind === "task" && <><p className="text-xs">Status: {getTaskStatusLabel(row.task, today)}</p><p className="text-xs">Projeto/contrato: {row.task.projectName || "Não informado"}</p><p className="text-xs">Responsável: {row.task.assigneeName || "Não atribuído"}</p><p className="text-xs">Progresso: {Math.round(row.task.progress ?? 0)}%</p><p className="text-xs">Dependências: {(row.task.dependencies ?? []).length || "Nenhuma"}</p>{criticalPathEnabled && criticalTaskIds.has(row.task.id) && <p className="text-xs font-semibold text-red-600">Caminho crítico</p>}</>}{row.kind === "checklist" && <p className="text-xs">Item de checklist da tarefa #{row.taskId}</p>}</TooltipContent></Tooltip>}
                      </div>
                    </div>
                  );
                })}
                <div className="sticky left-0 flex h-10 items-center gap-2 border-t border-slate-100 bg-white px-4 text-xs font-semibold text-slate-500"><span className="text-lg leading-none">+</span> Adicionar tarefa</div>
              </div>
            </div>
          </div>
        )}

        <Dialog open={showGanttHistory} onOpenChange={setShowGanttHistory}>
          <DialogContent className="w-[calc(100%-2rem)] max-w-3xl rounded-2xl">
            <DialogHeader>
              <DialogTitle>Histórico de alterações do Gantt</DialogTitle>
              <DialogDescription>Veja quem alterou datas e dependências, com os valores anteriores e posteriores. Os registros são isolados por empresa.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-wrap items-center justify-between gap-2 border-y border-slate-100 py-3">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <Filter className="h-3.5 w-3.5" /> Operação
                <select value={historyOperation} onChange={(event) => setHistoryOperation(event.target.value as typeof historyOperation)} className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs font-normal text-slate-700">
                  <option value="all">Todas</option>
                  <option value="dates_updated">Datas atualizadas</option>
                  <option value="dependency_created">Dependência criada</option>
                  <option value="dependency_deleted">Dependência excluída</option>
                </select>
              </label>
              <span className="text-xs text-slate-500">{ganttHistoryQ.data?.length ?? 0} registro(s)</span>
            </div>
            <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
              {ganttHistoryQ.isLoading && <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Carregando histórico...</div>}
              {ganttHistoryQ.error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">Não foi possível carregar o histórico: {ganttHistoryQ.error.message}</div>}
              {!ganttHistoryQ.isLoading && !ganttHistoryQ.error && (ganttHistoryQ.data ?? []).length === 0 && <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">Nenhuma alteração de Gantt registrada para este filtro.</div>}
              {(ganttHistoryQ.data ?? []).map((entry: GanttAuditEntry) => {
                const operationLabel = entry.operation === "dates_updated" ? "Datas atualizadas" : entry.operation === "dependency_created" ? "Dependência criada" : "Dependência excluída";
                const operationColor = entry.operation === "dates_updated" ? "bg-blue-50 text-blue-700" : entry.operation === "dependency_created" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700";
                return <div key={entry.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{entry.taskTitle || `Tarefa #${entry.taskId}`}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{entry.relatedTaskTitle ? `Relacionado a ${entry.relatedTaskTitle}` : "Alteração direta na tarefa"}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${operationColor}`}>{operationLabel}</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-600">{describeGanttAudit(entry)}</p>
                  <p className="mt-2 text-[11px] text-slate-400">Por <strong className="font-semibold text-slate-600">{entry.changedByName || entry.changedByEmail || `Usuário #${entry.changedById}`}</strong> em {new Date(entry.createdAt).toLocaleString("pt-BR")}</p>
                </div>;
              })}
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setShowGanttHistory(false)}>Fechar</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showPrintOptions} onOpenChange={setShowPrintOptions}>
          <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle>Preparar relatório Gantt</DialogTitle>
              <DialogDescription>Escolha o formato de impressão antes de gerar a visualização do relatório.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                Orientação
                <select value={printOrientation} onChange={(event) => setPrintOrientation(event.target.value as ReportOrientation)} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
                  <option value="landscape">Paisagem — melhor para timelines</option>
                  <option value="portrait">Retrato — melhor para leitura vertical</option>
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                Escala do conteúdo
                <select value={printScale} onChange={(event) => setPrintScale(event.target.value as ReportScale)} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
                  <option value="compact">Compacta — mais tarefas por página</option>
                  <option value="standard">Padrão — equilíbrio entre leitura e densidade</option>
                  <option value="large">Ampliada — texto e barras maiores</option>
                </select>
              </label>
            </div>
            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
              <Button variant="outline" className="w-full sm:w-auto" onClick={() => setShowPrintOptions(false)}>Cancelar</Button>
              <Button className="w-full gap-2 sm:w-auto" onClick={() => exportTimeline()}><Download className="h-4 w-4" />Gerar relatório</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
