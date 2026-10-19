CREATE TABLE `installment_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`user_id` integer NOT NULL,
	`request_id` text NOT NULL,
	`input_json` text NOT NULL,
	`installment_id` integer,
	CONSTRAINT `fk_installment_requests_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`),
	CONSTRAINT `fk_installment_requests_installment_id_installment_id_fk` FOREIGN KEY (`installment_id`) REFERENCES `installment`(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `installment_requests_user_request_unique` ON `installment_requests` (`user_id`,`request_id`);