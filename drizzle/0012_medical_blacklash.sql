CREATE TABLE `documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`titel` text NOT NULL,
	`dateiname` text NOT NULL,
	`ablage` text NOT NULL,
	`groesse` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `documents_ablage_unique` ON `documents` (`ablage`);