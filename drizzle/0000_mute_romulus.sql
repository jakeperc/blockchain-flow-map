CREATE TABLE `entity_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`chain` text NOT NULL,
	`address` text NOT NULL,
	`evidence` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_evidence_chain_address` ON `entity_evidence` (`chain`,`address`);--> statement-breakpoint
CREATE TABLE `feeds` (
	`chain` text PRIMARY KEY NOT NULL,
	`cursor` text DEFAULT '' NOT NULL,
	`last_received` integer,
	`captured_to` integer,
	`coverage_start` integer,
	`state` text DEFAULT 'NOT CONNECTED' NOT NULL,
	`error` text
);
--> statement-breakpoint
CREATE TABLE `prices` (
	`id` text PRIMARY KEY NOT NULL,
	`asset` text NOT NULL,
	`at` integer NOT NULL,
	`usd` real NOT NULL,
	`source` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_prices_asset_time` ON `prices` (`asset`,`at`);--> statement-breakpoint
CREATE TABLE `transfers` (
	`id` text PRIMARY KEY NOT NULL,
	`chain` text NOT NULL,
	`transaction_id` text NOT NULL,
	`block_time` integer NOT NULL,
	`asset` text NOT NULL,
	`usd_value` real,
	`adjustment` text NOT NULL,
	`economic_class` text NOT NULL,
	`origin` text,
	`destination` text,
	`confidence` text,
	`mapped` integer DEFAULT 0 NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_transfers_time_chain` ON `transfers` (`block_time`,`chain`);--> statement-breakpoint
CREATE INDEX `idx_transfers_corridor_time` ON `transfers` (`origin`,`destination`,`block_time`);