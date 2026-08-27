CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`text` text NOT NULL,
	`completed_by` integer,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`completed_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
