import { supabase } from "@/integrations/supabase/client";
import { CONCERN_ABOUT } from "@/lib/concern-copy";
import {
  CONCERN_GROUPS,
  SCAN_CONCERN_LABEL,
  bandFor,
  overallScore,
  toConcernRows,
  type Band,
  type ScanConcernRow,
} from "@/lib/scan-concerns";
import { displayTreatmentName } from "@/lib/treatment-labels";
import type { SkinAnalysis } from "@/lib/skin-analysis";
import type { ScanResult } from "@/lib/skinAnalysis";

/**
 * the shape the pdf and the public web report both render from. everything the
 * document needs is resolved before rendering, so the renderer stays dumb.
 */

export interface ReportTreatment {
  slug: string;
  name: string;
  priceFrom: number | null;
  downtimeLabel: string;
}

export interface ReportIndicator {
  key: string;
  label: string;
  score: number;
  band: Band;
  blurb: string;
  treatments: ReportTreatment[];
  /** data url or signed url of the cropped region tile, when photos are on */
  photoUrl: string | null;
}

export interface ReportGroup {
  key: string;
  /** page heading, e.g. "texture and clarity" */
  label: string;
  indicators: ReportIndicator[];
}

export interface ReportPlanStep {
  position: number;
  treatmentName: string;
  forLabel: string;
  priceFrom: number | null;
  downtimeLabel: string;
  why: string;
}

export interface ReportData {
  name: string;
  dateLabel: string;
  skinType: string;
  skinTone: string;
  overall: number;
  overallBand: Band;
  summary: string;
  indicators: ReportIndicator[];
  groups: ReportGroup[];
  plan: ReportPlanStep[];
  estimatedTotal: number;
  scanUrl: string;
}

export const SCAN_URL = "https://www.treatmeapp.com/scan";

export const BAND_COLOR: Record<Band, string> = {
  "focus here": "#F8A1C6",
  average: "#FFEDB4",
  good: "#DFFFF8",
  great: "#7ED9C3",
};

/** the deeper fill used for the bar itself, so a pale tint still reads */
export const BAND_BAR: Record<Band, string> = {
  "focus here": "#F08FB4",
  average: "#FBE08F",
  good: "#6FD4BC",
  great: "#2BAF93",
};

export const BAND_RANGE: Record<Band, string> = {
  "focus here": "under 50",
  average: "50 to 79",
  good: "80 to 89",
  great: "90 to 100",
};

export const BAND_ORDER: Band[] = ["focus here", "average", "good", "great"];

export function formatReportDate(iso: string): string {
  const d = new Date(iso);
  const month = d.toLocaleString("en-CA", { month: "long" }).toLowerCase();
  return `${d.getDate()} ${month} ${d.getFullYear()}`;
}

const ROMAN = ["", "i", "ii", "iii", "iv", "v", "vi"];

export function skinToneLabel(fitzpatrick: string | number | null | undefined): string {
  if (fitzpatrick === null || fitzpatrick === undefined) return "not recorded";
  const n = typeof fitzpatrick === "number" ? fitzpatrick : parseInt(String(fitzpatrick), 10);
  if (!Number.isFinite(n) || n < 1 || n > 6) return String(fitzpatrick).toLowerCase();
  return `fitzpatrick ${ROMAN[n]}`;
}

function downtimeLabel(raw: string | null, days: number | null): string {
  if (typeof days === "number") return days === 1 ? "1 day downtime" : `${days} days downtime`;
  if (!raw) return "downtime varies";
  const clean = raw.toLowerCase();
  if (clean === "none" || clean === "no downtime") return "0 days downtime";
  return `${clean} downtime`;
}

interface CatalogRow {
  slug: string;
  name: string;
  price_from: number | null;
  downtime: string | null;
  downtime_days: number | null;
  improves: string[] | null;
}

/** the reassurance line used when an indicator needs nothing */
export const NO_TREATMENT_LINE: Record<string, string> = {
  default: "this one is already working. the useful move here is not changing it.",
  breakouts: "whatever your routine is doing for oil and bacteria is working. the useful move here is not changing it.",
  hydration: "your barrier is holding water well. keep the routine that got you here.",
  firmness: "structure reads strong for your age band. nothing worth treating yet.",
  volume_loss: "volume is sitting where it should. nothing to fill.",
  eyelid_heaviness: "the lid sits high and open. nothing indicated.",
};

/** assembles the whole report payload for one scan */
export async function buildReportData(input: {
  result: ScanResult;
  analysis: SkinAnalysis | null;
  createdAt: string;
  firstName: string | null;
  photoTiles?: Record<string, string | null>;
}): Promise<ReportData> {
  const rows = toConcernRows(input.result);
  const overall = overallScore(rows);

  const { data } = await supabase
    .from("treatments")
    .select("slug, name, price_from, downtime, downtime_days, improves");
  const catalog = ((data ?? []) as unknown as CatalogRow[]).map((t) => ({
    ...t,
    name: displayTreatmentName(t.name, t.slug),
  }));

  const matchFor = (key: string): ReportTreatment[] => {
    const label = SCAN_CONCERN_LABEL[key] ?? key;
    const words = [label, ...label.split(" ")];
    return catalog
      .filter((t) => (t.improves ?? []).some((im) => words.includes(im.toLowerCase())))
      .slice(0, 3)
      .map((t) => ({
        slug: t.slug,
        name: t.name,
        priceFrom: t.price_from === null ? null : Number(t.price_from),
        downtimeLabel: downtimeLabel(t.downtime, t.downtime_days),
      }));
  };

  const indicatorFor = (row: ScanConcernRow): ReportIndicator => ({
    key: row.concern_key,
    label: SCAN_CONCERN_LABEL[row.concern_key] ?? row.concern_key,
    score: row.score,
    band: row.band,
    blurb: CONCERN_ABOUT[row.concern_key] ?? "",
    treatments: row.score >= 80 ? [] : matchFor(row.concern_key),
    photoUrl: input.photoTiles?.[row.concern_key] ?? null,
  });

  const indicators = rows.map(indicatorFor);
  const byKey = new Map(indicators.map((i) => [i.key, i]));

  const groups: ReportGroup[] = CONCERN_GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    indicators: (g.concerns as readonly string[])
      .map((k) => byKey.get(k))
      .filter((i): i is ReportIndicator => Boolean(i)),
  }));

  // the plan: worst four indicators, each paired with its strongest treatment
  const worst = [...indicators].sort((a, b) => a.score - b.score).slice(0, 4);
  const used = new Set<string>();
  const plan: ReportPlanStep[] = [];
  worst.forEach((ind) => {
    const pick = ind.treatments.find((t) => !used.has(t.slug)) ?? ind.treatments[0];
    if (!pick) return;
    used.add(pick.slug);
    plan.push({
      position: plan.length + 1,
      treatmentName: pick.name,
      forLabel: ind.label,
      priceFrom: pick.priceFrom,
      downtimeLabel: pick.downtimeLabel,
      why: planWhy(plan.length, ind.label),
    });
  });

  const estimatedTotal = plan.reduce((sum, s) => sum + (s.priceFrom ?? 0), 0);

  return {
    name: (input.firstName ?? "you").toLowerCase(),
    dateLabel: formatReportDate(input.createdAt),
    skinType: (input.analysis?.skinType ?? "not recorded").toLowerCase(),
    skinTone: skinToneLabel(input.analysis?.fitzpatrick),
    overall,
    overallBand: bandFor(overall),
    summary: input.analysis?.blurb?.toLowerCase() ?? assessmentFallback(indicators),
    indicators,
    groups,
    plan,
    estimatedTotal,
    scanUrl: SCAN_URL,
  };
}

function planWhy(index: number, label: string): string {
  if (index === 0)
    return `${label} is your lowest number and the most visible one. settling it first means everything after it starts from a better baseline.`;
  if (index === 1)
    return `${label} is the structural half of the same picture, so it comes before anything surface level in that area.`;
  if (index === 2)
    return `this only makes sense once the two above have been handled, otherwise you are treating a symptom twice.`;
  return `leave at least two weeks between this and the step above. they should not sit in the same window.`;
}

function assessmentFallback(indicators: ReportIndicator[]): string {
  const sorted = [...indicators].sort((a, b) => a.score - b.score);
  const worst = sorted.slice(0, 3);
  const best = sorted.slice(-2).reverse();
  return `${best.map((b) => b.label).join(" and ")} are the strongest markers in this scan, at ${best
    .map((b) => b.score)
    .join(" and ")} respectively. the primary finding is ${worst[0]?.label} at ${worst[0]?.score}, with ${worst
    .slice(1)
    .map((w) => `${w.label} at ${w.score}`)
    .join(" and ")} close behind. all three are responsive to treatment.`;
}

/** the mock used by the preview route, so the layout can be checked without a scan */
export function mockReportData(): ReportData {
  const scores: Record<string, number> = {
    pores: 65,
    breakouts: 94,
    texture: 71,
    oiliness: 78,
    redness: 42,
    pigmentation: 58,
    uniformness: 66,
    radiance: 74,
    lines: 61,
    firmness: 83,
    volume_loss: 88,
    hydration: 91,
    dark_circles: 47,
    under_eye_puffiness: 55,
    tear_trough: 49,
    eyelid_heaviness: 86,
  };

  const tx: Record<string, ReportTreatment[]> = {
    default: [
      { slug: "hydrafacial", name: "hydrafacial", priceFrom: 189, downtimeLabel: "0 days downtime" },
      { slug: "microneedling", name: "microneedling", priceFrom: 259, downtimeLabel: "2 days downtime" },
      { slug: "chemical-peel", name: "chemical peel", priceFrom: 149, downtimeLabel: "3 days downtime" },
    ],
  };

  const indicators: ReportIndicator[] = Object.entries(scores).map(([key, score]) => ({
    key,
    label: SCAN_CONCERN_LABEL[key] ?? key,
    score,
    band: bandFor(score),
    blurb: CONCERN_ABOUT[key] ?? "",
    treatments: score >= 80 ? [] : (tx.default ?? []).slice(0, score < 50 ? 3 : 2),
    photoUrl: null,
  }));

  const byKey = new Map(indicators.map((i) => [i.key, i]));

  return {
    name: "maya",
    dateLabel: "13 august 2026",
    skinType: "combination",
    skinTone: "fitzpatrick iii",
    overall: 69,
    overallBand: "average",
    summary:
      "hydration and clarity are the strongest markers in this scan, at 91 and 94 respectively. the primary finding is redness at 42, distributed across both cheeks and the central forehead. the eye area presents a secondary cluster, with dark circles at 47 and tear trough at 49, which typically present together. all three are responsive to treatment and reflect surface inflammation and volume distribution rather than structural change.",
    indicators,
    groups: CONCERN_GROUPS.map((g) => ({
      key: g.key,
      label: g.label,
      indicators: (g.concerns as readonly string[])
        .map((k) => byKey.get(k))
        .filter((i): i is ReportIndicator => Boolean(i)),
    })),
    plan: [
      {
        position: 1,
        treatmentName: "ipl photofacial",
        forLabel: "redness",
        priceFrom: 299,
        downtimeLabel: "1 day downtime",
        why: "redness is your lowest number and the most visible one. settling the vascular activity first also lifts uniformness and radiance, so everything after it starts from a better baseline.",
      },
      {
        position: 2,
        treatmentName: "dermal filler",
        forLabel: "tear trough",
        priceFrom: 650,
        downtimeLabel: "3 days downtime",
        why: "the groove is the structural part of your eye area. filling it removes the shadow driving part of your dark circle score, so it comes before anything surface level under the eye.",
      },
      {
        position: 3,
        treatmentName: "microneedling",
        forLabel: "dark circles",
        priceFrom: 259,
        downtimeLabel: "2 days downtime",
        why: "this works on skin thickness under the eye, and only makes sense once the shadow underneath it has been handled.",
      },
      {
        position: 4,
        treatmentName: "chemical peel",
        forLabel: "pigmentation",
        priceFrom: 149,
        downtimeLabel: "3 days downtime",
        why: "pigment is easier to read and easier to target once redness has settled. leave at least two weeks between this and the ipl, they should not sit in the same window.",
      },
    ],
    estimatedTotal: 1357,
    scanUrl: SCAN_URL,
  };
}
