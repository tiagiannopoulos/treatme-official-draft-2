ALTER TABLE public.booking_requests ADD COLUMN IF NOT EXISTS treatment_slug text;
ALTER TABLE public.booking_requests ALTER COLUMN treatment_id DROP NOT NULL;
GRANT SELECT, INSERT ON public.booking_requests TO authenticated;
GRANT ALL ON public.booking_requests TO service_role;