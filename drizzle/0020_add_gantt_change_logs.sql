CREATE TABLE IF NOT EXISTS `gantt_change_logs` (
  `id` int AUTO_INCREMENT NOT NULL,
  `companyId` int NOT NULL,
  `taskId` int NOT NULL,
  `relatedTaskId` int,
  `dependencyId` int,
  `changedById` int NOT NULL,
  `operation` enum('dates_updated','dependency_created','dependency_deleted') NOT NULL,
  `beforeData` text,
  `afterData` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `gantt_change_logs_id` PRIMARY KEY(`id`),
  INDEX `gantt_change_logs_company_created_idx` (`companyId`,`createdAt`),
  INDEX `gantt_change_logs_task_created_idx` (`taskId`,`createdAt`),
  INDEX `gantt_change_logs_changed_by_idx` (`changedById`)
);
