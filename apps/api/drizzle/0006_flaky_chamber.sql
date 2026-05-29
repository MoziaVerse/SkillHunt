CREATE TABLE `contest_votes` (
	`id` text PRIMARY KEY NOT NULL,
	`event_slug` text NOT NULL,
	`submission_id` text NOT NULL,
	`track` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`canceled_at` integer,
	FOREIGN KEY (`submission_id`) REFERENCES `contest_submissions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contest_votes_event_submission_user_idx` ON `contest_votes` (`event_slug`,`submission_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `contest_votes_event_submission_idx` ON `contest_votes` (`event_slug`,`submission_id`);--> statement-breakpoint
CREATE INDEX `contest_votes_event_track_user_idx` ON `contest_votes` (`event_slug`,`track`,`user_id`);--> statement-breakpoint
CREATE INDEX `contest_votes_event_canceled_idx` ON `contest_votes` (`event_slug`,`canceled_at`);--> statement-breakpoint
ALTER TABLE `contest_submissions` ADD `status` text DEFAULT 'submitted' NOT NULL;