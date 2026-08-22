import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { dataUrlToThumbBlob } from "@/lib/image-process";
import { useScan } from "@/lib/scan-store";

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(",");
  const mime = /:(.*?);/.exec(meta)?.[1] ?? "image/jpeg";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export interface StoredScanPhoto {
  path: string | null;
  thumbPath: string | null;
}

/**
 * stores the scan photo in the private scan-photos bucket under the signed-in
 * user's own folder, plus a 320px thumbnail used by every small image in the
 * app. returns nulls when nobody is signed in (alpha guests keep the photo in
 * the session only).
 */
export async function uploadScanPhoto(dataUrl: string): Promise<StoredScanPhoto> {
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) return { path: null, thumbPath: null };

  const base = `${userId}/${Date.now()}-${crypto.randomUUID()}`;
  const path = `${base}.jpg`;
  const { error } = await supabase.storage
    .from("scan-photos")
    .upload(path, dataUrlToBlob(dataUrl), { contentType: "image/jpeg", upsert: false });

  if (error) {
    console.warn("[treatme] scan photo upload failed:", error.message);
    return { path: null, thumbPath: null };
  }

  // the thumbnail is a nice-to-have: a failure here never fails the scan.
  let thumbPath: string | null = null;
  const thumb = await dataUrlToThumbBlob(dataUrl);
  if (thumb) {
    const candidate = `${base}-thumb.jpg`;
    const { error: thumbError } = await supabase.storage
      .from("scan-photos")
      .upload(candidate, thumb, { contentType: "image/jpeg", upsert: false });
    if (thumbError) console.warn("[treatme] scan thumb upload failed:", thumbError.message);
    else thumbPath = candidate;
  }

  return { path, thumbPath };
}

export const SCAN_PHOTO_TTL = 60 * 60;

export type ScanPhotoSource = { url: string | null; reason: string | null };

/**
 * signed urls are valid for an hour, so hold them for that hour instead of
 * asking the storage api again on every render.
 */
const urlCache = new Map<string, { url: string; expiresAt: number }>();

function cached(path: string): string | null {
  const hit = urlCache.get(path);
  if (hit && hit.expiresAt > Date.now()) return hit.url;
  return null;
}

/**
 * ONE round trip for many paths. the bucket is private, so a stored photo is
 * only readable through a short lived signed url. never build a public url.
 */
export async function signScanPhotoPaths(
  paths: (string | null | undefined)[],
  expiresInSeconds = SCAN_PHOTO_TTL,
): Promise<Record<string, string>> {
  const wanted = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  const missing = wanted.filter((p) => !cached(p));

  if (missing.length) {
    const { data, error } = await supabase.storage
      .from("scan-photos")
      .createSignedUrls(missing, expiresInSeconds);
    if (error) {
      console.warn("[treatme] scan photo signing failed:", error.message);
    }
    // keep a minute of headroom so a url never expires mid render
    const expiresAt = Date.now() + Math.max(0, expiresInSeconds - 60) * 1000;
    for (const row of data ?? []) {
      if (row.path && row.signedUrl) urlCache.set(row.path, { url: row.signedUrl, expiresAt });
    }
  }

  const out: Record<string, string> = {};
  for (const p of wanted) {
    const url = cached(p);
    if (url) out[p] = url;
  }
  return out;
}

/** single path convenience wrapper. goes through the same batch + cache. */
export async function scanPhotoSignedUrl(
  path: string,
  expiresInSeconds = SCAN_PHOTO_TTL,
): Promise<ScanPhotoSource> {
  const map = await signScanPhotoPaths([path], expiresInSeconds);
  const url = map[path];
  if (!url) return { url: null, reason: "signing returned no url" };
  return { url, reason: null };
}

/**
 * THE one way to resolve a stored scan photo: give it a scan id, get back a
 * signed url valid for one hour.
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
  const [state, setState] = useState<ScanPhotoSource>(() =>
    path && cached(path) ? { url: cached(path), reason: null } : { url: null, reason: null },
  );

  useEffect(() => {
    if (!path) {
      setState({ url: null, reason: path === undefined ? null : "no photo saved on this scan" });
      return;
    }
    const hit = cached(path);
    if (hit) {
      setState({ url: hit, reason: null });
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

/** batched signed urls for a list of paths, one round trip for the whole list. */
export function useScanPhotoUrls(paths: (string | null | undefined)[]): Record<string, string> {
  const key = useMemo(
    () => [...new Set(paths.filter((p): p is string => Boolean(p)))].sort().join("|"),
    [paths],
  );
  const [map, setMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const list = key ? key.split("|") : [];
    if (!list.length) {
      setMap({});
      return;
    }
    let alive = true;
    void signScanPhotoPaths(list).then((next) => {
      if (alive) setMap(next);
    });
    return () => {
      alive = false;
    };
  }, [key]);

  return map;
}

/**
 * the photo to render on analysis screens: the in session capture when we still
 * have it, otherwise a signed url for the stored file.
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
