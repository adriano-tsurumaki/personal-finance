CREATE TABLE IF NOT EXISTS `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`icon_key` text DEFAULT 'other' NOT NULL,
	`archived_at` DATE,
	`user_id` integer NOT NULL,
	CONSTRAINT `fk_categories_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `credit_card_invoice` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`amount_cents` integer NOT NULL,
	`closing_date` DATE NOT NULL,
	`due_date` DATE NOT NULL,
	`paid_at` DATE,
	`credit_card_id` integer NOT NULL,
	CONSTRAINT `fk_credit_card_invoice_credit_card_id_credit_cards_id_fk` FOREIGN KEY (`credit_card_id`) REFERENCES `credit_cards`(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `credit_cards` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL,
	`user_id` integer NOT NULL,
	CONSTRAINT `fk_credit_cards_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `installment` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL,
	`total_installments` integer NOT NULL,
	`total_amount_cents` integer NOT NULL,
	`start_date` DATE NOT NULL,
	`end_date` DATE NOT NULL,
	`purchase_at` DATE NOT NULL,
	`user_id` integer NOT NULL,
	CONSTRAINT `fk_installment_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`),
	CONSTRAINT "installment_total_check" CHECK("total_installments" > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL,
	`type` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `recurrences_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`version` integer NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`amount_cents` integer NOT NULL,
	`frequency` integer NOT NULL,
	`interval` integer NOT NULL,
	`start_date` DATE NOT NULL,
	`end_date` DATE,
	`recurrence_id` integer NOT NULL,
	CONSTRAINT `fk_recurrences_versions_recurrence_id_recurrences_id_fk` FOREIGN KEY (`recurrence_id`) REFERENCES `recurrences`(`id`),
	CONSTRAINT `recurrences_versions_recurrence_version_unique` UNIQUE(`recurrence_id`,`version`),
	CONSTRAINT "recurrences_versions_active_check" CHECK("active" IN (0, 1)),
	CONSTRAINT "recurrences_versions_frequency_check" CHECK("frequency" IN (1, 2, 3, 4)),
	CONSTRAINT "recurrences_versions_interval_check" CHECK("interval" > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `recurrences` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`user_id` integer NOT NULL,
	CONSTRAINT `fk_recurrences_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`),
	CONSTRAINT "recurrences_active_check" CHECK("active" IN (0, 1))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL,
	`type` integer NOT NULL,
	`amount_cents` integer NOT NULL,
	`payment_date` DATE,
	`reference_date` DATE,
	`installment_number` integer,
	`user_id` integer NOT NULL,
	`payment_id` integer NOT NULL,
	`category_id` integer,
	`recurrence_version_id` integer,
	`credit_card_invoice_id` integer,
	`installment_id` integer,
	CONSTRAINT `fk_transactions_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`),
	CONSTRAINT `fk_transactions_payment_id_payments_id_fk` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`),
	CONSTRAINT `fk_transactions_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`),
	CONSTRAINT `fk_transactions_recurrence_version_id_recurrences_versions_id_fk` FOREIGN KEY (`recurrence_version_id`) REFERENCES `recurrences_versions`(`id`),
	CONSTRAINT `fk_transactions_credit_card_invoice_id_credit_card_invoice_id_fk` FOREIGN KEY (`credit_card_invoice_id`) REFERENCES `credit_card_invoice`(`id`),
	CONSTRAINT `fk_transactions_installment_id_installment_id_fk` FOREIGN KEY (`installment_id`) REFERENCES `installment`(`id`),
	CONSTRAINT `transactions_installment_number_unique` UNIQUE(`installment_id`,`installment_number`),
	CONSTRAINT "transactions_installment_check" CHECK(("installment_id" IS NULL AND "installment_number" IS NULL) OR ("installment_id" IS NOT NULL AND "installment_number" IS NOT NULL AND "installment_number" > 0))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `user` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL,
	`email` text NOT NULL UNIQUE,
	`password` text NOT NULL
);

