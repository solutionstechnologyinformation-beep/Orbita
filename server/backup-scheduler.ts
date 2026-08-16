import { eq } from "drizzle-orm";
import { backupSchedules, companies } from "../drizzle/schema";
import { getDb } from "./db";
import { getCompanyMigrationSnapshot, generateMigrationExcelBuffer } from "./migration-export";
import { storagePut } from "./storage";

export const WEEKLY_BACKUP_PATH = "/api/scheduled/weekly-backup";

export function buildWeeklyBackupCron(dayOfWeek: number, hourUtc: number, minuteUtc: number): string {
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) throw new Error("Dia da semana inválido.");
  if (!Number.isInteger(hourUtc) || hourUtc < 0 || hourUtc > 23) throw new Error("Hora UTC inválida.");
  if (!Number.isInteger(minuteUtc) || minuteUtc < 0 || minuteUtc > 59) throw new Error("Minuto UTC inválido.");
  return `0 ${minuteUtc} ${hourUtc} * * ${dayOfWeek}`;
}

export function calculateNextWeeklyBackup(dayOfWeek: number, hourUtc: number, minuteUtc: number, now = new Date()): Date {
  const next = new Date(now);
  next.setUTCSeconds(0, 0);
  next.setUTCHours(hourUtc, minuteUtc, 0, 0);
  const daysAhead = (dayOfWeek - next.getUTCDay() + 7) % 7;
  if (daysAhead === 0 && next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 7);
  else next.setUTCDate(next.getUTCDate() + daysAhead);
  return next;
}

export async function executeScheduledBackupForTask(taskUid: string) {
  const db = await getDb();
  const schedule = (await db.select().from(backupSchedules).where(eq(backupSchedules.scheduleCronTaskUid, taskUid)).limit(1))[0];
  if (!schedule || !schedule.isEnabled) return { success: true, skipped: true, reason: "schedule-disabled-or-orphaned" } as const;

  const company = (await db.select().from(companies).where(eq(companies.id, schedule.companyId)).limit(1))[0];
  if (!company) return { success: true, skipped: true, reason: "company-not-found" } as const;

  // Heartbeat retries 5xx/429 calls. Reuse the last artifact during the retry window.
  if (schedule.lastExecutedAt && schedule.lastBackupUrl && Date.now() - new Date(schedule.lastExecutedAt).getTime() < 10 * 60 * 1000) {
    return { success: true, skipped: true, reason: "idempotent-retry", companyId: schedule.companyId, fileUrl: schedule.lastBackupUrl } as const;
  }

  const snapshot = await getCompanyMigrationSnapshot(schedule.companyId);
  const excelBuffer = generateMigrationExcelBuffer(snapshot);
  const fileKey = `backups/company-${schedule.companyId}/weekly-${new Date().toISOString().replace(/[:.]/g, "-")}.xlsx`;
  const { url } = await storagePut(fileKey, excelBuffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  const nextExecutionAt = calculateNextWeeklyBackup(schedule.dayOfWeek, schedule.hourUtc, schedule.minuteUtc);

  await db.update(backupSchedules).set({
    lastExecutedAt: new Date(),
    nextExecutionAt,
    lastBackupUrl: url,
    lastBackupKey: fileKey,
  }).where(eq(backupSchedules.id, schedule.id));

  return {
    success: true,
    skipped: false,
    companyId: schedule.companyId,
    companyName: company.name,
    fileUrl: url,
    fileKey,
    executedAt: new Date().toISOString(),
    nextExecutionAt: nextExecutionAt.toISOString(),
  } as const;
}
