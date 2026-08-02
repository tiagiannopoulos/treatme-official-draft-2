ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS license_number text,
  ADD COLUMN IF NOT EXISTS license_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS license_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS fitzpatrick_min integer,
  ADD COLUMN IF NOT EXISTS fitzpatrick_max integer,
  ADD COLUMN IF NOT EXISTS treats text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS devices text[] NOT NULL DEFAULT '{}';

UPDATE public.providers SET license_verified = true WHERE verified = true AND license_verified = false;