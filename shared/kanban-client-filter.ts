export interface KanbanClientOption {
  id: number;
  name: string;
  color?: string | null;
}

export function getKanbanClientOptions(crsItems: Array<{ clientId?: number | null; clientName?: string | null; clientColor?: string | null }>): KanbanClientOption[] {
  const unique = new Map<number, KanbanClientOption>();
  for (const crs of crsItems) {
    if (crs.clientId != null && crs.clientName && !unique.has(crs.clientId)) {
      unique.set(crs.clientId, { id: crs.clientId, name: crs.clientName, color: crs.clientColor });
    }
  }
  return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export function filterKanbanCrsByClient<T extends { clientId?: number | null }>(crsItems: T[], clientId: string): T[] {
  return clientId === "all" ? crsItems : crsItems.filter((crs) => String(crs.clientId) === clientId);
}
