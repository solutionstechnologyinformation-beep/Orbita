export type SegmentMapItem = {
  id: number;
  crsId: number;
  crsName?: string | null;
};

export function buildContractNumbers(segments: SegmentMapItem[]): Record<number, number> {
  const contracts = Array.from(new Map(segments.map((segment) => [segment.crsId, segment.crsName ?? `Contrato #${segment.crsId}`])).entries())
    .sort(([, a], [, b]) => a.localeCompare(b, "pt-BR"));
  return Object.fromEntries(contracts.map(([crsId], index) => [crsId, index + 1]));
}

export function filterVisibleSegments<T extends SegmentMapItem>(
  segments: T[],
  visibility: Record<number, boolean>,
  selectedSegmentId: number | "all",
): T[] {
  return segments.filter((segment) => visibility[segment.id] !== false && (selectedSegmentId === "all" || segment.id === selectedSegmentId));
}
