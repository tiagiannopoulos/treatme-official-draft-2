CREATE OR REPLACE FUNCTION public.storefronts_near(_lat numeric, _lng numeric, _radius_km numeric DEFAULT 10, _limit integer DEFAULT 200)
RETURNS TABLE(id uuid, km numeric)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT s.id, public.km_between(_lat, _lng, s.lat::numeric, s.lng::numeric) AS km
  FROM public.storefronts s
  WHERE public.km_between(_lat, _lng, s.lat::numeric, s.lng::numeric) <= _radius_km
  ORDER BY km ASC
  LIMIT LEAST(GREATEST(COALESCE(_limit, 200), 1), 1000)
$function$;

GRANT EXECUTE ON FUNCTION public.storefronts_near(numeric, numeric, numeric, integer) TO anon, authenticated, service_role;