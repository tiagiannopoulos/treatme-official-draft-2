ALTER TABLE public.education_stories
  ADD COLUMN IF NOT EXISTS subtitle text,
  ADD COLUMN IF NOT EXISTS accent_color text NOT NULL DEFAULT '#DFFFF8',
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.education_slides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.education_stories(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  kind text NOT NULL DEFAULT 'text',
  chip text,
  chip_icon text,
  headline text NOT NULL,
  body text,
  items text[] NOT NULL DEFAULT '{}',
  pills text[] NOT NULL DEFAULT '{}',
  bg text NOT NULL DEFAULT 'cream',
  cta_label text,
  cta_route text,
  link_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.education_slides TO anon, authenticated;
GRANT ALL ON public.education_slides TO service_role;
ALTER TABLE public.education_slides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "education slides are public" ON public.education_slides;
CREATE POLICY "education slides are public"
  ON public.education_slides FOR SELECT TO anon, authenticated USING (true);

DROP TRIGGER IF EXISTS update_education_slides_updated_at ON public.education_slides;
CREATE TRIGGER update_education_slides_updated_at
  BEFORE UPDATE ON public.education_slides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- seed content
INSERT INTO public.education_stories (slug, title, subtitle, category, accent_color, sort_order, cover_tone, published)
VALUES
  ('how-injectables-work', 'how injectables actually work', 'neuromodulators, fillers and what each one is for.', 'injectables', '#DFFFF8', 1, 'mint_scrim', true),
  ('your-skin-barrier', 'your skin barrier, explained', 'why hydration comes before every other fix.', 'skin', '#FFEDB4', 2, 'butter_scrim', true),
  ('lasers-without-the-fear', 'lasers without the fear', 'what the light is doing under your skin.', 'laser', '#F8A1C6', 3, 'bubblegum_scrim', true),
  ('your-first-visit', 'planning your first visit', 'what to ask, what to bring, what to skip.', 'getting started', '#FCFBF7', 4, 'cream_scrim', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.education_slides (story_id, sort_order, kind, chip, chip_icon, headline, body, items, pills, bg, cta_label, cta_route, link_label)
SELECT s.id, v.sort_order, v.kind, v.chip, v.chip_icon, v.headline, v.body, v.items, v.pills, v.bg, v.cta_label, v.cta_route, v.link_label
FROM (VALUES
  ('how-injectables-work', 1, 'text', 'the basics', 'sparkles', 'two families, two jobs', 'neuromodulators relax the muscle that folds your skin. fillers replace volume that time took away. most plans use a little of both.', '{}'::text[], '{}'::text[], 'mint', NULL, NULL, NULL),
  ('how-injectables-work', 2, 'checklist', 'good to know', 'list', 'what a good plan looks like', NULL, ARRAY['a licensed injector who assesses your face at rest and in motion','a dose written down so it can be repeated','a follow up around two weeks to fine tune','no pressure to treat more than you came for'], '{}'::text[], 'mint', NULL, NULL, NULL),
  ('how-injectables-work', 3, 'pills', 'where it goes', 'ruler', 'common areas', NULL, '{}'::text[], ARRAY['forehead','frown lines','crow feet','lips','cheeks','jawline'], 'mint', NULL, NULL, NULL),
  ('how-injectables-work', 4, 'quote', NULL, 'quote', 'the goal is your face on a good day, not a different face.', NULL, '{}'::text[], '{}'::text[], 'mint', NULL, NULL, NULL),
  ('how-injectables-work', 5, 'cta', 'next step', 'sparkles', 'see who does this near you', 'every provider on treatme is licensed and verified before they appear.', '{}'::text[], '{}'::text[], 'mint', 'find providers', '/search', 'browse treatments'),

  ('your-skin-barrier', 1, 'text', 'the basics', 'droplet', 'your barrier holds water in', 'the top layer of skin is a wall of cells and lipids. when it holds water your skin looks plump and calm. when it leaks you get tightness, flaking and redness.', '{}'::text[], '{}'::text[], 'butter', NULL, NULL, NULL),
  ('your-skin-barrier', 2, 'checklist', 'signs it is stressed', 'alert', 'is this you?', NULL, ARRAY['stinging when you apply anything','flaking around the nose and mouth','makeup sitting in patches','breakouts that come with dryness'], '{}'::text[], 'butter', NULL, NULL, NULL),
  ('your-skin-barrier', 3, 'pills', 'what helps', 'bulb', 'ingredients that repair', NULL, '{}'::text[], ARRAY['ceramides','niacinamide','glycerin','panthenol','squalane'], 'butter', NULL, NULL, NULL),
  ('your-skin-barrier', 4, 'text', 'timing', 'clock', 'fix hydration first', 'peels, lasers and needling all work better on a calm barrier. two weeks of simple care before a treatment changes the result.', '{}'::text[], '{}'::text[], 'butter', NULL, NULL, NULL),
  ('your-skin-barrier', 5, 'cta', 'next step', 'sparkles', 'scan your skin first', 'the scan reads hydration and redness so you know where to start.', '{}'::text[], '{}'::text[], 'butter', 'start a scan', '/scan', 'see hydration treatments'),

  ('lasers-without-the-fear', 1, 'text', 'the basics', 'bulb', 'light picks a target', 'each laser is tuned to be absorbed by one thing: pigment, blood vessels or water in the skin. the target heats, the body repairs, the tone evens out.', '{}'::text[], '{}'::text[], 'bubblegum', NULL, NULL, NULL),
  ('lasers-without-the-fear', 2, 'pills', 'the families', 'ruler', 'what you will hear about', NULL, '{}'::text[], ARRAY['ipl','pico','fractional','vascular','resurfacing'], 'bubblegum', NULL, NULL, NULL),
  ('lasers-without-the-fear', 3, 'checklist', 'safety', 'shield', 'ask before you book', NULL, ARRAY['is this device safe for my skin tone','who is operating it and what is their licence','how many sessions and how far apart','what does the healing week look like'], '{}'::text[], 'bubblegum', NULL, NULL, NULL),
  ('lasers-without-the-fear', 4, 'quote', NULL, 'quote', 'the right setting matters more than the brand on the machine.', NULL, '{}'::text[], '{}'::text[], 'bubblegum', NULL, NULL, NULL),
  ('lasers-without-the-fear', 5, 'cta', 'next step', 'sparkles', 'find a clinic with the device', 'search by treatment and see which clinics list it.', '{}'::text[], '{}'::text[], 'bubblegum', 'browse laser clinics', '/search', 'read treatment pages'),

  ('your-first-visit', 1, 'text', 'the basics', 'book', 'a consult is a conversation', 'a good first visit is mostly questions. you describe what bothers you, they explain what is realistic and in what order.', '{}'::text[], '{}'::text[], 'cream', NULL, NULL, NULL),
  ('your-first-visit', 2, 'checklist', 'bring this', 'list', 'come prepared', NULL, ARRAY['photos of your skin in daylight','the products you use now','any medication or recent treatment','your budget range for the year'], '{}'::text[], 'cream', NULL, NULL, NULL),
  ('your-first-visit', 3, 'pills', 'skip this', 'alert', 'not before a consult', NULL, '{}'::text[], ARRAY['heavy makeup','a fresh tan','strong actives that morning','same day plans you cannot move'], 'cream', NULL, NULL, NULL),
  ('your-first-visit', 4, 'text', 'red flags', 'shield', 'when to walk away', 'pressure to decide today, prices that only exist right now, or no one who can name the product going into your face.', '{}'::text[], '{}'::text[], 'cream', NULL, NULL, NULL),
  ('your-first-visit', 5, 'cta', 'next step', 'sparkles', 'book a consult', 'pick a clinic near you and start with a conversation.', '{}'::text[], '{}'::text[], 'cream', 'book a consult', '/book/consult', 'browse clinics')
) AS v(story_slug, sort_order, kind, chip, chip_icon, headline, body, items, pills, bg, cta_label, cta_route, link_label)
JOIN public.education_stories s ON s.slug = v.story_slug
WHERE NOT EXISTS (SELECT 1 FROM public.education_slides es WHERE es.story_id = s.id);