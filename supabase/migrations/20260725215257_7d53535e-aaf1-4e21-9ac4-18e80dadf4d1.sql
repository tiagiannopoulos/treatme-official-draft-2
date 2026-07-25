
CREATE TABLE public.treatments (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  improves TEXT[] NOT NULL DEFAULT '{}',
  price_from INTEGER NOT NULL,
  what_it_is TEXT NOT NULL,
  what_to_expect TEXT NOT NULL,
  downtime TEXT NOT NULL,
  science TEXT NOT NULL DEFAULT '',
  hero_image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.treatments TO anon, authenticated;
GRANT ALL ON public.treatments TO service_role;
ALTER TABLE public.treatments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "treatments public read" ON public.treatments FOR SELECT USING (true);

CREATE TABLE public.treatment_before_afters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  treatment_slug TEXT NOT NULL REFERENCES public.treatments(slug) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  before_url TEXT NOT NULL,
  after_url TEXT NOT NULL,
  caption TEXT,
  provider_name TEXT,
  weeks_between INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.treatment_before_afters TO anon, authenticated;
GRANT ALL ON public.treatment_before_afters TO service_role;
ALTER TABLE public.treatment_before_afters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "before_afters public read" ON public.treatment_before_afters FOR SELECT USING (true);
CREATE INDEX ON public.treatment_before_afters(treatment_slug, sort_order);

INSERT INTO public.treatments (slug,name,category,improves,price_from,what_it_is,what_to_expect,downtime,science,hero_image_url,sort_order) VALUES
('hydrafacial','hydrafacial','deep cleansing & hydration',ARRAY['hydration','pores','texture','dullness']::text[],189,'a medical-grade three-step facial: cleanse + exfoliate, extract debris from pores, then infuse the skin with hydrating and antioxidant serums. no needles, no downtime.','60 minutes. you''ll feel suction (gentle vacuum), then cool serums. your skin reads brighter and plumper the same day.','none','vortex-fusion tech uses spiral suction to loosen debris while simultaneously delivering peptides, ha, and antioxidants. no wounding — pure conditioning.','https://picsum.photos/seed/hydrafacial-hero/900/1200',0),
('botox','neuromodulator (botox / dysport)','fine lines & wrinkles',ARRAY['fineLines','wrinkles']::text[],12,'tiny injections that relax the muscles creating expression lines. softens forehead, brow, and crow''s feet without freezing the face.','15–20 minutes. small pinches. results show in 5–14 days and last 3–4 months.','back to normal same day. avoid lying flat or workouts for 4 hours.','botulinum toxin type a temporarily blocks acetylcholine at the neuromuscular junction — the muscle stops contracting, the overlying skin stops creasing.','https://picsum.photos/seed/botox-hero/900/1200',1),
('filler','dermal filler','volume restoration',ARRAY['volumeLoss','wrinkles','symmetry']::text[],650,'hyaluronic acid placed precisely to restore lost volume in cheeks, temples, lips, or under-eyes. instant lift, dissolvable.','30–60 minutes with numbing. mild swelling for 1–3 days. results last 9–18 months.','1–3 days of swelling/bruising possible.','cross-linked hyaluronic acid binds water in the dermis, physically restoring volume lost to bone remodeling and fat pad atrophy. fully reversible with hyaluronidase.','https://picsum.photos/seed/filler-hero/900/1200',2),
('microneedling-rf','microneedling with rf','texture & collagen',ARRAY['texture','pores','fineLines','wrinkles']::text[],550,'ultrafine needles deliver radiofrequency heat into the deep dermis to remodel collagen — tightens pores and smooths texture.','topical numbing, 45 minutes. skin is pink for 24–48 hours. series of 3 spaced 4 weeks apart for best results.','24–48 hours of redness.','insulated needles bypass the epidermis and deposit rf heat at a controlled depth (1.5–3.5mm). the thermal wound triggers a fresh collagen and elastin cascade.','https://picsum.photos/seed/microneedling-rf-hero/900/1200',3),
('ipl','ipl photofacial','pigmentation & redness',ARRAY['pigmentation','darkSpots','redness']::text[],350,'broad-spectrum light targets brown spots and broken capillaries. evens tone without harming surrounding skin.','30 minutes. feels like a warm rubber band snap. spots darken then flake off over 7–10 days.','minimal — slight redness same day.','selective photothermolysis: melanin and hemoglobin absorb specific wavelengths, heat up, and are cleared by the body — while surrounding tissue stays cool.','https://picsum.photos/seed/ipl-hero/900/1200',4),
('chemical-peel','medical chemical peel','tone & texture',ARRAY['pigmentation','texture','darkSpots','fineLines']::text[],175,'controlled acid resurfacing (glycolic, tca, or jessner''s) to lift dull surface layers and trigger fresh, even skin.','30 minutes. mild tingling. light flaking for 3–7 days depending on depth.','3–7 days of flaking.','acids disrupt corneocyte adhesion in the upper epidermis; controlled shedding accelerates cell turnover and stimulates deeper collagen when the peel reaches the papillary dermis.','https://picsum.photos/seed/chemical-peel-hero/900/1200',5),
('laser-resurfacing','fractional laser resurfacing','wrinkles & texture',ARRAY['wrinkles','fineLines','texture','pigmentation']::text[],850,'fractional laser creates microscopic columns of heat that trigger deep collagen remodelling. the gold standard for crepiness and scars.','45 minutes with numbing. skin feels sunburned for 3–5 days.','5–7 days of pinkness and peeling.','fractionated columns of ablation leave healthy skin bridges between treatment zones — the same wound response, dramatically faster healing than fully ablative lasers.','https://picsum.photos/seed/laser-resurfacing-hero/900/1200',6),
('skin-booster','skin booster (profhilo / volite)','deep hydration',ARRAY['hydration','fineLines','texture','volumeLoss']::text[],600,'micro-injections of pure hyaluronic acid spread across the face for deep hydration and a quiet glow.','20 minutes. tiny bumps for a few hours. results build over 4 weeks.','tiny bumps for 4–8 hours.','unmodified high/low molecular weight ha diffuses through the dermis, hydrating and gently stimulating fibroblasts to produce more collagen and elastin over 4–8 weeks.','https://picsum.photos/seed/skin-booster-hero/900/1200',7);

INSERT INTO public.treatment_before_afters (treatment_slug,sort_order,before_url,after_url,caption,provider_name,weeks_between)
SELECT t.slug, n, 'https://picsum.photos/seed/'||t.slug||'-b'||n||'/800/1000', 'https://picsum.photos/seed/'||t.slug||'-a'||n||'/800/1000',
  (ARRAY['single session · 6 weeks post','series of 3 · 12 weeks apart','one visit · 4 weeks post'])[n+1],
  (ARRAY['dr. mei aesthetics','atelier aesthetics','the glow room'])[n+1],
  (ARRAY[6,12,4])[n+1]
FROM public.treatments t, generate_series(0,2) n;
