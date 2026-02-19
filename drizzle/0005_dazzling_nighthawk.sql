CREATE TABLE `notification_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`notificationType` varchar(64) NOT NULL,
	`inApp` boolean NOT NULL DEFAULT true,
	`email` boolean NOT NULL DEFAULT true,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notification_preferences_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `notifications` MODIFY COLUMN `notificationType` enum('task_assigned','task_status_changed','task_created','task_deleted','task_comment','task_due','project_invite','project_update','system') NOT NULL DEFAULT 'system';