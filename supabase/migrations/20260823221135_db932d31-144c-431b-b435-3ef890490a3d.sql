ALTER TABLE public.scans
  ADD COLUMN IF NOT EXISTS face_zones jsonb,
  ADD COLUMN IF NOT EXISTS mapping_method text NOT NULL DEFAULT 'fallback_diagram';

ALTER TABLE public.scan_results
  ADD COLUMN IF NOT EXISTS mapping_method text NOT NULL DEFAULT 'fallback_diagram',
  ADD COLUMN IF NOT EXISTS measured jsonb,
  ADD COLUMN IF NOT EXISTS zone_scores jsonb;