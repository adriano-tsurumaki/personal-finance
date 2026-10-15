CREATE TABLE `recurrence_invoice_coverage` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`recurrence_id` integer NOT NULL,
	`scheduled_date` DATE NOT NULL,
	`credit_card_invoice_id` integer NOT NULL,
	`status` text NOT NULL,
	CONSTRAINT `fk_recurrence_invoice_coverage_recurrence_id_recurrences_id_fk` FOREIGN KEY (`recurrence_id`) REFERENCES `recurrences`(`id`),
	CONSTRAINT `fk_recurrence_invoice_coverage_credit_card_invoice_id_credit_card_invoice_id_fk` FOREIGN KEY (`credit_card_invoice_id`) REFERENCES `credit_card_invoice`(`id`),
	CONSTRAINT "recurrence_invoice_coverage_status_check" CHECK("status" IN ('included', 'excluded'))
);
--> statement-breakpoint
CREATE TABLE `recurrence_occurrences` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`recurrence_id` integer NOT NULL,
	`scheduled_date` DATE NOT NULL,
	`recurrence_version_id` integer NOT NULL,
	`state` text NOT NULL,
	`transaction_id` integer,
	CONSTRAINT `fk_recurrence_occurrences_recurrence_id_recurrences_id_fk` FOREIGN KEY (`recurrence_id`) REFERENCES `recurrences`(`id`),
	CONSTRAINT `fk_recurrence_occurrences_recurrence_version_id_recurrences_versions_id_fk` FOREIGN KEY (`recurrence_version_id`) REFERENCES `recurrences_versions`(`id`),
	CONSTRAINT `fk_recurrence_occurrences_transaction_id_transactions_id_fk` FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`),
	CONSTRAINT "recurrence_occurrences_state_check" CHECK(("state" = 'confirmed' AND "transaction_id" IS NOT NULL) OR ("state" = 'ignored' AND "transaction_id" IS NULL))
);
--> statement-breakpoint
ALTER TABLE `recurrences_versions` ADD `type` integer CHECK (`type` IS NULL OR `type` IN (1, 2));--> statement-breakpoint
ALTER TABLE `recurrences_versions` ADD `category_id` integer REFERENCES categories(id);--> statement-breakpoint
ALTER TABLE `recurrences_versions` ADD `payment_id` integer REFERENCES payments(id);--> statement-breakpoint
ALTER TABLE `recurrences_versions` ADD `credit_card_id` integer REFERENCES credit_cards(id);--> statement-breakpoint
ALTER TABLE `recurrences` ADD `status` text DEFAULT 'repair_required' NOT NULL CHECK (`status` IN ('active', 'paused', 'ended', 'repair_required'));--> statement-breakpoint
ALTER TABLE `recurrences` ADD `anchor_date` DATE;--> statement-breakpoint
ALTER TABLE `recurrences` ADD `last_retained_date` DATE;--> statement-breakpoint
CREATE INDEX `recurrences_versions_effective_idx` ON `recurrences_versions` (`recurrence_id`,`start_date`,`end_date`);--> statement-breakpoint
CREATE INDEX `recurrences_user_status_idx` ON `recurrences` (`user_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `recurrence_invoice_coverage_slot_unique` ON `recurrence_invoice_coverage` (`recurrence_id`,`scheduled_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `recurrence_occurrences_slot_unique` ON `recurrence_occurrences` (`recurrence_id`,`scheduled_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `recurrence_occurrences_transaction_unique` ON `recurrence_occurrences` (`transaction_id`);
--> statement-breakpoint
CREATE TRIGGER recurrence_versions_validate_insert BEFORE INSERT ON recurrences_versions
WHEN (SELECT status FROM recurrences WHERE id = NEW.recurrence_id) <> 'repair_required'
BEGIN
  SELECT CASE WHEN NEW.type IS NULL OR NEW.payment_id IS NULL OR NEW.amount_cents <= 0
    OR (NEW.end_date IS NOT NULL AND (NEW.end_date < NEW.start_date OR (NEW.end_date = NEW.start_date AND NEW.active <> 0)))
    THEN RAISE(ABORT, 'Invalid recurrence version defaults or interval') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM recurrences_versions existing WHERE existing.recurrence_id = NEW.recurrence_id AND (existing.end_date IS NULL OR existing.end_date > existing.start_date) AND (NEW.end_date IS NULL OR NEW.end_date > NEW.start_date)
      AND (existing.end_date IS NULL OR NEW.start_date < existing.end_date)
      AND (NEW.end_date IS NULL OR existing.start_date < NEW.end_date)
  ) THEN RAISE(ABORT, 'Overlapping recurrence versions') END;
END;
--> statement-breakpoint
CREATE TRIGGER recurrence_versions_validate_update BEFORE UPDATE ON recurrences_versions
WHEN (SELECT status FROM recurrences WHERE id = NEW.recurrence_id) <> 'repair_required'
BEGIN
  SELECT CASE WHEN NEW.type IS NULL OR NEW.payment_id IS NULL OR NEW.amount_cents <= 0
    OR (NEW.end_date IS NOT NULL AND (NEW.end_date < NEW.start_date OR (NEW.end_date = NEW.start_date AND NEW.active <> 0)))
    THEN RAISE(ABORT, 'Invalid recurrence version defaults or interval') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM recurrences_versions existing WHERE existing.recurrence_id = NEW.recurrence_id AND (existing.end_date IS NULL OR existing.end_date > existing.start_date) AND (NEW.end_date IS NULL OR NEW.end_date > NEW.start_date) AND existing.id <> NEW.id
      AND (existing.end_date IS NULL OR NEW.start_date < existing.end_date)
      AND (NEW.end_date IS NULL OR existing.start_date < NEW.end_date)
  ) THEN RAISE(ABORT, 'Overlapping recurrence versions') END;
END;

--> statement-breakpoint
CREATE TRIGGER recurrence_occurrences_validate_insert BEFORE INSERT ON recurrence_occurrences
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM recurrences_versions v JOIN recurrences r ON r.id = v.recurrence_id
    WHERE v.id = NEW.recurrence_version_id AND r.id = NEW.recurrence_id
      AND (NEW.transaction_id IS NULL OR EXISTS (
        SELECT 1 FROM transactions t WHERE t.id = NEW.transaction_id
          AND t.user_id = r.user_id AND t.recurrence_version_id = v.id
      ))
  ) THEN RAISE(ABORT, 'Invalid recurrence occurrence provenance') END;
END;
--> statement-breakpoint
CREATE TRIGGER recurrence_occurrences_validate_update BEFORE UPDATE ON recurrence_occurrences
BEGIN
  SELECT CASE WHEN NEW.recurrence_id <> OLD.recurrence_id OR NEW.scheduled_date <> OLD.scheduled_date
    THEN RAISE(ABORT, 'Immutable recurrence occurrence identity') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM recurrences_versions v JOIN recurrences r ON r.id = v.recurrence_id
    WHERE v.id = NEW.recurrence_version_id AND r.id = NEW.recurrence_id
      AND (NEW.transaction_id IS NULL OR EXISTS (
        SELECT 1 FROM transactions t WHERE t.id = NEW.transaction_id
          AND t.user_id = r.user_id AND t.recurrence_version_id = v.id
      ))
  ) THEN RAISE(ABORT, 'Invalid recurrence occurrence provenance') END;
END;
