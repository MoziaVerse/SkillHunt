CREATE TABLE `skill_package_upvotes` (
	`id` text PRIMARY KEY NOT NULL,
	`package_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`package_id`) REFERENCES `skill_packages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skill_package_upvotes_package_user_idx` ON `skill_package_upvotes` (`package_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `skill_package_upvotes_package_idx` ON `skill_package_upvotes` (`package_id`);--> statement-breakpoint
CREATE INDEX `skill_package_upvotes_user_idx` ON `skill_package_upvotes` (`user_id`);--> statement-breakpoint
CREATE INDEX `skill_package_upvotes_created_at_idx` ON `skill_package_upvotes` (`created_at`);--> statement-breakpoint
CREATE TABLE `skill_package_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`package_id` text NOT NULL,
	`user_id` text NOT NULL,
	`parent_id` text,
	`content` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`package_id`) REFERENCES `skill_packages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `skill_package_comments_package_idx` ON `skill_package_comments` (`package_id`);--> statement-breakpoint
CREATE INDEX `skill_package_comments_user_idx` ON `skill_package_comments` (`user_id`);--> statement-breakpoint
CREATE INDEX `skill_package_comments_parent_idx` ON `skill_package_comments` (`parent_id`);--> statement-breakpoint
CREATE INDEX `skill_package_comments_created_at_idx` ON `skill_package_comments` (`created_at`);--> statement-breakpoint
CREATE TABLE `user_package_bookmarks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`package_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`package_id`) REFERENCES `skill_packages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_package_bookmarks_user_package_idx` ON `user_package_bookmarks` (`user_id`,`package_id`);--> statement-breakpoint
CREATE INDEX `user_package_bookmarks_user_idx` ON `user_package_bookmarks` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_package_bookmarks_package_idx` ON `user_package_bookmarks` (`package_id`);--> statement-breakpoint
CREATE INDEX `user_package_bookmarks_created_at_idx` ON `user_package_bookmarks` (`created_at`);
