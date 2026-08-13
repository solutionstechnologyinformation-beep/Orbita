export function getSegmentExtensionKmValue(
  extensaoKm: number | null | undefined,
  techDataByType: string | null | undefined,
): number | null {
  if (typeof extensaoKm === "number" && Number.isFinite(extensaoKm)) return extensaoKm;
  try {
    const technical = JSON.parse(techDataByType ?? "{}");
    if (!technical || typeof technical !== "object") return null;
    const total = Object.values(technical as Record<string, { extensaoKm?: number | null }>).reduce(
      (sum, entry) => sum + (Number(entry?.extensaoKm) || 0),
      0,
    );
    return total > 0 ? total : null;
  } catch {
    return null;
  }
}
