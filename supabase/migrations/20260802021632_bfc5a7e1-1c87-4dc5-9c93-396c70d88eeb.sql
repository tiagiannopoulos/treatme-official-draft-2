DROP INDEX IF EXISTS public.storefronts_google_place_id_key;
ALTER TABLE public.storefronts ADD CONSTRAINT storefronts_google_place_id_key UNIQUE (google_place_id);