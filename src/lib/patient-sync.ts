import { supabase } from "@/integrations/supabase/client";
import type { HealthFlags, PatientProfile, SavedTreatment } from "@/lib/patient-store";

/**
 * mirrors device answers to supabase when there is a session. each shape has
 * exactly one destination table: profile answers to patient_profile, safety
 * answers to patient_health_flags, saves to saved_treatments. failures are
 * ignored on purpose so the local value stays authoritative for alpha.
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
  await supabase.from("patient_profile").upsert(
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
}

/** safety only. never touches patient_profile. */
export async function syncHealthFlags(flags: HealthFlags) {
  const uid = await userId();
  if (!uid) return;
  await supabase.from("patient_health_flags").upsert(
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
}

export async function syncSaved(saved: SavedTreatment[], removedSlug?: string) {
  const uid = await userId();
  if (!uid) return;
  if (removedSlug) {
    await supabase.from("saved_treatments").delete().eq("user_id", uid).eq("treatment_slug", removedSlug);
    return;
  }
  if (saved.length === 0) return;
  await supabase
    .from("saved_treatments")
    .upsert(saved.map((s) => ({ user_id: uid, treatment_slug: s.slug })), { onConflict: "user_id,treatment_slug" });
}
