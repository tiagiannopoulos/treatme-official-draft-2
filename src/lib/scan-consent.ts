import { supabase } from "@/integrations/supabase/client";

export const CONSENT_POLICY_VERSION = "2026-08-v1";
const STORE_KEY = "treatme.scan.storePhoto";

/** records consent for the signed in user. guests keep it in the session only. */
export async function recordConsent(storePhoto: boolean): Promise<void> {
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem(STORE_KEY, storePhoto ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) return;

  const { error } = await supabase.from("scan_consents").insert({
    user_id: userId,
    policy_version: CONSENT_POLICY_VERSION,
    store_photo: storePhoto,
  });
  if (error) console.warn("consent insert failed", error.message);
}

export function storePhotoPreference(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.sessionStorage.getItem(STORE_KEY) !== "0";
  } catch {
    return true;
  }
}
