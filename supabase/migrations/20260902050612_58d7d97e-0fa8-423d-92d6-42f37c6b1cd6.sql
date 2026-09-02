DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own roles" ON public.user_roles;
CREATE POLICY "users read own roles" ON public.user_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

INSERT INTO public.user_roles (user_id, role)
VALUES ('5d03baab-acf2-4ae3-8a63-f0cda43f8459', 'admin')
ON CONFLICT DO NOTHING;

-- admins may edit treatment rows (to store picture urls)
DROP POLICY IF EXISTS "admins update treatments" ON public.treatments;
CREATE POLICY "admins update treatments" ON public.treatments
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT UPDATE ON public.treatments TO authenticated;

-- storage policies for treatment-images
DROP POLICY IF EXISTS "admins read treatment images" ON storage.objects;
CREATE POLICY "admins read treatment images" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'treatment-images' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins upload treatment images" ON storage.objects;
CREATE POLICY "admins upload treatment images" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'treatment-images' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins update treatment images" ON storage.objects;
CREATE POLICY "admins update treatment images" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'treatment-images' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins delete treatment images" ON storage.objects;
CREATE POLICY "admins delete treatment images" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'treatment-images' AND public.has_role(auth.uid(), 'admin'));