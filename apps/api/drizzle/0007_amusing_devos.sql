CREATE TABLE `publishable_external_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`publishable_id` text NOT NULL,
	`tag` text NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`publishable_id`) REFERENCES `publishables`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `publishable_external_tags_unique_idx` ON `publishable_external_tags` (`publishable_id`,`tag`,`source_type`,`source_id`);--> statement-breakpoint
CREATE INDEX `publishable_external_tags_publishable_idx` ON `publishable_external_tags` (`publishable_id`);--> statement-breakpoint
CREATE INDEX `publishable_external_tags_tag_idx` ON `publishable_external_tags` (`tag`);--> statement-breakpoint
CREATE INDEX `publishable_external_tags_source_idx` ON `publishable_external_tags` (`source_type`,`source_id`);