import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** deletes my stored scan photos and clears photo_path on my scans. the reads stay. */
export const deleteMyScanPhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { wipePhotos } = await import("@/lib/account.server");
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
    const { wipeAccount } = await import("@/lib/account.server");
    return wipeAccount(context.userId);
  });

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
    const { wipePhotos, revokeScanConsent, wipeAccount } = await import("@/lib/account.server");

    if (data.mode === "photos") {
      const removed = await wipePhotos(context.userId);
      await context.supabase
        .from("scans")
        .update({ photo_path: null, store_photo: false })
        .eq("user_id", context.userId);
      return { ok: true as const, removed };
    }

    if (data.mode === "revoke_consent") {
      return revokeScanConsent(context.userId);
    }

    return { ...(await wipeAccount(context.userId)), removed: 0 };
  });
