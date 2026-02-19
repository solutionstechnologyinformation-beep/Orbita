import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  activityLogs,
  chatMessages,
  InsertActivityLog,
  InsertChatMessage,
  InsertNotification,
  InsertProject,
  InsertProjectMember,
  InsertTask,
  InsertTaskAttachment,
  InsertTaskComment,
  InsertUser,
  notifications,
  projectMembers,
  projects,
  taskAttachments,
  taskComments,
  tasks,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const fields = ["name", "email", "loginMethod", "avatarUrl"] as const;
  for (const f of fields) {
    const v = user[f];
    if (v !== undefined) { values[f] = v ?? null; updateSet[f] = v ?? null; }
  }
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return r[0];
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return r[0];
}

export async function getAllUsers(limit = 100, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt)).limit(limit).offset(offset);
}

export async function updateUserRole(userId: number, role: "user" | "admin") {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

// ─── Projects ─────────────────────────────────────────────────────────────────
export async function createProject(data: InsertProject) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(projects).values(data);
  return result.insertId as number;
}

export async function getProjectsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  // Projects owned by user OR where user is a member
  const owned = await db.select().from(projects).where(eq(projects.ownerId, userId));
  const memberRows = await db.select({ projectId: projectMembers.projectId })
    .from(projectMembers).where(eq(projectMembers.userId, userId));
  const memberIds = memberRows.map(r => r.projectId).filter(id => !owned.find(p => p.id === id));
  if (memberIds.length === 0) return owned;
  const memberProjects = await db.select().from(projects).where(inArray(projects.id, memberIds));
  return [...owned, ...memberProjects];
}

export async function getProjectById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return r[0];
}

export async function updateProject(id: number, data: Partial<InsertProject>) {
  const db = await getDb();
  if (!db) return;
  await db.update(projects).set({ ...data, updatedAt: new Date() }).where(eq(projects.id, id));
}

export async function deleteProject(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(projects).where(eq(projects.id, id));
}

export async function getAllProjects() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projects).orderBy(desc(projects.createdAt));
}

// ─── Project Members ──────────────────────────────────────────────────────────
export async function addProjectMember(data: InsertProjectMember) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(projectMembers).values(data);
}

export async function getProjectMembers(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    id: projectMembers.id,
    projectId: projectMembers.projectId,
    userId: projectMembers.userId,
    role: projectMembers.role,
    invitedAt: projectMembers.invitedAt,
    userName: users.name,
    userEmail: users.email,
    userAvatarUrl: users.avatarUrl,
  }).from(projectMembers)
    .leftJoin(users, eq(projectMembers.userId, users.id))
    .where(eq(projectMembers.projectId, projectId));
  return rows;
}

export async function removeProjectMember(projectId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
}

export async function isProjectMember(projectId: number, userId: number) {
  const db = await getDb();
  if (!db) return false;
  const r = await db.select({ id: projectMembers.id }).from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId))).limit(1);
  return r.length > 0;
}

// ─── Tasks ────────────────────────────────────────────────────────────────────
export async function createTask(data: InsertTask) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  // Use raw SQL to avoid Drizzle mysql2 enum serialization issues.
  // position uses modulo to stay within INT range (max 2,147,483,647).
  const safePosition = data.position ? data.position % 2000000000 : Date.now() % 2000000000;
  const [result] = await db.execute(
    sql`INSERT INTO tasks (projectId, title, description, status, priority, assigneeId, createdById, dueDate, position)
        VALUES (${data.projectId}, ${data.title}, ${data.description ?? null}, ${data.status ?? 'todo'}, ${data.priority ?? 'medium'}, ${data.assigneeId ?? null}, ${data.createdById}, ${data.dueDate ?? null}, ${safePosition})`
  );
  return (result as any).insertId as number;
}

export async function getTasksByProject(
  projectId: number,
  filters?: { status?: string; priority?: string; assigneeId?: number; search?: string }
) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(tasks.projectId, projectId)];
  if (filters?.status) conditions.push(eq(tasks.status, filters.status as any));
  if (filters?.priority) conditions.push(eq(tasks.priority, filters.priority as any));
  if (filters?.assigneeId) conditions.push(eq(tasks.assigneeId, filters.assigneeId));
  if (filters?.search) conditions.push(like(tasks.title, `%${filters.search}%`));

  const rows = await db.select({
    id: tasks.id,
    projectId: tasks.projectId,
    title: tasks.title,
    description: tasks.description,
    status: tasks.status,
    priority: tasks.priority,
    assigneeId: tasks.assigneeId,
    createdById: tasks.createdById,
    dueDate: tasks.dueDate,
    position: tasks.position,
    createdAt: tasks.createdAt,
    updatedAt: tasks.updatedAt,
    assigneeName: users.name,
    assigneeAvatarUrl: users.avatarUrl,
  }).from(tasks)
    .leftJoin(users, eq(tasks.assigneeId, users.id))
    .where(and(...conditions))
    .orderBy(tasks.position, tasks.createdAt);
  return rows;
}

export async function getTaskById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select({
    id: tasks.id,
    projectId: tasks.projectId,
    title: tasks.title,
    description: tasks.description,
    status: tasks.status,
    priority: tasks.priority,
    assigneeId: tasks.assigneeId,
    assigneeName: users.name,
    assigneeAvatarUrl: users.avatarUrl,
    dueDate: tasks.dueDate,
    position: tasks.position,
    createdById: tasks.createdById,
    createdAt: tasks.createdAt,
    updatedAt: tasks.updatedAt,
  }).from(tasks)
    .leftJoin(users, eq(tasks.assigneeId, users.id))
    .where(eq(tasks.id, id)).limit(1);
  return r[0];
}

export async function updateTask(id: number, data: Partial<InsertTask>) {
  const db = await getDb();
  if (!db) return;
  await db.update(tasks).set({ ...data, updatedAt: new Date() }).where(eq(tasks.id, id));
}

export async function deleteTask(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(tasks).where(eq(tasks.id, id));
}

export async function getTasksAssignedToUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tasks).where(eq(tasks.assigneeId, userId)).orderBy(desc(tasks.createdAt)).limit(20);
}

export async function getTaskCountsByProject(projectId: number) {
  const db = await getDb();
  if (!db) return { todo: 0, in_progress: 0, done: 0, total: 0 };
  const rows = await db.select({ status: tasks.status, count: sql<number>`count(*)` })
    .from(tasks).where(eq(tasks.projectId, projectId)).groupBy(tasks.status);
  const counts = { todo: 0, in_progress: 0, done: 0, total: 0 };
  for (const r of rows) {
    counts[r.status as keyof typeof counts] = Number(r.count);
    counts.total += Number(r.count);
  }
  return counts;
}

// ─── Task Comments ────────────────────────────────────────────────────────────
export async function createTaskComment(data: InsertTaskComment) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(taskComments).values(data);
  return result.insertId as number;
}

export async function getTaskComments(taskId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: taskComments.id,
    taskId: taskComments.taskId,
    userId: taskComments.userId,
    content: taskComments.content,
    createdAt: taskComments.createdAt,
    updatedAt: taskComments.updatedAt,
    userName: users.name,
    userAvatarUrl: users.avatarUrl,
  }).from(taskComments)
    .leftJoin(users, eq(taskComments.userId, users.id))
    .where(eq(taskComments.taskId, taskId))
    .orderBy(taskComments.createdAt);
}

export async function deleteTaskComment(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(taskComments).where(eq(taskComments.id, id));
}

// ─── Task Attachments ─────────────────────────────────────────────────────────
export async function createTaskAttachment(data: InsertTaskAttachment) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(taskAttachments).values(data);
  return result.insertId as number;
}

export async function getTaskAttachments(taskId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: taskAttachments.id,
    taskId: taskAttachments.taskId,
    uploadedById: taskAttachments.uploadedById,
    filename: taskAttachments.filename,
    fileKey: taskAttachments.fileKey,
    fileUrl: taskAttachments.fileUrl,
    mimeType: taskAttachments.mimeType,
    fileSize: taskAttachments.fileSize,
    createdAt: taskAttachments.createdAt,
    uploaderName: users.name,
  }).from(taskAttachments)
    .leftJoin(users, eq(taskAttachments.uploadedById, users.id))
    .where(eq(taskAttachments.taskId, taskId))
    .orderBy(taskAttachments.createdAt);
}

export async function getAttachmentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(taskAttachments).where(eq(taskAttachments.id, id)).limit(1);
  return r[0];
}

export async function deleteTaskAttachment(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(taskAttachments).where(eq(taskAttachments.id, id));
}

// ─── Notifications ────────────────────────────────────────────────────────────
export async function createNotification(data: InsertNotification) {
  const db = await getDb();
  if (!db) return;
  await db.insert(notifications).values(data);
}

export async function getNotificationsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(50);
}

export async function getUnreadNotificationCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const r = await db.select({ count: sql<number>`count(*)` }).from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  return Number(r[0]?.count ?? 0);
}

export async function markNotificationRead(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
}

export async function markAllNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ isRead: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
}

export async function deleteNotification(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(notifications).where(eq(notifications.id, id));
}

// ─── Activity Logs ────────────────────────────────────────────────────────────
export async function logActivity(data: InsertActivityLog) {
  const db = await getDb();
  if (!db) return;
  await db.insert(activityLogs).values(data);
}

export async function getActivityLogs(limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: activityLogs.id,
    userId: activityLogs.userId,
    action: activityLogs.action,
    entityType: activityLogs.entityType,
    entityId: activityLogs.entityId,
    metadata: activityLogs.metadata,
    createdAt: activityLogs.createdAt,
    userName: users.name,
    userEmail: users.email,
  }).from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit).offset(offset);
}

// ─── Chat Messages ────────────────────────────────────────────────────────────
export async function saveChatMessage(data: InsertChatMessage) {
  const db = await getDb();
  if (!db) return;
  const [result] = await db.insert(chatMessages).values(data);
  return result.insertId as number;
}

export async function getChatHistory(userId: number, projectId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(chatMessages.userId, userId)];
  if (projectId) conditions.push(eq(chatMessages.projectId, projectId));
  return db.select().from(chatMessages)
    .where(and(...conditions))
    .orderBy(chatMessages.createdAt)
    .limit(100);
}

export async function clearChatHistory(userId: number, projectId?: number) {
  const db = await getDb();
  if (!db) return;
  const conditions = [eq(chatMessages.userId, userId)];
  if (projectId) conditions.push(eq(chatMessages.projectId, projectId));
  await db.delete(chatMessages).where(and(...conditions));
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
export async function getDashboardStats(userId: number) {
  const db = await getDb();
  if (!db) return { totalProjects: 0, totalTasks: 0, completedTasks: 0, pendingTasks: 0 };

  const userProjects = await getProjectsByUser(userId);
  const projectIds = userProjects.map(p => p.id);

  if (projectIds.length === 0) return { totalProjects: 0, totalTasks: 0, completedTasks: 0, pendingTasks: 0 };

  const taskCounts = await db.select({ status: tasks.status, count: sql<number>`count(*)` })
    .from(tasks).where(inArray(tasks.projectId, projectIds)).groupBy(tasks.status);

  let completedTasks = 0, pendingTasks = 0;
  for (const r of taskCounts) {
    if (r.status === "done") completedTasks = Number(r.count);
    else pendingTasks += Number(r.count);
  }

  return {
    totalProjects: userProjects.length,
    totalTasks: completedTasks + pendingTasks,
    completedTasks,
    pendingTasks,
  };
}

// ─── Due-Date Alerts ──────────────────────────────────────────────────────────
/**
 * Returns tasks that are due within the next `windowHours` hours and are not yet done.
 * Used by the background job that sends 24h-before notifications.
 */
export async function getTasksDueSoon(windowHours = 24) {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  const cutoff = new Date(now.getTime() + windowHours * 60 * 60 * 1000);
  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      dueDate: tasks.dueDate,
      assigneeId: tasks.assigneeId,
      projectId: tasks.projectId,
      createdById: tasks.createdById,
    })
    .from(tasks)
    .where(
      and(
        sql`${tasks.dueDate} IS NOT NULL`,
        sql`${tasks.dueDate} > ${now}`,
        sql`${tasks.dueDate} <= ${cutoff}`,
        sql`${tasks.status} != 'done'`
      )
    );
  return rows;
}
