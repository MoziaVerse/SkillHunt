CREATE TABLE `skill_upvotes` (
	`id` text PRIMARY KEY NOT NULL,
	`skill_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skill_upvotes_skill_user_idx` ON `skill_upvotes` (`skill_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `skill_upvotes_skill_idx` ON `skill_upvotes` (`skill_id`);--> statement-breakpoint
CREATE INDEX `skill_upvotes_user_idx` ON `skill_upvotes` (`user_id`);--> statement-breakpoint
CREATE INDEX `skill_upvotes_created_at_idx` ON `skill_upvotes` (`created_at`);--> statement-breakpoint
CREATE TABLE `skill_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`skill_id` text NOT NULL,
	`user_id` text NOT NULL,
	`parent_id` text,
	`content` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `skill_comments_skill_idx` ON `skill_comments` (`skill_id`);--> statement-breakpoint
CREATE INDEX `skill_comments_user_idx` ON `skill_comments` (`user_id`);--> statement-breakpoint
CREATE INDEX `skill_comments_parent_idx` ON `skill_comments` (`parent_id`);--> statement-breakpoint
CREATE INDEX `skill_comments_created_at_idx` ON `skill_comments` (`created_at`);--> statement-breakpoint
CREATE TABLE `user_bookmarks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`skill_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_bookmarks_user_skill_idx` ON `user_bookmarks` (`user_id`,`skill_id`);--> statement-breakpoint
CREATE INDEX `user_bookmarks_user_idx` ON `user_bookmarks` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_bookmarks_skill_idx` ON `user_bookmarks` (`skill_id`);--> statement-breakpoint
CREATE INDEX `user_bookmarks_created_at_idx` ON `user_bookmarks` (`created_at`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`actor_id` text,
	`skill_id` text,
	`comment_id` text,
	`read` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `notifications_user_idx` ON `notifications` (`user_id`);--> statement-breakpoint
CREATE INDEX `notifications_user_read_idx` ON `notifications` (`user_id`,`read`);--> statement-breakpoint
CREATE INDEX `notifications_created_at_idx` ON `notifications` (`created_at`);--> statement-breakpoint
CREATE TABLE `skill_counts` (
	`skill_id` text PRIMARY KEY NOT NULL,
	`upvote_count` integer DEFAULT 0 NOT NULL,
	`comment_count` integer DEFAULT 0 NOT NULL,
	`bookmark_count` integer DEFAULT 0 NOT NULL,
	`featured_date` text
);
