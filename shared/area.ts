export type AreaRecord = {
  areaM2?: number | string | null;
  areaHa?: number | string | null;
  techDataByType?: string | Record<string, { areaM2?: number | string | null; areaHa?: number | string | null }> | null;
};

function finiteNonNegative(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

function parseTechnicalArea(value: AreaRecord["techDataByType"]) {
  if (!value) return [] as number[];
  let entries: Record<string, { areaM2?: number | string | null; areaHa?: number | string | null }>;
  if (typeof value === "string") {
    try {
      entries = JSON.parse(value);
    } catch {
      return [];
    }
  } else {
    entries = value;
  }
  return Object.values(entries ?? {})
    .map((entry) => finiteNonNegative(entry?.areaM2 ?? entry?.areaHa))
    .filter((area): area is number => area != null);
}

/**
 * Retorna a área em m² sem converter valores legados: o campo antigo areaHa
 * passou a representar o valor digitado no formulário de área total (m²).
 * Quando o total principal está vazio, usa a soma dos dados técnicos por tipo.
 */
export function getContractAreaM2(record: AreaRecord): number {
  const direct = finiteNonNegative(record.areaM2 ?? record.areaHa);
  if (direct != null && direct > 0) return direct;
  const technical = parseTechnicalArea(record.techDataByType);
  return technical.reduce((sum, area) => sum + area, 0);
}

export function sumContractAreasM2(records: AreaRecord[]): number {
  const total = records.reduce((sum, record) => sum + getContractAreaM2(record), 0);
  return Math.round(total * 100) / 100;
}

export function formatAreaM2(value: number | null | undefined): string {
  const numeric = finiteNonNegative(value);
  return `${(numeric ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} m²`;
}
