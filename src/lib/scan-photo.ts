import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useScan } from "@/lib/scan-store";

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

/**
 * the bucket is private, so a stored photo is only readable through a short
 * lived signed url. never build a public url for scan-photos.
 */
export async function scanPhotoSignedUrl(path: string, expiresInSeconds = 60 * 60): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("scan-photos")
    .createSignedUrl(path, expiresInSeconds);
  if (error) {
    console.warn("scan photo sign failed", error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}

/**
 * the photo to render on analysis screens: the in session capture when we still
 * have it, otherwise a signed url for the stored file.
 */
export function useScanPhoto(): string | null {
  const { photoDataUrl, photoPath } = useScan();
  const [signed, setSigned] = useState<string | null>(null);

  useEffect(() => {
    if (photoDataUrl || !photoPath) {
      setSigned(null);
      return;
    }
    let alive = true;
    void scanPhotoSignedUrl(photoPath).then((url) => {
      if (alive) setSigned(url);
    });
    return () => {
      alive = false;
    };
  }, [photoDataUrl, photoPath]);

  return photoDataUrl ?? signed;
}
