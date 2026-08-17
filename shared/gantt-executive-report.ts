export type GanttExecutiveEntry = {
  taskId: number;
  operation: string;
  taskTitle: string | null;
  relatedTaskTitle: string | null;
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

export type GanttExecutiveChartData = {
  operationBreakdown: Array<{ label: string; value: number; color: [number, number, number] }>;
  dailyVolume: Array<{ label: string; value: number }>;
  topAffectedTasks: Array<{ label: string; value: number }>;
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

export function buildGanttExecutiveChartData(entries: GanttExecutiveEntry[]): GanttExecutiveChartData {
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
  return { operationBreakdown, dailyVolume, topAffectedTasks };
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
