import { addGanttDays, ganttDayDistance } from "./gantt-time";

export type GanttDateEditMode = "move" | "resize-start" | "resize-end";

export function calculateDateEditRange(
  initialStart: Date,
  initialEnd: Date,
  pointerStartDate: Date,
  pointerDate: Date,
  mode: GanttDateEditMode,
) {
  if (mode === "move") {
    const delta = ganttDayDistance(pointerStartDate, pointerDate);
    return {
      start: addGanttDays(initialStart, delta),
      end: addGanttDays(initialEnd, delta),
    };
  }
  if (mode === "resize-start") {
    return { start: pointerDate > initialEnd ? initialEnd : pointerDate, end: initialEnd };
  }
  return { start: initialStart, end: pointerDate < initialStart ? initialStart : pointerDate };
}

export type GanttDependencyDirection = "successor" | "predecessor";

export function resolveDependencyPair(sourceTaskId: number, targetTaskId: number, direction: GanttDependencyDirection) {
  return direction === "predecessor"
    ? { predecessorTaskId: targetTaskId, successorTaskId: sourceTaskId }
    : { predecessorTaskId: sourceTaskId, successorTaskId: targetTaskId };
}

export function canCreateDependency(predecessorTaskId: number, successorTaskId: number | null | undefined) {
  return Number.isInteger(successorTaskId) && predecessorTaskId !== successorTaskId;
}
