import { CONCERN_KEYS, type AnalysisProvider, type ConcernKey, type ConcernResult, type ScanImage, type ScanResult } from "./types";
import { DEV_FORCE_KEY } from "./config";

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function readForced(): ConcernKey[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DEV_FORCE_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as string[]).filter((k): k is ConcernKey =>
      (CONCERN_KEYS as readonly string[]).includes(k),
    );
  } catch {
    return [];
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * randomized but realistic: 3 to 5 concerns land in the 50-85 band,
 * everything else stays low. confidence always 0.8+.
 * a hidden dev override can force which concerns are elevated.
 */
export const mockProvider: AnalysisProvider = {
  name: "mock",
  async analyze(images: ScanImage[]): Promise<ScanResult> {
    await new Promise((r) => setTimeout(r, 600));

    const forced = readForced();
    const elevated = forced.length
      ? forced
      : shuffle([...CONCERN_KEYS]).slice(0, Math.floor(rand(3, 6)));

    const concerns: ConcernResult[] = CONCERN_KEYS.map((key) => {
      const hot = elevated.includes(key);
      // preserve the forced ordering so the top concern is the first one asked for
      const rank = elevated.indexOf(key);
      const score = hot
        ? round1(85 - (rank < 0 ? 0 : rank) * rand(3, 7) - rand(0, 8))
        : round1(rand(8, 34));
      return {
        key,
        score: Math.min(85, Math.max(8, score)),
        confidence: round1(rand(0.82, 0.98)),
        assessable: true,
      };
    });

    return {
      scan_id: crypto.randomUUID(),
      model_version: "mock-0.3.0",
      image_quality: {
        ok: images.length > 0,
        issues: images.length > 0 ? [] : ["no_image"],
      },
      concerns,
    };
  },
};
