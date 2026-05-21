CREATE TABLE `contest_users` (
	`id` text PRIMARY KEY NOT NULL,
	`event_slug` text NOT NULL,
	`phone` text NOT NULL,
	`status` text DEFAULT 'eligible' NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contest_users_event_phone_idx` ON `contest_users` (`event_slug`,`phone`);--> statement-breakpoint
CREATE INDEX `contest_users_event_status_idx` ON `contest_users` (`event_slug`,`status`);