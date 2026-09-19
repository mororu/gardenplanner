CREATE TABLE `treatments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mittel` text NOT NULL,
	`ort` text,
	`angewendet_am` integer NOT NULL,
	`intervall_tage` integer,
	`member_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
