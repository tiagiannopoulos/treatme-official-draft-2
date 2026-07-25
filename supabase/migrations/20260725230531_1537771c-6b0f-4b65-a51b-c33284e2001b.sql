-- Enums
CREATE TYPE public.treatment_group AS ENUM ('injectables','skin','laser','body');
CREATE TYPE public.slide_type AS ENUM ('hook','what_it_is','how_it_works','science','what_to_expect','downtime','results','pricing','cta');
CREATE TYPE public.slide_overlay AS ENUM ('cream_scrim','butter_scrim','mint_scrim','bubblegum_scrim','none');
CREATE TYPE public.education_slide_type AS ENUM ('hook','concept','science','myth_vs_fact','how_to','when_to_scan','cta');

-- updated_at helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- =========================================================
-- treatments
-- =========================================================
CREATE TABLE public.treatments (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  "group" public.treatment_group NOT NULL,
  improves TEXT[] NOT NULL DEFAULT '{}',
  what_it_is TEXT NOT NULL,
  what_to_expect TEXT NOT NULL,
  downtime TEXT NOT NULL,
  price_from NUMERIC(10,2) NOT NULL,
  hero_image TEXT NOT NULL,
  hero_tone public.slide_overlay NOT NULL DEFAULT 'cream_scrim',
  descriptor TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.treatments TO anon, authenticated;
GRANT ALL ON public.treatments TO service_role;
ALTER TABLE public.treatments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "treatments_public_read" ON public.treatments FOR SELECT TO anon, authenticated USING (true);
CREATE TRIGGER treatments_updated_at BEFORE UPDATE ON public.treatments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- treatment_story_slides
-- =========================================================
CREATE TABLE public.treatment_story_slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  treatment_slug TEXT NOT NULL REFERENCES public.treatments(slug) ON DELETE CASCADE,
  slide_order INT NOT NULL,
  slide_type public.slide_type NOT NULL,
  headline TEXT NOT NULL,
  body TEXT,
  detail_chips TEXT[] NOT NULL DEFAULT '{}',
  media_url TEXT,
  media_overlay public.slide_overlay NOT NULL DEFAULT 'cream_scrim',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (treatment_slug, slide_order)
);
CREATE INDEX treatment_story_slides_slug_idx ON public.treatment_story_slides (treatment_slug, slide_order);
GRANT SELECT ON public.treatment_story_slides TO anon, authenticated;
GRANT ALL ON public.treatment_story_slides TO service_role;
ALTER TABLE public.treatment_story_slides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "slides_public_read" ON public.treatment_story_slides FOR SELECT TO anon, authenticated USING (true);
CREATE TRIGGER treatment_story_slides_updated_at BEFORE UPDATE ON public.treatment_story_slides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- treatment_before_afters
-- =========================================================
CREATE TABLE public.treatment_before_afters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  treatment_slug TEXT NOT NULL REFERENCES public.treatments(slug) ON DELETE CASCADE,
  before_url TEXT NOT NULL,
  after_url TEXT NOT NULL,
  caption TEXT,
  provider_name TEXT,
  weeks_between INT,
  sort_order INT NOT NULL DEFAULT 0,
  approved BOOLEAN NOT NULL DEFAULT false,
  consent_confirmed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX treatment_before_afters_slug_idx ON public.treatment_before_afters (treatment_slug, sort_order);
GRANT SELECT ON public.treatment_before_afters TO anon, authenticated;
GRANT ALL ON public.treatment_before_afters TO service_role;
ALTER TABLE public.treatment_before_afters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ba_public_read" ON public.treatment_before_afters
  FOR SELECT TO anon, authenticated
  USING (approved = true AND consent_confirmed = true);
CREATE TRIGGER treatment_before_afters_updated_at BEFORE UPDATE ON public.treatment_before_afters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- education_stories
-- =========================================================
CREATE TABLE public.education_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category TEXT,
  cover_image TEXT,
  cover_tone public.slide_overlay NOT NULL DEFAULT 'cream_scrim',
  published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.education_stories TO anon, authenticated;
GRANT ALL ON public.education_stories TO service_role;
ALTER TABLE public.education_stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "edu_stories_public_read" ON public.education_stories
  FOR SELECT TO anon, authenticated
  USING (published = true);
CREATE TRIGGER education_stories_updated_at BEFORE UPDATE ON public.education_stories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- education_story_slides
-- =========================================================
CREATE TABLE public.education_story_slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.education_stories(id) ON DELETE CASCADE,
  slide_order INT NOT NULL,
  slide_type public.education_slide_type NOT NULL,
  headline TEXT NOT NULL,
  body TEXT,
  detail_chips TEXT[] NOT NULL DEFAULT '{}',
  media_url TEXT,
  media_overlay public.slide_overlay NOT NULL DEFAULT 'cream_scrim',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (story_id, slide_order)
);
CREATE INDEX education_story_slides_story_idx ON public.education_story_slides (story_id, slide_order);
GRANT SELECT ON public.education_story_slides TO anon, authenticated;
GRANT ALL ON public.education_story_slides TO service_role;
ALTER TABLE public.education_story_slides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "edu_slides_public_read" ON public.education_story_slides
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.education_stories s
    WHERE s.id = story_id AND s.published = true
  ));
CREATE TRIGGER education_story_slides_updated_at BEFORE UPDATE ON public.education_story_slides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();