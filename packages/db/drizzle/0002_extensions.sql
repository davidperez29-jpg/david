-- Fuzzy search on exercise names (§6.5). unaccent for accent-insensitive search.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS unaccent;
