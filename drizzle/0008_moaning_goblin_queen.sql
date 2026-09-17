CREATE TABLE `agenda_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`text` text NOT NULL,
	`sitzung_am` integer NOT NULL,
	`member_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `minutes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sitzung_am` integer NOT NULL,
	`datei` text NOT NULL,
	`member_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `minutes_datei_unique` ON `minutes` (`datei`);