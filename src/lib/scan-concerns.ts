// canonical 16 concerns for the skin analysis, in four groups.
// scores here are health scores: 0 = needs the most work, 100 = great.

import type { ScanResult } from "@/lib/skinAnalysis";
import type { ConcernKey as EngineKey, MarkedRegion } from "@/lib/skinAnalysis";
import type { Measured, MeasuredIndicator } from "@/lib/skin-measure";
import type { ZoneKey } from "@/lib/face-zones";

export const CONCERN_GROUPS = [
  {
    key: "texture",
    label: "texture and clarity",
    concerns: ["pores", "breakouts", "texture", "oiliness"],
  },
  {
    key: "tone",
    label: "tone and pigment",
    concerns: ["redness", "pigmentation", "uniformness", "radiance"],
  },
  {
    key: "aging",
    label: "aging and structure",
    concerns: ["lines", "firmness", "volume_loss", "hydration"],
  },
  {
    key: "eyes",
    label: "eye area",
    concerns: ["dark_circles", "under_eye_puffiness", "tear_trough", "eyelid_heaviness"],
  },
] as const;

export const SCAN_CONCERN_KEYS = CONCERN_GROUPS.flatMap((g) => g.concerns as readonly string[]);

/**
 * measured from landmark geometry rather than read as one of the four groups.
 * it is not a grid tile, but it is persisted like every other indicator so it
 * has a score and marker geometry to render from.
 */
export const EXTRA_CONCERN_KEYS = ["symmetry"] as const;

/** every concern written to scan_results, one row each */
export const PERSISTED_CONCERN_KEYS = [...SCAN_CONCERN_KEYS, ...EXTRA_CONCERN_KEYS];

export const SCAN_CONCERN_LABEL: Record<string, string> = {
  pores: "pores",
  breakouts: "breakouts",
  texture: "texture",
  oiliness: "oiliness",
  redness: "redness",
  pigmentation: "pigmentation",
  uniformness: "uniformness",
  radiance: "radiance",
  lines: "lines",
  firmness: "firmness",
  volume_loss: "volume loss",
  hydration: "hydration",
  dark_circles: "dark circles",
  under_eye_puffiness: "under eye puffiness",
  tear_trough: "tear trough",
  eyelid_heaviness: "eyelid heaviness",
  symmetry: "symmetry",
};

export type Band = "great" | "good" | "average" | "focus here";

export function bandFor(score: number): Band {
  if (score >= 90) return "great";
  if (score >= 80) return "good";
  if (score >= 50) return "average";
  return "focus here";
}

/** brand tint for a band */
export function bandTint(band: Band): string {
  if (band === "great" || band === "good") return "#DFFFF8";
  if (band === "average") return "#FFEDB4";
  return "#F8A1C6";
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** severity (higher = worse) from the engine → health score */
function health(severity: number) {
  return clamp(100 - severity);
}

const avg = (...n: number[]) => n.reduce((a, b) => a + b, 0) / n.length;

export interface ScanConcernRow {
  concern_key: string;
  score: number;
  band: Band;
  sub_scores: Record<string, number> | null;
  /** per-region health score, keyed by the region keys in CONCERN_REGIONS */
  region_scores: Record<string, number> | null;
  /** marked places on the patient photo. empty when the read found nothing to mark. */
  regions: MarkedRegion[];
  /** severity 0 to 1 per landmark zone, from the pixel or geometry read */
  zone_scores: Partial<Record<ZoneKey, number>> | null;
  /** the raw measurement, kept so a read can be explained or re measured */
  measured: MeasuredIndicator | null;
  /** how this row's markers were placed */
  mapping_method: "measured" | "landmarks" | "fallback_diagram";
}

/** which engine concerns carry the photo coordinates for each indicator */
const REGION_SOURCES: Record<string, EngineKey[]> = {
  pores: ["pores"],
  breakouts: ["acne"],
  texture: ["texture"],
  oiliness: ["pores"],
  redness: ["redness"],
  pigmentation: ["pigmentation"],
  uniformness: ["darkSpots", "pigmentation"],
  radiance: ["dullness"],
  lines: ["fineLines", "wrinkles"],
  firmness: ["laxity"],
  volume_loss: ["volumeLoss"],
  hydration: ["hydration"],
  dark_circles: ["underEyes"],
  under_eye_puffiness: ["underEyes"],
  tear_trough: ["underEyes"],
  eyelid_heaviness: ["laxity"],
  symmetry: ["symmetry"],
};

/** dedupes near identical spots so a merged indicator does not double up markers */
function mergeRegions(lists: MarkedRegion[][]): MarkedRegion[] {
  const out: MarkedRegion[] = [];
  for (const list of lists) {
    for (const r of list) {
      if (out.some((o) => Math.abs(o.x - r.x) < 0.02 && Math.abs(o.y - r.y) < 0.02)) continue;
      out.push(r);
      if (out.length === 40) return out;
    }
  }
  return out;
}

/**
 * turns one engine result into the canonical concern rows: the 16 grid
 * indicators plus symmetry. every row is always present, so a scan always
 * writes the full set.
 */
export function toConcernRows(result: ScanResult, measured?: Measured | null): ScanConcernRow[] {
  const sev = (key: EngineKey) => result.concerns.find((c) => c.key === key)?.score ?? 0;

  const raw: Record<string, number> = {
    pores: health(sev("pores")),
    breakouts: health(sev("acne")),
    texture: health(sev("texture")),
    oiliness: health(avg(sev("pores"), sev("acne"))),
    redness: health(sev("redness")),
    pigmentation: health(sev("pigmentation")),
    uniformness: health(avg(sev("darkSpots"), sev("pigmentation"))),
    radiance: health(sev("dullness")),
    lines: health(avg(sev("fineLines"), sev("wrinkles"))),
    firmness: health(sev("laxity")),
    volume_loss: health(sev("volumeLoss")),
    hydration: health(sev("hydration")),
    dark_circles: health(sev("underEyes")),
    under_eye_puffiness: health(avg(sev("underEyes"), sev("hydration"))),
    tear_trough: health(avg(sev("underEyes"), sev("volumeLoss"))),
    eyelid_heaviness: health(avg(sev("laxity"), sev("underEyes"))),
    symmetry: health(sev("symmetry")),
  };

  // per-region reads, so the overlay can paint one patch heavier than another
  const regions: Record<string, Record<string, number>> = {
    redness: {
      cheeks: health(sev("redness")),
      nose: health(sev("redness") * 1.1),
      chin: health(sev("redness") * 0.8),
      forehead: health(sev("redness") * 0.7),
    },
    pores: { t_zone: health(sev("pores") * 1.15), cheeks: health(sev("pores") * 0.85) },
    oiliness: { t_zone: raw.oiliness },
    breakouts: {
      forehead: health(sev("acne") * 0.9),
      cheeks: health(sev("acne")),
      chin: health(sev("acne") * 1.1),
    },
    pigmentation: {
      cheeks: health(sev("pigmentation") * 1.1),
      forehead: health(sev("pigmentation") * 0.85),
    },
    uniformness: { full_face: raw.uniformness },
    radiance: { full_face: raw.radiance },
    hydration: { full_face: raw.hydration },
    texture: { full_face: raw.texture },
    lines: {
      forehead: health(sev("wrinkles")),
      glabellar: health(sev("wrinkles") * 1.1),
      crowsfeet: health(sev("fineLines") * 1.1),
      nasolabial: health(avg(sev("fineLines"), sev("volumeLoss"))),
      marionette: health(avg(sev("wrinkles"), sev("laxity"))),
    },
    firmness: {
      jawline: health(sev("laxity") * 1.1),
      lower_cheeks: health(sev("laxity") * 0.9),
    },
    volume_loss: { midface: raw.volume_loss },
    dark_circles: { under_eye: raw.dark_circles },
    under_eye_puffiness: { under_eye: raw.under_eye_puffiness },
    tear_trough: { tear_trough: raw.tear_trough },
    eyelid_heaviness: { upper_lid: raw.eyelid_heaviness },
    symmetry: { full_face: raw.symmetry },
  };

  const regionsFor = (key: string): MarkedRegion[] =>
    mergeRegions(
      (REGION_SOURCES[key] ?? []).map(
        (engineKey) => result.concerns.find((c) => c.key === engineKey)?.regions ?? [],
      ),
    );

  return PERSISTED_CONCERN_KEYS.map((key) => {
    // a measured indicator always wins over the model. the pixels are the
    // ground truth for these, and the markers come from real clusters.
    const read = measured?.[key as keyof Measured] ?? null;
    const score = read ? health(read.severity) : (raw[key] ?? 0);
    const marks = read ? read.regions : regionsFor(key);

    return {
      concern_key: key,
      score,
      band: bandFor(score),
      sub_scores:
        key === "lines" ? { fine: health(sev("fineLines")), deep: health(sev("wrinkles")) } : null,
      region_scores: regions[key] ?? null,
      regions: marks,
      zone_scores: read ? read.zones : null,
      measured: read,
      mapping_method: read ? "measured" : marks.length ? "landmarks" : "fallback_diagram",
    } satisfies ScanConcernRow;
  });
}

/** one overall score for the scan row */
export function overallScore(rows: ScanConcernRow[]): number {
  // the four groups only. symmetry is persisted but not part of the headline.
  const grid = rows.filter((r) => SCAN_CONCERN_KEYS.includes(r.concern_key));
  return clamp(avg(...(grid.length ? grid : rows).map((r) => r.score)));
}
