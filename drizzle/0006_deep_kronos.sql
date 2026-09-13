CREATE TABLE `harvests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kultur` text NOT NULL,
	`ort` text,
	`status` text NOT NULL,
	`laufend` integer DEFAULT false NOT NULL,
	`member_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
