import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** removes every object under the caller's own folder in the private scan-photos bucket. */
async function wipePhotos(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: files } = await supabaseAdmin.storage.from("scan-photos").list(userId, { limit: 1000 });
  const paths = (files ?? []).map((f) => `${userId}/${f.name}`);
  if (paths.length > 0) await supabaseAdmin.storage.from("scan-photos").remove(paths);
  return paths.length;
}

/** deletes my stored scan photos and clears photo_path on my scans. the reads stay. */
export const deleteMyScanPhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const removed = await wipePhotos(context.userId);
    await context.supabase
      .from("scans")
      .update({ photo_path: null, store_photo: false })
      .eq("user_id", context.userId);
    return { removed };
  });

/** wipes everything for one user, including the auth row. */
async function wipeAccount(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  await wipePhotos(userId);

  const { data: scans } = await supabaseAdmin.from("scans").select("id").eq("user_id", userId);
  const scanIds = (scans ?? []).map((s) => s.id);
  if (scanIds.length > 0) {
    await supabaseAdmin.from("scan_results").delete().in("scan_id", scanIds);
  }
  await supabaseAdmin.from("consult_chats").delete().eq("user_id", userId);
  await supabaseAdmin.from("scans").delete().eq("user_id", userId);
  await supabaseAdmin.from("scan_consents").delete().eq("user_id", userId);
  await supabaseAdmin.from("profiles").delete().eq("id", userId);

  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);

  return { ok: true as const };
}

/** deletes my account: photos, scans, results, chats, profile row, then the auth user itself. */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => wipeAccount(context.userId));

/**
 * one entry point for every data request the profile tab can make.
 * photos: drop stored photos only. revoke_consent: drop photos, results, scans
 * and turn the scan off. account: wipe everything and delete the auth user.
 */
export const deleteMyData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { mode: "photos" | "revoke_consent" | "account" }) => {
    if (input?.mode !== "photos" && input?.mode !== "revoke_consent" && input?.mode !== "account") {
      throw new Error("unknown mode");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    if (data.mode === "photos") {
      const removed = await wipePhotos(context.userId);
      await context.supabase
        .from("scans")
        .update({ photo_path: null, store_photo: false })
        .eq("user_id", context.userId);
      return { ok: true, removed };
    }

    if (data.mode === "revoke_consent") {
      const userId = context.userId;
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const removed = await wipePhotos(userId);

      const { data: scans } = await supabaseAdmin.from("scans").select("id").eq("user_id", userId);
      const scanIds = (scans ?? []).map((s) => s.id);
      if (scanIds.length > 0) await supabaseAdmin.from("scan_results").delete().in("scan_id", scanIds);
      await supabaseAdmin.from("scans").delete().eq("user_id", userId);
      await supabaseAdmin
        .from("scan_consents")
        .update({ revoked_at: new Date().toISOString(), store_photo: false })
        .eq("user_id", userId)
        .is("revoked_at", null);

      return { ok: true, removed };
    }

    return await wipeAccount(context.userId);
  });
