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

/** deletes my account: photos, scans, results, chats, profile row, then the auth user itself. */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;
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

    return { ok: true };
  });
