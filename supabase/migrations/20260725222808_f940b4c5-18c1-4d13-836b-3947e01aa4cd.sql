
-- enums
CREATE TYPE public.slide_type AS ENUM (
  'hook','what_it_is','how_it_works','science','what_to_expect','downtime','results','pricing','cta'
);
CREATE TYPE public.slide_overlay AS ENUM (
  'cream_scrim','butter_scrim','mint_scrim','bubblegum_scrim','none'
);

-- table
CREATE TABLE public.treatment_story_slides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  treatment_slug TEXT NOT NULL REFERENCES public.treatments(slug) ON DELETE CASCADE,
  slide_order INTEGER NOT NULL,
  slide_type public.slide_type NOT NULL,
  headline TEXT NOT NULL,
  body TEXT,
  detail_chips TEXT[] NOT NULL DEFAULT '{}',
  media_url TEXT,
  media_overlay public.slide_overlay NOT NULL DEFAULT 'cream_scrim',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (treatment_slug, slide_order)
);
CREATE INDEX treatment_story_slides_slug_order_idx
  ON public.treatment_story_slides (treatment_slug, slide_order);

-- grants
GRANT SELECT ON public.treatment_story_slides TO anon, authenticated;
GRANT ALL   ON public.treatment_story_slides TO service_role;

-- rls
ALTER TABLE public.treatment_story_slides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "story slides public read"
  ON public.treatment_story_slides FOR SELECT TO anon, authenticated USING (true);
-- no INSERT/UPDATE/DELETE policies: service role bypasses RLS; no client role can write.

-- ensure treatments exist for fks (idempotent)
INSERT INTO public.treatments (slug, name, category, improves, price_from, what_it_is, what_to_expect, downtime, science, sort_order)
VALUES
  ('chemical-peel',    'chemical peel',              'skin',        ARRAY['texture','dullness','pigmentation'], 150, 'a controlled exfoliation using medical acids.', '30 minutes, mild tingling.', 'depth-dependent flaking 3-7 days.', '', 5),
  ('laser-resurfacing','laser resurfacing',          'laser',       ARRAY['texture','scarring','pigmentation'], 800, 'fractional laser resurfacing.', '30-60 minutes with numbing.', '3-7 days of visible downtime.', '', 6),
  ('prp',              'platelet rich plasma (prp)', 'skin',        ARRAY['texture','hair'],                    600, 'your own platelets returned to your skin.', '60 minutes including draw and centrifuge.', 'up to 24 hours of pinkness.', '', 7),
  ('medical-facial',   'medical facial',             'skin',        ARRAY['hydration','texture','pores'],       180, 'clinic-grade customized facial.', '60 minutes, deeply relaxing.', 'no real downtime.', '', 8)
ON CONFLICT (slug) DO NOTHING;

-- seeds: 8 treatments
INSERT INTO public.treatment_story_slides
  (treatment_slug, slide_order, slide_type, headline, body, detail_chips, media_overlay)
VALUES
  -- HYDRAFACIAL
  ('hydrafacial', 1, 'hook',           'the everything facial',       'cleanse, exfoliate, extract, hydrate. one appointment, zero downtime.', ARRAY['45 min','no downtime','instant glow'], 'bubblegum_scrim'),
  ('hydrafacial', 2, 'what_it_is',     'so what is it',               'a medical-grade facial using a vortex tip to deep clean and infuse serums in one pass. commonly used for dullness, congestion, and dehydration.', ARRAY[]::text[], 'cream_scrim'),
  ('hydrafacial', 3, 'how_it_works',   'how it works',                'the tip exfoliates and suctions while pushing hydrating serums into fresh skin. your provider customizes the serums to your skin.', ARRAY[]::text[], 'butter_scrim'),
  ('hydrafacial', 4, 'science',        'what''s actually happening',  'hydradermabrasion: mechanical exfoliation lifts the stratum corneum, your outermost layer of dead cells, while glycolic and salicylic acids dissolve the oil binding debris inside pores. the vacuum boosts local blood flow, and hyaluronic acid and antioxidant serums absorb deeper through freshly exfoliated skin.', ARRAY['stratum corneum','aha + bha','hyaluronic acid'], 'cream_scrim'),
  ('hydrafacial', 5, 'what_to_expect', 'your appointment',            '45 minutes, fully awake, most people find it relaxing. you can go straight back to your day.', ARRAY['no needles','no numbing'], 'mint_scrim'),
  ('hydrafacial', 6, 'downtime',       'after care',                  'maybe slightly pink for an hour. skip makeup for the evening if you can, then business as usual.', ARRAY['makeup ok next day','spf always'], 'cream_scrim'),
  ('hydrafacial', 7, 'pricing',        'what it really costs',        'from $X at clinics near you.', ARRAY[]::text[], 'bubblegum_scrim'),
  ('hydrafacial', 8, 'cta',            'ready when you are.',         'providers near you offer this.', ARRAY[]::text[], 'butter_scrim'),

  -- NEUROMODULATOR (botox slug)
  ('botox', 1, 'hook',           'the most researched treatment in aesthetics', 'commonly used to soften expression lines. subtle is the whole point.', ARRAY['15 min appt','results ~2 weeks','lasts 3-4 months'], 'bubblegum_scrim'),
  ('botox', 2, 'what_it_is',     'so what is it',                                'a prescription medication injected in tiny amounts to relax specific muscles. only a licensed provider can assess if it''s right for you.', ARRAY[]::text[], 'cream_scrim'),
  ('botox', 3, 'how_it_works',   'how it works',                                 'it temporarily reduces the signal between nerve and muscle, so the skin above creases less. it does not freeze your face when dosed well.', ARRAY[]::text[], 'butter_scrim'),
  ('botox', 4, 'science',        'what''s actually happening',                   'botulinum toxin type a blocks the release of acetylcholine, the chemical messenger your nerves use to tell muscles to contract. the treated muscle relaxes, so the skin above it stops creasing. your nerve endings regenerate naturally over 3 to 4 months, which is exactly why results fade and maintenance is needed.', ARRAY['acetylcholine','neuromuscular junction','fully reversible'], 'cream_scrim'),
  ('botox', 5, 'what_to_expect', 'your appointment',                             'a consult first, always. then a few small injections, about 15 minutes. many describe it as a pinch.', ARRAY['consult required','15 min'], 'mint_scrim'),
  ('botox', 6, 'downtime',       'after care',                                   'tiny bumps settle within the hour. no workouts, no lying flat, no rubbing the area for the rest of the day.', ARRAY['back to work same day'], 'cream_scrim'),
  ('botox', 7, 'pricing',        'what it really costs',                         'priced per unit. your provider determines dosing at consult.', ARRAY[]::text[], 'bubblegum_scrim'),
  ('botox', 8, 'cta',            'ready when you are.',                          'providers near you offer this.', ARRAY[]::text[], 'butter_scrim'),

  -- DERMAL FILLER
  ('filler', 1, 'hook',           'structure, softened.',       'hyaluronic acid placed with intention. commonly used to restore volume that fades with time.', ARRAY['30-60 min','results same day','lasts 9-18 months'], 'bubblegum_scrim'),
  ('filler', 2, 'what_it_is',     'so what is it',              'a gel made of hyaluronic acid, a sugar molecule your skin already produces, placed by a licensed injector to support areas that have lost volume.', ARRAY[]::text[], 'cream_scrim'),
  ('filler', 3, 'how_it_works',   'how it works',               'your provider maps the face first, then places small amounts along bone or in the dermis to lift, contour, or hydrate. dissolvable if you ever want it undone.', ARRAY[]::text[], 'butter_scrim'),
  ('filler', 4, 'science',        'what''s actually happening', 'hyaluronic acid is a glycosaminoglycan that binds up to a thousand times its weight in water. cross-linked gels sit in the tissue, hold hydration, and give scaffolding to the skin above. an enzyme called hyaluronidase can dissolve it if needed, which is why hyaluronic acid filler is considered reversible.', ARRAY['hyaluronic acid','glycosaminoglycan','hyaluronidase reversible'], 'cream_scrim'),
  ('filler', 5, 'what_to_expect', 'your appointment',           'consult and facial assessment first, always. numbing cream, then careful placement. many describe pressure more than pain.', ARRAY['consult required','numbing used'], 'mint_scrim'),
  ('filler', 6, 'downtime',       'after care',                 'swelling and small bruises are common for a few days. sleep elevated, skip alcohol and workouts for 24 hours.', ARRAY['1-3 days swelling','bruising possible'], 'cream_scrim'),
  ('filler', 7, 'pricing',        'what it really costs',       'priced per syringe. your provider determines how many at consult.', ARRAY[]::text[], 'bubblegum_scrim'),
  ('filler', 8, 'cta',            'ready when you are.',        'providers near you offer this.', ARRAY[]::text[], 'butter_scrim'),

  -- MICRONEEDLING RF
  ('microneedling-rf', 1, 'hook',           'your skin, rebuilding itself.', 'controlled micro-injuries that ask your skin to remodel. commonly used for texture, pores, and early lines.', ARRAY['45 min','24-48 hrs pink','series of 3'], 'bubblegum_scrim'),
  ('microneedling-rf', 2, 'what_it_is',     'so what is it',                 'ultrafine needles create tiny channels in the skin. in the rf version, radiofrequency energy is delivered through the needle tips into the deeper layer.', ARRAY[]::text[], 'cream_scrim'),
  ('microneedling-rf', 3, 'how_it_works',   'how it works',                  'the needles and heat trigger a healing response. your skin repairs itself, laying down new collagen and elastin in the process. a series is standard because remodeling takes weeks.', ARRAY[]::text[], 'butter_scrim'),
  ('microneedling-rf', 4, 'science',        'what''s actually happening',    'the technique is called collagen induction therapy. controlled micro-injuries and, in rf devices, controlled thermal injury signal fibroblasts, the cells that build your skin''s scaffolding, to produce new collagen and elastin. remodeling continues for 8 to 12 weeks after each session.', ARRAY['fibroblasts','collagen induction','controlled thermal injury'], 'cream_scrim'),
  ('microneedling-rf', 5, 'what_to_expect', 'your appointment',              'topical numbing for about 30 minutes, then 20-30 minutes of treatment. warm and prickly, not sharp.', ARRAY['topical numbing','45 min total'], 'mint_scrim'),
  ('microneedling-rf', 6, 'downtime',       'after care',                    'pink and sensitive like a sunburn for a day or two. no makeup for 24 hours, gentle cleanser, no actives for a week, spf always.', ARRAY['24-48 hrs pink','no actives 7 days'], 'cream_scrim'),
  ('microneedling-rf', 7, 'pricing',        'what it really costs',          'often sold as a package of 3 sessions.', ARRAY[]::text[], 'bubblegum_scrim'),
  ('microneedling-rf', 8, 'cta',            'ready when you are.',           'providers near you offer this.', ARRAY[]::text[], 'butter_scrim'),

  -- CHEMICAL PEEL
  ('chemical-peel', 1, 'hook',           'shed the surface.',            'a controlled exfoliation, tuned to your skin. commonly used for tone, dullness, and mild texture.', ARRAY['30 min','downtime varies','many patients repeat monthly'], 'bubblegum_scrim'),
  ('chemical-peel', 2, 'what_it_is',     'so what is it',                'a solution of acids applied to clean skin for a set time. strength ranges from a lunchtime refresh to a deeper medical peel.', ARRAY[]::text[], 'cream_scrim'),
  ('chemical-peel', 3, 'how_it_works',   'how it works',                 'the acids loosen the bonds between dead skin cells so they release evenly. your provider chooses depth and formula based on your skin type and fitzpatrick tone.', ARRAY[]::text[], 'butter_scrim'),
  ('chemical-peel', 4, 'science',        'what''s actually happening',   'alpha hydroxy acids like glycolic and lactic dissolve the desmosomes that glue dead cells together in the stratum corneum. beta hydroxy acids like salicylic are oil soluble and reach inside the pore. deeper peels reach the papillary dermis and prompt fresh keratinocyte turnover from beneath.', ARRAY['ahas + bhas','desmosomes','keratinocyte turnover'], 'cream_scrim'),
  ('chemical-peel', 5, 'what_to_expect', 'your appointment',             'cleanse, apply, tingle. superficial peels finish in 20-30 minutes. deeper peels involve neutralization and a longer settle.', ARRAY['mild tingling','30 min'], 'mint_scrim'),
  ('chemical-peel', 6, 'downtime',       'after care',                   'flaking is normal for 3-7 days depending on depth. do not pick. no retinoids or scrubs while shedding, spf daily.', ARRAY['3-7 days flaking','no picking','spf daily'], 'cream_scrim'),
  ('chemical-peel', 7, 'pricing',        'what it really costs',         'depth of peel changes the price.', ARRAY[]::text[], 'bubblegum_scrim'),
  ('chemical-peel', 8, 'cta',            'ready when you are.',          'providers near you offer this.', ARRAY[]::text[], 'butter_scrim'),

  -- LASER RESURFACING
  ('laser-resurfacing', 1, 'hook',           'resurface, don''t restart.',   'columns of laser energy that tell your skin to rebuild. commonly used for texture, scarring, and sun damage.', ARRAY['30-60 min','3-7 days downtime','1-3 sessions'], 'bubblegum_scrim'),
  ('laser-resurfacing', 2, 'what_it_is',     'so what is it',                'a fractional laser that treats a percentage of your skin at a time, leaving untouched skin around each column to speed healing. non-ablative and ablative options exist.', ARRAY[]::text[], 'cream_scrim'),
  ('laser-resurfacing', 3, 'how_it_works',   'how it works',                 'the laser drops microscopic zones of heat into the skin in a grid pattern. the untreated skin between zones acts as a healing reservoir. your provider matches wavelength and depth to your fitzpatrick type.', ARRAY[]::text[], 'butter_scrim'),
  ('laser-resurfacing', 4, 'science',        'what''s actually happening',   'fractional photothermolysis: water in the skin absorbs specific laser wavelengths and converts light to heat, creating microscopic thermal zones. dermal fibroblasts respond by producing new collagen, and epidermal keratinocytes migrate in from surrounding untreated tissue to resurface each column.', ARRAY['fractional photothermolysis','chromophore water','collagen remodeling'], 'cream_scrim'),
  ('laser-resurfacing', 5, 'what_to_expect', 'your appointment',             'numbing for 30-60 minutes, then treatment. many describe it as hot rubber bands. cool air runs throughout.', ARRAY['topical numbing','cool air'], 'mint_scrim'),
  ('laser-resurfacing', 6, 'downtime',       'after care',                   'red, swollen, sandpaper texture for 3-7 days depending on depth. petrolatum-based ointment, no makeup, strict spf, no sun exposure while healing.', ARRAY['3-7 days visible downtime','strict spf'], 'cream_scrim'),
  ('laser-resurfacing', 7, 'pricing',        'what it really costs',         'depth and area covered change the price.', ARRAY[]::text[], 'bubblegum_scrim'),
  ('laser-resurfacing', 8, 'cta',            'ready when you are.',          'providers near you offer this.', ARRAY[]::text[], 'butter_scrim'),

  -- PRP
  ('prp', 1, 'hook',           'your own biology, put back to work.', 'a small draw of your blood, spun down, returned to your skin. commonly used alongside microneedling or for hair thinning.', ARRAY['60 min','minimal downtime','series of 3'], 'bubblegum_scrim'),
  ('prp', 2, 'what_it_is',     'so what is it',                       'a concentrate of platelets and growth factors made from your own blood in the clinic. autologous means it comes from you, so there is no foreign material.', ARRAY[]::text[], 'cream_scrim'),
  ('prp', 3, 'how_it_works',   'how it works',                        'your provider draws a small vial, spins it in a centrifuge to separate layers, then either microneedles the plasma into your skin or injects it into the scalp for hair.', ARRAY[]::text[], 'butter_scrim'),
  ('prp', 4, 'science',        'what''s actually happening',          'platelets release growth factors including pdgf, tgf-beta, and vegf when activated. these signal fibroblasts to produce collagen and prompt local angiogenesis, the formation of new small blood vessels. because the material is autologous, there is no allergic risk.', ARRAY['growth factors','pdgf + tgf-beta','angiogenesis'], 'cream_scrim'),
  ('prp', 5, 'what_to_expect', 'your appointment',                    'blood draw first, then 15 minutes in the centrifuge while you numb, then delivery. about 60 minutes total.', ARRAY['blood draw','60 min'], 'mint_scrim'),
  ('prp', 6, 'downtime',       'after care',                          'pink and slightly swollen for up to 24 hours. do not wash your face for the rest of the day when combined with microneedling.', ARRAY['24 hrs pink','no wash same day'], 'cream_scrim'),
  ('prp', 7, 'pricing',        'what it really costs',                'often paired with microneedling.', ARRAY[]::text[], 'bubblegum_scrim'),
  ('prp', 8, 'cta',            'ready when you are.',                 'providers near you offer this.', ARRAY[]::text[], 'butter_scrim'),

  -- MEDICAL FACIAL
  ('medical-facial', 1, 'hook',           'your baseline, elevated.',    'a facial designed and delivered inside a medical practice. commonly used as maintenance between bigger treatments.', ARRAY['60 min','no downtime','monthly cadence'], 'bubblegum_scrim'),
  ('medical-facial', 2, 'what_it_is',     'so what is it',               'a customized facial that can include prescription-strength exfoliation, extractions, led, and professional-grade serums. your provider builds it around your skin that day.', ARRAY[]::text[], 'cream_scrim'),
  ('medical-facial', 3, 'how_it_works',   'how it works',                'cleanse, assess, exfoliate, extract if needed, then targeted serums and masks. medical-grade formulas reach further than what you can buy over the counter.', ARRAY[]::text[], 'butter_scrim'),
  ('medical-facial', 4, 'science',        'what''s actually happening',  'prescription-strength enzymes and acids accelerate desquamation, the shedding of dead skin cells from the stratum corneum. led at specific wavelengths, typically red around 630 nm and blue around 415 nm, is absorbed by chromophores in the skin and modulates inflammation and sebum-associated bacteria.', ARRAY['desquamation','red + blue led','chromophores'], 'cream_scrim'),
  ('medical-facial', 5, 'what_to_expect', 'your appointment',            '60 minutes, deeply relaxing. steam, exfoliation, and a proper cleanse most at-home routines can''t match.', ARRAY['60 min','relaxing'], 'mint_scrim'),
  ('medical-facial', 6, 'downtime',       'after care',                  'skin may glow pink for an hour. skip actives for 24 hours, spf daily, and give extractions a day before makeup.', ARRAY['no real downtime','24 hr break from actives'], 'cream_scrim'),
  ('medical-facial', 7, 'pricing',        'what it really costs',        'from $X at clinics near you.', ARRAY[]::text[], 'bubblegum_scrim'),
  ('medical-facial', 8, 'cta',            'ready when you are.',         'providers near you offer this.', ARRAY[]::text[], 'butter_scrim');
