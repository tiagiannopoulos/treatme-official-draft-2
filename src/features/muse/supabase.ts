import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Share the existing TreatMe login session; do not create a second auth client. */
export function getSupabase(): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

export function isSupabaseConfigured(): boolean {
  return true;
}
