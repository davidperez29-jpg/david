CREATE TABLE "api_rate_limits" (
	"bucket" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "api_rate_limits_bucket_window_start_pk" PRIMARY KEY("bucket","window_start")
);
