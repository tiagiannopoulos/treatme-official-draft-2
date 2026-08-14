ALTER TABLE public.scans
  ADD COLUMN IF NOT EXISTS result jsonb,
  ADD COLUMN IF NOT EXISTS analysis jsonb;