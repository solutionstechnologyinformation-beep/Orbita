import { isCompletedKanbanPhase, type KanbanPhaseLike } from "./kanban-completion";

export interface KanbanTaskLike {
  progress?: number | null;
  dueDate?: Date | string | null;
}

export function isKanbanTaskCompleted(task: KanbanTaskLike, phase?: KanbanPhaseLike | null): boolean {
  return Number(task.progress ?? 0) >= 100 || isCompletedKanbanPhase(phase);
}

export function isKanbanTaskOverdue(task: KanbanTaskLike, phase?: KanbanPhaseLike | null, now = new Date()): boolean {
  if (isKanbanTaskCompleted(task, phase) || !task.dueDate) return false;
  return new Date(task.dueDate) < now;
}
