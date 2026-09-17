CREATE TABLE `agenda_lists` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`datei` text NOT NULL,
	`member_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agenda_lists_datei_unique` ON `agenda_lists` (`datei`);--> statement-breakpoint
ALTER TABLE `agenda_items` DROP COLUMN `sitzung_am`;