GRANT SELECT ON public.treatment_faqs TO anon;
GRANT SELECT ON public.treatment_faqs TO authenticated;
GRANT ALL ON public.treatment_faqs TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'treatment_faqs' AND cmd = 'SELECT'
  ) THEN
    CREATE POLICY "treatment faqs are public" ON public.treatment_faqs FOR SELECT USING (true);
  END IF;
END $$;