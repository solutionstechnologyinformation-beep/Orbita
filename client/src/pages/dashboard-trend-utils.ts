export type TrendDirection = "up" | "down" | "neutral";
export type TrendTone = "positive" | "negative" | "neutral";

export type TrendPresentation = {
  direction: TrendDirection;
  tone: TrendTone;
  label: string;
};

export function getTrendPresentation(value: number | null | undefined, positiveWhenUp = true): TrendPresentation {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return { direction: "neutral", tone: "neutral", label: "—" };
  }
  if (value === 0) {
    return { direction: "neutral", tone: "neutral", label: "0" };
  }

  const direction: TrendDirection = value > 0 ? "up" : "down";
  const isPositive = positiveWhenUp ? direction === "up" : direction === "down";
  return {
    direction,
    tone: isPositive ? "positive" : "negative",
    label: `${value > 0 ? "+" : ""}${value}`,
  };
}

export function formatTrendDescription(value: number | null | undefined, suffix: string, period: string) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return `Sem comparação disponível para ${period.toLowerCase()}.`;
  }
  if (value === 0) return `Sem alteração em relação a ${period.toLowerCase()}.`;
  return `${value > 0 ? "+" : ""}${value}${suffix} em relação a ${period.toLowerCase()}.`;
}
