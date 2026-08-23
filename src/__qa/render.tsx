import { renderToFile } from "@react-pdf/renderer";
import React from "react";
import fs from "fs";
import { SkinReportDocument } from "../components/report/SkinReportDocument";
import { mockReportData } from "../lib/report-data";

const photo = "data:image/jpeg;base64," + fs.readFileSync("/tmp/qa/face.jpg").toString("base64");
const kinds = ["bloom","cloud","patches","patches_soft","dots_dense","dots_scatter","spots","hatch","strokes_long","strokes_short","crescent","crescent_soft","crescent_thin","arc_upper","contour","deflate","axis"];
const data = mockReportData();
data.indicators.forEach((ind, i) => {
  ind.photoUrl = photo;
  ind.overlayKind = kinds[i % kinds.length]!;
  ind.regions = Array.from({ length: 8 }, (_, k) => ({
    x: 0.25 + ((i * 7 + k * 13) % 50) / 100,
    y: 0.2 + ((i * 11 + k * 17) % 60) / 100,
    r: 0.03 + ((k * 5) % 4) / 100,
    intensity: 0.4 + ((k * 3) % 6) / 10,
  })) as any;
});
data.groups.forEach((g) => (g.indicators = g.indicators.map((x) => data.indicators.find((i) => i.key === x.key)!)));
await renderToFile(React.createElement(SkinReportDocument, { data, includePhotos: true }) as any, "/tmp/qa/report.pdf");
console.log("ok");
