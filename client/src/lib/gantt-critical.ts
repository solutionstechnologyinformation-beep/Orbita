export type CriticalTaskInput = {
  id: number;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  durationDays?: number | null;
  dependencies?: Array<{ predecessorTaskId: number; successorTaskId: number }>;
};

function toDate(value: Date | string | null | undefined) {
  if (value == null) return null;
  const date = value instanceof Date ? new Date(value) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function durationOf(task: CriticalTaskInput) {
  if (task.durationDays != null && Number.isFinite(task.durationDays)) return Math.max(1, Math.round(task.durationDays));
  const start = toDate(task.startDate);
  const end = toDate(task.endDate) ?? start;
  if (!start || !end) return 1;
  return Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1);
}

/** Returns the IDs in the longest acyclic predecessor -> successor chain. */
export function getCriticalTaskIds(tasks: CriticalTaskInput[]) {
  const taskIds = new Set(tasks.map((task) => task.id));
  const outgoing = new Map<number, number[]>();
  for (const task of tasks) {
    for (const dependency of task.dependencies ?? []) {
      if (!taskIds.has(dependency.predecessorTaskId) || !taskIds.has(dependency.successorTaskId)) continue;
      const successors = outgoing.get(dependency.predecessorTaskId) ?? [];
      if (!successors.includes(dependency.successorTaskId)) successors.push(dependency.successorTaskId);
      outgoing.set(dependency.predecessorTaskId, successors);
    }
  }

  const graphTaskIds = new Set<number>([
    ...Array.from(outgoing.keys()),
    ...Array.from(outgoing.values()).flat(),
  ]);
  if (graphTaskIds.size === 0) return new Set<number>();

  const memo = new Map<number, { score: number; path: number[] }>();
  const visiting = new Set<number>();
  function longestFrom(id: number): { score: number; path: number[] } {
    const cached = memo.get(id);
    if (cached) return cached;
    if (visiting.has(id)) return { score: 0, path: [] };
    visiting.add(id);
    let best = { score: 0, path: [] as number[] };
    for (const successorId of outgoing.get(id) ?? []) {
      const candidate = longestFrom(successorId);
      if (candidate.score > best.score) best = candidate;
    }
    visiting.delete(id);
    const result = { score: durationOf(tasks.find((task) => task.id === id)!) + best.score, path: [id, ...best.path] };
    memo.set(id, result);
    return result;
  }

  let longest = { score: 0, path: [] as number[] };
  for (const task of tasks) {
    if (!graphTaskIds.has(task.id)) continue;
    const candidate = longestFrom(task.id);
    if (candidate.score > longest.score) longest = candidate;
  }
  return new Set(longest.path);
}
