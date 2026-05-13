CREATE TABLE `skill_packages` (
	`id` text PRIMARY KEY NOT NULL,
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
CREATE UNIQUE INDEX `skill_packages_owner_slug_idx` ON `skill_packages` (`owner_user_id`,`slug`);--> statement-breakpoint
CREATE INDEX `skill_packages_visibility_idx` ON `skill_packages` (`visibility`);--> statement-breakpoint
CREATE INDEX `skill_packages_updated_at_idx` ON `skill_packages` (`updated_at`);--> statement-breakpoint
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
	FOREIGN KEY (`pinned_release_id`) REFERENCES `skill_releases`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skill_package_items_package_skill_idx` ON `skill_package_items` (`package_id`,`skill_id`);--> statement-breakpoint
CREATE INDEX `skill_package_items_package_position_idx` ON `skill_package_items` (`package_id`,`position`);--> statement-breakpoint
CREATE INDEX `skill_package_items_skill_idx` ON `skill_package_items` (`skill_id`);
