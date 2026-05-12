CREATE TABLE `skill_install_events` (
	`id` text PRIMARY KEY NOT NULL,
	`skill_id` text NOT NULL,
	`dedupe_key` text NOT NULL,
	`source` text NOT NULL,
	`installed_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skill_install_events_skill_dedupe_idx` ON `skill_install_events` (`skill_id`,`dedupe_key`);--> statement-breakpoint
CREATE INDEX `skill_install_events_skill_idx` ON `skill_install_events` (`skill_id`);--> statement-breakpoint
CREATE INDEX `skill_install_events_installed_at_idx` ON `skill_install_events` (`installed_at`);