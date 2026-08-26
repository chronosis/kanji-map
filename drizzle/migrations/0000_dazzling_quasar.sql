CREATE TABLE `kanji_ref` (
	`character` text PRIMARY KEY NOT NULL,
	`school_grade` integer,
	`jlpt_level` text,
	`in_joyo` integer DEFAULT false NOT NULL,
	`freq_rank` integer,
	`strokes` integer,
	`grid_index` integer NOT NULL,
	`in_wanikani` integer DEFAULT false NOT NULL,
	`wk_level` integer,
	`wk_api_order` integer,
	`radical_symbol` text,
	`radical_forms_json` text,
	`parts_json` text
);
--> statement-breakpoint
CREATE TABLE `progress_bunpro` (
	`character` text PRIMARY KEY NOT NULL,
	`srs_stage_normalized` real NOT NULL,
	`accuracy_pct` real,
	`raw_json` text,
	`synced_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `progress_merged` (
	`character` text PRIMARY KEY NOT NULL,
	`srs_avg` real,
	`accuracy_avg` real,
	`sources` integer DEFAULT 0 NOT NULL,
	`synced_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `progress_wanikani` (
	`character` text PRIMARY KEY NOT NULL,
	`subject_id` integer,
	`wk_level` integer,
	`api_order` integer,
	`srs_stage` integer NOT NULL,
	`accuracy_pct` real,
	`meaning_correct` integer DEFAULT 0 NOT NULL,
	`meaning_incorrect` integer DEFAULT 0 NOT NULL,
	`reading_correct` integer DEFAULT 0 NOT NULL,
	`reading_incorrect` integer DEFAULT 0 NOT NULL,
	`raw_json` text,
	`synced_at` text NOT NULL
);
