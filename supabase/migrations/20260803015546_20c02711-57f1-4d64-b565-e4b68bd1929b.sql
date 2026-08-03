CREATE TABLE public.clinic_bundles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  storefront_id uuid NOT NULL REFERENCES public.storefronts(id) ON DELETE CASCADE,
  name text NOT NULL,
  tagline text,
  treatment_slugs text[] NOT NULL DEFAULT '{}',
  sessions integer,
  price numeric,
  compare_at_price numeric,
  validity_months integer,
  badge text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.clinic_bundles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinic_bundles TO authenticated;
GRANT ALL ON public.clinic_bundles TO service_role;

ALTER TABLE public.clinic_bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "active bundles are public"
  ON public.clinic_bundles FOR SELECT
  USING (active = true);

CREATE POLICY "owners read own bundles"
  ON public.clinic_bundles FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.storefronts s
    WHERE s.id = clinic_bundles.storefront_id
      AND s.owner_user_id IS NOT NULL
      AND s.owner_user_id = auth.uid()
  ));

CREATE POLICY "owners insert own bundles"
  ON public.clinic_bundles FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.storefronts s
    WHERE s.id = clinic_bundles.storefront_id
      AND s.owner_user_id IS NOT NULL
      AND s.owner_user_id = auth.uid()
  ));

CREATE POLICY "owners update own bundles"
  ON public.clinic_bundles FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.storefronts s
    WHERE s.id = clinic_bundles.storefront_id
      AND s.owner_user_id IS NOT NULL
      AND s.owner_user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.storefronts s
    WHERE s.id = clinic_bundles.storefront_id
      AND s.owner_user_id IS NOT NULL
      AND s.owner_user_id = auth.uid()
  ));

CREATE POLICY "owners delete own bundles"
  ON public.clinic_bundles FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.storefronts s
    WHERE s.id = clinic_bundles.storefront_id
      AND s.owner_user_id IS NOT NULL
      AND s.owner_user_id = auth.uid()
  ));

CREATE INDEX clinic_bundles_storefront_idx ON public.clinic_bundles (storefront_id, sort_order);

CREATE TRIGGER update_clinic_bundles_updated_at
  BEFORE UPDATE ON public.clinic_bundles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.clinic_bundles (storefront_id, name, tagline, treatment_slugs, sessions, price, compare_at_price, validity_months, badge, sort_order)
SELECT s.id, v.name, v.tagline, v.slugs, v.sessions, v.price, v.compare_at, v.months, v.badge, v.sort_order
FROM public.storefronts s
CROSS JOIN (VALUES
  ('glow reset', 'three facials spaced a month apart, plus a take home routine', ARRAY['hydrafacial','chemical-peel']::text[], 3, 690, 855, 6, 'most booked', 1),
  ('smooth start', 'two neuromodulator visits with a free touch up in between', ARRAY['neuromodulators']::text[], 2, 780, 900, 8, NULL, 2),
  ('clear skin course', 'four sessions built for texture and breakouts', ARRAY['chemical-peel','microneedling']::text[], 4, 1180, 1480, 9, 'best value', 3)
) AS v(name, tagline, slugs, sessions, price, compare_at, months, badge, sort_order)
WHERE s.claimed = true;