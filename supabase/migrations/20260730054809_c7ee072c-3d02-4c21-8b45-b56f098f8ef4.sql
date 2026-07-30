ALTER TABLE public.storefronts
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS claimed boolean NOT NULL DEFAULT false;