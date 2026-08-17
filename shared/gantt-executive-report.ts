export type GanttExecutiveEntry = {
  taskId: number;
  relatedTaskId?: number | null;
  operation: string;
  taskTitle: string | null;
  relatedTaskTitle: string | null;
  beforeData?: string | null;
  afterData?: string | null;
  changedById?: number | null;
  changedByName: string | null;
  changedByEmail: string | null;
  createdAt: Date | string;
};

export type GanttExecutiveSummary = {
  totalChanges: number;
  dateChanges: number;
  dependenciesCreated: number;
  dependenciesDeleted: number;
  affectedTasks: number;
};

export type GanttExecutiveImpactMetrics = {
  criticalTasksAffected: number;
  criticalChanges: number;
  criticalDelayedChanges: number;
  criticalAcceleratedChanges: number;
  criticalNetEndShiftDays: number;
  criticalMaxEndShiftDays: number;
  totalDelayedChanges: number;
  totalAcceleratedChanges: number;
  netEndShiftDays: number;
  maxEndShiftDays: number;
};

export type GanttExecutiveChartData = {
  operationBreakdown: Array<{ label: string; value: number; color: [number, number, number] }>;
  dailyVolume: Array<{ label: string; value: number }>;
  topAffectedTasks: Array<{ label: string; value: number }>;
  impact: GanttExecutiveImpactMetrics;
};

export function summarizeGanttEntries(entries: GanttExecutiveEntry[]): GanttExecutiveSummary {
  return {
    totalChanges: entries.length,
    dateChanges: entries.filter((entry) => entry.operation === "dates_updated").length,
    dependenciesCreated: entries.filter((entry) => entry.operation === "dependency_created").length,
    dependenciesDeleted: entries.filter((entry) => entry.operation === "dependency_deleted").length,
    affectedTasks: new Set(entries.map((entry) => entry.taskId)).size,
  };
}

function snapshotDate(snapshot: Record<string, unknown>, field: string) {
  const value = snapshot[field];
  if (typeof value !== "string") return null;
  const token = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(token)) return null;
  const [year, month, day] = token.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function calendarDayShift(before: Date | null, after: Date | null) {
  if (!before || !after) return null;
  return Math.round((after.getTime() - before.getTime()) / 86400000);
}

function parseSnapshot(value: string | null | undefined) {
  if (!value) return {} as Record<string, unknown>;
  try { return JSON.parse(value) as Record<string, unknown>; } catch { return {}; }
}

export function buildGanttExecutiveChartData(entries: GanttExecutiveEntry[], criticalTaskIds: ReadonlySet<number> = new Set()): GanttExecutiveChartData {
  const operationBreakdown = [
    { label: "Datas", operation: "dates_updated", color: [37, 99, 235] as [number, number, number] },
    { label: "Dependências criadas", operation: "dependency_created", color: [16, 185, 129] as [number, number, number] },
    { label: "Dependências excluídas", operation: "dependency_deleted", color: [220, 38, 38] as [number, number, number] },
  ].map(({ label, operation, color }) => ({ label, value: entries.filter((entry) => entry.operation === operation).length, color }));
  const dailyMap = new Map<string, number>();
  entries.forEach((entry) => {
    const date = new Date(entry.createdAt);
    const key = Number.isNaN(date.getTime()) ? "Sem data" : date.toISOString().slice(0, 10);
    dailyMap.set(key, (dailyMap.get(key) ?? 0) + 1);
  });
  const dailyVolume = Array.from(dailyMap.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => ({
    label: key === "Sem data" ? key : new Date(`${key}T00:00:00.000Z`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" }),
    value,
  }));
  const taskMap = new Map<number, { label: string; value: number }>();
  entries.forEach((entry) => {
    const current = taskMap.get(entry.taskId);
    taskMap.set(entry.taskId, { label: entry.taskTitle || `Tarefa #${entry.taskId}`, value: (current?.value ?? 0) + 1 });
  });
  const topAffectedTasks = Array.from(taskMap.values()).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label)).slice(0, 5);
  const criticalTaskIdsAffected = new Set<number>();
  let criticalChanges = 0;
  let criticalDelayedChanges = 0;
  let criticalAcceleratedChanges = 0;
  let criticalNetEndShiftDays = 0;
  let criticalMaxEndShiftDays = 0;
  let totalDelayedChanges = 0;
  let totalAcceleratedChanges = 0;
  let netEndShiftDays = 0;
  let maxEndShiftDays = 0;
  entries.forEach((entry) => {
    const before = parseSnapshot(entry.beforeData);
    const after = parseSnapshot(entry.afterData);
    if (entry.operation !== "dates_updated") return;
    const beforeEnd = snapshotDate(before, "endDate") ?? snapshotDate(before, "startDate");
    const afterEnd = snapshotDate(after, "endDate") ?? snapshotDate(after, "startDate");
    const shiftDays = calendarDayShift(beforeEnd, afterEnd);
    if (shiftDays == null) return;
    if (shiftDays > 0) totalDelayedChanges += 1;
    if (shiftDays < 0) totalAcceleratedChanges += 1;
    netEndShiftDays += shiftDays;
    maxEndShiftDays = Math.max(maxEndShiftDays, shiftDays);
    const isCritical = criticalTaskIds.has(entry.taskId) || (entry.relatedTaskId != null && criticalTaskIds.has(entry.relatedTaskId));
    if (!isCritical) return;
    criticalChanges += 1;
    criticalTaskIdsAffected.add(entry.taskId);
    if (entry.relatedTaskId != null && criticalTaskIds.has(entry.relatedTaskId)) criticalTaskIdsAffected.add(entry.relatedTaskId);
    if (shiftDays > 0) criticalDelayedChanges += 1;
    if (shiftDays < 0) criticalAcceleratedChanges += 1;
    criticalNetEndShiftDays += shiftDays;
    criticalMaxEndShiftDays = Math.max(criticalMaxEndShiftDays, shiftDays);
  });
  return {
    operationBreakdown,
    dailyVolume,
    topAffectedTasks,
    impact: {
      criticalTasksAffected: criticalTaskIdsAffected.size,
      criticalChanges,
      criticalDelayedChanges,
      criticalAcceleratedChanges,
      criticalNetEndShiftDays,
      criticalMaxEndShiftDays,
      totalDelayedChanges,
      totalAcceleratedChanges,
      netEndShiftDays,
      maxEndShiftDays,
    },
  };
}

export function buildGanttExecutivePeriodLabel(fromDate?: string, toDate?: string) {
  if (!fromDate && !toDate) return "Resumo semanal do histórico atual";
  if (fromDate && toDate) return `${formatIsoDate(fromDate)} a ${formatIsoDate(toDate)}`;
  if (fromDate) return `A partir de ${formatIsoDate(fromDate)}`;
  return `Até ${formatIsoDate(toDate as string)}`;
}

export function formatIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export function getExecutiveOperationLabel(operation: string) {
  if (operation === "dates_updated") return "Datas atualizadas";
  if (operation === "dependency_created") return "Dependência criada";
  if (operation === "dependency_deleted") return "Dependência excluída";
  return operation;
}

export function getExecutiveEntryDescription(entry: GanttExecutiveEntry) {
  if (entry.operation === "dates_updated") return `${entry.taskTitle || `Tarefa #${entry.taskId}`} teve o período programado alterado.`;
  const related = entry.relatedTaskTitle || "tarefa relacionada";
  return `${entry.taskTitle || `Tarefa #${entry.taskId}`} e ${related}.`;
}

export function buildGanttPdfFileName(companyName: string) {
  const normalized = companyName.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "empresa";
  return `orbita-relatorio-executivo-gantt-${normalized}.pdf`;
}

export function buildGanttTaskReportLink(baseUrl: string, taskId: number) {
  const url = new URL("gantt", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  url.searchParams.set("taskId", String(taskId));
  url.searchParams.set("history", "1");
  return url.toString();
}
