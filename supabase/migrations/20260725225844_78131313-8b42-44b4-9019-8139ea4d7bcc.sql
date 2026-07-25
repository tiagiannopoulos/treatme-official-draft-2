-- Enums
CREATE TYPE public.slide_type AS ENUM ('hook', 'what_it_is', 'how_it_works', 'science', 'what_to_expect', 'downtime', 'results', 'pricing', 'cta');
CREATE TYPE public.slide_overlay AS ENUM ('cream_scrim', 'butter_scrim', 'mint_scrim', 'bubblegum_scrim', 'none');
CREATE TYPE public.education_slide_type AS ENUM ('hook', 'concept', 'science', 'myth', 'takeaway', 'cta');

-- Treatments catalogue (canonical list, referenced by stories and before/afters)
CREATE TABLE public.treatments (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  what_it_is TEXT NOT NULL,
  what_to_expect TEXT NOT NULL,
  downtime TEXT NOT NULL,
  science TEXT NOT NULL,
  improves TEXT[] NOT NULL DEFAULT '{}',
  price_from NUMERIC NOT NULL,
  hero_image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.treatments TO anon;
GRANT SELECT ON public.treatments TO authenticated;
GRANT ALL ON public.treatments TO service_role;
ALTER TABLE public.treatments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Treatments are publicly readable" ON public.treatments FOR SELECT TO anon, authenticated USING (true);

-- Treatment story slides (public read, no client writes)
CREATE TABLE public.treatment_story_slides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  treatment_slug TEXT NOT NULL REFERENCES public.treatments(slug) ON DELETE CASCADE,
  slide_order INTEGER NOT NULL,
  slide_type public.slide_type NOT NULL,
  headline TEXT NOT NULL,
  body TEXT,
  detail_chips TEXT[] NOT NULL DEFAULT '{}',
  media_url TEXT,
  media_overlay public.slide_overlay NOT NULL DEFAULT 'none',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.treatment_story_slides TO anon;
GRANT SELECT ON public.treatment_story_slides TO authenticated;
GRANT ALL ON public.treatment_story_slides TO service_role;
ALTER TABLE public.treatment_story_slides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Treatment story slides are publicly readable" ON public.treatment_story_slides FOR SELECT TO anon, authenticated USING (true);

-- Before/after images for treatments (public read only approved + consent)
CREATE TABLE public.treatment_before_afters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  treatment_slug TEXT NOT NULL REFERENCES public.treatments(slug) ON DELETE CASCADE,
  before_url TEXT NOT NULL,
  after_url TEXT NOT NULL,
  caption TEXT,
  provider_name TEXT,
  weeks_between INTEGER,
  consent_confirmed BOOLEAN NOT NULL DEFAULT false,
  approved BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.treatment_before_afters TO anon;
GRANT SELECT ON public.treatment_before_afters TO authenticated;
GRANT ALL ON public.treatment_before_afters TO service_role;
ALTER TABLE public.treatment_before_afters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public sees only approved and consented before/afters" ON public.treatment_before_afters FOR SELECT TO anon, authenticated USING (approved = true AND consent_confirmed = true);

-- Education stories (public read only published)
CREATE TABLE public.education_stories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT,
  cover_media_url TEXT,
  published BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.education_stories TO anon;
GRANT SELECT ON public.education_stories TO authenticated;
GRANT ALL ON public.education_stories TO service_role;
ALTER TABLE public.education_stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Education stories are readable when published" ON public.education_stories FOR SELECT TO anon, authenticated USING (published = true);

-- Education story slides (public read only for published stories)
CREATE TABLE public.education_story_slides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  education_story_id UUID NOT NULL REFERENCES public.education_stories(id) ON DELETE CASCADE,
  slide_order INTEGER NOT NULL,
  slide_type public.education_slide_type NOT NULL,
  headline TEXT NOT NULL,
  body TEXT,
  detail_chips TEXT[] NOT NULL DEFAULT '{}',
  media_url TEXT,
  media_overlay public.slide_overlay NOT NULL DEFAULT 'none',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.education_story_slides TO anon;
GRANT SELECT ON public.education_story_slides TO authenticated;
GRANT ALL ON public.education_story_slides TO service_role;
ALTER TABLE public.education_story_slides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Education story slides are readable for published stories" ON public.education_story_slides FOR SELECT TO anon, authenticated USING (
  EXISTS (
    SELECT 1 FROM public.education_stories WHERE id = education_story_slides.education_story_id AND published = true
  )
);

-- Updated-at trigger for education stories
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_education_stories_updated_at BEFORE UPDATE ON public.education_stories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
