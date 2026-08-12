import { supabase } from "@/integrations/supabase/client";
import type { SkinAnalysis } from "@/lib/skin-analysis";

export interface ScanPdfInput {
  scanId: string;
  includePhoto: boolean;
  analysis: SkinAnalysis | null;
}

/** asks the server for the pdf of one scan and hands back the file */
export async function fetchScanPdf({ scanId, includePhoto, analysis }: ScanPdfInput): Promise<File> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("signed out");

  const res = await fetch("/api/generate-scan-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      scan_id: scanId,
      include_photo: includePhoto,
      analysis: analysis
        ? {
            skinType: analysis.skinType,
            fitzpatrick: analysis.fitzpatrick,
            skinAge: analysis.skinAge,
            blurb: analysis.blurb,
          }
        : undefined,
    }),
  });

  if (!res.ok) throw new Error(`pdf failed (${res.status})`);
  const blob = await res.blob();
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
