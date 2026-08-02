ALTER TABLE public.treatments
  ADD COLUMN IF NOT EXISTS search_synonyms text[] NOT NULL DEFAULT '{}'::text[];