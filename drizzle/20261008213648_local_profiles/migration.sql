ALTER TABLE `categories` ADD `catalog_key` text;--> statement-breakpoint
ALTER TABLE `payments` ADD `catalog_key` text;--> statement-breakpoint
ALTER TABLE `user` ADD `locale` text DEFAULT 'pt-BR' NOT NULL;--> statement-breakpoint
-- Avoid rebuilding a referenced table so existing transaction history stays intact.
CREATE UNIQUE INDEX `payments_catalog_key_unique` ON `payments` (`catalog_key`);
