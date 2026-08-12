ALTER TABLE public.scans
  ADD COLUMN IF NOT EXISTS photo_quality TEXT,
  ADD COLUMN IF NOT EXISTS medical_flag TEXT,
  ADD COLUMN IF NOT EXISTS store_photo BOOLEAN NOT NULL DEFAULT true;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scan_results TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.scan_consents TO authenticated;
GRANT ALL ON public.scans TO service_role;
GRANT ALL ON public.scan_results TO service_role;
GRANT ALL ON public.scan_consents TO service_role;