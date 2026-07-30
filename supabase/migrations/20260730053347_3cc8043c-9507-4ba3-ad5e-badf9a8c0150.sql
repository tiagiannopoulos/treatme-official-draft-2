DELETE FROM public.provider_treatments;
INSERT INTO public.provider_treatments (provider_id, treatment_slug, price_from)
SELECT p.id, t.slug, t.price_from::int FROM (VALUES
  ('dr-amara-ellis','botox'),
  ('dr-amara-ellis','filler'),
  ('dr-amara-ellis','skin-booster'),
  ('dr-amara-ellis','thread-lift'),
  ('dr-jonah-price','filler'),
  ('dr-jonah-price','lip-filler'),
  ('dr-jonah-price','liquid-rhinoplasty'),
  ('dr-jonah-price','botox'),
  ('nadia-rahman','skin-booster'),
  ('nadia-rahman','polynucleotides'),
  ('nadia-rahman','prp'),
  ('nadia-rahman','microneedling'),
  ('elise-moreau','laser-resurfacing'),
  ('elise-moreau','ipl'),
  ('elise-moreau','laser-hair-removal'),
  ('elise-moreau','pico-laser'),
  ('tom-braddock','hydrafacial'),
  ('tom-braddock','chemical-peel'),
  ('tom-braddock','dermaplaning'),
  ('tom-braddock','led-therapy'),
  ('dr-priya-shah','chemical-peel'),
  ('dr-priya-shah','microneedling'),
  ('dr-priya-shah','acne-laser'),
  ('dr-priya-shah','medical-facial')
) AS v(provider_slug, treatment_slug)
JOIN public.providers p ON p.slug = v.provider_slug
JOIN public.treatments t ON t.slug = v.treatment_slug;