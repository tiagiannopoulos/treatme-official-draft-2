import { ANALYSIS_PROVIDER, MIN_CONFIDENCE, DEV_FORCE_KEY } from "./config";
import { mockProvider } from "./mockProvider";
import { apiProvider } from "./apiProvider";
import { CONCERN_KEYS, type ConcernKey, type ScanImage, type ScanResult } from "./types";

export { CONCERN_KEYS, CONCERN_LABEL } from "./types";
export type { ConcernKey, ConcernResult, ScanImage, ScanResult, ImageQuality } from "./types";
export { ANALYSIS_MIN_MS } from "./config";

const provider = ANALYSIS_PROVIDER === "api" ? apiProvider : mockProvider;

/** the only way in. callers never learn which provider ran. */
export async function analyze(images: ScanImage[]): Promise<ScanResult> {
  return provider.analyze(images);
}

/** concern keys worth acting on, confidence-filtered and sorted by score desc */
export function topConcerns(result: ScanResult, limit = 5): ConcernKey[] {
  return result.concerns
    .filter((c) => c.assessable && c.confidence >= MIN_CONFIDENCE)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((c) => c.key);
}

/* ---- hidden dev override ---- */

export function getForcedConcerns(): ConcernKey[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DEV_FORCE_KEY);
    return raw ? (JSON.parse(raw) as ConcernKey[]) : [];
  } catch {
    return [];
  }
}

export function setForcedConcerns(keys: ConcernKey[]) {
  if (typeof window === "undefined") return;
  if (!keys.length) window.localStorage.removeItem(DEV_FORCE_KEY);
  else window.localStorage.setItem(DEV_FORCE_KEY, JSON.stringify(keys));
}
