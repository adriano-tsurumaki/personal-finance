ALTER TABLE `categories` ADD `description` text;--> statement-breakpoint
ALTER TABLE `categories` ADD `transaction_type` text DEFAULT 'both' NOT NULL CHECK (`transaction_type` IN ('income', 'expense', 'both'));--> statement-breakpoint
CREATE UNIQUE INDEX `categories_user_name_unique` ON `categories` (`user_id`,category_name_key("name"));
