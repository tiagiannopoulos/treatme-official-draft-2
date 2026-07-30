ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS licensing_body text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS languages text[] NOT NULL DEFAULT '{}'::text[];

CREATE TABLE IF NOT EXISTS public.provider_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  treatment_slug text NOT NULL,
  treatment_name text NOT NULL,
  before_url text NOT NULL,
  after_url text NOT NULL,
  weeks_between integer,
  sort_order integer NOT NULL DEFAULT 0,
  approved boolean NOT NULL DEFAULT false,
  consent_confirmed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.provider_media TO anon, authenticated;
GRANT ALL ON public.provider_media TO service_role;
ALTER TABLE public.provider_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY provider_media_public_read ON public.provider_media
  FOR SELECT TO anon, authenticated
  USING (approved = true AND consent_confirmed = true);

CREATE TABLE IF NOT EXISTS public.provider_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  reviewer_name text NOT NULL,
  rating numeric NOT NULL DEFAULT 5,
  treatment_name text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.provider_reviews TO anon, authenticated;
GRANT ALL ON public.provider_reviews TO service_role;
ALTER TABLE public.provider_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY provider_reviews_public_read ON public.provider_reviews
  FOR SELECT TO anon, authenticated
  USING (published = true);

CREATE TRIGGER provider_media_updated_at BEFORE UPDATE ON public.provider_media
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER provider_reviews_updated_at BEFORE UPDATE ON public.provider_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

UPDATE public.providers
SET licensing_body = CASE
      WHEN title ILIKE '%rn%' THEN 'college of nurses'
      WHEN title ILIKE '%dr%' OR credentials ILIKE '%md%' THEN 'college of physicians and surgeons'
      ELSE 'provincial regulatory college' END,
    languages = ARRAY['english']
WHERE licensing_body = '';

INSERT INTO public.provider_media (provider_id, treatment_slug, treatment_name, before_url, after_url, weeks_between, sort_order, approved, consent_confirmed)
SELECT p.id, x.slug, x.tname, x.b, x.a, x.wk, x.so, true, true
FROM public.providers p
CROSS JOIN (VALUES
  ('lip-filler','lip filler','https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=600&q=80','https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600&q=80',2,0),
  ('hydrafacial','hydrafacial','https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=600&q=80','https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=600&q=80',4,1)
) AS x(slug,tname,b,a,wk,so)
WHERE NOT EXISTS (SELECT 1 FROM public.provider_media m WHERE m.provider_id = p.id);

INSERT INTO public.provider_reviews (provider_id, reviewer_name, rating, treatment_name, body, reviewed_at)
SELECT p.id, x.rn, x.rating, x.tname, x.body, now() - (x.days || ' days')::interval
FROM public.providers p
CROSS JOIN (VALUES
  ('sarah k.', 5, 'lip filler', 'so natural. she talked me through every step and did not oversell me anything.', 6),
  ('maya r.', 5, 'hydrafacial', 'my skin has never looked this calm. booked my next one on the way out.', 21),
  ('jenna l.', 4.5, 'botox', 'subtle and even. exactly what i asked for.', 48)
) AS x(rn, rating, tname, body, days)
WHERE NOT EXISTS (SELECT 1 FROM public.provider_reviews r WHERE r.provider_id = p.id);