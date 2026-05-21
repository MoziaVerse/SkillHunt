CREATE TABLE `contest_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`event_slug` text NOT NULL,
	`skill_id` text NOT NULL,
	`submitter_user_id` text NOT NULL,
	`track` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contest_submissions_event_skill_idx` ON `contest_submissions` (`event_slug`,`skill_id`);--> statement-breakpoint
CREATE INDEX `contest_submissions_event_user_idx` ON `contest_submissions` (`event_slug`,`submitter_user_id`);--> statement-breakpoint
CREATE INDEX `contest_submissions_event_track_idx` ON `contest_submissions` (`event_slug`,`track`);--> statement-breakpoint
CREATE INDEX `contest_submissions_created_at_idx` ON `contest_submissions` (`created_at`);