-- unaccent() is STABLE, so it cannot be used in an index expression. This IMMUTABLE wrapper
-- pins the dictionary explicitly (standard pattern) for accent-insensitive trigram search.
CREATE OR REPLACE FUNCTION immutable_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;
