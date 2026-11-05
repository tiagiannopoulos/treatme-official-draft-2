-- Muse three-photo reports are distinct from the existing single-photo scans.
-- Keep both schemas intact. Apply on staging before production.
CREATE TABLE IF NOT EXISTS public.muse_scan_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  scores jsonb NOT NULL,
  explanations jsonb NOT NULL,
  top_priorities text[] NOT NULL DEFAULT '{}',
  summary text NOT NULL,
  fitzpatrick text,
  medical_flag text,
  email text NOT NULL,
  photo_count integer NOT NULL DEFAULT 3
);
CREATE INDEX IF NOT EXISTS muse_scan_reports_user_created_idx
  ON public.muse_scan_reports (user_id, created_at DESC);
ALTER TABLE public.muse_scan_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.muse_scan_reports FROM anon;
GRANT SELECT ON public.muse_scan_reports TO authenticated;
GRANT ALL ON public.muse_scan_reports TO service_role;
DROP POLICY IF EXISTS "muse select own scans" ON public.muse_scan_reports;
CREATE POLICY "muse select own scans" ON public.muse_scan_reports
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
-- The server writes using service-role after validating Supabase auth.
