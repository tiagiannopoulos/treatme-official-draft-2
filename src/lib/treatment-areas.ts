import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TreatmentArea = {
  id: string;
  treatment_slug: string;
  area_slug: string;
  name: string;
  price_from: number | null;
  sort_order: number;
};

export const treatmentAreasQuery = (slug: string) =>
  queryOptions({
    queryKey: ["treatment-areas", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treatment_areas")
        .select("id, treatment_slug, area_slug, name, price_from, sort_order")
        .eq("treatment_slug", slug)
        .order("sort_order", { ascending: true })
        .returns<TreatmentArea[]>();
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });
