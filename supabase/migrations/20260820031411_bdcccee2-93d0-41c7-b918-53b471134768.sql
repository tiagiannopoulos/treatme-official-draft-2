-- url-safe 12 char token generator
CREATE OR REPLACE FUNCTION public.generate_share_token()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  alphabet text := 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  out text := '';
  i int;
BEGIN
  FOR i IN 1..12 LOOP
    out := out || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  END LOOP;
  RETURN out;
END;
$$;

CREATE TABLE public.scan_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_token text NOT NULL UNIQUE DEFAULT public.generate_share_token(),
  include_photos boolean NOT NULL DEFAULT true,
  pdf_path text,
  pdf_generated_at timestamptz,
  view_count integer NOT NULL DEFAULT 0,
  revoked boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX scan_reports_scan_id_idx ON public.scan_reports (scan_id);
CREATE INDEX scan_reports_user_id_idx ON public.scan_reports (user_id);

GRANT SELECT, INSERT, UPDATE ON public.scan_reports TO authenticated;
GRANT ALL ON public.scan_reports TO service_role;

ALTER TABLE public.scan_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own reports select" ON public.scan_reports
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own reports insert" ON public.scan_reports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own reports update" ON public.scan_reports
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- the only path an unauthenticated visitor has to report data
CREATE OR REPLACE FUNCTION public.get_shared_report(token text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rep public.scan_reports;
  payload jsonb;
BEGIN
  SELECT * INTO rep
  FROM public.scan_reports r
  WHERE r.share_token = token
    AND r.revoked = false
    AND r.expires_at > now();

  IF rep.id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.scan_reports
  SET view_count = view_count + 1
  WHERE id = rep.id;

  SELECT jsonb_build_object(
    'report', jsonb_build_object(
      'id', rep.id,
      'share_token', rep.share_token,
      'include_photos', rep.include_photos,
      'pdf_path', rep.pdf_path,
      'pdf_generated_at', rep.pdf_generated_at,
      'expires_at', rep.expires_at,
      'created_at', rep.created_at
    ),
    'scan', jsonb_build_object(
      'id', s.id,
      'created_at', s.created_at,
      'skin_type', s.skin_type,
      'skin_tone', s.skin_tone,
      'overall_score', s.overall_score,
      'photo_path', CASE WHEN rep.include_photos THEN s.photo_path ELSE NULL END,
      'result', s.result,
      'analysis', s.analysis
    ),
    'results', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'concern_key', sr.concern_key,
        'score', sr.score,
        'band', sr.band,
        'region_scores', sr.region_scores,
        'sub_scores', sr.sub_scores,
        'notes', sr.notes
      ) ORDER BY sr.score)
      FROM public.scan_results sr WHERE sr.scan_id = s.id
    ), '[]'::jsonb)
  )
  INTO payload
  FROM public.scans s
  WHERE s.id = rep.scan_id;

  RETURN payload;
END;
$$;

REVOKE ALL ON FUNCTION public.get_shared_report(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_report(text) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.generate_share_token() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_share_token() TO authenticated, service_role;