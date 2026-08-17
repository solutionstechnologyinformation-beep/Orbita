import { describe, expect, it } from "vitest";
import {
  formatGanttExactDate,
  formatGanttWeekLabel,
  getGanttDurationDays,
  getGanttWeekStart,
} from "./gantt-time";

describe("gantt-time", () => {
  it("alinha a semana na segunda-feira", () => {
    const sunday = new Date(2025, 7, 17);
    const monday = getGanttWeekStart(sunday);
    expect(monday.getDay()).toBe(1);
    expect(monday.getDate()).toBe(11);
  });

  it("calcula a duração de forma inclusiva", () => {
    expect(getGanttDurationDays("2025-08-11", "2025-08-17")).toBe(7);
    expect(getGanttDurationDays("2025-08-11", "2025-08-11")).toBe(1);
    expect(getGanttDurationDays(null, "2025-08-11")).toBe(0);
  });

  it("formata datas exatas para o tooltip", () => {
    expect(formatGanttExactDate("2025-08-11")).toMatch(/11\/08\/2025/);
    expect(formatGanttExactDate(null)).toBe("Sem data");
  });

  it("gera o intervalo visual da semana", () => {
    expect(formatGanttWeekLabel(new Date(2025, 7, 11), new Date(2025, 7, 17))).toMatch(/11.*17/);
  });
});
