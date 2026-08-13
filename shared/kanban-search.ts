export interface KanbanSearchableTask {
  title?: string | null;
  assigneeName?: string | null;
  projectName?: string | null;
  setor?: string | null;
}

/**
 * Retorna true quando a busca encontra o card em seu título, responsável,
 * contrato ou disciplina. A comparação é case-insensitive e ignora espaços
 * externos da consulta.
 */
export function matchesKanbanTaskSearch(task: KanbanSearchableTask, query: string): boolean {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return true;

  const searchableText = [task.title, task.assigneeName, task.projectName, task.setor]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .toLocaleLowerCase();

  return searchableText.includes(normalizedQuery);
}
