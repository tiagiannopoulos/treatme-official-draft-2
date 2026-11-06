-- TreatMe MVP: clinic routing + private role management (stage first).
CREATE TABLE IF NOT EXISTS public.treatme_admins (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.treatme_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.treatme_admins FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.treatme_admins TO service_role;
CREATE TABLE IF NOT EXISTS public.clinic_accounts (
 storefront_id uuid PRIMARY KEY REFERENCES public.storefronts(id) ON DELETE CASCADE,
 owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','suspended')),
 billing_status text NOT NULL DEFAULT 'inactive' CHECK(billing_status IN ('inactive','trialing','active','past_due','canceled')),
 verified_at timestamptz,
 notification_email text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.clinic_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.clinic_accounts FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.clinic_accounts TO service_role;
ALTER TABLE public.booking_requests
 ADD COLUMN IF NOT EXISTS requested_slots jsonb,
 ADD COLUMN IF NOT EXISTS routing_target text NOT NULL DEFAULT 'admin',
 ADD COLUMN IF NOT EXISTS contact_consent_at timestamptz,
 ADD COLUMN IF NOT EXISTS contact_consent_version text,
 ADD COLUMN IF NOT EXISTS notification_status text DEFAULT 'pending',
 ADD COLUMN IF NOT EXISTS notification_attempted_at timestamptz;
ALTER TABLE public.booking_requests DROP CONSTRAINT IF EXISTS booking_requests_routing_target_check;
ALTER TABLE public.booking_requests ADD CONSTRAINT booking_requests_routing_target_check CHECK (routing_target IN ('admin','clinic'));
ALTER TABLE public.booking_requests DROP CONSTRAINT IF EXISTS booking_requests_notification_status_check;
ALTER TABLE public.booking_requests ADD CONSTRAINT booking_requests_notification_status_check CHECK(notification_status IN('pending','sent','failed'));
CREATE INDEX IF NOT EXISTS booking_requests_route_created ON public.booking_requests(routing_target,created_at DESC);
CREATE INDEX IF NOT EXISTS booking_requests_clinic_created ON public.booking_requests(storefront_id,created_at DESC);
ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "submit booking request" ON public.booking_requests;
DROP POLICY IF EXISTS "patients insert own requests" ON public.booking_requests;
DROP POLICY IF EXISTS "patients read own requests" ON public.booking_requests;
DROP POLICY IF EXISTS "read own consultation requests" ON public.booking_requests;
CREATE POLICY "read own consultation requests" ON public.booking_requests
 FOR SELECT TO authenticated USING (user_id=auth.uid());
REVOKE INSERT,UPDATE,DELETE ON public.booking_requests FROM anon,authenticated;
REVOKE ALL ON public.booking_requests FROM anon;
GRANT SELECT ON public.booking_requests TO authenticated;
GRANT ALL ON public.booking_requests TO service_role;
-- Provision admin and verified clinic accounts only through trusted service-role paths.
