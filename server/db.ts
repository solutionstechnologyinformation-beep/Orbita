import { eq, and, desc, like, inArray, sql, asc } from "drizzle-orm";
import {
  users, clients, crs, kanbanPhases, tasks, checklistItems,
  checklistItemComments, checklistItemHistory, taskComments,
  taskPhaseHistory, vacationPeriods, notifications, activityLogs,
  disciplines, sprints, sprintTasks, agendaEvents, chatMessages,
  conversations, conversationParticipants, directMessages,
  sprintChecklistItems,
} from "../drizzle/schema";

// ─── DB Connection ─────────────────────────────────────────────────────────────
let _db: any = null;
export async function getDb() {
  if (_db) return _db;
  const { drizzle } = await import("drizzle-orm/mysql2");
  const mysql = await import("mysql2/promise");
  const pool = mysql.createPool({ uri: process.env.DATABASE_URL, waitForConnections: true, connectionLimit: 10 });
  _db = drizzle(pool);
  return _db;
}

// ─── Users ─────────────────────────────────────────────────────────────────────
export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  const r = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return r[0];
}
export async function createUser(data: { openId: string; name?: string; email?: string; loginMethod?: string; avatarUrl?: string }) {
  const db = await getDb();
  const [result] = await db.execute(
    sql`INSERT INTO users (openId, name, email, loginMethod, avatarUrl, role, createdAt, updatedAt, lastSignedIn, lastSeenAt)
        VALUES (${data.openId}, ${data.name ?? null}, ${data.email ?? null}, ${data.loginMethod ?? null}, ${data.avatarUrl ?? null}, 'user', NOW(), NOW(), NOW(), NOW())`
  );
  return (result as any).insertId as number;
}
export async function upsertUser(data: { openId: string; name?: string | null; email?: string | null; loginMethod?: string | null; lastSignedIn?: Date }) {
  const db = await getDb();
  const existing = await getUserByOpenId(data.openId);
  if (existing) {
    await db.update(users).set({ ...data, updatedAt: new Date() }).where(eq(users.openId, data.openId));
  } else {
    await db.insert(users).values({ openId: data.openId, name: data.name ?? null, email: data.email ?? null, loginMethod: data.loginMethod ?? null, lastSignedIn: data.lastSignedIn ?? new Date() });
  }
}
export async function updateUser(id: number, data: Partial<typeof users.$inferInsert>) {
  const db = await getDb();
  await db.update(users).set({ ...data, updatedAt: new Date() }).where(eq(users.id, id));
}
export async function getAllUsers() {
  const db = await getDb();
  return db.select({ id: users.id, name: users.name, email: users.email, role: users.role, avatarUrl: users.avatarUrl, createdAt: users.createdAt }).from(users).orderBy(asc(users.name));
}

// ─── Clients ───────────────────────────────────────────────────────────────────
export async function getClients() {
  const db = await getDb();
  return db.select().from(clients).where(eq(clients.status, "active")).orderBy(asc(clients.name));
}
export async function getAllClients() {
  const db = await getDb();
  return db.select().from(clients).orderBy(asc(clients.name));
}
export async function getClientById(id: number) {
  const db = await getDb();
  const r = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return r[0];
}
export async function createClient(data: { name: string; description?: string; color?: string; createdById: number }) {
  const db = await getDb();
  const [result] = await db.execute(
    sql`INSERT INTO clients (name, description, color, status, createdById, createdAt, updatedAt)
        VALUES (${data.name}, ${data.description ?? null}, ${data.color ?? '#1561ad'}, 'active', ${data.createdById}, NOW(), NOW())`
  );
  return (result as any).insertId as number;
}
export async function updateClient(id: number, data: Partial<typeof clients.$inferInsert>) {
  const db = await getDb();
  await db.update(clients).set({ ...data, updatedAt: new Date() }).where(eq(clients.id, id));
}
export async function deleteClient(id: number) {
  const db = await getDb();
  await db.update(clients).set({ status: "archived", updatedAt: new Date() }).where(eq(clients.id, id));
}

// ─── CRS ───────────────────────────────────────────────────────────────────────
export async function getCrsByClient(clientId: number) {
  const db = await getDb();
  return db.select().from(crs).where(and(eq(crs.clientId, clientId), eq(crs.status, "active"))).orderBy(asc(crs.name));
}
export async function getAllCrs() {
  const db = await getDb();
  return db.select({
    id: crs.id, clientId: crs.clientId, name: crs.name, code: crs.code,
    description: crs.description, country: crs.country, countryCode: crs.countryCode,
    state: crs.state, stateCode: crs.stateCode, status: crs.status, progress: crs.progress,
    tipoObra: crs.tipoObra, extensaoKm: crs.extensaoKm, areaHa: crs.areaHa, perimetroUrbano: crs.perimetroUrbano,
    createdById: crs.createdById, createdAt: crs.createdAt, updatedAt: crs.updatedAt,
    clientName: clients.name, clientColor: clients.color,
  }).from(crs).leftJoin(clients, eq(crs.clientId, clients.id)).where(eq(crs.status, 'active')).orderBy(asc(crs.name));
}
export async function getArchivedCrs() {
  const db = await getDb();
  return db.select({
    id: crs.id, clientId: crs.clientId, name: crs.name, code: crs.code,
    description: crs.description, country: crs.country, status: crs.status,
    clientName: clients.name, clientColor: clients.color,
  }).from(crs).leftJoin(clients, eq(crs.clientId, clients.id)).where(eq(crs.status, 'archived')).orderBy(asc(crs.name));
}
export async function getCrsById(id: number) {
  const db = await getDb();
  const r = await db.select({
    id: crs.id, clientId: crs.clientId, name: crs.name, code: crs.code,
    description: crs.description, country: crs.country, countryCode: crs.countryCode,
    state: crs.state, stateCode: crs.stateCode, status: crs.status, progress: crs.progress,
    tipoObra: crs.tipoObra, extensaoKm: crs.extensaoKm, areaHa: crs.areaHa, perimetroUrbano: crs.perimetroUrbano,
    createdById: crs.createdById, createdAt: crs.createdAt, updatedAt: crs.updatedAt,
    clientName: clients.name, clientColor: clients.color,
  }).from(crs).leftJoin(clients, eq(crs.clientId, clients.id)).where(eq(crs.id, id)).limit(1);
  return r[0];
}
export async function createCrs(data: { clientId: number; name: string; code?: string; description?: string; country?: string; countryCode?: string; state?: string; stateCode?: string; tipoObra?: string; extensaoKm?: number; areaHa?: number; perimetroUrbano?: number; createdById: number }) {
  const db = await getDb();
  const [result] = await db.execute(
    sql`INSERT INTO crs (clientId, name, code, description, country, countryCode, state, stateCode, tipoObra, extensaoKm, areaHa, perimetroUrbano, status, progress, createdById, createdAt, updatedAt)
        VALUES (${data.clientId}, ${data.name}, ${data.code ?? null}, ${data.description ?? null}, ${data.country ?? null}, ${data.countryCode ?? null}, ${data.state ?? null}, ${data.stateCode ?? null}, ${data.tipoObra ?? null}, ${data.extensaoKm ?? null}, ${data.areaHa ?? null}, ${data.perimetroUrbano ?? null}, 'active', 0, ${data.createdById}, NOW(), NOW())`
  );
  const crsId = (result as any).insertId as number;
  // Create default phases for the new CRS
  await createDefaultPhases(crsId, data.createdById);
  return crsId;
}
export async function updateCrs(id: number, data: Partial<typeof crs.$inferInsert>) {
  const db = await getDb();
  await db.update(crs).set({ ...data, updatedAt: new Date() }).where(eq(crs.id, id));
}
export async function deleteCrs(id: number) {
  const db = await getDb();
  await db.update(crs).set({ status: "archived", updatedAt: new Date() }).where(eq(crs.id, id));
}
export async function recalcCrsProgress(crsId: number) {
  const db = await getDb();
  // Get all tasks for this CRS
  const allTasks = await db.select({ id: tasks.id, progress: tasks.progress }).from(tasks).where(eq(tasks.crsId, crsId));
  if (allTasks.length === 0) {
    await db.update(crs).set({ progress: 0 }).where(eq(crs.id, crsId));
    return;
  }
  const avg = allTasks.reduce((sum: number, t: any) => sum + (t.progress || 0), 0) / allTasks.length;
  await db.update(crs).set({ progress: Math.round(avg * 10) / 10 }).where(eq(crs.id, crsId));
}

// ─── Kanban Phases ─────────────────────────────────────────────────────────────
const DEFAULT_PHASES = [
  { name: "Para Iniciar", color: "#94a3b8", position: 0, isDefault: true, isTerminal: false },
  { name: "Em Andamento", color: "#1c77ac", position: 1, isDefault: true, isTerminal: false },
  { name: "Compartilhado", color: "#1dbab4", position: 2, isDefault: true, isTerminal: false },
  { name: "Publicado", color: "#22c55e", position: 3, isDefault: true, isTerminal: true },
  { name: "Arquivado", color: "#6366f1", position: 4, isDefault: true, isTerminal: true },
  { name: "Bloqueado", color: "#fc5226", position: 5, isDefault: true, isTerminal: false },
];
export async function createDefaultPhases(crsId: number, createdById: number) {
  const db = await getDb();
  for (const p of DEFAULT_PHASES) {
    await db.execute(
      sql`INSERT INTO kanban_phases (crsId, name, color, position, isDefault, isTerminal, createdById, createdAt)
          VALUES (${crsId}, ${p.name}, ${p.color}, ${p.position}, ${p.isDefault ? 1 : 0}, ${p.isTerminal ? 1 : 0}, ${createdById}, NOW())`
    );
  }
}
export async function getPhasesByCrs(crsId: number) {
  const db = await getDb();
  return db.select().from(kanbanPhases).where(eq(kanbanPhases.crsId, crsId)).orderBy(asc(kanbanPhases.position));
}
export async function createPhase(data: { crsId: number; name: string; color?: string; position?: number; isTerminal?: boolean; createdById: number }) {
  const db = await getDb();
  const [result] = await db.execute(
    sql`INSERT INTO kanban_phases (crsId, name, color, position, isDefault, isTerminal, createdById, createdAt)
        VALUES (${data.crsId}, ${data.name}, ${data.color ?? '#6366f1'}, ${data.position ?? 99}, 0, ${data.isTerminal ? 1 : 0}, ${data.createdById}, NOW())`
  );
  return (result as any).insertId as number;
}
export async function updatePhase(id: number, data: { name?: string; color?: string; position?: number; isTerminal?: boolean }) {
  const db = await getDb();
  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.color !== undefined) updateData.color = data.color;
  if (data.position !== undefined) updateData.position = data.position;
  if (data.isTerminal !== undefined) updateData.isTerminal = data.isTerminal;
  if (Object.keys(updateData).length > 0) {
    await db.update(kanbanPhases).set(updateData).where(eq(kanbanPhases.id, id));
  }
}
export async function deletePhase(id: number) {
  const db = await getDb();
  await db.delete(kanbanPhases).where(eq(kanbanPhases.id, id));
}

// ─── Tasks ─────────────────────────────────────────────────────────────────────
export async function getTasksByCrs(crsId: number, filters?: { phaseId?: number; priority?: string; assigneeId?: number; search?: string }) {
  const db = await getDb();
  const conditions: any[] = [eq(tasks.crsId, crsId)];
  if (filters?.phaseId) conditions.push(eq(tasks.phaseId, filters.phaseId));
  if (filters?.priority) conditions.push(eq(tasks.priority, filters.priority as any));
  if (filters?.assigneeId) conditions.push(eq(tasks.assigneeId, filters.assigneeId));
  if (filters?.search) conditions.push(like(tasks.title, `%${filters.search}%`));
  return db.select({
    id: tasks.id, crsId: tasks.crsId, phaseId: tasks.phaseId,
    title: tasks.title, description: tasks.description, priority: tasks.priority,
    assigneeId: tasks.assigneeId, createdById: tasks.createdById,
    dueDate: tasks.dueDate, startDate: tasks.startDate, endDate: tasks.endDate,
    position: tasks.position, revisionsCount: tasks.revisionsCount,
    setor: tasks.setor, progress: tasks.progress,
    blockReason: tasks.blockReason, openedAt: tasks.openedAt,
    completedAt: tasks.completedAt, statusChangedAt: tasks.statusChangedAt,
    createdAt: tasks.createdAt, updatedAt: tasks.updatedAt,
    assigneeName: users.name, assigneeAvatarUrl: users.avatarUrl,
    projectName: crs.name,
    phaseName: kanbanPhases.name,
    phaseColor: kanbanPhases.color,
    phaseIsTerminal: kanbanPhases.isTerminal,
  }).from(tasks)
    .leftJoin(users, eq(tasks.assigneeId, users.id))
    .leftJoin(crs, eq(tasks.crsId, crs.id))
    .leftJoin(kanbanPhases, eq(tasks.phaseId, kanbanPhases.id))
    .where(and(...conditions))
    .orderBy(tasks.position, tasks.createdAt);
}
export async function getTaskById(id: number) {
  const db = await getDb();
  const r = await db.select({
    id: tasks.id, crsId: tasks.crsId, phaseId: tasks.phaseId,
    title: tasks.title, description: tasks.description, priority: tasks.priority,
    assigneeId: tasks.assigneeId, approvedById: tasks.approvedById, approvedAt: tasks.approvedAt,
    createdById: tasks.createdById, dueDate: tasks.dueDate, startDate: tasks.startDate,
    endDate: tasks.endDate, position: tasks.position, revisionsCount: tasks.revisionsCount,
    setor: tasks.setor, progress: tasks.progress, blockReason: tasks.blockReason,
    openedAt: tasks.openedAt, completedAt: tasks.completedAt, statusChangedAt: tasks.statusChangedAt,
    createdAt: tasks.createdAt, updatedAt: tasks.updatedAt,
    assigneeName: users.name,
  }).from(tasks)
    .leftJoin(users, eq(tasks.assigneeId, users.id))
    .where(eq(tasks.id, id)).limit(1);
  return r[0];
}
export async function createTask(data: {
  crsId: number; phaseId: number; title: string; description?: string;
  priority?: string; assigneeId?: number; dueDate?: Date; setor?: string;
  createdById: number; position?: number;
}) {
  const db = await getDb();
  const safePosition = data.position ? data.position % 2000000000 : Date.now() % 2000000000;
  const now = new Date();
  const [result] = await db.execute(
    sql`INSERT INTO tasks (crsId, phaseId, title, description, priority, assigneeId, createdById, dueDate, position, revisionsCount, setor, progress, openedAt, statusChangedAt, createdAt, updatedAt)
        VALUES (${data.crsId}, ${data.phaseId}, ${data.title}, ${data.description ?? null}, ${data.priority ?? 'medium'}, ${data.assigneeId ?? null}, ${data.createdById}, ${data.dueDate ?? null}, ${safePosition}, 0, ${data.setor ?? null}, 0, ${now}, ${now}, ${now}, ${now})`
  );
  return (result as any).insertId as number;
}
export async function updateTask(id: number, data: any) {
  const db = await getDb();
  const now = new Date();
  const updateData: Record<string, any> = { ...data, updatedAt: now };
  if (data.phaseId !== undefined) updateData.statusChangedAt = now;
  await db.update(tasks).set(updateData).where(eq(tasks.id, id));
}
export async function deleteTask(id: number) {
  const db = await getDb();
  await db.delete(tasks).where(eq(tasks.id, id));
}
export async function recalcTaskProgress(taskId: number) {
  const db = await getDb();
  const items = await db.select({ status: checklistItems.status }).from(checklistItems).where(eq(checklistItems.taskId, taskId));
  if (items.length === 0) {
    await db.update(tasks).set({ progress: 0 }).where(eq(tasks.id, taskId));
    return 0;
  }
  const done = items.filter((i: any) => i.status === 'published' || i.status === 'archived').length;
  const progress = Math.round((done / items.length) * 100);
  await db.update(tasks).set({ progress }).where(eq(tasks.id, taskId));
  // Recalc CRS progress
  const task = await getTaskById(taskId);
  if (task) await recalcCrsProgress(task.crsId);
  return progress;
}

// ─── Task Comments ─────────────────────────────────────────────────────────────
export async function getTaskComments(taskId: number) {
  const db = await getDb();
  return db.select({
    id: taskComments.id, taskId: taskComments.taskId, content: taskComments.content,
    createdAt: taskComments.createdAt, updatedAt: taskComments.updatedAt,
    userId: taskComments.userId, userName: users.name, userAvatar: users.avatarUrl,
  }).from(taskComments)
    .leftJoin(users, eq(taskComments.userId, users.id))
    .where(eq(taskComments.taskId, taskId))
    .orderBy(asc(taskComments.createdAt));
}
export async function createTaskComment(data: { taskId: number; userId: number; content: string }) {
  const db = await getDb();
  const [result] = await db.execute(
    sql`INSERT INTO task_comments (taskId, userId, content, createdAt, updatedAt) VALUES (${data.taskId}, ${data.userId}, ${data.content}, NOW(), NOW())`
  );
  return (result as any).insertId as number;
}
export async function deleteTaskComment(id: number) {
  const db = await getDb();
  await db.delete(taskComments).where(eq(taskComments.id, id));
}

// ─── Checklist Items ───────────────────────────────────────────────────────────
export async function getChecklistItems(taskId: number) {
  const db = await getDb();
  return db.select({
    id: checklistItems.id, taskId: checklistItems.taskId, title: checklistItems.title,
    description: checklistItems.description, assigneeId: checklistItems.assigneeId,
    status: checklistItems.status, position: checklistItems.position,
    createdById: checklistItems.createdById,
    startDate: checklistItems.startDate, endDate: checklistItems.endDate,
    completedAt: checklistItems.completedAt,
    createdAt: checklistItems.createdAt, updatedAt: checklistItems.updatedAt,
    assigneeName: users.name, assigneeAvatar: users.avatarUrl,
  }).from(checklistItems)
    .leftJoin(users, eq(checklistItems.assigneeId, users.id))
    .where(eq(checklistItems.taskId, taskId))
    .orderBy(asc(checklistItems.position));
}

// Deriva datas do CRS a partir dos itens de checklist de todas as suas tarefas
export async function getCrsDateRange(crsId: number): Promise<{ startDate: Date | null; endDate: Date | null }> {
  const db = await getDb();
  // Busca todos os checklist items das tarefas deste CRS que têm datas definidas
  const rows = await db.select({
    startDate: checklistItems.startDate,
    endDate: checklistItems.endDate,
    taskStartDate: tasks.startDate,
    taskEndDate: tasks.endDate,
    taskDueDate: tasks.dueDate,
  }).from(checklistItems)
    .innerJoin(tasks, eq(checklistItems.taskId, tasks.id))
    .where(eq(tasks.crsId, crsId));

  const allStarts: Date[] = [];
  const allEnds: Date[] = [];
  for (const r of rows) {
    if (r.startDate) allStarts.push(new Date(r.startDate));
    if (r.endDate) allEnds.push(new Date(r.endDate));
  }
  // Fallback: usar datas das tarefas se não houver datas no checklist
  if (allStarts.length === 0 || allEnds.length === 0) {
    const taskRows = await db.select({
      startDate: tasks.startDate, endDate: tasks.endDate, dueDate: tasks.dueDate,
    }).from(tasks).where(eq(tasks.crsId, crsId));
    for (const t of taskRows) {
      if (t.startDate) allStarts.push(new Date(t.startDate));
      if (t.endDate) allEnds.push(new Date(t.endDate));
      else if (t.dueDate) allEnds.push(new Date(t.dueDate));
    }
  }
  return {
    startDate: allStarts.length > 0 ? new Date(Math.min(...allStarts.map(d => d.getTime()))) : null,
    endDate: allEnds.length > 0 ? new Date(Math.max(...allEnds.map(d => d.getTime()))) : null,
  };
}
export async function createChecklistItem(data: { taskId: number; title: string; description?: string; assigneeId?: number; position?: number; startDate?: Date | null; endDate?: Date | null; createdById: number }) {
  const db = await getDb();
  const [result] = await db.execute(
    sql`INSERT INTO checklist_items (taskId, title, description, assigneeId, status, position, startDate, endDate, createdById, createdAt, updatedAt)
        VALUES (${data.taskId}, ${data.title}, ${data.description ?? null}, ${data.assigneeId ?? null}, 'pending', ${data.position ?? 99}, ${data.startDate ?? null}, ${data.endDate ?? null}, ${data.createdById}, NOW(), NOW())`
  );
  return (result as any).insertId as number;
}
export async function updateChecklistItem(id: number, data: any) {
  const db = await getDb();
  await db.update(checklistItems).set({ ...data, updatedAt: new Date() }).where(eq(checklistItems.id, id));
}
export async function deleteChecklistItem(id: number) {
  const db = await getDb();
  await db.delete(checklistItems).where(eq(checklistItems.id, id));
}
export async function getChecklistItemComments(checklistItemId: number) {
  const db = await getDb();
  return db.select({
    id: checklistItemComments.id, checklistItemId: checklistItemComments.checklistItemId,
    content: checklistItemComments.content, createdAt: checklistItemComments.createdAt,
    userId: checklistItemComments.userId, userName: users.name, userAvatar: users.avatarUrl,
  }).from(checklistItemComments)
    .leftJoin(users, eq(checklistItemComments.userId, users.id))
    .where(eq(checklistItemComments.checklistItemId, checklistItemId))
    .orderBy(asc(checklistItemComments.createdAt));
}
export async function createChecklistItemComment(data: { checklistItemId: number; userId: number; content: string }) {
  const db = await getDb();
  const [result] = await db.execute(
    sql`INSERT INTO checklist_item_comments (checklistItemId, userId, content, createdAt, updatedAt) VALUES (${data.checklistItemId}, ${data.userId}, ${data.content}, NOW(), NOW())`
  );
  return (result as any).insertId as number;
}

// ─── Task Phase History ────────────────────────────────────────────────────────
export async function recordPhaseChange(data: { taskId: number; changedById: number; fromPhaseId?: number; fromPhaseName?: string; toPhaseId: number; toPhaseName: string }) {
  const db = await getDb();
  await db.execute(
    sql`INSERT INTO task_phase_history (taskId, changedById, fromPhaseId, fromPhaseName, toPhaseId, toPhaseName, changedAt)
        VALUES (${data.taskId}, ${data.changedById}, ${data.fromPhaseId ?? null}, ${data.fromPhaseName ?? null}, ${data.toPhaseId}, ${data.toPhaseName}, NOW())`
  );
}
export async function getTaskPhaseHistory(taskId: number) {
  const db = await getDb();
  return db.select({
    id: taskPhaseHistory.id, fromPhaseId: taskPhaseHistory.fromPhaseId,
    fromPhaseName: taskPhaseHistory.fromPhaseName, toPhaseId: taskPhaseHistory.toPhaseId,
    toPhaseName: taskPhaseHistory.toPhaseName, changedAt: taskPhaseHistory.changedAt,
    changedByName: users.name, changedByAvatar: users.avatarUrl,
  }).from(taskPhaseHistory)
    .leftJoin(users, eq(taskPhaseHistory.changedById, users.id))
    .where(eq(taskPhaseHistory.taskId, taskId))
    .orderBy(asc(taskPhaseHistory.changedAt));
}
export async function getChecklistItemHistory(taskId: number) {
  const db = await getDb();
  return db.select({
    id: checklistItemHistory.id, checklistItemId: checklistItemHistory.checklistItemId,
    fromStatus: checklistItemHistory.fromStatus, toStatus: checklistItemHistory.toStatus,
    changedAt: checklistItemHistory.changedAt,
    changedByName: users.name, changedByAvatar: users.avatarUrl,
  }).from(checklistItemHistory)
    .leftJoin(users, eq(checklistItemHistory.changedById, users.id))
    .where(eq(checklistItemHistory.taskId, taskId))
    .orderBy(asc(checklistItemHistory.changedAt));
}

// ─── Vacation Periods ──────────────────────────────────────────────────────────
export async function getVacationPeriods(userId?: number) {
  const db = await getDb();
  const conditions = userId ? [eq(vacationPeriods.userId, userId)] : [];
  return db.select({
    id: vacationPeriods.id, userId: vacationPeriods.userId,
    startDate: vacationPeriods.startDate, endDate: vacationPeriods.endDate,
    description: vacationPeriods.description, createdAt: vacationPeriods.createdAt,
    userName: users.name, userAvatar: users.avatarUrl,
  }).from(vacationPeriods)
    .leftJoin(users, eq(vacationPeriods.userId, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(vacationPeriods.startDate));
}
export async function createVacationPeriod(data: { userId: number; startDate: Date; endDate: Date; description?: string }) {
  const db = await getDb();
  const [result] = await db.execute(
    sql`INSERT INTO vacation_periods (userId, startDate, endDate, description, createdAt) VALUES (${data.userId}, ${data.startDate}, ${data.endDate}, ${data.description ?? null}, NOW())`
  );
  return (result as any).insertId as number;
}
export async function deleteVacationPeriod(id: number) {
  const db = await getDb();
  await db.delete(vacationPeriods).where(eq(vacationPeriods.id, id));
}
export async function getTasksInVacationPeriod(userId: number, startDate: Date, endDate: Date) {
  const db = await getDb();
  const r = await db.execute(
    sql`SELECT t.id, t.title, t.dueDate, t.startDate, t.endDate FROM tasks t
        WHERE t.assigneeId = ${userId}
        AND (
          (t.startDate IS NOT NULL AND t.startDate <= ${endDate} AND t.startDate >= ${startDate})
          OR (t.dueDate IS NOT NULL AND t.dueDate >= ${startDate} AND t.dueDate <= ${endDate})
          OR (t.endDate IS NOT NULL AND t.endDate >= ${startDate} AND t.endDate <= ${endDate})
        )
        LIMIT 20`
  );
  return (r[0] as any[]) ?? [];
}
export async function isUserOnVacation(userId: number, date: Date): Promise<boolean> {
  const db = await getDb();
  const r = await db.select({ id: vacationPeriods.id }).from(vacationPeriods)
    .where(and(eq(vacationPeriods.userId, userId), sql`${vacationPeriods.startDate} <= ${date}`, sql`${vacationPeriods.endDate} >= ${date}`))
    .limit(1);
  return r.length > 0;
}

// ─── Notifications ─────────────────────────────────────────────────────────────
export async function notifyUser(data: { userId: number; title: string; message: string; notificationType: any; relatedCrsId?: number; relatedTaskId?: number }) {
  const db = await getDb();
  await db.execute(
    sql`INSERT INTO notifications (userId, title, message, notificationType, isRead, relatedCrsId, relatedTaskId, createdAt)
        VALUES (${data.userId}, ${data.title}, ${data.message}, ${data.notificationType}, 0, ${data.relatedCrsId ?? null}, ${data.relatedTaskId ?? null}, NOW())`
  );
}
export async function getNotifications(userId: number) {
  const db = await getDb();
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(50);
}
export async function markNotificationRead(id: number) {
  const db = await getDb();
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
}
export async function markAllNotificationsRead(userId: number) {
  const db = await getDb();
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId));
}

// ─── Activity Logs ─────────────────────────────────────────────────────────────
export async function logActivity(data: { userId: number; action: string; entityType: string; entityId?: number; metadata?: string }) {
  const db = await getDb();
  await db.execute(
    sql`INSERT INTO activity_logs (userId, action, entityType, entityId, metadata, createdAt) VALUES (${data.userId}, ${data.action}, ${data.entityType}, ${data.entityId ?? null}, ${data.metadata ?? null}, NOW())`
  );
}

// ─── Disciplines ───────────────────────────────────────────────────────────────
export async function getDisciplines(activeOnly = true) {
  const db = await getDb();
  const conditions = activeOnly ? [eq(disciplines.isActive, true)] : [];
  return db.select().from(disciplines).where(conditions.length > 0 ? and(...conditions) : undefined).orderBy(asc(disciplines.name));
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────
export async function getDashboardStats(clientId?: number) {
  const db = await getDb();
  const totalClients = await db.select({ count: sql<number>`COUNT(*)` }).from(clients).where(eq(clients.status, "active"));
  // CRS filtered by clientId if provided
  const crsConditions = clientId
    ? and(eq(crs.status, "active"), eq(crs.clientId, clientId))
    : eq(crs.status, "active");
  const totalCrs = await db.select({ count: sql<number>`COUNT(*)` }).from(crs).where(crsConditions);
  const avgProgress = await db.select({ avg: sql<number>`AVG(progress)` }).from(crs).where(crsConditions);
  // Tasks filtered through CRS
  const taskQuery = db.select({
    id: tasks.id, progress: tasks.progress, dueDate: tasks.dueDate, crsId: tasks.crsId,
  }).from(tasks);
  const allTasksRaw = clientId
    ? await taskQuery.innerJoin(crs, and(eq(tasks.crsId, crs.id), eq(crs.clientId, clientId)))
    : await taskQuery;
  const totalTasks = allTasksRaw.length;
  const now = new Date();
  const completedTasks = allTasksRaw.filter((t: any) => t.progress >= 100).length;
  const inProgressTasks = allTasksRaw.filter((t: any) => t.progress > 0 && t.progress < 100).length;
  const pendingTasks = allTasksRaw.filter((t: any) => t.progress === 0).length;
  const overdueTasks = allTasksRaw.filter((t: any) => t.dueDate && new Date(t.dueDate) < now && t.progress < 100).length;
  // Checklist stats — filtered by clientId if provided
  const checklistQuery = db.select({ status: checklistItems.status, completedAt: checklistItems.completedAt, endDate: checklistItems.endDate }).from(checklistItems);
  const allChecklist = clientId
    ? await checklistQuery
        .innerJoin(tasks, eq(checklistItems.taskId, tasks.id))
        .innerJoin(crs, and(eq(tasks.crsId, crs.id), eq(crs.clientId, clientId)))
    : await checklistQuery;
  const totalChecklist = allChecklist.length;
  const completedChecklist = allChecklist.filter((c: any) => c.status === 'published' || c.status === 'archived' || c.completedAt != null).length;
  const pendingChecklist = totalChecklist - completedChecklist;
  const overdueChecklist = allChecklist.filter((c: any) => (c.status !== 'published' && c.status !== 'archived' && c.completedAt == null) && c.endDate && new Date(c.endDate) < now).length;
  const checklistProgress = totalChecklist > 0 ? Math.round((completedChecklist / totalChecklist) * 100) : 0;
  return {
    totalClients: totalClients[0]?.count ?? 0,
    totalCrs: totalCrs[0]?.count ?? 0,
    totalTasks,
    avgProgress: Math.round((avgProgress[0]?.avg ?? 0) * 10) / 10,
    pendingTasks,
    inProgressTasks,
    completedTasks,
    overdueTasks,
    // Checklist KPIs
    totalChecklist,
    completedChecklist,
    pendingChecklist,
    overdueChecklist,
    checklistProgress,
  };
}

export async function getClientProgress() {
  const db = await getDb();
  // Get all active clients with their CRS progress
  const rows = await db.select({
    clientId: clients.id,
    clientName: clients.name,
    clientColor: clients.color,
    crsId: crs.id,
    crsProgress: crs.progress,
  }).from(clients)
    .leftJoin(crs, and(eq(crs.clientId, clients.id), eq(crs.status, "active")))
    .where(eq(clients.status, "active"))
    .orderBy(asc(clients.name));
  // Group by client
  const clientMap = new Map<number, { id: number; name: string; color: string; crsCount: number; avgProgress: number }>();
  rows.forEach((r: any) => {
    if (!clientMap.has(r.clientId)) {
      clientMap.set(r.clientId, { id: r.clientId, name: r.clientName, color: r.clientColor ?? "#1561ad", crsCount: 0, avgProgress: 0 });
    }
    if (r.crsId) {
      const c = clientMap.get(r.clientId)!;
      c.crsCount++;
      c.avgProgress += r.crsProgress ?? 0;
    }
  });
  return Array.from(clientMap.values()).map(c => ({
    ...c,
    avgProgress: c.crsCount > 0 ? Math.round(c.avgProgress / c.crsCount) : 0,
  }));
}
export async function getWorldMapData() {
  const db = await getDb();
  const rows = await db.select({
    id: crs.id, name: crs.name, code: crs.code, country: crs.country,
    countryCode: crs.countryCode, state: crs.state, stateCode: crs.stateCode,
    progress: crs.progress, status: crs.status, clientName: clients.name,
    tipoObra: crs.tipoObra, extensaoKm: crs.extensaoKm, areaHa: crs.areaHa, perimetroUrbano: crs.perimetroUrbano,
  }).from(crs)
    .leftJoin(clients, eq(crs.clientId, clients.id))
    .where(eq(crs.status, "active"));
  return rows;
}
export async function getWeekDeliveries() {
  const db = await getDb();
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  return db.select({
    id: tasks.id, title: tasks.title, dueDate: tasks.dueDate,
    progress: tasks.progress, phaseId: tasks.phaseId, crsId: tasks.crsId,
    assigneeName: users.name, assigneeAvatar: users.avatarUrl,
    crsName: crs.name,
  }).from(tasks)
    .leftJoin(users, eq(tasks.assigneeId, users.id))
    .leftJoin(crs, eq(tasks.crsId, crs.id))
    .where(and(sql`${tasks.dueDate} >= ${startOfWeek}`, sql`${tasks.dueDate} <= ${endOfWeek}`))
    .orderBy(asc(tasks.dueDate));
}

// ─── Agenda Events ─────────────────────────────────────────────────────────────
export async function getAgendaEvents(filters?: { userId?: number; crsId?: number }) {
  const db = await getDb();
  const conditions: any[] = [];
  if (filters?.crsId) conditions.push(eq(agendaEvents.projectId, filters.crsId));
  return db.select().from(agendaEvents)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(agendaEvents.startDate));
}
export async function createAgendaEvent(data: any) {
  const db = await getDb();
  const [result] = await db.execute(
    sql`INSERT INTO agenda_events (createdById, title, type, startDate, endDate, description, meetingUrl, attendeeIds, projectId, isPublic, createdAt)
        VALUES (${data.createdById}, ${data.title}, ${data.type ?? 'other'}, ${data.startDate}, ${data.endDate}, ${data.description ?? null}, ${data.meetingUrl ?? null}, ${data.attendeeIds ?? null}, ${data.crsId ?? null}, ${data.isPublic ? 1 : 0}, NOW())`
  );
  return (result as any).insertId as number;
}
export async function deleteAgendaEvent(id: number) {
  const db = await getDb();
  await db.delete(agendaEvents).where(eq(agendaEvents.id, id));
}

// ─── Chat Messages ─────────────────────────────────────────────────────────────
export async function getChatMessages(userId: number, crsId?: number) {
  const db = await getDb();
  const conditions: any[] = [eq(chatMessages.userId, userId)];
  if (crsId) conditions.push(eq(chatMessages.crsId, crsId));
  return db.select().from(chatMessages).where(and(...conditions)).orderBy(asc(chatMessages.createdAt)).limit(100);
}
export async function createChatMessage(data: { userId: number; crsId?: number; role: "user" | "assistant"; content: string }) {
  const db = await getDb();
  const [result] = await db.execute(
    sql`INSERT INTO chat_messages (userId, crsId, role, content, createdAt) VALUES (${data.userId}, ${data.crsId ?? null}, ${data.role}, ${data.content}, NOW())`
  );
  return (result as any).insertId as number;
}

// ─── Conversations / Direct Messages ──────────────────────────────────────────
export async function getOrCreateConversation(userId1: number, userId2: number) {
  const db = await getDb();
  // Find existing direct conversation between these two users
  const existing = await db.execute(
    sql`SELECT c.id FROM conversations c
        JOIN conversation_participants cp1 ON cp1.conversationId = c.id AND cp1.userId = ${userId1}
        JOIN conversation_participants cp2 ON cp2.conversationId = c.id AND cp2.userId = ${userId2}
        WHERE c.type = 'direct' LIMIT 1`
  );
  if ((existing[0] as any[]).length > 0) return (existing[0] as any[])[0].id as number;
  const [result] = await db.execute(
    sql`INSERT INTO conversations (type, createdById, createdAt, updatedAt) VALUES ('direct', ${userId1}, NOW(), NOW())`
  );
  const convId = (result as any).insertId as number;
  await db.execute(sql`INSERT INTO conversation_participants (conversationId, userId, joinedAt) VALUES (${convId}, ${userId1}, NOW())`);
  await db.execute(sql`INSERT INTO conversation_participants (conversationId, userId, joinedAt) VALUES (${convId}, ${userId2}, NOW())`);
  return convId;
}
export async function getDirectMessages(conversationId: number) {
  const db = await getDb();
  return db.select({
    id: directMessages.id, content: directMessages.content, createdAt: directMessages.createdAt,
    senderId: directMessages.senderId, senderName: users.name, senderAvatar: users.avatarUrl,
  }).from(directMessages)
    .leftJoin(users, eq(directMessages.senderId, users.id))
    .where(eq(directMessages.conversationId, conversationId))
    .orderBy(asc(directMessages.createdAt)).limit(100);
}
export async function sendDirectMessage(data: { conversationId: number; senderId: number; content: string }) {
  const db = await getDb();
  const [result] = await db.execute(
    sql`INSERT INTO direct_messages (conversationId, senderId, content, createdAt) VALUES (${data.conversationId}, ${data.senderId}, ${data.content}, NOW())`
  );
  await db.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, data.conversationId));
  return (result as any).insertId as number;
}
export async function getUserConversations(userId: number) {
  const db = await getDb();
  return db.execute(
    sql`SELECT c.id, c.type, c.name, c.updatedAt,
        u.id as otherUserId, u.name as otherUserName, u.avatarUrl as otherUserAvatar
        FROM conversations c
        JOIN conversation_participants cp ON cp.conversationId = c.id AND cp.userId = ${userId}
        LEFT JOIN conversation_participants cp2 ON cp2.conversationId = c.id AND cp2.userId != ${userId}
        LEFT JOIN users u ON u.id = cp2.userId
        WHERE c.type = 'direct'
        ORDER BY c.updatedAt DESC LIMIT 50`
  );
}

export async function createGroupConversation(createdById: number, name: string, memberIds: number[]) {
  const db = await getDb();
  const [result] = await db.execute(
    sql`INSERT INTO conversations (type, name, createdById, createdAt, updatedAt) VALUES ('group', ${name}, ${createdById}, NOW(), NOW())`
  );
  const convId = (result as any).insertId as number;
  // Add all members including creator
  const allMembers = Array.from(new Set([createdById, ...memberIds]));
  for (const uid of allMembers) {
    await db.execute(sql`INSERT INTO conversation_participants (conversationId, userId, joinedAt) VALUES (${convId}, ${uid}, NOW())`);
  }
  return convId;
}
export async function getGroupConversations(userId: number) {
  const db = await getDb();
  return db.execute(
    sql`SELECT c.id, c.type, c.name, c.updatedAt,
        (SELECT dm.content FROM direct_messages dm WHERE dm.conversationId = c.id ORDER BY dm.createdAt DESC LIMIT 1) as lastMessage,
        (SELECT COUNT(*) FROM conversation_participants cp3 WHERE cp3.conversationId = c.id) as memberCount
        FROM conversations c
        JOIN conversation_participants cp ON cp.conversationId = c.id AND cp.userId = ${userId}
        WHERE c.type = 'group'
        ORDER BY c.updatedAt DESC LIMIT 50`
  );
}
export async function getConversationMembers(conversationId: number) {
  const db = await getDb();
  return db.select({
    id: users.id, name: users.name, avatarUrl: users.avatarUrl, role: users.role,
  }).from(conversationParticipants)
    .leftJoin(users, eq(conversationParticipants.userId, users.id))
    .where(eq(conversationParticipants.conversationId, conversationId));
}
// ─── Sprints ───────────────────────────────────────────────────────────────────
export async function getSprintsByCrs(crsId: number) {
  const db = await getDb();
  return db.select().from(sprints).where(eq(sprints.crsId, crsId)).orderBy(desc(sprints.createdAt));
}

// ─── Sprint Checklist Items ────────────────────────────────────────────────────
export async function getSprintChecklistItems(sprintId: number) {
  const db = await getDb();
  return db.select({
    id: sprintChecklistItems.id,
    sprintId: sprintChecklistItems.sprintId,
    checklistItemId: sprintChecklistItems.checklistItemId,
    addedAt: sprintChecklistItems.addedAt,
    // Checklist item fields
    title: checklistItems.title,
    description: checklistItems.description,
    status: checklistItems.status,
    startDate: checklistItems.startDate,
    endDate: checklistItems.endDate,
    completedAt: checklistItems.completedAt,
    assigneeId: checklistItems.assigneeId,
    taskId: checklistItems.taskId,
    // Assignee info
    assigneeName: users.name,
    assigneeAvatar: users.avatarUrl,
    // Task info
    taskTitle: tasks.title,
    taskSetor: tasks.setor,
  }).from(sprintChecklistItems)
    .innerJoin(checklistItems, eq(sprintChecklistItems.checklistItemId, checklistItems.id))
    .leftJoin(users, eq(checklistItems.assigneeId, users.id))
    .leftJoin(tasks, eq(checklistItems.taskId, tasks.id))
    .where(eq(sprintChecklistItems.sprintId, sprintId))
    .orderBy(asc(sprintChecklistItems.addedAt));
}
export async function addChecklistItemToSprint(sprintId: number, checklistItemId: number) {
  const db = await getDb();
  const [result] = await db.execute(
    sql`INSERT IGNORE INTO sprint_checklist_items (sprintId, checklistItemId, addedAt)
        VALUES (${sprintId}, ${checklistItemId}, NOW())`
  );
  return (result as any).insertId as number;
}
export async function removeChecklistItemFromSprint(sprintId: number, checklistItemId: number) {
  const db = await getDb();
  await db.delete(sprintChecklistItems)
    .where(and(eq(sprintChecklistItems.sprintId, sprintId), eq(sprintChecklistItems.checklistItemId, checklistItemId)));
}

// ─── CRS Discipline Progress ─────────────────────────────────────────────────
/** Returns progress per discipline for a given CRS, based on checklist items grouped by task.setor */
export async function getCrsDisciplineProgress(crsId: number) {
  const db = await getDb();
  // Get all checklist items for this CRS, joining tasks to get setor (discipline)
  const rows = await db.select({
    setor: tasks.setor,
    status: checklistItems.status,
  })
    .from(checklistItems)
    .innerJoin(tasks, eq(checklistItems.taskId, tasks.id))
    .where(eq(tasks.crsId, crsId));

  // Group by setor
  const map: Record<string, { total: number; done: number }> = {};
  for (const r of rows) {
    const key = r.setor ?? "Sem Disciplina";
    if (!map[key]) map[key] = { total: 0, done: 0 };
    map[key].total++;
    if (r.status === "published" || r.status === "archived") map[key].done++;
  }

  // Also get discipline colors from disciplines table
  const disciplineRows = await db.select({ name: disciplines.name, color: disciplines.color })
    .from(disciplines)
    .where(eq(disciplines.isActive, true));
  const colorMap: Record<string, string> = {};
  for (const d of disciplineRows) colorMap[d.name] = d.color;

  return Object.entries(map).map(([name, { total, done }]) => ({
    name,
    total,
    done,
    progress: total > 0 ? Math.round((done / total) * 100) : 0,
    color: colorMap[name] ?? "#6366f1",
  })).sort((a, b) => a.name.localeCompare(b.name));
}

// ─── Yearly Stats ─────────────────────────────────────────────────────────────
/** Returns task and checklist stats grouped by year, based on task.startDate or task.createdAt */
export async function getYearlyStats(clientId?: number) {
  const db = await getDb();
  // Get tasks with their year
  const taskQuery = db.select({
    id: tasks.id,
    progress: tasks.progress,
    dueDate: tasks.dueDate,
    startDate: tasks.startDate,
    createdAt: tasks.createdAt,
    crsId: tasks.crsId,
  }).from(tasks);
  const allTasksRaw = clientId
    ? await taskQuery.innerJoin(crs, and(eq(tasks.crsId, crs.id), eq(crs.clientId, clientId)))
    : await taskQuery;
  // Get checklist items with their year
  const checklistQuery = db.select({
    status: checklistItems.status,
    startDate: checklistItems.startDate,
    endDate: checklistItems.endDate,
    completedAt: checklistItems.completedAt,
    createdAt: checklistItems.createdAt,
  }).from(checklistItems);
  const allChecklistRaw = clientId
    ? await checklistQuery
        .innerJoin(tasks, eq(checklistItems.taskId, tasks.id))
        .innerJoin(crs, and(eq(tasks.crsId, crs.id), eq(crs.clientId, clientId)))
    : await checklistQuery;
  // Get CRS with their year (createdAt)
  const crsConditions = clientId
    ? and(eq(crs.status, "active"), eq(crs.clientId, clientId))
    : eq(crs.status, "active");
  const allCrsRaw = await db.select({ id: crs.id, createdAt: crs.createdAt, progress: crs.progress }).from(crs).where(crsConditions);
  // Build year sets
  const yearSet = new Set<number>();
  const now = new Date();
  yearSet.add(now.getFullYear());
  allTasksRaw.forEach((t: any) => {
    const d = t.startDate ?? t.createdAt;
    if (d) yearSet.add(new Date(d).getFullYear());
    if (t.dueDate) yearSet.add(new Date(t.dueDate).getFullYear());
  });
  allCrsRaw.forEach((c: any) => {
    if (c.createdAt) yearSet.add(new Date(c.createdAt).getFullYear());
  });
  const years = Array.from(yearSet).sort();
  const result = years.map(year => {
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59);
    // Tasks active in this year (startDate within year OR dueDate within year)
    const yearTasks = allTasksRaw.filter((t: any) => {
      const start = t.startDate ? new Date(t.startDate) : t.createdAt ? new Date(t.createdAt) : null;
      const due = t.dueDate ? new Date(t.dueDate) : null;
      if (start && start >= yearStart && start <= yearEnd) return true;
      if (due && due >= yearStart && due <= yearEnd) return true;
      return false;
    });
    const totalTasks = yearTasks.length;
    const completedTasks = yearTasks.filter((t: any) => t.progress >= 100).length;
    const inProgressTasks = yearTasks.filter((t: any) => t.progress > 0 && t.progress < 100).length;
    const overdueTasks = yearTasks.filter((t: any) => t.dueDate && new Date(t.dueDate) < now && t.progress < 100 && new Date(t.dueDate).getFullYear() === year).length;
    // Checklist items active in this year
    const yearChecklist = allChecklistRaw.filter((c: any) => {
      const start = c.startDate ? new Date(c.startDate) : c.createdAt ? new Date(c.createdAt) : null;
      const end = c.endDate ? new Date(c.endDate) : null;
      if (start && start >= yearStart && start <= yearEnd) return true;
      if (end && end >= yearStart && end <= yearEnd) return true;
      return false;
    });
    const totalChecklist = yearChecklist.length;
    const completedChecklist = yearChecklist.filter((c: any) => c.status === 'published' || c.status === 'archived' || c.completedAt != null).length;
    // CRS created in this year
    const yearCrs = allCrsRaw.filter((c: any) => c.createdAt && new Date(c.createdAt).getFullYear() === year);
    return {
      year,
      totalTasks,
      completedTasks,
      inProgressTasks,
      overdueTasks,
      totalChecklist,
      completedChecklist,
      totalCrs: yearCrs.length,
    };
  });
  return result;
}
