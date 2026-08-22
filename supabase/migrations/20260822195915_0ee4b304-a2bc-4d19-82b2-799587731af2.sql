ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS thumb_path text;

CREATE INDEX IF NOT EXISTS scans_user_id_created_at_desc_idx
  ON public.scans (user_id, created_at DESC);