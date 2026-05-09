ALTER TABLE `skills` ADD `parent_skill_id` text;--> statement-breakpoint
ALTER TABLE `skills` ADD `root_skill_id` text;--> statement-breakpoint
ALTER TABLE `skills` ADD `fork_source_release_id` text;--> statement-breakpoint
ALTER TABLE `skills` ADD `latest_synced_release_id` text;--> statement-breakpoint
ALTER TABLE `skills` ADD `fork_mode` text DEFAULT 'linked' NOT NULL;--> statement-breakpoint
ALTER TABLE `skills` ADD `allow_upstream_sync` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `skills` ADD `fork_note` text;--> statement-breakpoint
CREATE INDEX `skills_parent_idx` ON `skills` (`parent_skill_id`);--> statement-breakpoint
CREATE INDEX `skills_root_idx` ON `skills` (`root_skill_id`);--> statement-breakpoint
CREATE TABLE `skill_releases` (
	`id` text PRIMARY KEY NOT NULL,
	`skill_id` text NOT NULL,
	`version` integer NOT NULL,
	`title` text NOT NULL,
	`changelog` text DEFAULT '' NOT NULL,
	`snapshot_files` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skill_releases_skill_version_idx` ON `skill_releases` (`skill_id`,`version`);--> statement-breakpoint
CREATE INDEX `skill_releases_skill_idx` ON `skill_releases` (`skill_id`);--> statement-breakpoint
CREATE INDEX `skill_releases_created_at_idx` ON `skill_releases` (`created_at`);--> statement-breakpoint
CREATE TABLE `skill_sync_events` (
	`id` text PRIMARY KEY NOT NULL,
	`fork_skill_id` text NOT NULL,
	`upstream_skill_id` text NOT NULL,
	`from_release_id` text,
	`to_release_id` text NOT NULL,
	`status` text NOT NULL,
	`conflict_files` text DEFAULT '[]' NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`fork_skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`upstream_skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `skill_sync_events_fork_idx` ON `skill_sync_events` (`fork_skill_id`);--> statement-breakpoint
CREATE INDEX `skill_sync_events_upstream_idx` ON `skill_sync_events` (`upstream_skill_id`);--> statement-breakpoint
CREATE INDEX `skill_sync_events_created_at_idx` ON `skill_sync_events` (`created_at`);--> statement-breakpoint
CREATE TABLE `skill_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`skill_id` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`notify_on_release` integer DEFAULT 1 NOT NULL,
	`notify_on_sync` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skill_subscriptions_user_skill_idx` ON `skill_subscriptions` (`user_id`,`skill_id`);--> statement-breakpoint
CREATE INDEX `skill_subscriptions_skill_idx` ON `skill_subscriptions` (`skill_id`);--> statement-breakpoint
CREATE INDEX `skill_subscriptions_user_idx` ON `skill_subscriptions` (`user_id`);--> statement-breakpoint
CREATE TABLE `skill_merge_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`source_skill_id` text NOT NULL,
	`target_skill_id` text NOT NULL,
	`source_release_id` text NOT NULL,
	`target_base_release_id` text,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_by_user_id` text NOT NULL,
	`reviewed_by_user_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`merged_at` integer,
	FOREIGN KEY (`source_skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `skill_merge_requests_source_idx` ON `skill_merge_requests` (`source_skill_id`);--> statement-breakpoint
CREATE INDEX `skill_merge_requests_target_idx` ON `skill_merge_requests` (`target_skill_id`);--> statement-breakpoint
CREATE INDEX `skill_merge_requests_status_idx` ON `skill_merge_requests` (`status`);
