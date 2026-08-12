import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export interface MyProfile {
  id: string;
  first_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  budget_range: string | null;
  downtime_tolerance: string | null;
  primary_concern: string | null;
  provider_preference: string | null;
}

export const myProfileQuery = queryOptions({
  queryKey: ["my-profile"],
  queryFn: async (): Promise<MyProfile | null> => {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) return null;

    const { data } = await supabase
      .from("profiles")
      .select(
        "id, first_name, phone, email, city, budget_range, downtime_tolerance, primary_concern, provider_preference",
      )
      .eq("id", user.id)
      .maybeSingle();

    if (data) return data as MyProfile;

    // the signup trigger normally makes this row. if it is missing, make it here.
    const { data: made } = await supabase
      .from("profiles")
      .upsert({ id: user.id, email: user.email ?? null }, { onConflict: "id" })
      .select(
        "id, first_name, phone, email, city, budget_range, downtime_tolerance, primary_concern, provider_preference",
      )
      .maybeSingle();
    return (made as MyProfile) ?? null;
  },
  staleTime: 60_000,
});

export async function saveMyProfile(patch: Partial<Omit<MyProfile, "id">>) {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) throw new Error("you need an account for that.");

  const { error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, email: user.email ?? null, ...patch }, { onConflict: "id" });
  if (error) throw error;
}
