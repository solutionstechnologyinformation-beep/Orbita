import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { formatTrendDescription, getTrendPresentation } from "./dashboard-trend-utils";

const indicatorSource = readFileSync(new URL("./DashboardTrendIndicator.tsx", import.meta.url), "utf8");

describe("dashboard trend utilities", () => {
  it("marks a positive comparison as an upward positive trend", () => {
    expect(getTrendPresentation(12)).toEqual({ direction: "up", tone: "positive", label: "+12" });
    expect(formatTrendDescription(12, "%", "mês anterior")).toBe("+12% em relação a mês anterior.");
  });

  it("inverts the tone when a decrease is the desired outcome", () => {
    expect(getTrendPresentation(-3, false)).toEqual({ direction: "down", tone: "positive", label: "-3" });
  });

  it("reveals the floating tooltip and period selector on hover and keyboard focus", () => {
    expect(indicatorSource).toContain("group-hover:opacity-100");
    expect(indicatorSource).toContain("group-focus-visible:opacity-100");
    expect(indicatorSource).toContain('role="tooltip"');
    expect(indicatorSource).toContain('aria-label="Período de comparação das tendências"');
    expect(indicatorSource).toContain("TREND_COMPARISON_PERIODS.map");
  });

  it("uses a neutral presentation when no comparison is available", () => {
    expect(getTrendPresentation(null)).toEqual({ direction: "neutral", tone: "neutral", label: "—" });
    expect(formatTrendDescription(undefined, "%", "período anterior")).toBe("Sem comparação disponível para período anterior.");
    expect(formatTrendDescription(0, "pp", "mês anterior")).toBe("Sem alteração em relação a mês anterior.");
  });
});
