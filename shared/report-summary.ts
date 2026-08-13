export interface CompletedTaskAssigneeRow {
  assigneeName?: string | null;
}

export interface CompletedTaskAssigneeSummary {
  assigneeName: string;
  count: number;
  percentage: number;
}

/** Agrega tarefas concluídas por responsável, incluindo tarefas sem atribuição. */
export function aggregateCompletedTasksByAssignee(
  tasks: CompletedTaskAssigneeRow[],
): CompletedTaskAssigneeSummary[] {
  const counts = new Map<string, number>();
  for (const task of tasks) {
    const name = task.assigneeName?.trim() || "Não atribuído";
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  const total = tasks.length;
  return Array.from(counts.entries())
    .map(([assigneeName, count]) => ({
      assigneeName,
      count,
      percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count || a.assigneeName.localeCompare(b.assigneeName, "pt-BR"));
}
