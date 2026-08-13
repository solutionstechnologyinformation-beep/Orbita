import { eq, and, desc, like, inArray, sql, asc, aliasedTable, gte, lte, or } from "drizzle-orm";
import { aggregateExtensionByType } from "./extension-summary";
import { getSegmentExtensionKmValue } from "./segment-display";
import {
  users, clients, crs, kanbanPhases, tasks, taskAttachments, checklistItems,
  checklistItemComments, checklistItemHistory, taskComments,
  taskPhaseHistory, vacationPeriods, notifications, activityLogs,
  disciplines, sprints, sprintTasks, agendaEvents, chatMessages,
  conversations, conversationParticipants, directMessages,
  sprintChecklistItems, whiteboards, userDisciplines,
  googleCalendarTokens, googleCalendarEvents, meetings, crsSegments,
  subscriptionPlans, userSubscriptions, subscriptionInvoices,
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
export async function getUserByEmail(email: string) {
  const db = await getDb();
  const r = await db.select().from(users).where(eq(users.email, email)).limit(1);
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
export async function deleteUser(id: number) {
  const db = await getDb();
  // Remove related data to avoid FK violations
  await db.delete(userDisciplines).where(eq(userDisciplines.userId, id));
  // Remove from project_members (raw SQL since table isn't in schema exports)
  await db.execute(sql`DELETE FROM project_members WHERE userId = ${id}`);
  await db.delete(users).where(eq(users.id, id));
}
export async function getAllUsers() {
  const db = await getDb();
  const userRows = await db.select({ id: users.id, name: users.name, email: users.email, role: users.role, avatarUrl: users.avatarUrl, avatarColor: users.avatarColor, avatarInitials: users.avatarInitials, createdAt: users.createdAt }).from(users).orderBy(asc(users.name));
  // Fetch all user disciplines in one query
  const allDiscs = await db.select({ userId: userDisciplines.userId, disciplineName: userDisciplines.disciplineName }).from(userDisciplines);
  const discByUser = new Map<number, string[]>();
  for (const d of allDiscs) {
    if (!discByUser.has(d.userId)) discByUser.set(d.userId, []);
    discByUser.get(d.userId)!.push(d.disciplineName);
  }
  type UserRow = typeof userRows[number];
  return userRows.map((u: UserRow) => ({ ...u, disciplines: discByUser.get(u.id) ?? ([] as string[]) }));
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
export async function createClient(data: { name: string; description?: string; crsCode?: string; color?: string; createdById: number }) {
  const db = await getDb();
  const [result] = await db.execute(
    sql`INSERT INTO clients (name, description, crsCode, color, status, createdById, createdAt, updatedAt)
        VALUES (${data.name}, ${data.description ?? null}, ${data.crsCode ?? null}, ${data.color ?? '#785500'}, 'active', ${data.createdById}, NOW(), NOW())`
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
    techDataByType: crs.techDataByType,
    createdById: crs.createdById, createdAt: crs.createdAt, updatedAt: crs.updatedAt,
    clientName: clients.name, clientColor: clients.color,
  }).from(crs).leftJoin(clients, eq(crs.clientId, clients.id)).where(eq(crs.status, 'active')).orderBy(asc(crs.name));
}
export async function getCrsSegments(crsId?: number) {
  const db = await getDb();
  const query = db.select({
    id: crsSegments.id,
    crsId: crsSegments.crsId,
    name: crsSegments.name,
    fileName: crsSegments.fileName,
    fileUrl: crsSegments.fileUrl,
    geometryJson: crsSegments.geometryJson,
    boundsJson: crsSegments.boundsJson,
    createdById: crsSegments.createdById,
    createdAt: crsSegments.createdAt,
    updatedAt: crsSegments.updatedAt,
    crsName: crs.name,
    tipoObra: crs.tipoObra,
    extensaoKm: crs.extensaoKm,
    techDataByType: crs.techDataByType,
  }).from(crsSegments).innerJoin(crs, eq(crsSegments.crsId, crs.id));
  const rows = crsId == null ? await query.orderBy(desc(crsSegments.createdAt)) : await query.where(eq(crsSegments.crsId, crsId)).orderBy(desc(crsSegments.createdAt));
  return rows.map((row: typeof rows[number]) => ({ ...row, extensionKm: getSegmentExtensionKmValue(row.extensaoKm, row.techDataByType) }));
}

export async function createCrsSegment(data: {
  crsId: number;
  name: string;
  fileName: string;
  fileUrl: string;
  geometryJson: string;
  boundsJson?: string | null;
  createdById: number;
}) {
  const db = await getDb();
  const [result] = await db.insert(crsSegments).values({
    crsId: data.crsId,
    name: data.name,
    fileName: data.fileName,
    fileUrl: data.fileUrl,
    geometryJson: data.geometryJson,
    boundsJson: data.boundsJson ?? null,
    createdById: data.createdById,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return (result as any).insertId as number;
}

export async function deleteCrsSegment(id: number, crsId: number) {
  const db = await getDb();
  await db.delete(crsSegments).where(and(eq(crsSegments.id, id), eq(crsSegments.crsId, crsId)));
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
    techDataByType: crs.techDataByType,
    createdById: crs.createdById, createdAt: crs.createdAt, updatedAt: crs.updatedAt,
    clientName: clients.name, clientColor: clients.color,
  }).from(crs).leftJoin(clients, eq(crs.clientId, clients.id)).where(eq(crs.id, id)).limit(1);
  return r[0];
}
export async function createCrs(data: { clientId: number; name: string; code?: string; description?: string; country?: string; countryCode?: string; state?: string; stateCode?: string; tipoObra?: string; extensaoKm?: number; areaHa?: number; perimetroUrbano?: number; techDataByType?: string; createdById: number }) {
  const db = await getDb();
  const [result] = await db.execute(
    sql`INSERT INTO crs (clientId, name, code, description, country, countryCode, state, stateCode, tipoObra, extensaoKm, areaHa, perimetroUrbano, techDataByType, status, progress, createdById, createdAt, updatedAt)
        VALUES (${data.clientId}, ${data.name}, ${data.code ?? null}, ${data.description ?? null}, ${data.country ?? null}, ${data.countryCode ?? null}, ${data.state ?? null}, ${data.stateCode ?? null}, ${data.tipoObra ?? null}, ${data.extensaoKm ?? null}, ${data.areaHa ?? null}, ${data.perimetroUrbano ?? null}, ${data.techDataByType ?? null}, 'active', 0, ${data.createdById}, NOW(), NOW())`
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
  { name: "Em Andamento", color: "#9a6b00", position: 1, isDefault: true, isTerminal: false },
  { name: "Compartilhado", color: "#1dbab4", position: 2, isDefault: true, isTerminal: false },
  { name: "Publicado", color: "#22c55e", position: 3, isDefault: true, isTerminal: true },
  { name: "Concluído", color: "#6366f1", position: 4, isDefault: true, isTerminal: true },
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
  if (!r[0]) return undefined;
  const attachments = await db.select({
    id: taskAttachments.id,
    taskId: taskAttachments.taskId,
    filename: taskAttachments.filename,
    fileKey: taskAttachments.fileKey,
    fileUrl: taskAttachments.fileUrl,
    mimeType: taskAttachments.mimeType,
    fileSize: taskAttachments.fileSize,
    uploadedById: taskAttachments.uploadedById,
    createdAt: taskAttachments.createdAt,
  }).from(taskAttachments)
    .where(eq(taskAttachments.taskId, id))
    .orderBy(asc(taskAttachments.createdAt));
  return { ...r[0], attachments };
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
  // Totais de extensao, area e perimetro urbano dos contratos
  const crsStats = await db.select({
    totalArea: sql<number>`COALESCE(SUM(areaHa), 0)`,
    totalPerimetro: sql<number>`COALESCE(SUM(perimetroUrbano), 0)`,
  }).from(crs).where(crsConditions);
  const extensionRows = await db.select({
    tipoObra: crs.tipoObra,
    extensaoKm: crs.extensaoKm,
    techDataByType: crs.techDataByType,
  }).from(crs).where(crsConditions);
  const extensionSummary = aggregateExtensionByType(extensionRows);
  const totalExtensaoKm = extensionSummary.totalExtensaoKm;
  const extensaoByTipo = extensionSummary.extensaoByTipo;
  const totalAreaHa = crsStats[0]?.totalArea ?? 0;
  const totalPerimetroUrbano = crsStats[0]?.totalPerimetro ?? 0;
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
    // Totais de extensao, area e perimetro urbano
    totalExtensaoKm,
    extensaoByTipo,
    totalAreaHa: Math.round(totalAreaHa * 100) / 100,
    totalPerimetroUrbano: Math.round(totalPerimetroUrbano * 100) / 100,
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
      clientMap.set(r.clientId, { id: r.clientId, name: r.clientName, color: r.clientColor ?? "#785500", crsCount: 0, avgProgress: 0 });
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
  // All events are visible to all users (shared calendar)
  return db.select({
    id: agendaEvents.id,
    createdById: agendaEvents.createdById,
    title: agendaEvents.title,
    type: agendaEvents.type,
    startDate: agendaEvents.startDate,
    endDate: agendaEvents.endDate,
    description: agendaEvents.description,
    meetingUrl: agendaEvents.meetingUrl,
    attendeeIds: agendaEvents.attendeeIds,
    projectId: agendaEvents.projectId,
    isPublic: agendaEvents.isPublic,
    createdAt: agendaEvents.createdAt,
    creatorName: users.name,
    creatorAvatar: users.avatarUrl,
  }).from(agendaEvents)
    .leftJoin(users, eq(agendaEvents.createdById, users.id))
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
  const cp2 = aliasedTable(conversationParticipants, "cp2");
  const otherUser = aliasedTable(users, "otherUser");
  const rows = await db
    .select({
      id: conversations.id,
      type: conversations.type,
      name: conversations.name,
      updatedAt: conversations.updatedAt,
      otherUserId: otherUser.id,
      otherUserName: otherUser.name,
      otherUserAvatar: otherUser.avatarUrl,
      otherUserLastSeenAt: otherUser.lastSeenAt,
    })
    .from(conversations)
    .innerJoin(conversationParticipants, and(eq(conversationParticipants.conversationId, conversations.id), eq(conversationParticipants.userId, userId)))
    .leftJoin(cp2, and(eq(cp2.conversationId, conversations.id), sql`${cp2.userId} != ${userId}`))
    .leftJoin(otherUser, eq(otherUser.id, cp2.userId))
    .where(eq(conversations.type, "direct"))
    .orderBy(desc(conversations.updatedAt))
    .limit(50);
  // Also fetch last message for each conversation
  const result = await Promise.all(
    rows.map(async (row: typeof rows[number]) => {
      const lastMsgs = await db
        .select({ content: directMessages.content })
        .from(directMessages)
        .where(eq(directMessages.conversationId, row.id))
        .orderBy(desc(directMessages.createdAt))
        .limit(1);
      return { ...row, lastMessage: lastMsgs[0]?.content ?? null };
    })
  );
  return result;
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
  const rows = await db
    .select({
      id: conversations.id,
      type: conversations.type,
      name: conversations.name,
      updatedAt: conversations.updatedAt,
    })
    .from(conversations)
    .innerJoin(conversationParticipants, and(eq(conversationParticipants.conversationId, conversations.id), eq(conversationParticipants.userId, userId)))
    .where(eq(conversations.type, "group"))
    .orderBy(desc(conversations.updatedAt))
    .limit(50);
  const result = await Promise.all(
    rows.map(async (row: typeof rows[number]) => {
      const lastMsgs = await db
        .select({ content: directMessages.content })
        .from(directMessages)
        .where(eq(directMessages.conversationId, row.id))
        .orderBy(desc(directMessages.createdAt))
        .limit(1);
      const memberCountRows = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(conversationParticipants)
        .where(eq(conversationParticipants.conversationId, row.id));
      return {
        ...row,
        lastMessage: lastMsgs[0]?.content ?? null,
        memberCount: Number(memberCountRows[0]?.count ?? 0),
      };
    })
  );
  return result;
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
  const assigneeAlias = aliasedTable(users, "assignee");
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
    assigneeName: assigneeAlias.name,
    assigneeAvatar: assigneeAlias.avatarUrl,
    // Task info
    taskTitle: tasks.title,
    taskSetor: tasks.setor,
    taskCrsId: tasks.crsId,
    // CRS info
    crsName: crs.name,
    crsCode: crs.code,
    // Client info
    clientId: clients.id,
    clientName: clients.name,
  }).from(sprintChecklistItems)
    .innerJoin(checklistItems, eq(sprintChecklistItems.checklistItemId, checklistItems.id))
    .leftJoin(assigneeAlias, eq(checklistItems.assigneeId, assigneeAlias.id))
    .leftJoin(tasks, eq(checklistItems.taskId, tasks.id))
    .leftJoin(crs, eq(tasks.crsId, crs.id))
    .leftJoin(clients, eq(crs.clientId, clients.id))
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

// ─── Whiteboards ──────────────────────────────────────────────────────────────
export async function getWhiteboardsByUser(userId: number) {
  const db = await getDb();
  return db.select().from(whiteboards).where(eq(whiteboards.userId, userId)).orderBy(asc(whiteboards.pageIndex));
}

export async function saveWhiteboard(userId: number, pageIndex: number, title: string, dataUrl: string) {
  const db = await getDb();
  const existing = await db.select({ id: whiteboards.id })
    .from(whiteboards)
    .where(and(eq(whiteboards.userId, userId), eq(whiteboards.pageIndex, pageIndex)))
    .limit(1);
  if (existing.length > 0) {
    await db.update(whiteboards)
      .set({ dataUrl, title, updatedAt: new Date() })
      .where(eq(whiteboards.id, existing[0].id));
    return existing[0].id;
  } else {
    const [res] = await db.insert(whiteboards).values({ userId, pageIndex, title, dataUrl });
    return (res as any).insertId as number;
  }
}

export async function deleteWhiteboard(id: number, userId: number) {
  const db = await getDb();
  await db.delete(whiteboards).where(and(eq(whiteboards.id, id), eq(whiteboards.userId, userId)));
}

export async function renameWhiteboard(id: number, userId: number, title: string) {
  const db = await getDb();
  await db.update(whiteboards).set({ title }).where(and(eq(whiteboards.id, id), eq(whiteboards.userId, userId)));
}

// ─── My Tasks (all tasks assigned to a user) ──────────────────────────────────
export async function getMyTasks(userId: number) {
  const db = await getDb();
  return db.select({
    id: tasks.id,
    title: tasks.title,
    dueDate: tasks.dueDate,
    progress: tasks.progress,
    phaseId: tasks.phaseId,
    crsId: tasks.crsId,
    crsName: crs.name,
  })
    .from(tasks)
    .leftJoin(crs, eq(tasks.crsId, crs.id))
    .where(eq(tasks.assigneeId, userId))
    .orderBy(asc(tasks.dueDate));
}

// ─── User Disciplines ─────────────────────────────────────────────────────────
export async function getCompletedTasksSummary(limit = 100) {
  const db = await getDb();
  return db.select({
    id: tasks.id,
    title: tasks.title,
    progress: tasks.progress,
    completedAt: tasks.completedAt,
    updatedAt: tasks.updatedAt,
    dueDate: tasks.dueDate,
    crsName: crs.name,
    assigneeName: users.name,
    phaseName: kanbanPhases.name,
  })
    .from(tasks)
    .leftJoin(crs, eq(tasks.crsId, crs.id))
    .leftJoin(users, eq(tasks.assigneeId, users.id))
    .leftJoin(kanbanPhases, eq(tasks.phaseId, kanbanPhases.id))
    .where(and(
      eq(crs.status, "active"),
      or(gte(tasks.progress, 100), eq(kanbanPhases.isTerminal, true)),
    ))
    .orderBy(desc(tasks.completedAt), desc(tasks.updatedAt))
    .limit(limit);
}

export async function getUserDisciplines(userId: number) {
  const db = await getDb();
  return db.select().from(userDisciplines).where(eq(userDisciplines.userId, userId));
}
export async function setUserDisciplines(userId: number, disciplineNames: string[]) {
  const db = await getDb();
  await db.delete(userDisciplines).where(eq(userDisciplines.userId, userId));
  if (disciplineNames.length > 0) {
    for (const name of disciplineNames) {
      await db.execute(
        sql`INSERT INTO user_disciplines (userId, disciplineName, createdAt) VALUES (${userId}, ${name}, NOW())`
      );
    }
  }
}
// ─── Activity Logs (Registros) ────────────────────────────────────────────────
export async function getActivityLogs(filters?: { limit?: number; userId?: number; entityType?: string }) {
  const db = await getDb();
  const conditions = [];
  if (filters?.userId) conditions.push(eq(activityLogs.userId, filters.userId));
  if (filters?.entityType) conditions.push(eq(activityLogs.entityType, filters.entityType));
  const query = db.select({
    id: activityLogs.id,
    userId: activityLogs.userId,
    action: activityLogs.action,
    entityType: activityLogs.entityType,
    entityId: activityLogs.entityId,
    metadata: activityLogs.metadata,
    createdAt: activityLogs.createdAt,
    userName: users.name,
    userAvatar: users.avatarUrl,
  }).from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(activityLogs.createdAt))
    .limit(filters?.limit ?? 200);
  return query;
}
// ─── Task Trend (últimos 30 dias) ─────────────────────────────────────────────
export async function getTaskTrend(clientId?: number) {
  const db = await getDb();
  const now = new Date();
  const days: { date: string; completed: number; overdue: number; created: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const dEnd = new Date(d);
    dEnd.setHours(23, 59, 59, 999);
    const label = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    // tasks created on that day
    const baseQ = db.select({ id: tasks.id, progress: tasks.progress, dueDate: tasks.dueDate, createdAt: tasks.createdAt })
      .from(tasks);
    const allTasks = clientId
      ? await baseQ.innerJoin(crs, and(eq(tasks.crsId, crs.id), eq(crs.clientId, clientId)))
      : await baseQ;
    const created = allTasks.filter((t: any) => t.createdAt && new Date(t.createdAt) >= d && new Date(t.createdAt) <= dEnd).length;
    const completed = allTasks.filter((t: any) => t.progress >= 100 && t.dueDate && new Date(t.dueDate) >= d && new Date(t.dueDate) <= dEnd).length;
    const overdue = allTasks.filter((t: any) => t.progress < 100 && t.dueDate && new Date(t.dueDate) >= d && new Date(t.dueDate) <= dEnd).length;
    days.push({ date: label, completed, overdue, created });
  }
  return days;
}

// ─── Member Performance ───────────────────────────────────────────────────────
export async function getMemberPerformance(crsId?: number) {
  const db = await getDb();
  // Use raw SQL for aggregation with conditional crsId filter
  const crsFilter = crsId ? `AND t.crsId = ${Number(crsId)}` : "";
  const [rows] = await (db as any).$client.query(`
    SELECT
      u.id as userId,
      u.name as userName,
      u.avatarUrl,
      u.role,
      COUNT(t.id) as total,
      SUM(CASE WHEN kp.isTerminal = 1 THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN (kp.isTerminal = 0 OR kp.isTerminal IS NULL) AND t.status = 'in_progress' THEN 1 ELSE 0 END) as inProgress,
      SUM(CASE WHEN t.status = 'shared' THEN 1 ELSE 0 END) as shared,
      SUM(CASE WHEN t.status = 'blocked' THEN 1 ELSE 0 END) as blocked,
      SUM(CASE WHEN (kp.isTerminal = 0 OR kp.isTerminal IS NULL) AND t.status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN t.dueDate < NOW() AND (kp.isTerminal = 0 OR kp.isTerminal IS NULL) THEN 1 ELSE 0 END) as overdue
    FROM users u
    LEFT JOIN tasks t ON t.assigneeId = u.id ${crsFilter}
    LEFT JOIN kanban_phases kp ON kp.id = t.phaseId
    GROUP BY u.id, u.name, u.avatarUrl, u.role
    ORDER BY total DESC, u.name ASC
  `);
  return (rows as any[]).map(r => ({
    userId: r.userId,
    userName: r.userName,
    avatarUrl: r.avatarUrl,
    role: r.role,
    total: Number(r.total),
    completed: Number(r.completed),
    inProgress: Number(r.inProgress),
    shared: Number(r.shared),
    blocked: Number(r.blocked),
    pending: Number(r.pending),
    overdue: Number(r.overdue),
    completionRate: r.total > 0 ? Math.round((Number(r.completed) / Number(r.total)) * 100) : 0,
  }));
}

// ─── Sprint with Tasks ────────────────────────────────────────────────────────
export async function getSprintWithTasks(sprintId: number) {
  const db = await getDb();
  const [sprint] = await db.select().from(sprints).where(eq(sprints.id, sprintId));
  if (!sprint) return null;
  // Fetch tasks linked to this sprint with phase info
  const sprintTaskRows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      phaseId: tasks.phaseId,
      phaseName: kanbanPhases.name,
      phaseColor: kanbanPhases.color,
      phaseIsTerminal: kanbanPhases.isTerminal,
      setor: tasks.setor,
      assigneeId: tasks.assigneeId,
      dueDate: tasks.dueDate,
      crsId: tasks.crsId,
      priority: tasks.priority,
      progress: tasks.progress,
    })
    .from(sprintTasks)
    .innerJoin(tasks, eq(sprintTasks.taskId, tasks.id))
    .leftJoin(kanbanPhases, eq(tasks.phaseId, kanbanPhases.id))
    .where(eq(sprintTasks.sprintId, sprintId))
    .orderBy(asc(sprintTasks.addedAt));
  // Compute burndown data points
  const start = new Date(sprint.startDate);
  const end = new Date(sprint.endDate);
  const totalTasks = sprintTaskRows.length;
  const dataPoints: { date: string; remaining: number; ideal: number }[] = [];
  const msPerDay = 86400000;
  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / msPerDay));
  for (let d = 0; d <= totalDays; d++) {
    const day = new Date(start.getTime() + d * msPerDay);
    const dateStr = day.toISOString().split("T")[0];
    const remaining = sprintTaskRows.filter((t: typeof sprintTaskRows[0]) => !t.phaseIsTerminal).length;
    const ideal = totalTasks - (totalTasks / totalDays) * d;
    dataPoints.push({ date: dateStr, remaining, ideal: Math.max(0, ideal) });
  }
  return { ...sprint, tasks: sprintTaskRows, dataPoints };
}

export async function addTaskToSprint(sprintId: number, taskId: number) {
  const db = await getDb();
  await db.execute(
    sql`INSERT IGNORE INTO sprint_tasks (sprintId, taskId, addedAt) VALUES (${sprintId}, ${taskId}, NOW())`
  );
}

export async function removeTaskFromSprint(sprintId: number, taskId: number) {
  const db = await getDb();
  await db.delete(sprintTasks).where(and(eq(sprintTasks.sprintId, sprintId), eq(sprintTasks.taskId, taskId)));
}

// ─── Annual Report ────────────────────────────────────────────────────────────
export async function getAnnualReport(year: number, clientId?: number) {
  const db = await getDb();
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59);

  // 1. Clients summary
  const allClients = await db.select({ id: clients.id, name: clients.name, color: clients.color }).from(clients);

  // 2. CRS (contracts) active in the year
  const allCrsRaw = clientId
    ? await db.select().from(crs).where(and(eq(crs.clientId, clientId)))
    : await db.select().from(crs);
  const yearCrs = allCrsRaw.filter((c: any) => {
    const created = c.createdAt ? new Date(c.createdAt) : null;
    return !created || created <= yearEnd;
  });

  // 3. Tasks active in the year
  const allTasksRaw = clientId
    ? await db.select({ id: tasks.id, title: tasks.title, setor: tasks.setor, progress: tasks.progress, dueDate: tasks.dueDate, startDate: tasks.startDate, createdAt: tasks.createdAt, crsId: tasks.crsId, assigneeId: tasks.assigneeId })
        .from(tasks).innerJoin(crs, and(eq(tasks.crsId, crs.id), eq(crs.clientId, clientId)))
    : await db.select({ id: tasks.id, title: tasks.title, setor: tasks.setor, progress: tasks.progress, dueDate: tasks.dueDate, startDate: tasks.startDate, createdAt: tasks.createdAt, crsId: tasks.crsId, assigneeId: tasks.assigneeId }).from(tasks);

  const yearTasks = allTasksRaw.filter((t: any) => {
    const start = t.startDate ? new Date(t.startDate) : t.createdAt ? new Date(t.createdAt) : null;
    const due = t.dueDate ? new Date(t.dueDate) : null;
    if (start && start >= yearStart && start <= yearEnd) return true;
    if (due && due >= yearStart && due <= yearEnd) return true;
    return false;
  });

  const totalTasks = yearTasks.length;
  const completedTasks = yearTasks.filter((t: any) => t.status === "published" || t.status === "archived" || t.progress >= 100).length;
  const inProgressTasks = yearTasks.filter((t: any) => t.status === "in_progress" || (t.progress > 0 && t.progress < 100)).length;
  const overdueTasks = yearTasks.filter((t: any) => t.dueDate && new Date(t.dueDate) < new Date() && t.progress < 100).length;
  const pendingTasks = yearTasks.filter((t: any) => t.status === "pending" || t.progress === 0).length;

  // 4. Tasks by contract
  const tasksByCrs = yearCrs.map((c: any) => {
    const cTasks = yearTasks.filter((t: any) => t.crsId === c.id);
    const cCompleted = cTasks.filter((t: any) => t.status === "published" || t.status === "archived" || t.progress >= 100).length;
    const cOverdue = cTasks.filter((t: any) => t.dueDate && new Date(t.dueDate) < new Date() && t.progress < 100).length;
    const client = allClients.find((cl: any) => cl.id === c.clientId);
    return {
      crsId: c.id,
      crsName: c.name,
      crsCode: c.code,
      clientName: client?.name ?? "—",
      totalTasks: cTasks.length,
      completedTasks: cCompleted,
      overdueTasks: cOverdue,
      progress: cTasks.length > 0 ? Math.round((cCompleted / cTasks.length) * 100) : 0,
    };
  }).filter((c: any) => c.totalTasks > 0).sort((a: any, b: any) => b.totalTasks - a.totalTasks);

  // 5. Member performance for the year
  const memberRows = await getMemberPerformance(clientId ? undefined : undefined);
  // Filter tasks by year to get year-specific member stats
  const memberStats = memberRows.map((m: any) => {
    const mTasks = yearTasks.filter((t: any) => t.assigneeId === m.userId);
    const mCompleted = mTasks.filter((t: any) => t.status === "published" || t.status === "archived" || t.progress >= 100).length;
    const mOverdue = mTasks.filter((t: any) => t.dueDate && new Date(t.dueDate) < new Date() && t.progress < 100).length;
    return {
      userId: m.userId,
      userName: m.userName,
      totalTasks: mTasks.length,
      completedTasks: mCompleted,
      overdueTasks: mOverdue,
      completionRate: mTasks.length > 0 ? Math.round((mCompleted / mTasks.length) * 100) : 0,
    };
  }).filter((m: any) => m.totalTasks > 0).sort((a: any, b: any) => b.totalTasks - a.totalTasks);

  // 6. Disciplines breakdown
  const allDisciplines = await db.select().from(disciplines).where(eq(disciplines.isActive, true));
  const disciplineStats = allDisciplines.map((d: any) => {
    const dTasks = yearTasks.filter((t: any) => t.disciplineId === d.id);
    const dCompleted = dTasks.filter((t: any) => t.status === "published" || t.status === "archived" || t.progress >= 100).length;
    return {
      disciplineId: d.id,
      disciplineName: d.name,
      color: d.color,
      totalTasks: dTasks.length,
      completedTasks: dCompleted,
      completionRate: dTasks.length > 0 ? Math.round((dCompleted / dTasks.length) * 100) : 0,
    };
  }).filter((d: any) => d.totalTasks > 0).sort((a: any, b: any) => b.totalTasks - a.totalTasks);

  // 7. Monthly task creation trend
  const monthlyTrend = Array.from({ length: 12 }, (_, i) => {
    const monthStart = new Date(year, i, 1);
    const monthEnd = new Date(year, i + 1, 0, 23, 59, 59);
    const mTasks = allTasksRaw.filter((t: any) => {
      const d = t.createdAt ? new Date(t.createdAt) : null;
      return d && d >= monthStart && d <= monthEnd;
    });
    const mCompleted = mTasks.filter((t: any) => t.status === "published" || t.status === "archived" || t.progress >= 100).length;
    return {
      month: i + 1,
      monthName: new Date(year, i, 1).toLocaleString("pt-BR", { month: "short" }),
      created: mTasks.length,
      completed: mCompleted,
    };
  });

  return {
    year,
    generatedAt: new Date().toISOString(),
    summary: {
      totalContracts: yearCrs.length,
      activeContracts: yearCrs.filter((c: any) => c.status === "active").length,
      totalTasks,
      completedTasks,
      inProgressTasks,
      overdueTasks,
      pendingTasks,
      completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      totalClients: clientId ? 1 : allClients.length,
    },
    tasksByCrs,
    memberStats,
    disciplineStats,
    monthlyTrend,
  };
}

// ── getContractsForPdf ────────────────────────────────────────────────────────
export async function getContractsForPdf(clientId?: number) {
  const db = await getDb();
  const { sql: sqlExpr } = await import("drizzle-orm");

  // Buscar contratos com dados técnicos
  const clientFilter = clientId ? `AND c.clientId = ${clientId}` : "";
  const [crsRows] = await db.execute(sqlExpr.raw(`
    SELECT c.id, c.name, c.code, c.state, c.country, c.tipoObra, c.extensaoKm, c.areaHa,
           cl.name as clientName
    FROM crs c
    LEFT JOIN clients cl ON cl.id = c.clientId
    WHERE c.status = 'active' ${clientFilter}
    ORDER BY c.name
  `)) as any;

  const contracts = (crsRows as any[]).map(async (c: any) => {
    // Buscar tarefas agrupadas por disciplina (setor)
    const [taskRows] = await db.execute(sqlExpr.raw(`
      SELECT t.id, t.title, t.setor, t.status, t.dueDate, t.progress,
             u.name as assigneeName
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assigneeId
      WHERE t.projectId = ${c.id}
      ORDER BY t.setor, t.title
    `)) as any;

    // Agrupar tarefas por disciplina
    const tasksByDiscipline: Record<string, any[]> = {};
    (taskRows as any[]).forEach((t: any) => {
      const key = t.setor || "Sem Disciplina";
      if (!tasksByDiscipline[key]) tasksByDiscipline[key] = [];
      tasksByDiscipline[key].push(t);
    });

    // Para cada tarefa, buscar checklist
    const taskIds = (taskRows as any[]).map((t: any) => t.id);
    let checklistByTask: Record<number, any[]> = {};
    if (taskIds.length > 0) {
      const [clRows] = await db.execute(sqlExpr.raw(`
        SELECT id, taskId, title, status
        FROM checklist_items
        WHERE taskId IN (${taskIds.join(",")})
        ORDER BY taskId, id
      `)) as any;
      (clRows as any[]).forEach((cl: any) => {
        if (!checklistByTask[cl.taskId]) checklistByTask[cl.taskId] = [];
        checklistByTask[cl.taskId].push(cl);
      });
    }

    // Tipos de obra
    let tiposObra: string[] = [];
    try { tiposObra = JSON.parse(c.tipoObra ?? "[]"); } catch { tiposObra = c.tipoObra ? [c.tipoObra] : []; }

    return {
      id: c.id,
      name: c.name,
      code: c.code,
      state: c.state,
      country: c.country,
      clientName: c.clientName,
      tiposObra,
      extensaoKm: c.extensaoKm,
      areaHa: c.areaHa,
      tasksByDiscipline,
      checklistByTask,
      totalTasks: (taskRows as any[]).length,
    };
  });

  return Promise.all(contracts);
}


// ─── Google Calendar ────────────────────────────────────────────────────────────
export async function getGoogleCalendarToken(userId: number) {
  const db = await getDb();
  const r = await db.select().from(googleCalendarTokens).where(eq(googleCalendarTokens.userId, userId)).limit(1);
  return r[0];
}

export async function saveGoogleCalendarToken(userId: number, data: { accessToken: string; refreshToken?: string; expiresAt?: Date }) {
  const db = await getDb();
  const existing = await getGoogleCalendarToken(userId);
  
  if (existing) {
    await db.update(googleCalendarTokens)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(googleCalendarTokens.userId, userId));
  } else {
    await db.insert(googleCalendarTokens).values({
      userId,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: data.expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}

export async function deleteGoogleCalendarToken(userId: number) {
  const db = await getDb();
  await db.delete(googleCalendarTokens).where(eq(googleCalendarTokens.userId, userId));
}

export async function saveGoogleCalendarEvent(userId: number, data: {
  googleEventId: string;
  agendaEventId?: number;
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  isSynced: boolean;
}) {
  const db = await getDb();
  const existing = await db.select().from(googleCalendarEvents)
    .where(and(eq(googleCalendarEvents.userId, userId), eq(googleCalendarEvents.googleEventId, data.googleEventId)))
    .limit(1);
  
  if (existing[0]) {
    await db.update(googleCalendarEvents)
      .set({ ...data, lastSyncedAt: new Date(), updatedAt: new Date() })
      .where(eq(googleCalendarEvents.id, existing[0].id));
  } else {
    await db.insert(googleCalendarEvents).values({
      userId,
      ...data,
      lastSyncedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}

export async function getGoogleCalendarEventsByUser(userId: number) {
  const db = await getDb();
  return await db.select().from(googleCalendarEvents).where(eq(googleCalendarEvents.userId, userId));
}

export async function deleteGoogleCalendarEvent(eventId: number) {
  const db = await getDb();
  await db.delete(googleCalendarEvents).where(eq(googleCalendarEvents.id, eventId));
}


// ─── Meetings ───────────────────────────────────────────────────────────────────
export async function getMeetings(filters?: { crsId?: number; taskId?: number; from?: Date; to?: Date }) {
  const db = await getDb();
  const conditions: any[] = [];
  if (filters?.crsId) conditions.push(eq(meetings.crsId, filters.crsId));
  if (filters?.taskId) conditions.push(eq(meetings.taskId, filters.taskId));
  if (filters?.from) conditions.push(gte(meetings.startDate, filters.from));
  if (filters?.to) conditions.push(lte(meetings.startDate, filters.to));
  return db.select({
    id: meetings.id,
    createdById: meetings.createdById,
    crsId: meetings.crsId,
    taskId: meetings.taskId,
    title: meetings.title,
    description: meetings.description,
    startDate: meetings.startDate,
    endDate: meetings.endDate,
    googleEventId: meetings.googleEventId,
    googleMeetUrl: meetings.googleMeetUrl,
    meetingCode: meetings.meetingCode,
    participantIds: meetings.participantIds,
    participantEmails: meetings.participantEmails,
    actualParticipants: meetings.actualParticipants,
    actualStartDate: meetings.actualStartDate,
    actualEndDate: meetings.actualEndDate,
    status: meetings.status,
    lastSyncedAt: meetings.lastSyncedAt,
    createdAt: meetings.createdAt,
    updatedAt: meetings.updatedAt,
    crsName: crs.name,
    crsCode: crs.code,
    taskTitle: tasks.title,
    creatorName: users.name,
    creatorAvatar: users.avatarUrl,
  }).from(meetings)
    .leftJoin(crs, eq(meetings.crsId, crs.id))
    .leftJoin(tasks, eq(meetings.taskId, tasks.id))
    .leftJoin(users, eq(meetings.createdById, users.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(meetings.startDate));
}

export async function getMeetingById(id: number) {
  const rows = await getMeetings();
  return rows.find((meeting: any) => meeting.id === id);
}

export async function createMeeting(data: {
  createdById: number;
  crsId: number;
  taskId?: number;
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  participantIds?: string;
  participantEmails?: string;
  googleEventId?: string;
  googleMeetUrl?: string;
  meetingCode?: string;
}) {
  const db = await getDb();
  const [result] = await db.insert(meetings).values({
    createdById: data.createdById,
    crsId: data.crsId,
    taskId: data.taskId ?? null,
    title: data.title,
    description: data.description ?? null,
    startDate: data.startDate,
    endDate: data.endDate,
    participantIds: data.participantIds ?? null,
    participantEmails: data.participantEmails ?? null,
    googleEventId: data.googleEventId ?? null,
    googleMeetUrl: data.googleMeetUrl ?? null,
    meetingCode: data.meetingCode ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return (result as any).insertId as number;
}

export async function updateMeeting(id: number, data: Partial<{
  googleEventId: string | null;
  googleMeetUrl: string | null;
  meetingCode: string | null;
  actualParticipants: string | null;
  actualStartDate: Date | null;
  actualEndDate: Date | null;
  status: "scheduled" | "completed" | "canceled";
  lastSyncedAt: Date | null;
}>) {
  const db = await getDb();
  await db.update(meetings).set({ ...data, updatedAt: new Date() }).where(eq(meetings.id, id));
}

export async function deleteMeeting(id: number) {
  const db = await getDb();
  await db.delete(meetings).where(eq(meetings.id, id));
}

// ─── Subscription Plans ────────────────────────────────────────────────────────
export async function getSubscriptionPlans() {
  const db = await getDb();
  return await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.isActive, true));
}

export async function getSubscriptionPlanById(id: number) {
  const db = await getDb();
  return await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, id)).limit(1).then((r: any[]) => r[0]);
}

export async function getSubscriptionPlanByStripePriceId(stripePriceId: string) {
  const db = await getDb();
  return await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.stripePriceId, stripePriceId)).limit(1).then((r: any[]) => r[0]);
}

export async function createSubscriptionPlan(data: {
  name: string;
  stripePriceId: string;
  stripeProductId: string;
  monthlyPrice: number;
  annualPrice: number;
  maxUsers: number;
  maxProjects: number;
  features?: string;
  description?: string;
}) {
  const db = await getDb();
  const [result] = await db.execute(
    sql`INSERT INTO subscription_plans (name, stripePriceId, stripeProductId, monthlyPrice, annualPrice, maxUsers, maxProjects, features, description, isActive, createdAt, updatedAt)
        VALUES (${data.name}, ${data.stripePriceId}, ${data.stripeProductId}, ${data.monthlyPrice}, ${data.annualPrice}, ${data.maxUsers}, ${data.maxProjects}, ${data.features ?? null}, ${data.description ?? null}, TRUE, NOW(), NOW())`
  );
  return (result as any).insertId as number;
}

// ─── User Subscriptions ────────────────────────────────────────────────────────
export async function getUserSubscription(userId: number) {
  const db = await getDb();
  const result: any[] = await db.select().from(userSubscriptions)
    .where(and(eq(userSubscriptions.userId, userId), eq(userSubscriptions.status, "active")))
    .limit(1);
  return result[0];
}

export async function getUserSubscriptionByStripeId(stripeSubscriptionId: string) {
  const db = await getDb();
  return await db.select().from(userSubscriptions)
    .where(eq(userSubscriptions.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1)
    .then((r: any[]) => r[0]);
}

export async function createUserSubscription(data: {
  userId: number;
  planId: number;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  status: "active" | "trialing" | "past_due" | "canceled" | "unpaid";
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  trialEndDate?: Date;
  billingCycle: "monthly" | "annual";
}) {
  const db = await getDb();
  const [result] = await db.execute(
    sql`INSERT INTO user_subscriptions (userId, planId, stripeSubscriptionId, stripeCustomerId, status, currentPeriodStart, currentPeriodEnd, trialEndDate, billingCycle, autoRenew, createdAt, updatedAt)
        VALUES (${data.userId}, ${data.planId}, ${data.stripeSubscriptionId ?? null}, ${data.stripeCustomerId ?? null}, ${data.status}, ${data.currentPeriodStart ?? null}, ${data.currentPeriodEnd ?? null}, ${data.trialEndDate ?? null}, ${data.billingCycle}, TRUE, NOW(), NOW())`
  );
  return (result as any).insertId as number;
}

export async function updateUserSubscription(subscriptionId: number, data: Partial<{
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  canceledAt: Date;
  cancelReason: string;
  autoRenew: boolean;
}>) {
  const db = await getDb();
  await db.update(userSubscriptions).set({ ...data, updatedAt: new Date() }).where(eq(userSubscriptions.id, subscriptionId));
}

export async function cancelUserSubscription(subscriptionId: number, reason?: string) {
  const db = await getDb();
  await db.update(userSubscriptions).set({
    status: "canceled",
    canceledAt: new Date(),
    cancelReason: reason ?? null,
    updatedAt: new Date(),
  }).where(eq(userSubscriptions.id, subscriptionId));
}

// ─── Subscription Invoices ─────────────────────────────────────────────────────
export async function getUserInvoices(userId: number) {
  const db = await getDb();
  return await db.select().from(subscriptionInvoices)
    .where(eq(subscriptionInvoices.userId, userId))
    .orderBy(desc(subscriptionInvoices.createdAt));
}

export async function createSubscriptionInvoice(data: {
  userId: number;
  subscriptionId: number;
  stripeInvoiceId?: string;
  amount: number;
  currency?: string;
  status?: string;
  paidAt?: Date;
  dueDate?: Date;
  invoiceUrl?: string;
}) {
  const db = await getDb();
  const [result] = await db.execute(
    sql`INSERT INTO subscription_invoices (userId, subscriptionId, stripeInvoiceId, amount, currency, status, paidAt, dueDate, invoiceUrl, createdAt, updatedAt)
        VALUES (${data.userId}, ${data.subscriptionId}, ${data.stripeInvoiceId ?? null}, ${data.amount}, ${data.currency ?? "BRL"}, ${data.status ?? "open"}, ${data.paidAt ?? null}, ${data.dueDate ?? null}, ${data.invoiceUrl ?? null}, NOW(), NOW())`
  );
  return (result as any).insertId as number;
}

export async function updateSubscriptionInvoice(invoiceId: number, data: Partial<{
  status: string;
  paidAt: Date;
}>) {
  const db = await getDb();
  await db.update(subscriptionInvoices).set({ ...data, updatedAt: new Date() }).where(eq(subscriptionInvoices.id, invoiceId));
}

// ─── Subscription Helpers ──────────────────────────────────────────────────────
export async function hasActiveSubscription(userId: number): Promise<boolean> {
  const sub = await getUserSubscription(userId);
  return !!sub && (sub.status === "active" || sub.status === "trialing");
}

export async function isTrialPeriod(userId: number): Promise<boolean> {
  const sub = await getUserSubscription(userId);
  if (!sub || !sub.trialEndDate) return false;
  return new Date() < sub.trialEndDate;
}

export async function getSubscriptionStatus(userId: number) {
  const sub = await getUserSubscription(userId);
  if (!sub) return { hasSubscription: false, status: "no_subscription", plan: null, daysRemaining: null };
  
  const plan = await getSubscriptionPlanById(sub.planId);
  const now = new Date();
  const daysRemaining = sub.currentPeriodEnd ? Math.ceil((sub.currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
  
  return {
    hasSubscription: true,
    status: sub.status,
    plan: plan?.name,
    daysRemaining,
    isTrialing: sub.status === "trialing",
    trialEndsAt: sub.trialEndDate,
  };
}
