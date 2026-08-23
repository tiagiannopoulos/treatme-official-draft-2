import { supabase } from "@/integrations/supabase/client";
import type { HealthFlags, PatientProfile, SavedTreatment } from "@/lib/patient-store";

/**
 * mirrors device answers to supabase when there is a session. each shape has
 * exactly one destination table: profile answers to patient_profile, safety
 * answers to patient_health_flags, saves to saved_treatments. the local value
 * stays authoritative, but every failure is logged so nothing fails silently.
 */

async function userId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

export async function syncProfile(profile: PatientProfile) {
  const uid = await userId();
  if (!uid) return;
  const { error } = await supabase.from("patient_profile").upsert(
    {
      user_id: uid,
      skin_type: profile.skinType,
      concerns: profile.workingOn,
      goals: profile.goals ? [profile.goals] : [],
      budget_band: profile.budget,
      downtime_tolerance: profile.downtime,
      travel_radius_km: profile.travelKm,
      preferred_provider_gender: profile.providerPreference,
      languages: profile.languages,
      needle_comfort: profile.needleComfort,
      md_only: profile.mdOnly ?? false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) console.error("patient_profile upsert failed", error);
}

/** safety only. never touches patient_profile. */
export async function syncHealthFlags(flags: HealthFlags) {
  const uid = await userId();
  if (!uid) return;
  const { error } = await supabase.from("patient_health_flags").upsert(
    {
      user_id: uid,
      pregnant_or_breastfeeding: flags.pregnantOrBreastfeeding,
      keloid_history: flags.keloidHistory,
      recent_isotretinoin: flags.recentIsotretinoin,
      autoimmune_condition: flags.autoimmuneCondition,
      blood_thinners: flags.bloodThinners,
      allergies: flags.allergies,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) console.error("patient_health_flags upsert failed", error);
}

export async function syncSaved(saved: SavedTreatment[], removedSlug?: string) {
  const uid = await userId();
  if (!uid) return;
  if (removedSlug) {
    const { error } = await supabase
      .from("saved_treatments")
      .delete()
      .eq("user_id", uid)
      .eq("treatment_slug", removedSlug);
    if (error) console.error("saved_treatments delete failed", error);
    return;
  }
  if (saved.length === 0) return;
  const { error } = await supabase
    .from("saved_treatments")
    .upsert(saved.map((s) => ({ user_id: uid, treatment_slug: s.slug })), { onConflict: "user_id,treatment_slug" });
  if (error) console.error("saved_treatments upsert failed", error);
}
