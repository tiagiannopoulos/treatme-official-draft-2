-- 1. booking_requests: submitters may only attribute a request to themselves (or leave it as a guest request)
DROP POLICY IF EXISTS "submit booking request" ON public.booking_requests;
CREATE POLICY "submit booking request"
ON public.booking_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- 2. storefront_claims: created_by must be the submitter or null
DROP POLICY IF EXISTS "anyone can submit a claim request" ON public.storefront_claims;
DROP POLICY IF EXISTS "submit a claim" ON public.storefront_claims;
CREATE POLICY "submit a claim"
ON public.storefront_claims
FOR INSERT
TO anon, authenticated
WITH CHECK (created_by IS NULL OR created_by = auth.uid());

-- 3. lock down the SECURITY DEFINER shared report function to server-side callers only
REVOKE ALL ON FUNCTION public.get_shared_report(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_shared_report(text) FROM anon;
REVOKE ALL ON FUNCTION public.get_shared_report(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_shared_report(text) TO service_role;