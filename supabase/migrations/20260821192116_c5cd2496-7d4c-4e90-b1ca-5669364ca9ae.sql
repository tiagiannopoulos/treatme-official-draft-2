CREATE TABLE IF NOT EXISTS public.scan_errors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  status_code int,
  error_message text,
  image_bytes int,
  media_type text,
  created_at timestamptz not null default now()
);
GRANT SELECT ON public.scan_errors TO authenticated;
GRANT ALL ON public.scan_errors TO service_role;
ALTER TABLE public.scan_errors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own scan errors readable" ON public.scan_errors;
CREATE POLICY "own scan errors readable" ON public.scan_errors
  FOR SELECT TO authenticated USING (user_id = auth.uid());

UPDATE public.storefronts
SET neighbourhood = nullif(btrim(split_part(address_line, ',', 2)), '')
WHERE neighbourhood IS NULL;

WITH ordered AS (
  SELECT id, row_number() OVER (ORDER BY neighbourhood NULLS LAST, name) AS rn
  FROM public.storefronts
)
UPDATE public.storefronts s
SET brand_accent = (ARRAY['#F8A1C6','#FFEDB4','#DFFFF8','#FF1F87'])[(o.rn % 4) + 1]
FROM ordered o
WHERE o.id = s.id AND (s.brand_accent IS NULL OR s.brand_accent = '#F8A1C6');