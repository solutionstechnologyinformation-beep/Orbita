import { describe, expect, it } from "vitest";
import { buildWeeklyBackupCron, calculateNextWeeklyBackup } from "./backup-scheduler";

describe("weekly backup scheduler", () => {
  it("builds a six-field UTC cron expression", () => {
    expect(buildWeeklyBackupCron(1, 9, 30)).toBe("0 30 9 * * 1");
  });

  it("rejects invalid weekly schedule values", () => {
    expect(() => buildWeeklyBackupCron(7, 9, 0)).toThrow("Dia da semana inválido");
    expect(() => buildWeeklyBackupCron(1, 24, 0)).toThrow("Hora UTC inválida");
    expect(() => buildWeeklyBackupCron(1, 9, 60)).toThrow("Minuto UTC inválido");
  });

  it("calculates the next occurrence in UTC and skips the current occurrence after it has passed", () => {
    const now = new Date("2026-08-17T10:00:00.000Z"); // Monday
    expect(calculateNextWeeklyBackup(1, 9, 30, now).toISOString()).toBe("2026-08-24T09:30:00.000Z");
    expect(calculateNextWeeklyBackup(3, 9, 30, now).toISOString()).toBe("2026-08-19T09:30:00.000Z");
  });
});
