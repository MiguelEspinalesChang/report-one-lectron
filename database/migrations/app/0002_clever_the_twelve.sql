CREATE TABLE `brands` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `brands_name_unique` ON `brands` (`name`);--> statement-breakpoint
CREATE TABLE `devices` (
	`id` integer PRIMARY KEY NOT NULL,
	`model_id` integer NOT NULL,
	`name` text NOT NULL,
	`transport` text NOT NULL,
	`connection` text NOT NULL,
	`slave_id` integer DEFAULT 1 NOT NULL,
	`polling_interval_s` integer DEFAULT 900 NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`model_id`) REFERENCES `meter_models`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `devices_name_unique` ON `devices` (`name`);--> statement-breakpoint
CREATE TABLE `meter_models` (
	`id` integer PRIMARY KEY NOT NULL,
	`brand_id` integer NOT NULL,
	`name` text NOT NULL,
	`register_map` text NOT NULL,
	`notes` text,
	FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `meter_models_brand_id_name_unique` ON `meter_models` (`brand_id`,`name`);