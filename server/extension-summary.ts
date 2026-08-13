export type ExtensionSummaryRow = {
  tipoObra?: string | null;
  extensaoKm?: number | null;
  techDataByType?: string | null;
};

export type ExtensionSummary = {
  totalExtensaoKm: number;
  extensaoByTipo: Record<string, number>;
};

function parseTypes(raw: string | null | undefined) {
  if (!raw) return [] as string[];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((value): value is string => typeof value === "string");
    return typeof parsed === "string" ? [parsed] : [];
  } catch {
    return [raw];
  }
}

export function aggregateExtensionByType(rows: ExtensionSummaryRow[]): ExtensionSummary {
  const extensaoByTipo: Record<string, number> = {};
  let totalExtensaoKm = 0;

  for (const row of rows) {
    let techData: Record<string, { extensaoKm?: number | null }> = {};
    try {
      const parsed = row.techDataByType ? JSON.parse(row.techDataByType) : {};
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) techData = parsed;
    } catch {
      techData = {};
    }

    const detailedEntries = Object.entries(techData)
      .map(([key, value]) => ({ key, km: Number(value?.extensaoKm ?? 0) }))
      .filter((entry) => Number.isFinite(entry.km) && entry.km > 0);

    if (detailedEntries.length > 0) {
      for (const entry of detailedEntries) {
        extensaoByTipo[entry.key] = (extensaoByTipo[entry.key] ?? 0) + entry.km;
        totalExtensaoKm += entry.km;
      }
      continue;
    }

    const legacyKm = Number(row.extensaoKm ?? 0);
    if (!Number.isFinite(legacyKm) || legacyKm <= 0) continue;
    const types = parseTypes(row.tipoObra);
    const normalizedTypes = types.length > 0 ? types : ["outro"];
    const kmPerType = legacyKm / normalizedTypes.length;
    for (const type of normalizedTypes) extensaoByTipo[type] = (extensaoByTipo[type] ?? 0) + kmPerType;
    totalExtensaoKm += legacyKm;
  }

  return {
    totalExtensaoKm: Math.round(totalExtensaoKm * 100) / 100,
    extensaoByTipo: Object.fromEntries(
      Object.entries(extensaoByTipo).map(([key, value]) => [key, Math.round(value * 100) / 100]),
    ),
  };
}
