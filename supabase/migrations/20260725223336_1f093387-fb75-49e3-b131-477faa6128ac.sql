-- Reuse the existing slide_overlay enum; add education-specific slide types
CREATE TYPE public.education_slide_type AS ENUM (
  'hook', 'concept', 'science', 'myth', 'takeaway', 'cta'
);

-- Parent story
CREATE TABLE public.education_stories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  subtitle text,
  cover_media_url text,
  sort_order integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.education_stories TO anon, authenticated;
GRANT ALL ON public.education_stories TO service_role;

ALTER TABLE public.education_stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "education_stories public read published"
  ON public.education_stories
  FOR SELECT
  TO anon, authenticated
  USING (published = true);

-- Slides
CREATE TABLE public.education_story_slides (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  education_story_id uuid NOT NULL REFERENCES public.education_stories(id) ON DELETE CASCADE,
  slide_order integer NOT NULL DEFAULT 0,
  slide_type public.education_slide_type NOT NULL,
  headline text NOT NULL,
  body text,
  detail_chips text[] NOT NULL DEFAULT '{}'::text[],
  media_url text,
  media_overlay public.slide_overlay NOT NULL DEFAULT 'cream_scrim',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX education_story_slides_story_order_idx
  ON public.education_story_slides (education_story_id, slide_order);

GRANT SELECT ON public.education_story_slides TO anon, authenticated;
GRANT ALL ON public.education_story_slides TO service_role;

ALTER TABLE public.education_story_slides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "education_story_slides public read via published story"
  ON public.education_story_slides
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.education_stories s
      WHERE s.id = education_story_slides.education_story_id
        AND s.published = true
    )
  );

-- updated_at trigger for stories
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER education_stories_set_updated_at
  BEFORE UPDATE ON public.education_stories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();