import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { formatDashboardPeriodLabel } from "./DashboardPeriodBadge";

const dashboardSource = readFileSync(new URL("./Dashboard.tsx", import.meta.url), "utf8");
const badgeSource = readFileSync(new URL("./DashboardPeriodBadge.tsx", import.meta.url), "utf8");

describe("indicadores visuais do período do Dashboard", () => {
  it("formata presets e intervalos personalizados de forma legível", () => {
    expect(formatDashboardPeriodLabel("Todos os períodos")).toBe("Todos os períodos");
    expect(formatDashboardPeriodLabel("Este mês")).toBe("Este mês");
    expect(formatDashboardPeriodLabel("2026-08-01 → 2026-08-31")).toBe("01/08/2026 – 31/08/2026");
    expect(formatDashboardPeriodLabel("… → 2026-08-31")).toBe("… – 31/08/2026");
  });

  it("expõe o período ativo com semântica acessível e o usa nos títulos", () => {
    expect(badgeSource).toContain('data-dashboard-period-indicator="true"');
    expect(badgeSource).toContain("aria-label={`Período ativo: ${displayLabel}`}");
    expect(dashboardSource).toContain("const { label: globalPeriodLabel } = useGlobalPeriod();");
    expect(dashboardSource).toContain("whitespace-nowrap text-xl font-bold");
    expect(dashboardSource).toContain("periodLabel={globalPeriodLabel}");
    expect(dashboardSource).toContain('<span>Distribuição da Extensão</span>');
    expect(dashboardSource).toContain('<span>SLA / Pontualidade</span>');
    expect(dashboardSource).toContain('<span>Progresso por Cliente</span>');
  });
});
