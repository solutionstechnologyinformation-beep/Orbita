export function getKanbanPhaseDropId(phaseId: number): string {
  return `phase-${phaseId}`;
}

export function parseKanbanPhaseDropId(dropId: string | number): number | null {
  if (typeof dropId !== "string" || !dropId.startsWith("phase-")) return null;
  const phaseId = Number(dropId.slice("phase-".length));
  return Number.isInteger(phaseId) && phaseId > 0 ? phaseId : null;
}
