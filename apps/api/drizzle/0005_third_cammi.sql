ALTER TABLE `skill_files` ADD `storage_kind` text DEFAULT 'inline' NOT NULL;--> statement-breakpoint
ALTER TABLE `skill_files` ADD `object_key` text;--> statement-breakpoint
ALTER TABLE `skill_files` ADD `content_type` text;--> statement-breakpoint
ALTER TABLE `skill_files` ADD `size_bytes` integer DEFAULT 0 NOT NULL;