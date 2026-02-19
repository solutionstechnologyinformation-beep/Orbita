import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  boolean,
} from "drizzle-orm/mysql-core";
// ─── Companies ────────────────────────────────────────────────────────────────
export const companies = mysqlTable("companies", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  color: varchar("color", { length: 32 }).default("#1e2d5a"),
  logoUrl: text("logoUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Company = typeof companies.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "master_admin", "company_admin"]).default("user").notNull(),
  avatarUrl: text("avatarUrl"),
  company: varchar("company", { length: 256 }),
  companyId: int("companyId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Projects ─────────────────────────────────────────────────────────────────
export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  color: varchar("color", { length: 32 }).default("#6366f1").notNull(),
  status: mysqlEnum("status", ["active", "archived", "completed"]).default("active").notNull(),
   ownerId: int("ownerId").notNull(),
  companyId: int("companyId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

// ─── Project Members ──────────────────────────────────────────────────────────
export const projectMembers = mysqlTable("project_members", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["owner", "admin", "member", "viewer"]).default("member").notNull(),
  invitedAt: timestamp("invitedAt").defaultNow().notNull(),
});

export type ProjectMember = typeof projectMembers.$inferSelect;
export type InsertProjectMember = typeof projectMembers.$inferInsert;

// ─── Project Roles (custom roles per project) ────────────────────────────────
export const projectRoles = mysqlTable("project_roles", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  name: varchar("name", { length: 128 }).notNull(),       // e.g. "Líder", "Designer", "Dev"
  isLeader: boolean("isLeader").default(false).notNull(), // can approve shared→published
  canApprove: boolean("canApprove").default(false).notNull(),
  color: varchar("color", { length: 32 }).default("#6366f1"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ProjectRole = typeof projectRoles.$inferSelect;
export type InsertProjectRole = typeof projectRoles.$inferInsert;

// ─── Project Member Roles (assigns a custom role to a member) ─────────────────
export const projectMemberRoles = mysqlTable("project_member_roles", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),
  roleId: int("roleId").notNull(),
  assignedAt: timestamp("assignedAt").defaultNow().notNull(),
});

export type ProjectMemberRole = typeof projectMemberRoles.$inferSelect;
export type InsertProjectMemberRole = typeof projectMemberRoles.$inferInsert;

// ─── Teams ────────────────────────────────────────────────────────────────────
export const teams = mysqlTable("teams", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  color: varchar("color", { length: 32 }).default("#6366f1"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Team = typeof teams.$inferSelect;
export type InsertTeam = typeof teams.$inferInsert;

// ─── Tasks ────────────────────────────────────────────────────────────────────
export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  title: varchar("title", { length: 512 }).notNull(),
  description: text("description"),
  // 5-phase workflow:
  // pending     = Para Iniciar (sem responsável, sem iniciar)
  // in_progress = Em Andamento (com responsável, iniciada)
  // shared      = Compartilhado (finalizada, aguardando aprovação do Líder)
  // published   = Publicado (aprovada pelo Líder)
  // archived    = Arquivado (aprovada e finalizada)
  status: mysqlEnum("status", ["pending", "in_progress", "shared", "published", "archived", "blocked"]).default("pending").notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"]).default("medium").notNull(),
  assigneeId: int("assigneeId"),
  teamId: int("teamId"),                                  // equipe responsável
  approvedById: int("approvedById"),                      // Líder que aprovou
  approvedAt: timestamp("approvedAt"),                    // quando foi aprovada
  createdById: int("createdById").notNull(),
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  dueDate: timestamp("dueDate"),
  position: int("position").default(0).notNull(),
  revisionsCount: int("revisionsCount").default(0).notNull(),
  // Setor (disciplina/departamento) — ex: Geometria, Geoprocessamento, Drenagem...
  setor: varchar("setor", { length: 128 }),
  openedAt: timestamp("openedAt"),
  completedAt: timestamp("completedAt"),
  statusChangedAt: timestamp("statusChangedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

// ─── Task Comments ────────────────────────────────────────────────────────────
export const taskComments = mysqlTable("task_comments", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  userId: int("userId").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TaskComment = typeof taskComments.$inferSelect;
export type InsertTaskComment = typeof taskComments.$inferInsert;

// ─── Task Attachments ─────────────────────────────────────────────────────────
export const taskAttachments = mysqlTable("task_attachments", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  uploadedById: int("uploadedById").notNull(),
  filename: varchar("filename", { length: 512 }).notNull(),
  fileKey: varchar("fileKey", { length: 1024 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  mimeType: varchar("mimeType", { length: 128 }),
  fileSize: int("fileSize"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TaskAttachment = typeof taskAttachments.$inferSelect;
export type InsertTaskAttachment = typeof taskAttachments.$inferInsert;

// --- Notifications ---
export const NOTIFICATION_TYPES = [
  "task_assigned",     // tarefa atribuída ao usuário
  "task_status_changed", // status da tarefa mudou
  "task_created",      // nova tarefa criada no projeto
  "task_deleted",      // tarefa excluída
  "task_comment",      // comentário adicionado
  "task_due",          // prazo próximo (24h)
  "project_invite",    // convidado para projeto
  "project_update",    // projeto atualizado
  "system",            // mensagem do sistema
] as const;
export type NotificationType = typeof NOTIFICATION_TYPES[number];

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 512 }).notNull(),
  message: text("message").notNull(),
  notificationType: mysqlEnum("notificationType", [
    "task_assigned",
    "task_status_changed",
    "task_created",
    "task_deleted",
    "task_comment",
    "task_due",
    "project_invite",
    "project_update",
    "system",
  ]).default("system").notNull(),
  isRead: boolean("isRead").default(false).notNull(),
  relatedProjectId: int("relatedProjectId"),
  relatedTaskId: int("relatedTaskId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// ─── Notification Preferences ─────────────────────────────────────────────────
export const notificationPreferences = mysqlTable("notification_preferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  notificationType: varchar("notificationType", { length: 64 }).notNull(),
  inApp: boolean("inApp").default(true).notNull(),
  email: boolean("email").default(true).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreference = typeof notificationPreferences.$inferInsert;

// ─── Activity Logs ────────────────────────────────────────────────────────────
export const activityLogs = mysqlTable("activity_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  action: varchar("action", { length: 128 }).notNull(),
  entityType: varchar("entityType", { length: 64 }).notNull(),
  entityId: int("entityId"),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = typeof activityLogs.$inferInsert;

// ─── Chat Messages ────────────────────────────────────────────────────────────
export const chatMessages = mysqlTable("chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  projectId: int("projectId"),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

// ─── Sprints ──────────────────────────────────────────────────────────────────
export const sprints = mysqlTable("sprints", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  name: varchar("name", { length: 256 }).notNull(),
  goal: text("goal"),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate").notNull(),
  status: mysqlEnum("status", ["active", "completed", "planned"]).default("planned").notNull(),
  createdById: int("createdById").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Sprint = typeof sprints.$inferSelect;
export type InsertSprint = typeof sprints.$inferInsert;

export const sprintTasks = mysqlTable("sprint_tasks", {
  id: int("id").autoincrement().primaryKey(),
  sprintId: int("sprintId").notNull(),
  taskId: int("taskId").notNull(),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
});
export type SprintTask = typeof sprintTasks.$inferSelect;

// ─── Agenda Events ────────────────────────────────────────────────────────────
export const agendaEvents = mysqlTable("agenda_events", {
  id: int("id").autoincrement().primaryKey(),
  createdById: int("createdById").notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  type: mysqlEnum("type", ["vacation", "meeting", "other"]).default("other").notNull(),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate").notNull(),
  description: text("description"),
  meetingUrl: varchar("meetingUrl", { length: 1024 }),
  attendeeIds: text("attendeeIds"), // JSON array of user IDs
  projectId: int("projectId"),
  isPublic: boolean("isPublic").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AgendaEvent = typeof agendaEvents.$inferSelect;
export type InsertAgendaEvent = typeof agendaEvents.$inferInsert;

// ─── Task Messages (Chat entre membros) ──────────────────────────────────────
export const taskMessages = mysqlTable("task_messages", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  userId: int("userId").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type TaskMessage = typeof taskMessages.$inferSelect;
export type InsertTaskMessage = typeof taskMessages.$inferInsert;

// ─── Whiteboard ───────────────────────────────────────────────────────────────
export const whiteboardData = mysqlTable("whiteboard_data", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  content: text("content").notNull().default("[]"), // JSON array of canvas elements
  updatedById: int("updatedById"),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type WhiteboardData = typeof whiteboardData.$inferSelect;
export type InsertWhiteboardData = typeof whiteboardData.$inferInsert;
