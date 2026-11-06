-- TreatMe secure consultation routing MVP. Run in staging BEFORE deploying application code.
-- The old public insert policy must be removed when the server-managed write path is live.
CREATE TABLE IF NOT EXISTS public.clinic_partner_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storefront_id uuid NOT NULL UNIQUE REFERENCES public.storefronts(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  booking_email text NOT NULL,
  verified_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','suspended')),
  subscription_status text NOT NULL DEFAULT 'inactive'
    CHECK (subscription_status IN ('inactive','trialing','active','past_due','canceled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.clinic_partner_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.clinic_partner_accounts FROM anon, authenticated;
GRANT SELECT ON public.clinic_partner_accounts TO authenticated;
GRANT ALL ON public.clinic_partner_accounts TO service_role;
CREATE POLICY "clinic owners read own memberships" ON public.clinic_partner_accounts
  FOR SELECT TO authenticated USING ((select auth.uid()) = owner_user_id);

ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS routing_target text NOT NULL DEFAULT 'admin'
    CHECK (routing_target IN ('admin', 'clinic')),
  ADD COLUMN IF NOT EXISTS contact_consent_at timestamptz;
CREATE INDEX IF NOT EXISTS booking_requests_route_created
  ON public.booking_requests (routing_target, created_at DESC);

CREATE TABLE IF NOT EXISTS public.booking_request_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.booking_requests(id) ON DELETE CASCADE,
  recipient_type text NOT NULL CHECK (recipient_type IN ('admin','clinic')),
  recipient_email text NOT NULL,
  delivery_status text NOT NULL DEFAULT 'pending'
    CHECK (delivery_status IN ('pending','sent','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  UNIQUE(request_id,recipient_type)
);
ALTER TABLE public.booking_request_notices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.booking_request_notices FROM anon, authenticated;
GRANT ALL ON public.booking_request_notices TO service_role;
-- Client apps cannot spoof a clinic, send privileged notifications or change a booking route.
DROP POLICY IF EXISTS "submit booking request" ON public.booking_requests;
REVOKE INSERT ON public.booking_requests FROM anon, authenticated;
