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
    console.warn("[treatme] scan photo upload failed:", error.message);
    return null;
  }
  return path;
}

export const SCAN_PHOTO_TTL = 60 * 60;

export type ScanPhotoSource = { url: string | null; reason: string | null };

/**
 * the bucket is private, so a stored photo is only readable through a short
 * lived signed url. never build a public url for scan-photos.
 */
export async function scanPhotoSignedUrl(
  path: string,
  expiresInSeconds = SCAN_PHOTO_TTL,
): Promise<ScanPhotoSource> {
  const { data, error } = await supabase.storage
    .from("scan-photos")
    .createSignedUrl(path, expiresInSeconds);
  if (error) {
    console.warn(`[treatme] scan photo sign failed for ${path}:`, error.message);
    return { url: null, reason: `signing failed: ${error.message}` };
  }
  if (!data?.signedUrl) return { url: null, reason: "signing returned no url" };
  return { url: data.signedUrl, reason: null };
}

/**
 * THE one way to resolve a stored scan photo: give it a scan id, get back a
 * signed url valid for one hour. every screen that renders a scan photo goes
 * through this (or through useScanPhoto, which wraps it).
 */
export async function scanPhotoUrlForScan(scanId: string): Promise<ScanPhotoSource> {
  const { data, error } = await supabase
    .from("scans")
    .select("photo_path")
    .eq("id", scanId)
    .maybeSingle();

  if (error) {
    console.warn(`[treatme] scan photo lookup failed for scan ${scanId}:`, error.message);
    return { url: null, reason: `scan lookup failed: ${error.message}` };
  }
  if (!data?.photo_path) {
    return { url: null, reason: "no photo saved on this scan" };
  }
  return scanPhotoSignedUrl(data.photo_path);
}

/** signed url for a path we already hold (scan lists that selected photo_path). */
export function useScanPhotoByPath(path: string | null | undefined): ScanPhotoSource {
  const [state, setState] = useState<ScanPhotoSource>({ url: null, reason: null });

  useEffect(() => {
    if (!path) {
      setState({ url: null, reason: path === undefined ? null : "no photo saved on this scan" });
      return;
    }
    let alive = true;
    void scanPhotoSignedUrl(path).then((next) => {
      if (alive) setState(next);
    });
    return () => {
      alive = false;
    };
  }, [path]);

  return state;
}

/**
 * the photo to render on analysis screens: the in session capture when we still
 * have it, otherwise a signed url for the stored file. one source, used by the
 * results screen, every indicator detail view and the profile tab.
 */
export function useScanPhotoSource(): ScanPhotoSource {
  const { photoDataUrl, photoPath, scanId, storePhoto, sessionReady } = useScan();
  const [state, setState] = useState<ScanPhotoSource>({ url: null, reason: null });

  useEffect(() => {
    if (!sessionReady) return;
    if (photoDataUrl) {
      setState({ url: null, reason: null });
      return;
    }
    let alive = true;
    void (async () => {
      if (photoPath) {
        const next = await scanPhotoSignedUrl(photoPath);
        if (alive) setState(next);
        return;
      }
      if (scanId) {
        const next = await scanPhotoUrlForScan(scanId);
        if (alive) setState(next);
        return;
      }
      const reason = storePhoto ? "no photo path on this scan" : "photo was not saved for this scan";
      console.warn(`[treatme] scan photo unavailable: ${reason}`);
      if (alive) setState({ url: null, reason });
    })();
    return () => {
      alive = false;
    };
  }, [photoDataUrl, photoPath, scanId, storePhoto, sessionReady]);

  if (photoDataUrl) return { url: photoDataUrl, reason: null };
  return state;
}

/** convenience wrapper for callers that only need the url. */
export function useScanPhoto(): string | null {
  return useScanPhotoSource().url;
}
