export function getKanbanPhaseDisplayName(name: string | null | undefined): string {
  const normalized = name?.trim() ?? "";
  return /arquivad/i.test(normalized) ? "Concluído" : normalized;
}
