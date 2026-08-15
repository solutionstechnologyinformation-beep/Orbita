import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  boolean,
  float,
  mediumtext,
  primaryKey,
} from "drizzle-orm/mysql-core";

// ─── Companies (Multi-Tenant v3.9) ────────────────────────────────────────────
export const companies = mysqlTable("companies", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  color: varchar("color", { length: 32 }).default("#2563eb").notNull(),
  logoUrl: text("logoUrl"),
  logoDarkUrl: text("logoDarkUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Company = typeof companies.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;

export const companyDomains = mysqlTable("company_domains", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  domain: varchar("domain", { length: 255 }).notNull().unique(),
  status: mysqlEnum("status", ["pending", "verified", "disabled"]).default("pending").notNull(),
  verificationToken: varchar("verificationToken", { length: 128 }),
  verifiedAt: timestamp("verifiedAt"),
  isPrimary: boolean("isPrimary").default(false).notNull(),
  sslStatus: mysqlEnum("sslStatus", ["pending", "active", "expiring", "expired"]).default("pending").notNull(),
  sslExpiresAt: timestamp("sslExpiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CompanyDomain = typeof companyDomains.$inferSelect;
export type InsertCompanyDomain = typeof companyDomains.$inferInsert;

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "master_admin", "company_admin", "leader"]).default("user").notNull(),
  avatarUrl: text("avatarUrl"),
  avatarColor: varchar("avatarColor", { length: 32 }),
  avatarInitials: varchar("avatarInitials", { length: 4 }),
  company: varchar("company", { length: 256 }),
  companyId: int("companyId"),
  passwordHash: varchar("passwordHash", { length: 255 }),
  tfaSecret: varchar("tfaSecret", { length: 255 }),
  tfaEnabled: boolean("tfaEnabled").default(false).notNull(),
  tfaBackupCodes: text("tfaBackupCodes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  lastSeenAt: timestamp("lastSeenAt").defaultNow(),
});
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Clients (Grupo de Clientes — nível mais alto) ────────────────────────────
export const clients = mysqlTable("clients", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  crsCode: varchar("crsCode", { length: 64 }),  // código identificador do cliente no CRS (ex: "Seinfra", "DNIT")
  color: varchar("color", { length: 32 }).default("#1561ad").notNull(),
  status: mysqlEnum("status", ["active", "archived"]).default("active").notNull(),
  createdById: int("createdById").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

// ─── CRS (Contratos/Projetos dentro dos Clientes) ─────────────────────────────
export const crs = mysqlTable("crs", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  companyId: int("companyId"),
  name: varchar("name", { length: 256 }).notNull(),
  code: varchar("code", { length: 64 }),
  description: text("description"),
  country: varchar("country", { length: 128 }),       // país do contrato
  countryCode: varchar("countryCode", { length: 8 }), // código ISO do país
  state: varchar("state", { length: 128 }),            // estado/província
  stateCode: varchar("stateCode", { length: 16 }),     // código do estado
  status: mysqlEnum("status", ["active", "archived"]).default("active").notNull(),
  progress: float("progress").default(0).notNull(),    // 0-100, calculado automaticamente
  // ── Dados técnicos da obra ──────────────────────────────────────────────────
  tipoObra: text("tipoObra"),  // JSON array: ["implementacao","restauracao",...] — múltiplos tipos por CRS
  extensaoKm: float("extensaoKm"),          // extensão em km (para rodovias/ferrovias)
  areaHa: float("areaHa"),                  // área em hectares
  perimetroUrbano: int("perimetroUrbano"),   // quantidade de perímetros urbanos
  techDataByType: text("techDataByType"),     // JSON: {"restauracao":{"extensaoKm":55,"areaHa":null},...}
  createdById: int("createdById").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Crs = typeof crs.$inferSelect;
export type InsertCrs = typeof crs.$inferInsert;

// ─── Trechos geográficos importados (KMZ/KML) ──────────────────────────────────
export const crsSegments = mysqlTable("crs_segments", {
  id: int("id").autoincrement().primaryKey(),
  crsId: int("crsId").notNull(),
  name: varchar("name", { length: 256 }).notNull(),
  fileName: varchar("fileName", { length: 256 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  geometryJson: mediumtext("geometryJson").notNull(),
  boundsJson: text("boundsJson"),
  createdById: int("createdById").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CrsSegment = typeof crsSegments.$inferSelect;
export type InsertCrsSegment = typeof crsSegments.$inferInsert;

// ─── Kanban Phases (Fases customizáveis por CRS) ──────────────────────────────
// Substitui os status fixos do Kanban — cada CRS pode ter suas próprias fases
export const kanbanPhases = mysqlTable("kanban_phases", {
  id: int("id").autoincrement().primaryKey(),
  crsId: int("crsId").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  color: varchar("color", { length: 32 }).default("#6366f1").notNull(),
  position: int("position").default(0).notNull(),
  // isDefault: marca fases padrão criadas automaticamente ao criar o CRS
  isDefault: boolean("isDefault").default(false).notNull(),
  // isTerminal: fases que contam como "concluído" para cálculo de progresso
  isTerminal: boolean("isTerminal").default(false).notNull(),
  createdById: int("createdById").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type KanbanPhase = typeof kanbanPhases.$inferSelect;
export type InsertKanbanPhase = typeof kanbanPhases.$inferInsert;

// ─── Tasks ────────────────────────────────────────────────────────────────────
export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  crsId: int("crsId").notNull(),
  phaseId: int("phaseId").notNull(),             // fase atual no Kanban (FK para kanban_phases)
  title: varchar("title", { length: 512 }).notNull(),
  description: text("description"),
  priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"]).default("medium").notNull(),
  assigneeId: int("assigneeId"),
  approvedById: int("approvedById"),
  approvedAt: timestamp("approvedAt"),
  createdById: int("createdById").notNull(),
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  dueDate: timestamp("dueDate"),
  position: int("position").default(0).notNull(),
  revisionsCount: int("revisionsCount").default(0).notNull(),
  // Setor/Disciplina
  setor: varchar("setor", { length: 128 }),
  blockReason: text("blockReason"),
  openedAt: timestamp("openedAt"),
  completedAt: timestamp("completedAt"),
  statusChangedAt: timestamp("statusChangedAt"),
  // Progresso calculado automaticamente pelos itens do checklist (0-100)
  progress: float("progress").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

// ─── Task Attachments ─────────────────────────────────────────────────────────
// A tabela já existe no banco; os bytes ficam no S3 e apenas os metadados são persistidos aqui.
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

// ─── Checklist Items (Subtarefas dentro de cada Tarefa) ───────────────────────
export const checklistItems = mysqlTable("checklist_items", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  title: varchar("title", { length: 512 }).notNull(),
  description: text("description"),
  assigneeId: int("assigneeId"),
  status: mysqlEnum("status", ["pending", "in_progress", "shared", "published", "archived", "blocked"]).default("pending").notNull(),
  position: int("position").default(0).notNull(),
  createdById: int("createdById").notNull(),
  startDate: timestamp("startDate"),   // data de início do item
  endDate: timestamp("endDate"),         // data de entrega do item
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ChecklistItem = typeof checklistItems.$inferSelect;
export type InsertChecklistItem = typeof checklistItems.$inferInsert;

// ─── Checklist Item Comments ──────────────────────────────────────────────────
export const checklistItemComments = mysqlTable("checklist_item_comments", {
  id: int("id").autoincrement().primaryKey(),
  checklistItemId: int("checklistItemId").notNull(),
  userId: int("userId").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ChecklistItemComment = typeof checklistItemComments.$inferSelect;

// ─── Checklist Item History ───────────────────────────────────────────────────
export const checklistItemHistory = mysqlTable("checklist_item_history", {
  id: int("id").autoincrement().primaryKey(),
  checklistItemId: int("checklistItemId").notNull(),
  taskId: int("taskId").notNull(),
  changedById: int("changedById").notNull(),
  fromStatus: varchar("fromStatus", { length: 64 }),
  toStatus: varchar("toStatus", { length: 64 }).notNull(),
  changedAt: timestamp("changedAt").defaultNow().notNull(),
});
export type ChecklistItemHistory = typeof checklistItemHistory.$inferSelect;

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

// ─── Task Phase History (histórico de movimentação entre fases) ───────────────
export const taskPhaseHistory = mysqlTable("task_phase_history", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  changedById: int("changedById").notNull(),
  fromPhaseId: int("fromPhaseId"),
  fromPhaseName: varchar("fromPhaseName", { length: 128 }),
  toPhaseId: int("toPhaseId").notNull(),
  toPhaseName: varchar("toPhaseName", { length: 128 }).notNull(),
  changedAt: timestamp("changedAt").defaultNow().notNull(),
});
export type TaskPhaseHistory = typeof taskPhaseHistory.$inferSelect;

// ─── Vacation Periods ─────────────────────────────────────────────────────────
export const vacationPeriods = mysqlTable("vacation_periods", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate").notNull(),
  description: text("description"),
  approvedById: int("approvedById"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type VacationPeriod = typeof vacationPeriods.$inferSelect;
export type InsertVacationPeriod = typeof vacationPeriods.$inferInsert;

// ─── Notifications ────────────────────────────────────────────────────────────
export const NOTIFICATION_TYPES = [
  "task_assigned",
  "task_status_changed",
  "task_created",
  "task_deleted",
  "task_comment",
  "task_due",
  "project_invite",
  "project_update",
  "vacation_conflict",
  "chat_message",
  "mention",
  "task_overdue",
  "system",
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
    "vacation_conflict",
    "chat_message",
    "mention",
    "task_overdue",
    "system",
  ]).default("system").notNull(),
  isRead: boolean("isRead").default(false).notNull(),
  relatedCrsId: int("relatedCrsId"),
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
  deadlineAlertDays: int("deadlineAlertDays").default(3).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type NotificationPreference = typeof notificationPreferences.$inferSelect;

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

// ─── Chat Messages (AI Chat) ──────────────────────────────────────────────────
export const chatMessages = mysqlTable("chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  crsId: int("crsId"),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

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
  attendeeIds: text("attendeeIds"),
  projectId: int("projectId"),
  isPublic: boolean("isPublic").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AgendaEvent = typeof agendaEvents.$inferSelect;
export type InsertAgendaEvent = typeof agendaEvents.$inferInsert;

// ─── Direct Message Conversations ────────────────────────────────────────────
export const conversations = mysqlTable("conversations", {
  id: int("id").autoincrement().primaryKey(),
  type: mysqlEnum("type", ["direct", "group"]).default("direct").notNull(),
  name: varchar("name", { length: 256 }),
  createdById: int("createdById").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Conversation = typeof conversations.$inferSelect;

export const conversationParticipants = mysqlTable("conversation_participants", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  userId: int("userId").notNull(),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
  lastReadAt: timestamp("lastReadAt"),
});

export const directMessages = mysqlTable("direct_messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  senderId: int("senderId").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type DirectMessage = typeof directMessages.$inferSelect;

// ─── Chat typing presence ─────────────────────────────────────────────────────
export const chatTypingStates = mysqlTable("chat_typing_states", {
  conversationId: int("conversationId").notNull(),
  userId: int("userId").notNull(),
  lastTypedAt: timestamp("lastTypedAt").defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.conversationId, table.userId] }),
}));
export type ChatTypingState = typeof chatTypingStates.$inferSelect;

// ─── Disciplines (Setores/Disciplinas gerenciáveis pelo Admin) ────────────────

export const disciplines = mysqlTable("disciplines", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull().unique(),
  color: varchar("color", { length: 32 }).default("#6366f1").notNull(),
  description: text("description"),
  isActive: boolean("isActive").default(true).notNull(),
  createdById: int("createdById").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Discipline = typeof disciplines.$inferSelect;
export type InsertDiscipline = typeof disciplines.$inferInsert;

// ─── Sprints ──────────────────────────────────────────────────────────────────
export const sprints = mysqlTable("sprints", {
  id: int("id").autoincrement().primaryKey(),
  crsId: int("crsId").notNull(),
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

// ─── Sprint Checklist Items ────────────────────────────────────────────────────
export const sprintChecklistItems = mysqlTable("sprint_checklist_items", {
  id: int("id").autoincrement().primaryKey(),
  sprintId: int("sprintId").notNull(),
  checklistItemId: int("checklistItemId").notNull(),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
});
export type SprintChecklistItem = typeof sprintChecklistItems.$inferSelect;

// ─── User Disciplines (disciplinas de responsabilidade por usuário) ─────────────
export const userDisciplines = mysqlTable("user_disciplines", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  disciplineName: varchar("disciplineName", { length: 128 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type UserDiscipline = typeof userDisciplines.$inferSelect;
export type InsertUserDiscipline = typeof userDisciplines.$inferInsert;
// ─── Whiteboards ──────────────────────────────────────────────────────────────
export const whiteboards = mysqlTable("whiteboards", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 256 }).notNull().default("Sem título"),
  pageIndex: int("pageIndex").notNull().default(0),
  dataUrl: text("dataUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type Whiteboard = typeof whiteboards.$inferSelect;
export type InsertWhiteboard = typeof whiteboards.$inferInsert;

// ─── Google Calendar Tokens ───────────────────────────────────────────────────
export const googleCalendarTokens = mysqlTable("google_calendar_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  accessToken: text("accessToken").notNull(),
  refreshToken: text("refreshToken"),
  expiresAt: timestamp("expiresAt"),
  syncedAt: timestamp("syncedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type GoogleCalendarToken = typeof googleCalendarTokens.$inferSelect;
export type InsertGoogleCalendarToken = typeof googleCalendarTokens.$inferInsert;

// ─── Google Calendar Events (sincronizados) ───────────────────────────────────
export const googleCalendarEvents = mysqlTable("google_calendar_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  googleEventId: varchar("googleEventId", { length: 256 }).notNull(),
  agendaEventId: int("agendaEventId"),  // referência ao evento local (agenda_events)
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description"),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate").notNull(),
  isSynced: boolean("isSynced").default(false).notNull(),
  lastSyncedAt: timestamp("lastSyncedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type GoogleCalendarEvent = typeof googleCalendarEvents.$inferSelect;
export type InsertGoogleCalendarEvent = typeof googleCalendarEvents.$inferInsert;

// ─── Meetings (reuniões do Orbita vinculadas ao Google Calendar/Meet) ───────────
export const meetings = mysqlTable("meetings", {
  id: int("id").autoincrement().primaryKey(),
  createdById: int("createdById").notNull(),
  crsId: int("crsId").notNull(),
  taskId: int("taskId"),
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description"),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate").notNull(),
  googleEventId: varchar("googleEventId", { length: 256 }),
  googleMeetUrl: varchar("googleMeetUrl", { length: 1024 }),
  meetingCode: varchar("meetingCode", { length: 128 }),
  participantIds: text("participantIds"),
  participantEmails: text("participantEmails"),
  actualParticipants: text("actualParticipants"),
  actualStartDate: timestamp("actualStartDate"),
  actualEndDate: timestamp("actualEndDate"),
  status: mysqlEnum("status", ["scheduled", "completed", "canceled"]).default("scheduled").notNull(),
  lastSyncedAt: timestamp("lastSyncedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Meeting = typeof meetings.$inferSelect;
export type InsertMeeting = typeof meetings.$inferInsert;


// ─── Subscription Plans ────────────────────────────────────────────────────────
export const subscriptionPlans = mysqlTable("subscription_plans", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 64 }).notNull(),  // "Starter", "Basic", "Pro"
  stripePriceId: varchar("stripePriceId", { length: 256 }).notNull().unique(),
  stripeProductId: varchar("stripeProductId", { length: 256 }).notNull(),
  monthlyPrice: float("monthlyPrice").notNull(),  // 29, 59, 89
  annualPrice: float("annualPrice").notNull(),  // desconto anual
  maxUsers: int("maxUsers").notNull(),  // limite de usuários
  maxProjects: int("maxProjects").notNull(),  // limite de projetos
  features: text("features"),  // JSON array de features
  description: text("description"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = typeof subscriptionPlans.$inferInsert;

// ─── User Subscriptions ────────────────────────────────────────────────────────
export const userSubscriptions = mysqlTable("user_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  planId: int("planId").notNull(),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 256 }).unique(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 256 }),
  status: mysqlEnum("status", ["active", "trialing", "past_due", "canceled", "unpaid"]).default("trialing").notNull(),
  currentPeriodStart: timestamp("currentPeriodStart"),
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  trialEndDate: timestamp("trialEndDate"),  // 15 dias de trial
  canceledAt: timestamp("canceledAt"),
  cancelReason: text("cancelReason"),
  billingCycle: mysqlEnum("billingCycle", ["monthly", "annual"]).default("monthly").notNull(),
  autoRenew: boolean("autoRenew").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type InsertUserSubscription = typeof userSubscriptions.$inferInsert;

// ─── Subscription Invoices ─────────────────────────────────────────────────────
export const subscriptionInvoices = mysqlTable("subscription_invoices", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  subscriptionId: int("subscriptionId").notNull(),
  stripeInvoiceId: varchar("stripeInvoiceId", { length: 256 }).unique(),
  amount: float("amount").notNull(),
  currency: varchar("currency", { length: 3 }).default("BRL").notNull(),
  status: mysqlEnum("status", ["draft", "open", "paid", "void", "uncollectible"]).default("open").notNull(),
  paidAt: timestamp("paidAt"),
  dueDate: timestamp("dueDate"),
  invoiceUrl: text("invoiceUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type SubscriptionInvoice = typeof subscriptionInvoices.$inferSelect;
export type InsertSubscriptionInvoice = typeof subscriptionInvoices.$inferInsert;
