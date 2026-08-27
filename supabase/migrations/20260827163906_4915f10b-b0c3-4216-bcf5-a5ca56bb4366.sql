CREATE OR REPLACE FUNCTION public.storefronts_in_bounds(_min_lat double precision, _max_lat double precision, _min_lng double precision, _max_lng double precision, _limit integer DEFAULT 300)
RETURNS TABLE(id uuid, total_count bigint)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT s.id, count(*) OVER () AS total_count
  FROM public.storefronts s
  WHERE s.lat BETWEEN LEAST(_min_lat, _max_lat) AND GREATEST(_min_lat, _max_lat)
    AND s.lng BETWEEN LEAST(_min_lng, _max_lng) AND GREATEST(_min_lng, _max_lng)
  ORDER BY s.id
  LIMIT LEAST(GREATEST(COALESCE(_limit, 300), 1), 300)
$function$;

GRANT EXECUTE ON FUNCTION public.storefronts_in_bounds(double precision, double precision, double precision, double precision, integer) TO anon, authenticated, service_role;