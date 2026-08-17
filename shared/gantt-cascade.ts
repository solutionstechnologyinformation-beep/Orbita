export type CascadeDateValue = Date | string | null | undefined;

export type CascadeTask = {
  id: number;
  startDate?: CascadeDateValue;
  endDate?: CascadeDateValue;
  dueDate?: CascadeDateValue;
};

export type CascadeDependency = {
  predecessorTaskId: number;
  successorTaskId: number;
  dependencyType?: "finish_to_start" | "start_to_start" | "finish_to_finish" | "start_to_finish" | string;
};

export type CascadeTaskUpdate = {
  id: number;
  startDate: Date;
  endDate: Date;
  dueDate?: Date;
};

const DAY_MS = 86_400_000;

function asCalendarDate(value: CascadeDateValue) {
  if (value == null) return null;
  const source = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(source.getTime())) return null;
  return new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth(), source.getUTCDate()));
}

function addDays(date: Date, amount: number) {
  return new Date(date.getTime() + amount * DAY_MS);
}

function sameDay(left: Date, right: Date) {
  return left.getTime() === right.getTime();
}

function maxDate(left: Date, right: Date) {
  return left.getTime() >= right.getTime() ? left : right;
}

function durationDays(task: CascadeTask) {
  const start = asCalendarDate(task.startDate) ?? asCalendarDate(task.endDate) ?? asCalendarDate(task.dueDate);
  const end = asCalendarDate(task.endDate) ?? asCalendarDate(task.dueDate) ?? start;
  if (!start || !end) return 1;
  return Math.max(1, Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1);
}

function ensureAcyclic(taskIds: Set<number>, dependencies: CascadeDependency[]) {
  const outgoing = new Map<number, number[]>();
  const indegree = new Map<number, number>();
  for (const id of Array.from(taskIds)) indegree.set(id, 0);
  for (const dependency of dependencies) {
    if (!taskIds.has(dependency.predecessorTaskId) || !taskIds.has(dependency.successorTaskId)) continue;
    const successors = outgoing.get(dependency.predecessorTaskId) ?? [];
    if (successors.includes(dependency.successorTaskId)) continue;
    successors.push(dependency.successorTaskId);
    outgoing.set(dependency.predecessorTaskId, successors);
    indegree.set(dependency.successorTaskId, (indegree.get(dependency.successorTaskId) ?? 0) + 1);
  }
  const queue = Array.from(indegree.entries()).filter(([, degree]) => degree === 0).map(([id]) => id);
  let visited = 0;
  while (queue.length > 0) {
    const id = queue.shift()!;
    visited += 1;
    for (const successor of outgoing.get(id) ?? []) {
      const nextDegree = (indegree.get(successor) ?? 0) - 1;
      indegree.set(successor, nextDegree);
      if (nextDegree === 0) queue.push(successor);
    }
  }
  if (visited !== taskIds.size) throw new Error("Não foi possível propagar prazos porque existe um ciclo de dependências.");
}

function topologicalOrder(taskIds: Set<number>, dependencies: CascadeDependency[]) {
  const outgoing = new Map<number, number[]>();
  const indegree = new Map<number, number>();
  for (const id of Array.from(taskIds)) indegree.set(id, 0);
  for (const dependency of dependencies) {
    if (!taskIds.has(dependency.predecessorTaskId) || !taskIds.has(dependency.successorTaskId)) continue;
    const successors = outgoing.get(dependency.predecessorTaskId) ?? [];
    if (successors.includes(dependency.successorTaskId)) continue;
    successors.push(dependency.successorTaskId);
    outgoing.set(dependency.predecessorTaskId, successors);
    indegree.set(dependency.successorTaskId, (indegree.get(dependency.successorTaskId) ?? 0) + 1);
  }
  const queue = Array.from(indegree.entries()).filter(([, degree]) => degree === 0).map(([id]) => id);
  const order: number[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const successor of outgoing.get(id) ?? []) {
      const nextDegree = (indegree.get(successor) ?? 0) - 1;
      indegree.set(successor, nextDegree);
      if (nextDegree === 0) queue.push(successor);
    }
  }
  return order;
}

/** Calculates forward and backward successor date updates while preserving duration. */
export function propagateTaskDates(
  tasks: CascadeTask[],
  dependencies: CascadeDependency[],
  rootTaskId: number,
  rootStartDate: Date,
  rootEndDate: Date,
) {
  if (rootEndDate < rootStartDate) throw new Error("A data final não pode ser anterior à data inicial.");
  const root = tasks.find((task) => task.id === rootTaskId);
  if (!root) throw new Error("Tarefa predecessora não encontrada.");

  const taskIds = new Set(tasks.map((task) => task.id));
  ensureAcyclic(taskIds, dependencies);
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const incoming = new Map<number, CascadeDependency[]>();
  const outgoing = new Map<number, number[]>();
  for (const dependency of dependencies) {
    if (!taskIds.has(dependency.predecessorTaskId) || !taskIds.has(dependency.successorTaskId)) continue;
    const targetDependencies = incoming.get(dependency.successorTaskId) ?? [];
    targetDependencies.push(dependency);
    incoming.set(dependency.successorTaskId, targetDependencies);
    const successors = outgoing.get(dependency.predecessorTaskId) ?? [];
    if (!successors.includes(dependency.successorTaskId)) successors.push(dependency.successorTaskId);
    outgoing.set(dependency.predecessorTaskId, successors);
  }

  const schedules = new Map<number, { start: Date; end: Date; dueDate: Date | null; preserveDueDate: boolean }>();
  for (const task of tasks) {
    const start = asCalendarDate(task.startDate) ?? asCalendarDate(task.endDate) ?? asCalendarDate(task.dueDate);
    const end = asCalendarDate(task.endDate) ?? asCalendarDate(task.dueDate) ?? start;
    if (start && end) schedules.set(task.id, { start, end: end < start ? start : end, dueDate: asCalendarDate(task.dueDate), preserveDueDate: task.dueDate != null });
  }
  const normalizedRootStart = asCalendarDate(rootStartDate)!;
  const normalizedRootEnd = asCalendarDate(rootEndDate)!;
  const rootExisting = schedules.get(rootTaskId);
  schedules.set(rootTaskId, { start: normalizedRootStart, end: normalizedRootEnd, dueDate: rootExisting?.preserveDueDate ? normalizedRootEnd : null, preserveDueDate: rootExisting?.preserveDueDate ?? false });

  const reachable = new Set<number>([rootTaskId]);
  const traversal = [rootTaskId];
  while (traversal.length > 0) {
    const predecessorId = traversal.shift()!;
    for (const successorId of outgoing.get(predecessorId) ?? []) {
      if (!reachable.has(successorId)) {
        reachable.add(successorId);
        traversal.push(successorId);
      }
    }
  }

  for (const taskId of topologicalOrder(taskIds, dependencies)) {
    if (taskId === rootTaskId || !reachable.has(taskId)) continue;
    const predecessorSchedules = (incoming.get(taskId) ?? [])
      .filter((dependency) => reachable.has(dependency.predecessorTaskId))
      .map((dependency) => ({ dependency, schedule: schedules.get(dependency.predecessorTaskId) }))
      .filter((entry): entry is { dependency: CascadeDependency; schedule: { start: Date; end: Date; dueDate: Date | null; preserveDueDate: boolean } } => Boolean(entry.schedule));
    if (predecessorSchedules.length === 0) continue;

    const task = taskById.get(taskId)!;
    const duration = durationDays(task);
    let requiredStart: Date | null = null;
    let requiredEnd: Date | null = null;
    for (const { dependency, schedule } of predecessorSchedules) {
      let candidateStart: Date;
      if (dependency.dependencyType === "start_to_start") candidateStart = schedule.start;
      else if (dependency.dependencyType === "finish_to_finish" || dependency.dependencyType === "start_to_finish") candidateStart = addDays(dependency.dependencyType === "finish_to_finish" ? schedule.end : schedule.start, -(duration - 1));
      else candidateStart = addDays(schedule.end, 1);
      requiredStart = requiredStart ? maxDate(requiredStart, candidateStart) : candidateStart;
      requiredEnd = addDays(requiredStart, duration - 1);
    }
    if (requiredStart && requiredEnd) {
      const existing = schedules.get(taskId);
      const safeStart = existing ? maxDate(existing.start, requiredStart) : requiredStart;
      const safeEnd = addDays(safeStart, duration - 1);
      schedules.set(taskId, {
        start: safeStart,
        end: safeEnd,
        dueDate: existing?.preserveDueDate ? safeEnd : null,
        preserveDueDate: existing?.preserveDueDate ?? false,
      });
    }
  }

  const updates: CascadeTaskUpdate[] = [];
  for (const task of tasks) {
    if (!reachable.has(task.id)) continue;
    const schedule = schedules.get(task.id);
    if (!schedule) continue;
    const originalStart = asCalendarDate(task.startDate) ?? asCalendarDate(task.endDate) ?? asCalendarDate(task.dueDate);
    const originalEnd = asCalendarDate(task.endDate) ?? asCalendarDate(task.dueDate) ?? originalStart;
    if (task.id === rootTaskId || !originalStart || !originalEnd || !sameDay(schedule.start, originalStart) || !sameDay(schedule.end, originalEnd)) {
      updates.push({ id: task.id, startDate: schedule.start, endDate: schedule.end, ...(schedule.preserveDueDate ? { dueDate: schedule.dueDate ?? schedule.end } : {}) });
    }
  }
  return updates;
}
