CREATE TABLE `credit_card_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`user_id` integer NOT NULL,
	`credit_card_id` integer NOT NULL,
	`operation` text NOT NULL,
	`created_at` text NOT NULL,
	`changes_json` text NOT NULL,
	CONSTRAINT `fk_credit_card_history_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`),
	CONSTRAINT `fk_credit_card_history_credit_card_id_credit_cards_id_fk` FOREIGN KEY (`credit_card_id`) REFERENCES `credit_cards`(`id`)
);
--> statement-breakpoint
ALTER TABLE `credit_card_invoice` ADD `opening_date` DATE;--> statement-breakpoint
ALTER TABLE `credit_card_invoice` ADD `includes_closing_day` integer;--> statement-breakpoint
ALTER TABLE `credit_card_invoice` ADD `total_source` text DEFAULT 'statement' NOT NULL;--> statement-breakpoint
ALTER TABLE `credit_cards` ADD `closing_day` integer;--> statement-breakpoint
ALTER TABLE `credit_cards` ADD `includes_closing_day` integer;--> statement-breakpoint
ALTER TABLE `credit_cards` ADD `due_days_after_closing` integer;--> statement-breakpoint
ALTER TABLE `credit_cards` ADD `archived_at` DATE;--> statement-breakpoint
CREATE UNIQUE INDEX `credit_card_invoice_card_closing_unique` ON `credit_card_invoice` (`credit_card_id`,`closing_date`);--> statement-breakpoint
CREATE INDEX `transactions_invoice_idx` ON `transactions` (`credit_card_invoice_id`);