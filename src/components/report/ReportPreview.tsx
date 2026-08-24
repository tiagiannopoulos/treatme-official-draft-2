import { PDFViewer } from "@react-pdf/renderer";
import { useEffect, useState } from "react";
import { SkinReportDocument } from "@/components/report/SkinReportDocument";
import { buildReportData, mockReportData, type ReportData } from "@/lib/report-data";
import { storedMarkerPositions } from "@/lib/report-markers";
import { fetchSavedScan } from "@/lib/scan-history";
import { supabase } from "@/integrations/supabase/client";

/**
 * browser only preview of the pdf. /report/mock/preview renders the sample data
 * so the layout can be checked without a real scan.
 */
export default function ReportPreview({ scanId }: { scanId: string }) {
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (scanId === "mock" || scanId === "sample") {
        if (alive) setData(mockReportData());
        return;
      }
      const scan = await fetchSavedScan(scanId);
      if (!scan?.result) {
        if (alive) setError("that scan could not be loaded.");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name")
        .maybeSingle();
      const built = await buildReportData({
        result: scan.result,
        analysis: scan.analysis,
        createdAt: scan.createdAt,
        firstName: profile?.first_name ?? null,
        markerPositions: await storedMarkerPositions(scanId),
        landmarks: scan.landmarks,
        scanId,
      });
      if (alive) setData(built);
    })();
    return () => {
      alive = false;
    };
  }, [scanId]);

  if (error) return <p className="p-6 text-sm lowercase">{error}</p>;
  if (!data) return <p className="p-6 text-sm lowercase">building your report</p>;

  return (
    <PDFViewer style={{ width: "100%", height: "100%", border: "none" }} showToolbar>
      <SkinReportDocument data={data} includePhotos={false} />
    </PDFViewer>
  );
}
