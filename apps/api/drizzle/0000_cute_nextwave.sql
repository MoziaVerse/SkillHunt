CREATE TABLE `install_grant_uses` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`ip` text,
	`user_agent` text,
	`accessed_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `grant_uses_token_idx` ON `install_grant_uses` (`token`);--> statement-breakpoint
CREATE INDEX `grant_uses_accessed_idx` ON `install_grant_uses` (`accessed_at`);--> statement-breakpoint
CREATE TABLE `install_grants` (
	`token` text PRIMARY KEY NOT NULL,
	`skill_id` text NOT NULL,
	`granted_by` text NOT NULL,
	`expires_at` integer NOT NULL,
	`max_uses` integer DEFAULT 1 NOT NULL,
	`used_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `install_grants_skill_idx` ON `install_grants` (`skill_id`);--> statement-breakpoint
CREATE INDEX `install_grants_expires_idx` ON `install_grants` (`expires_at`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`actor_id` text,
	`publishable_id` text,
	`comment_id` text,
	`read` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `notifications_user_idx` ON `notifications` (`user_id`);--> statement-breakpoint
CREATE INDEX `notifications_user_read_idx` ON `notifications` (`user_id`,`read`);--> statement-breakpoint
CREATE INDEX `notifications_publishable_idx` ON `notifications` (`publishable_id`);--> statement-breakpoint
CREATE INDEX `notifications_created_at_idx` ON `notifications` (`created_at`);--> statement-breakpoint
CREATE TABLE `publishable_bookmarks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`publishable_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`publishable_id`) REFERENCES `publishables`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `publishable_bookmarks_user_publishable_idx` ON `publishable_bookmarks` (`user_id`,`publishable_id`);--> statement-breakpoint
CREATE INDEX `publishable_bookmarks_user_idx` ON `publishable_bookmarks` (`user_id`);--> statement-breakpoint
CREATE INDEX `publishable_bookmarks_publishable_idx` ON `publishable_bookmarks` (`publishable_id`);--> statement-breakpoint
CREATE INDEX `publishable_bookmarks_created_at_idx` ON `publishable_bookmarks` (`created_at`);--> statement-breakpoint
CREATE TABLE `publishable_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`publishable_id` text NOT NULL,
	`user_id` text NOT NULL,
	`parent_id` text,
	`content` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`publishable_id`) REFERENCES `publishables`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `publishable_comments_publishable_idx` ON `publishable_comments` (`publishable_id`);--> statement-breakpoint
CREATE INDEX `publishable_comments_user_idx` ON `publishable_comments` (`user_id`);--> statement-breakpoint
CREATE INDEX `publishable_comments_parent_idx` ON `publishable_comments` (`parent_id`);--> statement-breakpoint
CREATE INDEX `publishable_comments_created_at_idx` ON `publishable_comments` (`created_at`);--> statement-breakpoint
CREATE TABLE `publishable_releases` (
	`id` text PRIMARY KEY NOT NULL,
	`publishable_id` text NOT NULL,
	`version` integer NOT NULL,
	`title` text NOT NULL,
	`changelog` text DEFAULT '' NOT NULL,
	`snapshot` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`publishable_id`) REFERENCES `publishables`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `publishable_releases_publishable_version_idx` ON `publishable_releases` (`publishable_id`,`version`);--> statement-breakpoint
CREATE INDEX `publishable_releases_publishable_idx` ON `publishable_releases` (`publishable_id`);--> statement-breakpoint
CREATE INDEX `publishable_releases_created_at_idx` ON `publishable_releases` (`created_at`);--> statement-breakpoint
CREATE TABLE `publishable_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`publishable_id` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`notify_on_release` integer DEFAULT 1 NOT NULL,
	`notify_on_sync` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`publishable_id`) REFERENCES `publishables`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `publishable_subscriptions_user_publishable_idx` ON `publishable_subscriptions` (`user_id`,`publishable_id`);--> statement-breakpoint
CREATE INDEX `publishable_subscriptions_publishable_idx` ON `publishable_subscriptions` (`publishable_id`);--> statement-breakpoint
CREATE INDEX `publishable_subscriptions_user_idx` ON `publishable_subscriptions` (`user_id`);--> statement-breakpoint
CREATE TABLE `publishable_upvotes` (
	`id` text PRIMARY KEY NOT NULL,
	`publishable_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`publishable_id`) REFERENCES `publishables`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `publishable_upvotes_publishable_user_idx` ON `publishable_upvotes` (`publishable_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `publishable_upvotes_publishable_idx` ON `publishable_upvotes` (`publishable_id`);--> statement-breakpoint
CREATE INDEX `publishable_upvotes_user_idx` ON `publishable_upvotes` (`user_id`);--> statement-breakpoint
CREATE INDEX `publishable_upvotes_created_at_idx` ON `publishable_upvotes` (`created_at`);--> statement-breakpoint
CREATE TABLE `publishables` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`visibility` text DEFAULT 'private' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`icon` text,
	`cover_image` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `publishables_owner_kind_slug_idx` ON `publishables` (`owner_user_id`,`kind`,`slug`);--> statement-breakpoint
CREATE INDEX `publishables_kind_idx` ON `publishables` (`kind`);--> statement-breakpoint
CREATE INDEX `publishables_visibility_idx` ON `publishables` (`visibility`);--> statement-breakpoint
CREATE INDEX `publishables_updated_at_idx` ON `publishables` (`updated_at`);--> statement-breakpoint
CREATE TABLE `skill_files` (
	`id` text PRIMARY KEY NOT NULL,
	`skill_id` text NOT NULL,
	`path` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skill_files_skill_path_idx` ON `skill_files` (`skill_id`,`path`);--> statement-breakpoint
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
CREATE INDEX `skill_install_events_installed_at_idx` ON `skill_install_events` (`installed_at`);--> statement-breakpoint
CREATE TABLE `skill_package_items` (
	`id` text PRIMARY KEY NOT NULL,
	`package_id` text NOT NULL,
	`skill_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`note` text,
	`pinned_release_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`package_id`) REFERENCES `skill_packages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`pinned_release_id`) REFERENCES `publishable_releases`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skill_package_items_package_skill_idx` ON `skill_package_items` (`package_id`,`skill_id`);--> statement-breakpoint
CREATE INDEX `skill_package_items_package_position_idx` ON `skill_package_items` (`package_id`,`position`);--> statement-breakpoint
CREATE INDEX `skill_package_items_skill_idx` ON `skill_package_items` (`skill_id`);--> statement-breakpoint
CREATE TABLE `skill_packages` (
	`id` text PRIMARY KEY NOT NULL,
	FOREIGN KEY (`id`) REFERENCES `publishables`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
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
CREATE TABLE `skills` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`source_repo` text,
	`source_skill_name` text,
	`source_install_command` text,
	`source_url` text,
	`frontmatter` text,
	`demo_video_url` text,
	`parent_skill_id` text,
	`root_skill_id` text,
	`fork_source_release_id` text,
	`latest_synced_release_id` text,
	`fork_mode` text DEFAULT 'linked' NOT NULL,
	`allow_upstream_sync` integer DEFAULT 1 NOT NULL,
	`fork_note` text,
	FOREIGN KEY (`id`) REFERENCES `publishables`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `skills_type_idx` ON `skills` (`type`);--> statement-breakpoint
CREATE INDEX `skills_parent_idx` ON `skills` (`parent_skill_id`);--> statement-breakpoint
CREATE INDEX `skills_root_idx` ON `skills` (`root_skill_id`);--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`handle` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`sso_sub` text,
	`is_virtual` integer DEFAULT false NOT NULL,
	`can_publish_as` text DEFAULT '[]' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_handle_unique` ON `user` (`handle`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `external_identities` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`issuer` text NOT NULL,
	`subject` text NOT NULL,
	`email_snapshot` text,
	`name_snapshot` text,
	`avatar_snapshot` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `external_identities_provider_issuer_subject_idx` ON `external_identities` (`provider`,`issuer`,`subject`);--> statement-breakpoint
CREATE INDEX `external_identities_user_idx` ON `external_identities` (`user_id`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
