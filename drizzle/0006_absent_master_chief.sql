CREATE TABLE `agenda_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`createdById` int NOT NULL,
	`title` varchar(256) NOT NULL,
	`type` enum('vacation','meeting','other') NOT NULL DEFAULT 'other',
	`startDate` timestamp NOT NULL,
	`endDate` timestamp NOT NULL,
	`description` text,
	`meetingUrl` varchar(1024),
	`attendeeIds` text,
	`projectId` int,
	`isPublic` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agenda_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `companies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(256) NOT NULL,
	`slug` varchar(128) NOT NULL,
	`color` varchar(32) DEFAULT '#1e2d5a',
	`logoUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `companies_id` PRIMARY KEY(`id`),
	CONSTRAINT `companies_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `sprint_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sprintId` int NOT NULL,
	`taskId` int NOT NULL,
	`addedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sprint_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sprints` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`name` varchar(256) NOT NULL,
	`goal` text,
	`startDate` timestamp NOT NULL,
	`endDate` timestamp NOT NULL,
	`status` enum('active','completed','planned') NOT NULL DEFAULT 'planned',
	`createdById` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sprints_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `task_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`userId` int NOT NULL,
	`message` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `task_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `whiteboard_data` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`content` text NOT NULL DEFAULT ('[]'),
	`updatedById` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `whiteboard_data_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `tasks` MODIFY COLUMN `status` enum('pending','in_progress','shared','published','archived','blocked') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','master_admin','company_admin') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `projects` ADD `companyId` int;--> statement-breakpoint
ALTER TABLE `tasks` ADD `startDate` timestamp;--> statement-breakpoint
ALTER TABLE `tasks` ADD `endDate` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `company` varchar(256);--> statement-breakpoint
ALTER TABLE `users` ADD `companyId` int;