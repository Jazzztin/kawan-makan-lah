CREATE TABLE `seller_login_attempts` (
	`key` text PRIMARY KEY NOT NULL,
	`attempts` integer NOT NULL,
	`window_started` integer NOT NULL,
	`blocked_until` integer DEFAULT 0 NOT NULL
);
