import { CONCERN_KEYS, type AnalysisProvider, type ConcernKey, type ConcernResult, type ScanImage, type ScanResult } from "./types";
import { ANALYSIS_ENDPOINT } from "./config";

interface RawConcern {
  key?: string;
  score?: number;
  confidence?: number;
  assessable?: boolean;
}

function normalize(raw: unknown): ScanResult {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const rawConcerns = Array.isArray(obj.concerns) ? (obj.concerns as RawConcern[]) : [];
  const byKey = new Map(rawConcerns.map((c) => [c.key, c]));

  const concerns: ConcernResult[] = CONCERN_KEYS.map((key: ConcernKey) => {
    const c = byKey.get(key);
    const has = c && typeof c.score === "number";
    return {
      key,
      score: has ? Math.max(0, Math.min(100, c!.score as number)) : 0,
      confidence: typeof c?.confidence === "number" ? c.confidence : 0,
      assessable: c?.assessable ?? Boolean(has),
    };
  });

  const quality = (obj.image_quality ?? {}) as { ok?: boolean; issues?: unknown };

  return {
    scan_id: typeof obj.scan_id === "string" ? obj.scan_id : crypto.randomUUID(),
    model_version: typeof obj.model_version === "string" ? obj.model_version : "api-unknown",
    image_quality: {
      ok: quality.ok !== false,
      issues: Array.isArray(quality.issues) ? (quality.issues as string[]) : [],
    },
    concerns,
  };
}

/** stub. wired to the real endpoint shape, not live yet. */
export const apiProvider: AnalysisProvider = {
  name: "api",
  async analyze(images: ScanImage[]): Promise<ScanResult> {
    const res = await fetch(ANALYSIS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        images: images.map((i) => ({ dataUrl: i.dataUrl, storagePath: i.storagePath ?? null })),
      }),
    });
    if (!res.ok) throw new Error(`analysis_failed_${res.status}`);
    return normalize(await res.json());
  },
};
