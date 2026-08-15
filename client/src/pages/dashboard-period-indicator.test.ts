import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { formatDashboardPeriodLabel, getDashboardPeriodDays, getDashboardPeriodDaysLabel } from "./DashboardPeriodBadge";

const dashboardSource = readFileSync(new URL("./Dashboard.tsx", import.meta.url), "utf8");
const badgeSource = readFileSync(new URL("./DashboardPeriodBadge.tsx", import.meta.url), "utf8");

describe("indicadores visuais do período do Dashboard", () => {
  it("formata presets e intervalos personalizados de forma legível", () => {
    expect(formatDashboardPeriodLabel("Todos os períodos")).toBe("Todos os períodos");
    expect(formatDashboardPeriodLabel("Este mês")).toBe("Este mês");
    expect(formatDashboardPeriodLabel("2026-08-01 → 2026-08-31")).toBe("01/08/2026 – 31/08/2026");
    expect(formatDashboardPeriodLabel("… → 2026-08-31")).toBe("… – 31/08/2026");
  });

  it("calcula a quantidade inclusiva de dias para intervalos completos e personalizados", () => {
    const range = { start: new Date(2026, 7, 1), end: new Date(2026, 7, 31, 23, 59, 59) };
    expect(getDashboardPeriodDays(range)).toBe(31);
    expect(getDashboardPeriodDaysLabel(range)).toBe("31 dias");
    expect(getDashboardPeriodDays({ start: null, end: null })).toBeNull();
    expect(getDashboardPeriodDaysLabel({ start: null, end: null })).toBe("Sem limite de dias");
    expect(getDashboardPeriodDaysLabel({ start: new Date(2026, 7, 1), end: null })).toBe("Defina as duas datas");
  });

  it("expõe o período ativo com tooltip, semântica acessível e atalho para o filtro", () => {
    expect(badgeSource).toContain('data-dashboard-period-indicator="true"');
    expect(badgeSource).toContain("aria-label={`Período ativo: ${displayLabel}. Clique para ver detalhes.`}");
    expect(badgeSource).toContain('getElementById("global-period-filter")');
    expect(badgeSource).toContain("focusGlobalPeriodFilter");
    expect(badgeSource).toContain("Alterar filtro global");
    expect(dashboardSource).toContain("const { label: globalPeriodLabel } = useGlobalPeriod();");
    expect(dashboardSource).toContain("whitespace-nowrap text-xl font-bold");
    expect(dashboardSource).toContain("periodLabel={globalPeriodLabel}");
    expect(dashboardSource).toContain('<span>Distribuição da Extensão</span>');
    expect(dashboardSource).toContain('<span>SLA / Pontualidade</span>');
    expect(dashboardSource).toContain('<span>Progresso por Cliente</span>');
  });
});
