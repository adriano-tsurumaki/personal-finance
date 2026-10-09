CREATE INDEX `credit_card_invoice_card_paid_idx` ON `credit_card_invoice` (`credit_card_id`,`paid_at`);--> statement-breakpoint
CREATE INDEX `credit_cards_user_idx` ON `credit_cards` (`user_id`);--> statement-breakpoint
CREATE INDEX `transactions_user_payment_date_idx` ON `transactions` (`user_id`,`payment_date`);