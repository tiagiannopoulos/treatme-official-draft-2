CREATE TABLE public.storefront_claims (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  storefront_id uuid NOT NULL REFERENCES public.storefronts(id) ON DELETE CASCADE,
  contact_name text,
  role text,
  work_email text NOT NULL,
  work_phone text NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'new',
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT INSERT ON public.storefront_claims TO anon;
GRANT INSERT, SELECT ON public.storefront_claims TO authenticated;
GRANT ALL ON public.storefront_claims TO service_role;

ALTER TABLE public.storefront_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can submit a claim request"
ON public.storefront_claims FOR INSERT TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "people can see claims they submitted"
ON public.storefront_claims FOR SELECT TO authenticated
USING (created_by = auth.uid());