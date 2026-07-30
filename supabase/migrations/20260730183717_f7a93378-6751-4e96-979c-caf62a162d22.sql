CREATE OR REPLACE FUNCTION public.owns_provider(_provider_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.providers p
    WHERE p.id = _provider_id
      AND p.owner_user_id IS NOT NULL
      AND p.owner_user_id = auth.uid()
  )
$$;

REVOKE ALL ON FUNCTION public.owns_provider(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_provider(uuid) TO authenticated, service_role;