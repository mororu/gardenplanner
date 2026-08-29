CREATE TABLE `duty_weeks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`art` text NOT NULL,
	`iso_jahr` integer NOT NULL,
	`iso_woche` integer NOT NULL,
	`member_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `duty_weeks_art_jahr_woche` ON `duty_weeks` (`art`,`iso_jahr`,`iso_woche`);