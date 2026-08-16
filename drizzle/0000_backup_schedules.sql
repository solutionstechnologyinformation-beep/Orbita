CREATE TABLE IF NOT EXISTS `backup_schedules` (
  `id` int AUTO_INCREMENT NOT NULL,
  `companyId` int NOT NULL,
  `createdById` int NOT NULL,
  `scheduleCronTaskUid` varchar(65),
  `cronExpression` varchar(64) NOT NULL,
  `dayOfWeek` int NOT NULL,
  `hourUtc` int NOT NULL,
  `minuteUtc` int NOT NULL,
  `isEnabled` boolean NOT NULL DEFAULT true,
  `lastExecutedAt` timestamp,
  `nextExecutionAt` timestamp,
  `lastBackupUrl` text,
  `lastBackupKey` varchar(1024),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `backup_schedules_id` PRIMARY KEY(`id`),
  CONSTRAINT `backup_schedules_task_uid_unique` UNIQUE(`scheduleCronTaskUid`)
);
CREATE INDEX `backup_schedules_company_idx` ON `backup_schedules` (`companyId`);
