import React from "react";
import { renderToFile } from "@react-pdf/renderer";
import { SkinReportDocument } from "@/components/report/SkinReportDocument";
import { mockReportData } from "@/lib/report-data";
await renderToFile(<SkinReportDocument data={mockReportData()} includePhotos={false} />, "/tmp/rq/report.pdf");
console.log("ok");
