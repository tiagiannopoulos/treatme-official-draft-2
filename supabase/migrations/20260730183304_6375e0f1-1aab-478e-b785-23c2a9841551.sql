-- ownership columns
ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS owner_user_id uuid;
ALTER TABLE public.storefronts ADD COLUMN IF NOT EXISTS owner_user_id uuid;

CREATE INDEX IF NOT EXISTS providers_owner_idx ON public.providers (owner_user_id);
CREATE INDEX IF NOT EXISTS storefronts_owner_idx ON public.storefronts (owner_user_id);

-- ownership helper (avoids recursive policy lookups)
CREATE OR REPLACE FUNCTION public.owns_provider(_provider_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
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

-- ensure RLS is on everywhere
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storefronts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_storefronts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_treatments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treatments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treatment_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treatment_story_slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treatment_before_afters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.education_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.education_story_slides ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.providers, public.storefronts, public.provider_storefronts,
  public.provider_treatments, public.provider_media, public.provider_reviews,
  public.treatments, public.treatment_areas, public.treatment_story_slides,
  public.treatment_before_afters, public.education_stories, public.education_story_slides
  TO anon, authenticated;

GRANT INSERT, UPDATE, DELETE ON public.providers, public.provider_storefronts,
  public.provider_treatments, public.provider_media TO authenticated;

-- owner write policies: providers
DROP POLICY IF EXISTS providers_owner_insert ON public.providers;
CREATE POLICY providers_owner_insert ON public.providers FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid());
DROP POLICY IF EXISTS providers_owner_update ON public.providers;
CREATE POLICY providers_owner_update ON public.providers FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());
DROP POLICY IF EXISTS providers_owner_delete ON public.providers;
CREATE POLICY providers_owner_delete ON public.providers FOR DELETE TO authenticated
  USING (owner_user_id = auth.uid());

-- owner write policies: provider_storefronts
DROP POLICY IF EXISTS provider_storefronts_owner_write ON public.provider_storefronts;
CREATE POLICY provider_storefronts_owner_write ON public.provider_storefronts FOR ALL TO authenticated
  USING (public.owns_provider(provider_id)) WITH CHECK (public.owns_provider(provider_id));

-- owner write policies: provider_treatments
DROP POLICY IF EXISTS provider_treatments_owner_write ON public.provider_treatments;
CREATE POLICY provider_treatments_owner_write ON public.provider_treatments FOR ALL TO authenticated
  USING (public.owns_provider(provider_id)) WITH CHECK (public.owns_provider(provider_id));

-- owner write policies: provider_media (owners can also read their unapproved media)
DROP POLICY IF EXISTS provider_media_owner_write ON public.provider_media;
CREATE POLICY provider_media_owner_write ON public.provider_media FOR ALL TO authenticated
  USING (public.owns_provider(provider_id)) WITH CHECK (public.owns_provider(provider_id));

-- storefronts: owner writes only
DROP POLICY IF EXISTS storefronts_owner_write ON public.storefronts;
CREATE POLICY storefronts_owner_write ON public.storefronts FOR ALL TO authenticated
  USING (owner_user_id IS NOT NULL AND owner_user_id = auth.uid())
  WITH CHECK (owner_user_id IS NOT NULL AND owner_user_id = auth.uid());
GRANT INSERT, UPDATE, DELETE ON public.storefronts TO authenticated;

-- provider_reviews: owners may read all their reviews (including unpublished); no client writes
DROP POLICY IF EXISTS provider_reviews_owner_read ON public.provider_reviews;
CREATE POLICY provider_reviews_owner_read ON public.provider_reviews FOR SELECT TO authenticated
  USING (public.owns_provider(provider_id));

-- treatme ratings are derived from reviews, never stored
CREATE OR REPLACE VIEW public.provider_rating_stats
WITH (security_invoker = true) AS
SELECT p.id AS provider_id,
       count(r.id) FILTER (WHERE r.published) AS review_count,
       round(avg(r.rating) FILTER (WHERE r.published)::numeric, 1) AS rating
FROM public.providers p
LEFT JOIN public.provider_reviews r ON r.provider_id = p.id
GROUP BY p.id;

GRANT SELECT ON public.provider_rating_stats TO anon, authenticated;
GRANT ALL ON public.provider_rating_stats TO service_role;