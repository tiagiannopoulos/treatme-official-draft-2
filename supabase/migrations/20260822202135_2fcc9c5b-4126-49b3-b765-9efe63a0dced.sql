GRANT SELECT, INSERT, UPDATE, DELETE ON public.treatment_log TO authenticated;
GRANT ALL ON public.treatment_log TO service_role;
GRANT SELECT ON public.treatment_log_media TO authenticated;
GRANT ALL ON public.treatment_log_media TO service_role;