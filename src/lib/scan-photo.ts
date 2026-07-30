import { supabase } from "@/integrations/supabase/client";

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(",");
  const mime = /:(.*?);/.exec(meta)?.[1] ?? "image/jpeg";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * stores the scan photo in the private scan-photos bucket under the signed-in
 * user's own folder. returns null when nobody is signed in (alpha guests keep
 * the photo in the session only).
 */
export async function uploadScanPhoto(dataUrl: string): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) return null;

  const path = `${userId}/${Date.now()}-${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from("scan-photos")
    .upload(path, dataUrlToBlob(dataUrl), { contentType: "image/jpeg", upsert: false });

  if (error) {
    console.warn("scan photo upload failed", error.message);
    return null;
  }
  return path;
}
