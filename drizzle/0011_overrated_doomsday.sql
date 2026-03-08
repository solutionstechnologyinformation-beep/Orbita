CREATE TABLE `disciplines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`color` varchar(32) NOT NULL DEFAULT '#6366f1',
	`description` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdById` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `disciplines_id` PRIMARY KEY(`id`),
	CONSTRAINT `disciplines_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `project_invites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`token` varchar(128) NOT NULL,
	`createdById` int NOT NULL,
	`role` enum('admin','member','viewer') NOT NULL DEFAULT 'member',
	`usedById` int,
	`usedAt` timestamp,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `project_invites_id` PRIMARY KEY(`id`),
	CONSTRAINT `project_invites_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `task_status_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`changedById` int NOT NULL,
	`fromStatus` varchar(64),
	`toStatus` varchar(64) NOT NULL,
	`blockReason` text,
	`changedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `task_status_history_id` PRIMARY KEY(`id`)
);
