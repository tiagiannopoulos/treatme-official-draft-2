import type { SkinAnalysis } from "@/lib/skin-analysis";
import { CONCERN_GROUPS, SCAN_CONCERN_LABEL, type ScanConcernRow } from "@/lib/scan-concerns";

/** builds a plain text copy of the analysis the user can keep */
export function buildResultsText(rows: ScanConcernRow[], analysis: SkinAnalysis | null, overall: number) {
  const lines: string[] = [];
  lines.push("treatme · your analysis");
  lines.push(new Date().toLocaleDateString("en-CA"));
  lines.push("");
  lines.push(`overall score: ${overall}/100`);
  if (analysis) {
    lines.push(`skin type: ${analysis.skinType}`);
    lines.push(`skin tone: fitzpatrick ${analysis.fitzpatrick}`);
    lines.push(`skin age: ${analysis.skinAge}`);
  }
  lines.push("");

  for (const group of CONCERN_GROUPS) {
    lines.push(group.label);
    for (const key of group.concerns) {
      const row = rows.find((r) => r.concern_key === key);
      if (!row) continue;
      lines.push(`  ${SCAN_CONCERN_LABEL[key] ?? key}: ${row.score}/100 · ${row.band}`);
    }
    lines.push("");
  }

  if (analysis) {
    lines.push("the read");
    lines.push(`  ${analysis.blurb}`);
    lines.push("");
  }

  lines.push("this is an ai estimate, not a medical diagnosis. a provider will confirm what's worth treating.");
  return lines.join("\n");
}

export function downloadResults(text: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "treatme-analysis.txt";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
