ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS specialties text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS claimed boolean NOT NULL DEFAULT false;

ALTER TABLE public.treatments
  ADD COLUMN IF NOT EXISTS short_description text NOT NULL DEFAULT '';

UPDATE public.treatments SET short_description = descriptor WHERE short_description = '' AND descriptor <> '';

ALTER TABLE public.provider_media
  ADD COLUMN IF NOT EXISTS weeks_elapsed integer;

UPDATE public.provider_media SET weeks_elapsed = weeks_between WHERE weeks_elapsed IS NULL;

CREATE OR REPLACE VIEW public.clinics
WITH (security_invoker = true) AS
SELECT id, slug, name, tagline, address_line, city, postcode, lat, lng,
       hero_image_url, rating, review_count, featured, claimed, created_at, updated_at
FROM public.storefronts;

GRANT SELECT ON public.clinics TO anon, authenticated;
GRANT ALL ON public.clinics TO service_role;