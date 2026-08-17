CREATE TABLE IF NOT EXISTS `task_dependencies` (
  `id` int NOT NULL AUTO_INCREMENT,
  `predecessorTaskId` int NOT NULL,
  `successorTaskId` int NOT NULL,
  `dependencyType` enum('finish_to_start','start_to_start','finish_to_finish','start_to_finish') NOT NULL DEFAULT 'finish_to_start',
  `createdById` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `task_dependencies_pair_unique` (`predecessorTaskId`,`successorTaskId`,`dependencyType`),
  KEY `task_dependencies_predecessor_idx` (`predecessorTaskId`),
  KEY `task_dependencies_successor_idx` (`successorTaskId`),
  KEY `task_dependencies_created_by_idx` (`createdById`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DELETE td FROM `task_dependencies` td
LEFT JOIN `tasks` predecessor ON predecessor.`id` = td.`predecessorTaskId`
LEFT JOIN `tasks` successor ON successor.`id` = td.`successorTaskId`
WHERE predecessor.`id` IS NULL OR successor.`id` IS NULL OR predecessor.`id` = successor.`id`;

ALTER TABLE `task_dependencies`
  ADD CONSTRAINT `task_dependencies_predecessor_fk` FOREIGN KEY (`predecessorTaskId`) REFERENCES `tasks` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `task_dependencies_successor_fk` FOREIGN KEY (`successorTaskId`) REFERENCES `tasks` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `task_dependencies_created_by_fk` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`) ON DELETE RESTRICT;

UPDATE `tasks` t
LEFT JOIN (
  SELECT `successorTaskId`, MIN(`predecessorTaskId`) AS `predecessorId`
  FROM `task_dependencies`
  GROUP BY `successorTaskId`
) d ON d.`successorTaskId` = t.`id`
SET t.`updatedAt` = t.`updatedAt`;
