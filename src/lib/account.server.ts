/** server only helpers behind the account and data deletion server functions. */

/** removes every object under the caller's own folder in the private scan-photos bucket. */
export async function wipePhotos(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: files } = await supabaseAdmin.storage.from("scan-photos").list(userId, { limit: 1000 });
  const paths = (files ?? []).map((f) => `${userId}/${f.name}`);
  if (paths.length > 0) await supabaseAdmin.storage.from("scan-photos").remove(paths);
  return paths.length;
}

/** drops photos, results, scans and marks consent revoked. the account stays. */
export async function revokeScanConsent(userId: string) {
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

  return { ok: true as const, removed };
}

/** wipes everything for one user, including the auth row. */
export async function wipeAccount(userId: string) {
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
