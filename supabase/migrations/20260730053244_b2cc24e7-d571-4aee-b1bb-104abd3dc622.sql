CREATE TABLE public.storefronts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  tagline text NOT NULL DEFAULT '',
  address_line text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  postcode text NOT NULL DEFAULT '',
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  hero_image_url text,
  rating numeric(2,1) NOT NULL DEFAULT 4.8,
  review_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.storefronts TO anon, authenticated;
GRANT ALL ON public.storefronts TO service_role;
ALTER TABLE public.storefronts ENABLE ROW LEVEL SECURITY;
CREATE POLICY storefronts_public_read ON public.storefronts FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  title text NOT NULL DEFAULT '',
  credentials text NOT NULL DEFAULT '',
  years_experience integer NOT NULL DEFAULT 0,
  bio text NOT NULL DEFAULT '',
  avatar_url text,
  rating numeric(2,1) NOT NULL DEFAULT 4.9,
  review_count integer NOT NULL DEFAULT 0,
  verified boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.providers TO anon, authenticated;
GRANT ALL ON public.providers TO service_role;
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY providers_public_read ON public.providers FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.provider_storefronts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  storefront_id uuid NOT NULL REFERENCES public.storefronts(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, storefront_id)
);
GRANT SELECT ON public.provider_storefronts TO anon, authenticated;
GRANT ALL ON public.provider_storefronts TO service_role;
ALTER TABLE public.provider_storefronts ENABLE ROW LEVEL SECURITY;
CREATE POLICY provider_storefronts_public_read ON public.provider_storefronts FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.provider_treatments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  treatment_slug text NOT NULL,
  price_from integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, treatment_slug)
);
GRANT SELECT ON public.provider_treatments TO anon, authenticated;
GRANT ALL ON public.provider_treatments TO service_role;
ALTER TABLE public.provider_treatments ENABLE ROW LEVEL SECURITY;
CREATE POLICY provider_treatments_public_read ON public.provider_treatments FOR SELECT TO anon, authenticated USING (true);

CREATE TRIGGER storefronts_updated_at BEFORE UPDATE ON public.storefronts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER providers_updated_at BEFORE UPDATE ON public.providers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.storefronts (slug, name, tagline, address_line, city, postcode, lat, lng, rating, review_count) VALUES
  ('the-glass-house-marylebone', 'the glass house', 'quiet, clinical, unfussy. injectables and skin.', '18 devonshire street', 'london', 'W1G 7AF', 51.5205, -0.1487, 4.9, 412),
  ('lumen-clinic-shoreditch', 'lumen clinic', 'laser and resurfacing specialists in east london.', '42 rivington street', 'london', 'EC2A 3QP', 51.5262, -0.0810, 4.8, 287),
  ('atelier-skin-chelsea', 'atelier skin', 'facials, peels and long-game skin health.', '9 sloane avenue', 'london', 'SW3 3JD', 51.4930, -0.1663, 4.7, 196);

INSERT INTO public.providers (slug, name, title, credentials, years_experience, bio, rating, review_count) VALUES
  ('dr-amara-ellis', 'dr amara ellis', 'aesthetic doctor', 'mbbs, mrcgp', 11, 'known for conservative, structural injectables. treats the face as a whole rather than chasing single lines.', 4.9, 214),
  ('dr-jonah-price', 'dr jonah price', 'cosmetic physician', 'mbchb, bcam', 8, 'filler and profile balancing. big on saying no when a treatment is not the right call.', 4.8, 133),
  ('nadia-rahman', 'nadia rahman', 'aesthetic nurse prescriber', 'rgn, nmc independent prescriber', 13, 'skin boosters, polynucleotides and tear trough work. very steady hands, very direct advice.', 5.0, 301),
  ('elise-moreau', 'elise moreau', 'laser specialist', 'level 4 laser and light, bta', 9, 'pigmentation and resurfacing. builds slow multi-session plans instead of one aggressive pass.', 4.8, 178),
  ('tom-braddock', 'tom braddock', 'advanced aesthetician', 'cidesco, level 4 skin', 7, 'medical facials and peels. good first stop if you have never had anything done.', 4.7, 96),
  ('dr-priya-shah', 'dr priya shah', 'dermatologist', 'mbbs, mrcp (derm)', 16, 'acne, rosacea and pigmentation. treats the condition first and the aesthetics second.', 4.9, 342);

INSERT INTO public.provider_storefronts (provider_id, storefront_id, is_primary)
SELECT p.id, s.id, v.is_primary FROM (VALUES
  ('dr-amara-ellis','the-glass-house-marylebone', true),
  ('dr-jonah-price','the-glass-house-marylebone', true),
  ('nadia-rahman','the-glass-house-marylebone', true),
  ('nadia-rahman','atelier-skin-chelsea', false),
  ('elise-moreau','lumen-clinic-shoreditch', true),
  ('tom-braddock','atelier-skin-chelsea', true),
  ('dr-priya-shah','lumen-clinic-shoreditch', true)
) AS v(provider_slug, storefront_slug, is_primary)
JOIN public.providers p ON p.slug = v.provider_slug
JOIN public.storefronts s ON s.slug = v.storefront_slug;

INSERT INTO public.provider_treatments (provider_id, treatment_slug, price_from)
SELECT p.id, t.slug, t.price_from::int FROM (VALUES
  ('dr-amara-ellis','anti-wrinkle-injections'),
  ('dr-amara-ellis','dermal-filler'),
  ('dr-amara-ellis','skin-boosters'),
  ('dr-jonah-price','dermal-filler'),
  ('dr-jonah-price','anti-wrinkle-injections'),
  ('nadia-rahman','skin-boosters'),
  ('nadia-rahman','polynucleotides'),
  ('nadia-rahman','profhilo'),
  ('elise-moreau','laser-resurfacing'),
  ('elise-moreau','ipl-photofacial'),
  ('elise-moreau','laser-hair-removal'),
  ('tom-braddock','hydrafacial'),
  ('tom-braddock','chemical-peel'),
  ('tom-braddock','microneedling'),
  ('dr-priya-shah','chemical-peel'),
  ('dr-priya-shah','microneedling'),
  ('dr-priya-shah','hydrafacial')
) AS v(provider_slug, treatment_slug)
JOIN public.providers p ON p.slug = v.provider_slug
JOIN public.treatments t ON t.slug = v.treatment_slug;