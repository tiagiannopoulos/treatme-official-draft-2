ALTER TABLE public.scan_results DROP COLUMN IF EXISTS landmarks;

ALTER TABLE public.scan_errors
  ADD COLUMN IF NOT EXISTS stage text,
  ADD COLUMN IF NOT EXISTS detail jsonb;

GRANT SELECT, INSERT ON public.scan_errors TO authenticated;
GRANT ALL ON public.scan_errors TO service_role;

DROP POLICY IF EXISTS "own scan errors insertable" ON public.scan_errors;
CREATE POLICY "own scan errors insertable" ON public.scan_errors
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());