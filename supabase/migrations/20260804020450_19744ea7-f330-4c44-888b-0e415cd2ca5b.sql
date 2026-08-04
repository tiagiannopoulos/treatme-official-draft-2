ALTER TABLE public.storefronts
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS cover_url text,
  ADD COLUMN IF NOT EXISTS brand_accent text DEFAULT '#F8A1C6',
  ADD COLUMN IF NOT EXISTS tagline text,
  ADD COLUMN IF NOT EXISTS neighbourhood text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS hours jsonb,
  ADD COLUMN IF NOT EXISTS price_band text,
  ADD COLUMN IF NOT EXISTS parking text,
  ADD COLUMN IF NOT EXISTS transit_note text,
  ADD COLUMN IF NOT EXISTS accessibility text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS devices text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS product_lines text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS peel_depths text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS languages text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cancellation_policy text,
  ADD COLUMN IF NOT EXISTS deposit_policy text,
  ADD COLUMN IF NOT EXISTS late_policy text,
  ADD COLUMN IF NOT EXISTS booked_count_30d integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS year_opened integer;

CREATE TABLE IF NOT EXISTS public.storefront_media (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  storefront_id uuid NOT NULL REFERENCES public.storefronts(id) ON DELETE CASCADE,
  url text NOT NULL,
  caption text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.storefront_media
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'space';

GRANT SELECT ON public.storefront_media TO anon;
GRANT SELECT ON public.storefront_media TO authenticated;
GRANT ALL ON public.storefront_media TO service_role;

ALTER TABLE public.storefront_media ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'storefront_media'
      AND policyname = 'storefront media public read'
  ) THEN
    CREATE POLICY "storefront media public read" ON public.storefront_media
      FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;