import { and, eq, or, isNull, ne } from "drizzle-orm";
import { ganttDigestSchedules, companies } from "../drizzle/schema";
import { buildGanttDigestWindow } from "../shared/gantt-digest";
import { getDb, getGanttChangeLogs, getProjectMembers } from "./db";
import { selectGanttManagerIds } from "../shared/gantt-history-notifications";
import { sendGanttDigestEmail } from "./gantt-digest-email";

export async function executeScheduledGanttDigestForTask(taskUid: string) {
  const db = await getDb();
  const schedule = (await db.select().from(ganttDigestSchedules).where(eq(ganttDigestSchedules.scheduleCronTaskUid, taskUid)).limit(1))[0];
  if (!schedule || !schedule.isEnabled) return { success: true, skipped: true, reason: "schedule-disabled-or-orphaned" } as const;

  const company = (await db.select().from(companies).where(eq(companies.id, schedule.companyId)).limit(1))[0];
  if (!company) return { success: true, skipped: true, reason: "company-not-found" } as const;

  const window = buildGanttDigestWindow();
  const entries = await getGanttChangeLogs({ companyId: schedule.companyId, fromDate: window.start, toDate: window.end, limit: 500 });
  const members = await getProjectMembers(schedule.companyId);
  const recipientIds = selectGanttManagerIds(members, -1);
  const recipients = members.filter((member: any) => recipientIds.includes(member.id) && member.email).map((member: any) => String(member.email));

  if (entries.length === 0) {
    await db.update(ganttDigestSchedules).set({ lastExecutedAt: new Date(), lastDigestKey: window.key }).where(eq(ganttDigestSchedules.id, schedule.id));
    return { success: true, skipped: true, reason: "no-changes", companyId: schedule.companyId, window: window.key } as const;
  }

  const claim = await db.update(ganttDigestSchedules)
    .set({ lastDigestKey: window.key, lastExecutedAt: new Date() })
    .where(and(eq(ganttDigestSchedules.id, schedule.id), or(isNull(ganttDigestSchedules.lastDigestKey), ne(ganttDigestSchedules.lastDigestKey, window.key))));
  const affectedRows = Number((claim as any)?.[0]?.affectedRows ?? (claim as any)?.affectedRows ?? 0);
  if (affectedRows === 0) return { success: true, skipped: true, reason: "idempotent-retry", companyId: schedule.companyId, window: window.key } as const;

  const result = await sendGanttDigestEmail({
    recipients,
    companyName: company.name,
    windowLabel: `${window.start.toLocaleDateString("pt-BR", { timeZone: "UTC" })} a ${window.end.toLocaleDateString("pt-BR", { timeZone: "UTC" })}`,
    entries,
  });
  if (result.sent === 0 && recipients.length > 0) {
    await db.update(ganttDigestSchedules).set({ lastDigestKey: null }).where(eq(ganttDigestSchedules.id, schedule.id));
  }
  return { success: true, skipped: false, companyId: schedule.companyId, window: window.key, changes: entries.length, recipients: recipients.length, sent: result.sent, emailError: "error" in result ? result.error : undefined } as const;
}
