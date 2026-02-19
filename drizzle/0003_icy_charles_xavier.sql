CREATE TABLE `project_member_roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`userId` int NOT NULL,
	`roleId` int NOT NULL,
	`assignedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `project_member_roles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`name` varchar(128) NOT NULL,
	`isLeader` boolean NOT NULL DEFAULT false,
	`canApprove` boolean NOT NULL DEFAULT false,
	`color` varchar(32) DEFAULT '#6366f1',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `project_roles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `teams` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`name` varchar(128) NOT NULL,
	`color` varchar(32) DEFAULT '#6366f1',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `teams_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `tasks` MODIFY COLUMN `status` enum('pending','in_progress','shared','published','archived') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `tasks` ADD `teamId` int;--> statement-breakpoint
ALTER TABLE `tasks` ADD `approvedById` int;--> statement-breakpoint
ALTER TABLE `tasks` ADD `approvedAt` timestamp;