export type GanttHistoryCsvRecord = {
  createdAt: Date | string;
  operationLabel: string;
  taskTitle: string;
  relatedTaskTitle?: string | null;
  changedBy: string;
  summary: string;
  beforeData?: string | null;
  afterData?: string | null;
};

function escapeCsvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function buildGanttHistoryCsv(
  records: GanttHistoryCsvRecord[],
  formatDateTime = (value: Date | string) => new Date(value).toLocaleString("pt-BR"),
) {
  const rows = records.map((record) => [
    formatDateTime(record.createdAt),
    record.operationLabel,
    record.taskTitle,
    record.relatedTaskTitle ?? "",
    record.changedBy,
    record.summary,
    record.beforeData ?? "",
    record.afterData ?? "",
  ]);
  return [
    ["Data", "Operação", "Tarefa", "Tarefa relacionada", "Autor", "Resumo", "Antes", "Depois"],
    ...rows,
  ].map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
}

export const ganttHistoryOperationLabels = {
  dates_updated: "Datas atualizadas",
  dependency_created: "Dependência criada",
  dependency_deleted: "Dependência excluída",
} as const;

export type GanttHistoryOperation = keyof typeof ganttHistoryOperationLabels;

export function getGanttHistoryOperationLabel(operation: string) {
  return ganttHistoryOperationLabels[operation as GanttHistoryOperation] ?? operation;
}

export function getGanttDateRangeLabel(value: unknown) {
  if (!value) return "sem data";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("pt-BR");
}
