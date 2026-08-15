CREATE TABLE IF NOT EXISTS `company_domains` (
  `id` int AUTO_INCREMENT NOT NULL,
  `companyId` int NOT NULL,
  `domain` varchar(255) NOT NULL,
  `status` enum('pending','verified','disabled') NOT NULL DEFAULT 'pending',
  `verificationToken` varchar(128),
  `verifiedAt` timestamp NULL,
  `isPrimary` boolean NOT NULL DEFAULT false,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `company_domains_id` PRIMARY KEY(`id`),
  CONSTRAINT `company_domains_domain_unique` UNIQUE(`domain`)
);