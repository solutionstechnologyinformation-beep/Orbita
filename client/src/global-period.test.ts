import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dateRangeOverlapsGlobalPeriod, getGlobalPeriodRange, isDateInGlobalPeriod } from "./contexts/GlobalPeriodContext";

const appLayoutSource = readFileSync(new URL("./components/AppLayout.tsx", import.meta.url), "utf8");
const pageSources = ["CalendarPage.tsx", "Scheduling.tsx", "Projects.tsx", "Sprints.tsx", "Reports.tsx", "Notifications.tsx"].map((file) => readFileSync(new URL(`./pages/${file}`, import.meta.url), "utf8"));

describe("filtro global por período", () => {
  const reference = new Date(2026, 7, 14, 12, 0, 0);

  it("calcula presets mensais, trimestrais, anuais e próximos 30 dias", () => {
    const month = getGlobalPeriodRange("this-month", "", "", reference);
    expect(month.start?.getDate()).toBe(1);
    expect(month.start?.getMonth()).toBe(7);
    expect(month.end?.getDate()).toBe(31);

    const quarter = getGlobalPeriodRange("this-quarter", "", "", reference);
    expect(quarter.start?.getMonth()).toBe(6);
    expect(quarter.end?.getMonth()).toBe(8);

    const year = getGlobalPeriodRange("this-year", "", "", reference);
    expect(year.start?.getFullYear()).toBe(2026);
    expect(year.end?.getMonth()).toBe(11);

    const next = getGlobalPeriodRange("next-30-days", "", "", reference);
    expect(next.start?.getDate()).toBe(14);
    expect(next.end?.getDate()).toBe(13);
  });

  it("trata período personalizado, intervalo total e sobreposição de datas", () => {
    const custom = getGlobalPeriodRange("custom", "2026-08-10", "2026-08-20");
    expect(isDateInGlobalPeriod("2026-08-15T12:00:00", custom)).toBe(true);
    expect(isDateInGlobalPeriod("2026-08-21T12:00:00", custom)).toBe(false);
    expect(dateRangeOverlapsGlobalPeriod("2026-08-19", "2026-08-25", custom)).toBe(true);
    expect(dateRangeOverlapsGlobalPeriod("2026-08-01", "2026-08-09", custom)).toBe(false);
    expect(dateRangeOverlapsGlobalPeriod(null, null, custom)).toBe(false);

    const all = getGlobalPeriodRange("all", "", "", reference);
    expect(isDateInGlobalPeriod("1900-01-01", all)).toBe(true);
    expect(dateRangeOverlapsGlobalPeriod(null, null, all)).toBe(true);
  });

  it("expõe o seletor no cabeçalho e aplica o contexto às seis abas", () => {
    expect(appLayoutSource).toContain("GlobalPeriodControl");
    expect(appLayoutSource).toContain('"/dashboard", "/projects", "/sprints", "/scheduling", "/calendar", "/relatorios", "/notifications"');
    expect(pageSources.every((source) => source.includes("useGlobalPeriod"))).toBe(true);
    expect(pageSources.every((source) => source.includes("globalPeriodRange"))).toBe(true);
  });

  it("mantém controles e seleções sincronizados quando o período global muda", () => {
    expect(appLayoutSource).toContain("title || backHref || showGlobalPeriod");
    expect(appLayoutSource).toContain("!title && !backHref && !showGlobalPeriod");

    const reportsSource = pageSources.find((source) => source.includes("periodFilteredProjects"));
    const sprintsSource = pageSources.find((source) => source.includes("visibleSelectedSprint"));

    expect(reportsSource).toBeDefined();
    expect(reportsSource).toContain("visibleSprintIds");
    expect(reportsSource).toContain("periodFilteredProjects.map");
    expect(reportsSource).toContain("setSelectedProjectForMembers(\"none\")");
    expect(sprintsSource).toBeDefined();
    expect(sprintsSource).toContain("!selectedSprintId || !visibleSelectedSprint");
  });
});
