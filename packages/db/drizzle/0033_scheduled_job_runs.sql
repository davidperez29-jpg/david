CREATE TABLE "scheduled_job_runs" (
	"job" text NOT NULL,
	"run_on" date NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"result" jsonb,
	CONSTRAINT "scheduled_job_runs_job_run_on_pk" PRIMARY KEY("job","run_on")
);
