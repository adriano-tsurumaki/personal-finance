CREATE TABLE `indicator_anchors` (
	`user_id` integer PRIMARY KEY,
	`start_date` DATE NOT NULL,
	`opening_balance_cents` integer NOT NULL,
	CONSTRAINT `fk_indicator_anchors_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`),
	CONSTRAINT "indicator_anchor_safe_balance" CHECK("opening_balance_cents" BETWEEN -9007199254740991 AND 9007199254740991)
);
