ALTER TABLE public.storefronts
  ADD COLUMN IF NOT EXISTS cover_url text,
  ADD COLUMN IF NOT EXISTS neighbourhood text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS hours jsonb,
  ADD COLUMN IF NOT EXISTS parking text,
  ADD COLUMN IF NOT EXISTS transit_note text,
  ADD COLUMN IF NOT EXISTS accessibility text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS devices text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS product_lines text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS peel_depths text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cancellation_policy text,
  ADD COLUMN IF NOT EXISTS deposit_policy text,
  ADD COLUMN IF NOT EXISTS late_policy text;

CREATE TABLE IF NOT EXISTS public.storefront_media (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  storefront_id uuid NOT NULL REFERENCES public.storefronts(id) ON DELETE CASCADE,
  url text NOT NULL,
  caption text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.storefront_media TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.storefront_media TO authenticated;
GRANT ALL ON public.storefront_media TO service_role;

ALTER TABLE public.storefront_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "storefront media is public" ON public.storefront_media;
CREATE POLICY "storefront media is public"
  ON public.storefront_media FOR SELECT USING (true);

DROP POLICY IF EXISTS "owners manage their storefront media" ON public.storefront_media;
CREATE POLICY "owners manage their storefront media"
  ON public.storefront_media FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.storefronts s
    WHERE s.id = storefront_media.storefront_id
      AND s.owner_user_id IS NOT NULL
      AND s.owner_user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.storefronts s
    WHERE s.id = storefront_media.storefront_id
      AND s.owner_user_id IS NOT NULL
      AND s.owner_user_id = auth.uid()
  ));

DROP TRIGGER IF EXISTS update_storefront_media_updated_at ON public.storefront_media;
CREATE TRIGGER update_storefront_media_updated_at
  BEFORE UPDATE ON public.storefront_media
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS storefront_media_storefront_idx
  ON public.storefront_media (storefront_id, sort_order);