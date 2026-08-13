export interface KanbanPhaseLike {
  name?: string | null;
  isTerminal?: boolean | null;
}

export function isCompletedKanbanPhase(phase?: KanbanPhaseLike | null): boolean {
  if (!phase) return false;
  return Boolean(
    phase.isTerminal || /concluíd|concluid|publicad|arquivad/i.test(phase.name ?? ""),
  );
}
