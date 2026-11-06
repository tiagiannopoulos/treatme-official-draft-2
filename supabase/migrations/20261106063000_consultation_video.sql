-- Paid virtual consultation sessions are provisioned by trusted server actions only.
-- Apply only to staging until payments and clinic verification are implemented.
CREATE TABLE IF NOT EXISTS public.consultation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_request_id uuid NOT NULL UNIQUE REFERENCES public.booking_requests(id) ON DELETE CASCADE,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  payment_status text NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid','paid','refunded')),
  payment_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT consultation_time_order CHECK (end_at > start_at)
);
ALTER TABLE public.consultation_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.consultation_sessions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.consultation_sessions TO service_role;
-- A verified Stripe webhook or trusted server operation must mark payment_status='paid'.
-- Never allow clients or providers to set payment status or create paid sessions.
