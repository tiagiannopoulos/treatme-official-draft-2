import { pdf } from "@react-pdf/renderer";

import { SkinReportDocument } from "@/components/report/SkinReportDocument";
import { supabase } from "@/integrations/supabase/client";
import { buildReportData } from "@/lib/report-data";
import { fetchSavedScan } from "@/lib/scan-history";
import { scanPhotoSignedUrl } from "@/lib/scan-photo";
import type { SkinAnalysis } from "@/lib/skin-analysis";
import { createElement } from "react";

export interface ScanPdfInput {
  scanId: string;
  includePhoto: boolean;
  analysis: SkinAnalysis | null;
}

/** react-pdf needs the bytes, not a short lived url */
async function asDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * builds the eight page report in the browser, so the file a person downloads is
 * the same document the preview shows, with the same photo markings as the app.
 */
export async function fetchScanPdf({ scanId, includePhoto, analysis }: ScanPdfInput): Promise<File> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) throw new Error("signed out");

  const scan = await fetchSavedScan(scanId);
  if (!scan?.result) throw new Error("that scan could not be loaded");

  const { data: profile } = await supabase.from("profiles").select("first_name").maybeSingle();

  // one photo, every indicator: the marks differ, the photo does not
  let photoTiles: Record<string, string | null> | undefined;
  if (includePhoto && scan.photoPath) {
    const { url } = await scanPhotoSignedUrl(scan.photoPath);
    const dataUrl = url ? await asDataUrl(url) : null;
    if (dataUrl) {
      photoTiles = {};
      for (const row of scan.result.concerns ?? []) photoTiles[row.concern_key] = dataUrl;
    }
  }

  const data = await buildReportData({
    result: scan.result,
    analysis: analysis ?? scan.analysis,
    createdAt: scan.createdAt,
    firstName: profile?.first_name ?? null,
    photoTiles,
  });

  const blob = await pdf(
    createElement(SkinReportDocument, { data, includePhotos: Boolean(photoTiles) }),
  ).toBlob();

  return new File([blob], "treatme-analysis.pdf", { type: "application/pdf" });
}

/** native share sheet when the device has one, direct download otherwise */
export async function shareOrDownloadPdf(file: File) {
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (typeof nav.share === "function" && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: "my treatme analysis" });
      return;
    } catch (err) {
      // user dismissed the share sheet — nothing to recover from
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
  }

  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
