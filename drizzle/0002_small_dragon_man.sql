ALTER TABLE `tasks` ADD `revisionsCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `openedAt` timestamp;--> statement-breakpoint
ALTER TABLE `tasks` ADD `completedAt` timestamp;--> statement-breakpoint
ALTER TABLE `tasks` ADD `statusChangedAt` timestamp;