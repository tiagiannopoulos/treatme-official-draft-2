/**
 * layer 2 and 3 of marker placement: measured from the actual pixels and from
 * landmark geometry. no vision model is involved in any of this.
 *
 * ten indicators are decided here:
 *   from pixels        redness, pigmentation, pores, texture, uniformness,
 *                     oiliness, radiance, dark_circles
 *   from geometry      symmetry, eyelid_heaviness
 *
 * every marker returned sits on a real cluster of pixels or a real zone, in
 * normalised image coordinates (0,0 top left, 1,1 bottom right), so it maps
 * straight onto the photo with no maths at draw time.
 */

import { decodeImage } from "@/lib/facemesh";
import {
  insetPolygon,
  pointInPolygon,
  polygonBounds,
  polygonCentroid,
  ZONE_KEYS,
  type FaceMap,
  type Point,
  type Polygon,
  type ZoneKey,
} from "@/lib/face-zones";
import type { MarkedRegion } from "@/lib/skinAnalysis";

export const MEASURED_KEYS = [
  "redness",
  "pigmentation",
  "pores",
  "texture",
  "uniformness",
  "oiliness",
  "radiance",
  "dark_circles",
  "symmetry",
  "eyelid_heaviness",
] as const;

export type MeasuredKey = (typeof MEASURED_KEYS)[number];

export interface MeasuredIndicator {
  /** 0 to 100, higher = more pronounced. the app converts to a health score. */
  severity: number;
  /** 0 to 1 severity per zone, only for zones this indicator reads */
  zones: Partial<Record<ZoneKey, number>>;
  /** where it actually shows, measured not guessed */
  regions: MarkedRegion[];
}

export type Measured = Record<MeasuredKey, MeasuredIndicator>;

/* ---------- small numeric helpers ---------- */

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const round1 = (n: number) => Math.round(n * 10) / 10;

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)));
  return sorted[i]!;
}

/** maps a measurement onto 0..100 severity with a soft floor and ceiling */
function scale(value: number, quiet: number, loud: number): number {
  if (loud === quiet) return 0;
  return Math.round(clamp01((value - quiet) / (loud - quiet)) * 100);
}

const EMPTY: MeasuredIndicator = { severity: 0, zones: {}, regions: [] };

/* ---------- colour ---------- */

/** srgb byte to linear */
const LUT = new Float32Array(256);
for (let i = 0; i < 256; i += 1) {
  const c = i / 255;
  LUT[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

const labF = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);

/** srgb bytes to cie lab, d65 */
function toLab(r: number, g: number, b: number): [number, number, number] {
  const rl = LUT[r]!;
  const gl = LUT[g]!;
  const bl = LUT[b]!;
  const x = (rl * 0.4124 + gl * 0.3576 + bl * 0.1805) / 0.95047;
  const y = rl * 0.2126 + gl * 0.7152 + bl * 0.0722;
  const z = (rl * 0.0193 + gl * 0.1192 + bl * 0.9505) / 1.08883;
  const fx = labF(x);
  const fy = labF(y);
  const fz = labF(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/* ---------- the sampled field ---------- */

/** target width we sample at. big enough for pore scale, small enough to be quick. */
const SAMPLE_WIDTH = 640;

interface Field {
  w: number;
  h: number;
  L: Float32Array;
  A: Float32Array;
  B: Float32Array;
  /** 1 where the pixel is skin we are allowed to read */
  skin: Uint8Array;
  zoneMask: Record<ZoneKey, Uint8Array>;
  zonePixels: Record<ZoneKey, number[]>;
  /** face box in pixels of the sampled field */
  box: { x: number; y: number; w: number; h: number };
}

function toPixelPoly(poly: Polygon, w: number, h: number): Polygon {
  return poly.map((p) => ({ x: p.x * w, y: p.y * h }));
}

function buildField(image: HTMLImageElement, map: FaceMap): Field | null {
  const srcW = image.naturalWidth || image.width;
  const srcH = image.naturalHeight || image.height;
  if (!srcW || !srcH) return null;

  const scaleDown = Math.min(1, SAMPLE_WIDTH / srcW);
  const w = Math.max(64, Math.round(srcW * scaleDown));
  const h = Math.max(64, Math.round(srcH * scaleDown));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0, w, h);

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, w, h).data;
  } catch {
    return null;
  }

  const count = w * h;
  const L = new Float32Array(count);
  const A = new Float32Array(count);
  const B = new Float32Array(count);
  const skin = new Uint8Array(count);

  const face = toPixelPoly(insetPolygon(map.zones.full_face, 0.97), w, h);
  const masks = map.masks.map((m) => toPixelPoly(insetPolygon(m, 1.12), w, h));
  const box = polygonBounds(map.zones.full_face);
  const pxBox = {
    x: Math.max(0, Math.floor(box.x * w)),
    y: Math.max(0, Math.floor(box.y * h)),
    w: Math.min(w, Math.ceil(box.w * w)),
    h: Math.min(h, Math.ceil(box.h * h)),
  };

  for (let y = pxBox.y; y < pxBox.y + pxBox.h; y += 1) {
    for (let x = pxBox.x; x < pxBox.x + pxBox.w; x += 1) {
      const i = y * w + x;
      const p: Point = { x: x + 0.5, y: y + 0.5 };
      if (!pointInPolygon(p, face)) continue;
      const o = i * 4;
      const [l, a, b] = toLab(data[o]!, data[o + 1]!, data[o + 2]!);
      L[i] = l;
      A[i] = a;
      B[i] = b;
      // brows, lashes, lips and nostrils are never read and never marked
      if (masks.some((m) => pointInPolygon(p, m))) continue;
      skin[i] = 1;
    }
  }

  const zoneMask = {} as Record<ZoneKey, Uint8Array>;
  const zonePixels = {} as Record<ZoneKey, number[]>;
  for (const key of ZONE_KEYS) {
    const poly = toPixelPoly(insetPolygon(map.zones[key], key === "full_face" ? 0.95 : 0.88), w, h);
    const b = polygonBounds(map.zones[key]);
    const mask = new Uint8Array(count);
    const list: number[] = [];
    const y0 = Math.max(0, Math.floor(b.y * h));
    const y1 = Math.min(h, Math.ceil((b.y + b.h) * h));
    const x0 = Math.max(0, Math.floor(b.x * w));
    const x1 = Math.min(w, Math.ceil((b.x + b.w) * w));
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const i = y * w + x;
        if (!skin[i]) continue;
        if (!pointInPolygon({ x: x + 0.5, y: y + 0.5 }, poly)) continue;
        mask[i] = 1;
        list.push(i);
      }
    }
    zoneMask[key] = mask;
    zonePixels[key] = list;
  }

  if (zonePixels.full_face.length < 500) return null;

  return { w, h, L, A, B, skin, zoneMask, zonePixels, box: pxBox };
}

/* ---------- tiles ---------- */

interface Tile {
  /** centre in normalised image coordinates */
  x: number;
  y: number;
  /** tile size as a fraction of image width */
  size: number;
  value: number;
  n: number;
}

/**
 * walks a grid of tiles over the given pixel set and scores each one.
 * tiles with too few usable pixels are dropped, so a tile half over a lash
 * line never becomes a marker.
 */
function tileScan(
  field: Field,
  keys: ZoneKey[],
  tilePx: number,
  valueAt: (index: number) => number,
): Tile[] {
  const step = Math.max(4, Math.round(tilePx));
  const allow = new Uint8Array(field.w * field.h);
  for (const key of keys) for (const i of field.zonePixels[key]) allow[i] = 1;

  const out: Tile[] = [];
  for (let y = field.box.y; y < field.box.y + field.box.h; y += step) {
    for (let x = field.box.x; x < field.box.x + field.box.w; x += step) {
      let sum = 0;
      let n = 0;
      for (let dy = 0; dy < step; dy += 1) {
        const yy = y + dy;
        if (yy >= field.h) break;
        for (let dx = 0; dx < step; dx += 1) {
          const xx = x + dx;
          if (xx >= field.w) break;
          const i = yy * field.w + xx;
          if (!allow[i]) continue;
          sum += valueAt(i);
          n += 1;
        }
      }
      if (n < step * step * 0.5) continue;
      out.push({
        x: round3((x + step / 2) / field.w),
        y: round3((y + step / 2) / field.h),
        size: round3(step / field.w),
        value: sum / n,
        n,
      });
    }
  }
  return out;
}

/**
 * turns the loudest tiles into markers. only tiles that actually clear the
 * threshold become markers, so a clear face returns an empty array and the
 * app falls back to the diagram rather than inventing spots.
 */
function markersFromTiles(tiles: Tile[], threshold: number, span: number, max = 24): MarkedRegion[] {
  return tiles
    .filter((t) => t.value > threshold)
    .sort((a, b) => b.value - a.value)
    .slice(0, max)
    .map((t) => ({
      x: t.x,
      y: t.y,
      r: round3(t.size * 0.75),
      intensity: round3(clamp01((t.value - threshold) / (span || 1))),
    }));
}

/**
 * a whole zone marked as one soft blob, used when the read is zone level.
 * the radius is capped so a wide zone like the jawline never balloons into a
 * blob that spills off the face.
 */
function zoneMarker(map: FaceMap, key: ZoneKey, intensity: number): MarkedRegion {
  const c = polygonCentroid(insetPolygon(map.zones[key], 0.8));
  const b = polygonBounds(map.zones[key]);
  const r = Math.min(0.075, Math.max(0.035, Math.min(b.w, b.h) * 0.3));
  return { x: round3(c.x), y: round3(c.y), r: round3(r), intensity: round3(clamp01(intensity)) };
}

function zoneStat(field: Field, key: ZoneKey, arr: Float32Array) {
  const list = field.zonePixels[key];
  if (!list.length) return { mean: 0, sd: 0, n: 0 };
  let sum = 0;
  for (const i of list) sum += arr[i]!;
  const mean = sum / list.length;
  let variance = 0;
  for (const i of list) variance += (arr[i]! - mean) ** 2;
  return { mean, sd: Math.sqrt(variance / list.length), n: list.length };
}

/** box blur of L over the skin mask, radius in pixels. used for local contrast. */
function blurL(field: Field, radius: number): Float32Array {
  const { w, h, L, skin } = field;
  const r = Math.max(1, Math.round(radius));
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);

  for (let y = field.box.y; y < field.box.y + field.box.h; y += 1) {
    for (let x = field.box.x; x < field.box.x + field.box.w; x += 1) {
      let sum = 0;
      let n = 0;
      for (let dx = -r; dx <= r; dx += 1) {
        const xx = x + dx;
        if (xx < 0 || xx >= w) continue;
        const i = y * w + xx;
        if (!skin[i]) continue;
        sum += L[i]!;
        n += 1;
      }
      tmp[y * w + x] = n ? sum / n : L[y * w + x]!;
    }
  }
  for (let y = field.box.y; y < field.box.y + field.box.h; y += 1) {
    for (let x = field.box.x; x < field.box.x + field.box.w; x += 1) {
      let sum = 0;
      let n = 0;
      for (let dy = -r; dy <= r; dy += 1) {
        const yy = y + dy;
        if (yy < field.box.y || yy >= field.box.y + field.box.h) continue;
        const i = yy * w + x;
        if (!skin[i]) continue;
        sum += tmp[i]!;
        n += 1;
      }
      out[y * w + x] = n ? sum / n : L[y * w + x]!;
    }
  }
  return out;
}

const T_ZONE: ZoneKey[] = ["forehead", "glabella", "nose"];
const CHEEKS: ZoneKey[] = ["left_cheek", "right_cheek"];
/** zones we read for face wide indicators. eyelids and lips are left out. */
const SKIN_ZONES: ZoneKey[] = [
  "forehead",
  "glabella",
  "temple_left",
  "temple_right",
  "nose",
  "left_cheek",
  "right_cheek",
  "perioral",
  "chin",
  "jawline_left",
  "jawline_right",
];

/* ---------- the eight pixel reads ---------- */

function readRedness(field: Field, map: FaceMap): MeasuredIndicator {
  const faceA = field.zonePixels.full_face.map((i) => field.A[i]!);
  const base = median(faceA);
  const spread = Math.max(1.5, percentile(faceA, 0.9) - base);

  const zones: Partial<Record<ZoneKey, number>> = {};
  let worst = 0;
  for (const key of SKIN_ZONES) {
    const { mean, n } = zoneStat(field, key, field.A);
    if (n < 60) continue;
    const rel = clamp01((mean - base) / (spread * 2));
    zones[key] = round3(rel);
    if (rel > worst) worst = rel;
  }

  // markers sit on the actual clusters of high a star pixels
  const tiles = tileScan(field, SKIN_ZONES, field.box.w / 22, (i) => field.A[i]!);
  const cut = base + spread * 0.8;
  const regions = markersFromTiles(tiles, cut, spread * 1.6, 20);

  const meanExcess = Math.max(0, median(tiles.map((t) => t.value)) - base);
  return {
    severity: scale(meanExcess + spread * 0.35 * worst * 2, 0.4, 6),
    zones,
    regions: regions.length ? regions : zoneFallback(map, zones, 0.35),
  };
}

function readPigmentation(field: Field, map: FaceMap): MeasuredIndicator {
  // darker than the local neighbourhood, which is what a mark actually is.
  const local = blurL(field, Math.max(3, (field.box.w / 100) * 6));
  const darkness = (i: number) => Math.max(0, local[i]! - field.L[i]!);

  const sample = field.zonePixels.full_face.map(darkness);
  const cut = Math.max(1.6, percentile(sample, 0.985));
  const tiles = tileScan(field, SKIN_ZONES, field.box.w / 26, darkness);
  const regions = markersFromTiles(tiles, cut * 0.55, cut, 24);

  const zones: Partial<Record<ZoneKey, number>> = {};
  for (const key of SKIN_ZONES) {
    const list = field.zonePixels[key];
    if (list.length < 60) continue;
    const share = list.filter((i) => darkness(i) > cut).length / list.length;
    zones[key] = round3(clamp01(share * 12));
  }

  const share = sample.filter((v) => v > cut).length / Math.max(1, sample.length);
  return {
    severity: scale(share, 0.004, 0.05),
    zones,
    regions: regions.length ? regions : zoneFallback(map, zones, 0.3),
  };
}

/** high frequency energy at a 2 to 4 pixel period, which is pore scale */
function readPores(field: Field, map: FaceMap): MeasuredIndicator {
  const { w, L, skin } = field;
  const energy = (i: number) => {
    const l = L[i]!;
    let sum = 0;
    let n = 0;
    for (const d of [-2, 2, -2 * w, 2 * w]) {
      const j = i + d;
      if (j < 0 || j >= L.length || !skin[j]) continue;
      sum += Math.abs(l - L[j]!);
      n += 1;
    }
    return n ? sum / n : 0;
  };

  const keys = [...T_ZONE, ...CHEEKS];
  const tiles = tileScan(field, keys, field.box.w / 20, energy);
  const values = tiles.map((t) => t.value);
  const base = median(values);
  const loud = Math.max(base + 0.15, percentile(values, 0.9));
  const regions = markersFromTiles(tiles, base + (loud - base) * 0.45, loud - base, 18);

  const zones: Partial<Record<ZoneKey, number>> = {};
  for (const key of keys) {
    const inZone = tiles.filter((t) => tileInZone(field, t, key));
    if (!inZone.length) continue;
    zones[key] = round3(clamp01((median(inZone.map((t) => t.value)) - base * 0.6) / (loud * 1.2)));
  }

  return {
    severity: scale(base, 0.55, 2.6),
    zones,
    regions: regions.length ? regions : zoneFallback(map, zones, 0.3),
  };
}

/** local variance at a coarser scale than pores, across the whole face */
function readTexture(field: Field, map: FaceMap): MeasuredIndicator {
  const { w, L, skin } = field;
  const rough = (i: number) => {
    const l = L[i]!;
    let sum = 0;
    let n = 0;
    for (const d of [-5, 5, -5 * w, 5 * w, -5 * w - 5, 5 * w + 5]) {
      const j = i + d;
      if (j < 0 || j >= L.length || !skin[j]) continue;
      sum += (l - L[j]!) ** 2;
      n += 1;
    }
    return n ? Math.sqrt(sum / n) : 0;
  };

  const tiles = tileScan(field, SKIN_ZONES, field.box.w / 14, rough);
  const values = tiles.map((t) => t.value);
  const base = median(values);
  const loud = Math.max(base + 0.4, percentile(values, 0.9));
  const regions = markersFromTiles(tiles, base + (loud - base) * 0.4, loud - base, 14);

  const zones: Partial<Record<ZoneKey, number>> = {};
  for (const key of SKIN_ZONES) {
    const inZone = tiles.filter((t) => tileInZone(field, t, key));
    if (!inZone.length) continue;
    zones[key] = round3(clamp01((median(inZone.map((t) => t.value)) - base * 0.7) / (loud * 1.3)));
  }

  return {
    severity: scale(base, 1.1, 5),
    zones,
    regions: regions.length ? regions : zoneFallback(map, zones, 0.3),
  };
}

/** how wide the colour spread runs, zone by zone */
function readUniformness(field: Field, map: FaceMap): MeasuredIndicator {
  const zones: Partial<Record<ZoneKey, number>> = {};
  const spreads: number[] = [];
  for (const key of SKIN_ZONES) {
    const a = zoneStat(field, key, field.A);
    const b = zoneStat(field, key, field.B);
    const l = zoneStat(field, key, field.L);
    if (l.n < 60) continue;
    const spread = Math.sqrt(a.sd ** 2 + b.sd ** 2) + l.sd * 0.35;
    spreads.push(spread);
    zones[key] = spread;
  }
  if (!spreads.length) return EMPTY;

  const quiet = Math.min(...spreads);
  const loud = Math.max(...spreads, quiet + 0.5);
  const normalised: Partial<Record<ZoneKey, number>> = {};
  for (const [key, spread] of Object.entries(zones)) {
    normalised[key as ZoneKey] = round3(clamp01((spread - quiet) / (loud - quiet)));
  }

  // this one is a zone level read, so the markers are the widest spread zones
  const regions = (Object.entries(normalised) as [ZoneKey, number][])
    .filter(([, v]) => v > 0.45)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([key, v]) => zoneMarker(map, key, 0.25 + v * 0.6));

  return { severity: scale(median(spreads), 2.2, 7.5), zones: normalised, regions };
}

/** specular highlights: bright and low chroma, in clusters */
function readOiliness(field: Field, map: FaceMap): MeasuredIndicator {
  const faceL = field.zonePixels.full_face.map((i) => field.L[i]!);
  const bright = percentile(faceL, 0.88);
  const shine = (i: number) => {
    const chroma = Math.sqrt(field.A[i]! ** 2 + field.B[i]! ** 2);
    const over = field.L[i]! - bright;
    if (over <= 0) return 0;
    return over * clamp01(1.4 - chroma / 22);
  };

  const keys = [...T_ZONE, ...CHEEKS, "chin" as ZoneKey];
  const tiles = tileScan(field, keys, field.box.w / 18, shine);
  const values = tiles.map((t) => t.value);
  const loud = Math.max(0.5, percentile(values, 0.92));
  const regions = markersFromTiles(tiles, loud * 0.5, loud, 14);

  const zones: Partial<Record<ZoneKey, number>> = {};
  for (const key of keys) {
    const inZone = tiles.filter((t) => tileInZone(field, t, key));
    if (!inZone.length) continue;
    zones[key] = round3(clamp01(Math.max(...inZone.map((t) => t.value)) / (loud * 1.5)));
  }

  return {
    severity: scale(median(values.filter((v) => v > 0)) || 0, 0.15, 2.2),
    zones,
    regions,
  };
}

/** mean lightness and the share of matte reflection, zone by zone */
function readRadiance(field: Field, map: FaceMap): MeasuredIndicator {
  const faceL = field.zonePixels.full_face.map((i) => field.L[i]!);
  const faceMean = faceL.reduce((a, b) => a + b, 0) / Math.max(1, faceL.length);
  const specularCut = percentile(faceL, 0.9);

  const zones: Partial<Record<ZoneKey, number>> = {};
  const dullness: [ZoneKey, number][] = [];
  for (const key of SKIN_ZONES) {
    const list = field.zonePixels[key];
    if (list.length < 60) continue;
    const stat = zoneStat(field, key, field.L);
    const specular = list.filter((i) => field.L[i]! > specularCut).length / list.length;
    // dull = darker than the face average and flat rather than reflective
    const dull = clamp01((faceMean - stat.mean) / 9) * 0.7 + clamp01(1 - specular / 0.12) * 0.3;
    zones[key] = round3(dull);
    dullness.push([key, dull]);
  }

  const regions = dullness
    .filter(([, v]) => v > 0.45)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([key, v]) => zoneMarker(map, key, 0.25 + v * 0.55));

  const overall = dullness.length
    ? dullness.reduce((a, [, v]) => a + v, 0) / dullness.length
    : 0;
  return { severity: Math.round(clamp01(overall) * 100), zones, regions };
}

/** under eye against the cheek on the same side. the difference is the score. */
function readDarkCircles(field: Field, map: FaceMap): MeasuredIndicator {
  const pairs: [ZoneKey, ZoneKey][] = [
    ["under_eye_left", "left_cheek"],
    ["under_eye_right", "right_cheek"],
  ];

  const zones: Partial<Record<ZoneKey, number>> = {};
  const regions: MarkedRegion[] = [];
  const diffs: number[] = [];

  for (const [eye, cheek] of pairs) {
    const eyeStat = zoneStat(field, eye, field.L);
    const cheekStat = zoneStat(field, cheek, field.L);
    if (eyeStat.n < 40 || cheekStat.n < 40) continue;
    const diff = cheekStat.mean - eyeStat.mean;
    diffs.push(diff);
    const rel = clamp01(diff / 20);
    zones[eye] = round3(rel);
    if (rel <= 0.12) continue;

    // markers go where the gap is widest, not across the whole lid
    const tiles = tileScan(field, [eye], Math.max(6, field.box.w / 26), (i) =>
      Math.max(0, cheekStat.mean - field.L[i]!),
    );
    const loud = Math.max(1, percentile(tiles.map((t) => t.value), 0.9));
    const marks = markersFromTiles(tiles, loud * 0.45, loud, 6);
    if (marks.length) regions.push(...marks);
    else regions.push(zoneMarker(map, eye, 0.3 + rel * 0.5));
  }

  const meanDiff = diffs.length ? diffs.reduce((a, b) => a + b, 0) / diffs.length : 0;
  return { severity: scale(meanDiff, 3.5, 24), zones, regions };
}

/* ---------- layer 3, geometry only ---------- */

/**
 * mirror the landmarks across the midline and measure how far each one sits
 * from its partner. pairs are explicit, so the read is eye against eye and
 * mouth corner against mouth corner rather than silhouette against silhouette.
 */
const MIRROR_PAIRS: [number, number][] = [
  [33, 263], // outer eye corners
  [133, 362], // inner eye corners
  [159, 386], // upper lids
  [145, 374], // lower lids
  [70, 300], // brow starts
  [105, 334], // brow peaks
  [46, 276], // brow tails
  [61, 291], // mouth corners
  [98, 327], // nostril bases
  [50, 280], // upper cheeks
  [123, 352], // mid cheeks
  [172, 397], // jaw
  [58, 288], // jaw angles
  [234, 454], // face width
];

function readSymmetry(map: FaceMap): MeasuredIndicator {
  const { landmarks, midline, bounds } = map;
  if (!landmarks.length || !bounds.w) return EMPTY;

  const gaps: { x: number; y: number; d: number }[] = [];
  for (const [a, b] of MIRROR_PAIRS) {
    const pa = landmarks[a];
    const pb = landmarks[b];
    if (!pa || !pb) continue;
    // reflect the right hand point and compare it with its partner
    const reflected = { x: 2 * midline - pb.x, y: pb.y };
    const d = Math.hypot(reflected.x - pa.x, reflected.y - pa.y) / bounds.w;
    gaps.push({ x: pa.x, y: pa.y, d }, { x: pb.x, y: pb.y, d });
  }
  if (!gaps.length) return EMPTY;

  const mean = gaps.reduce((sum, g) => sum + g.d, 0) / gaps.length;
  const loud = Math.max(mean * 1.8, 0.03);
  const regions = gaps
    .filter((g) => g.d > loud)
    .sort((a, b) => b.d - a.d)
    .slice(0, 8)
    .map((g) => ({
      x: round3(g.x),
      y: round3(g.y),
      r: round3(bounds.w * 0.09),
      intensity: round3(clamp01((g.d - loud) / (loud * 1.5))),
    }));

  return { severity: scale(mean, 0.008, 0.06), zones: {}, regions };
}

/** lid to iris and lid to brow distance, per eye, normalised by face height */
function readEyelidHeaviness(map: FaceMap): MeasuredIndicator {
  const l = map.landmarks;
  const faceH = map.bounds.h || 1;
  const sides: { lid: number[]; iris: number; brow: number[]; zone: ZoneKey }[] = [
    { lid: [386, 385, 387], iris: 473, brow: [295, 282, 283], zone: "upper_eyelid_left" },
    { lid: [159, 158, 160], iris: 468, brow: [65, 52, 53], zone: "upper_eyelid_right" },
  ];

  const zones: Partial<Record<ZoneKey, number>> = {};
  const regions: MarkedRegion[] = [];
  const heaviness: number[] = [];

  for (const side of sides) {
    const lidY = side.lid.map((i) => l[i]?.y).filter((v): v is number => v != null);
    const browY = side.brow.map((i) => l[i]?.y).filter((v): v is number => v != null);
    const iris = l[side.iris];
    if (!lidY.length || !browY.length || !iris) continue;
    const lid = lidY.reduce((a, b) => a + b, 0) / lidY.length;
    const brow = browY.reduce((a, b) => a + b, 0) / browY.length;
    // lid sitting low over the iris, and little room between lid and brow
    const lidToIris = (iris.y - lid) / faceH;
    const lidToBrow = (lid - brow) / faceH;
    const value = clamp01(1 - lidToIris / 0.05) * 0.6 + clamp01(1 - lidToBrow / 0.075) * 0.4;
    heaviness.push(value);
    zones[side.zone] = round3(value);
    if (value > 0.35) regions.push(zoneMarker(map, side.zone, 0.3 + value * 0.5));
  }

  const overall = heaviness.length ? Math.max(...heaviness) : 0;
  return { severity: Math.round(clamp01(overall) * 100), zones, regions };
}

/* ---------- shared bits ---------- */

function tileInZone(field: Field, tile: Tile, key: ZoneKey): boolean {
  const x = Math.round(tile.x * field.w);
  const y = Math.round(tile.y * field.h);
  const i = y * field.w + x;
  return i >= 0 && i < field.zoneMask[key].length && field.zoneMask[key][i] === 1;
}

/**
 * when a read is real but no single cluster clears the bar, mark the zones it
 * scored highest instead of returning nothing. still measured, never invented.
 */
function zoneFallback(
  map: FaceMap,
  zones: Partial<Record<ZoneKey, number>>,
  floor: number,
): MarkedRegion[] {
  return (Object.entries(zones) as [ZoneKey, number][])
    .filter(([, v]) => v > floor)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key, v]) => zoneMarker(map, key, 0.25 + v * 0.5));
}

/* ---------- entry point ---------- */

/**
 * runs layers 2 and 3 on the captured still. returns null when the pixels
 * cannot be read, and the caller keeps whatever the model said.
 */
export async function measureSkin(dataUrl: string, map: FaceMap | null): Promise<Measured | null> {
  if (!map || typeof document === "undefined") return null;
  try {
    const image = await decodeImage(dataUrl);
    const field = buildField(image, map);
    if (!field) return null;

    const measured: Measured = {
      redness: readRedness(field, map),
      pigmentation: readPigmentation(field, map),
      pores: readPores(field, map),
      texture: readTexture(field, map),
      uniformness: readUniformness(field, map),
      oiliness: readOiliness(field, map),
      radiance: readRadiance(field, map),
      dark_circles: readDarkCircles(field, map),
      symmetry: readSymmetry(map),
      eyelid_heaviness: readEyelidHeaviness(map),
    };

    for (const key of MEASURED_KEYS) {
      measured[key].severity = Math.max(0, Math.min(100, round1(measured[key].severity)));
    }
    return measured;
  } catch (e) {
    console.warn("skin measurement failed", e);
    return null;
  }
}
