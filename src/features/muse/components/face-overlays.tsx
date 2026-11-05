/**
 * face-map overlay vocabulary — the 18 parameter styles from tia's pdf spec
 * (docs/overlay-vocabulary.md).
 *
 * all coordinates are in viewbox units: 75 x 100 (3:4, no distortion against
 * the aspect-[3/4] photo box). markings are positioned by facelandmarker
 * anchors when landmarks exist, else fractional fallback coords.
 *
 * intensity: i = clamp((90 - score) / 40, 0, 1). never render when score >= 90.
 * placement is deterministic: mulberry32 seeded from the concern key.
 */

import type { ReactNode } from "react";
import type { ConcernKey } from "@/features/muse/concerns";
import type { Landmark } from "@/features/muse/face-landmarks";

export interface Pt {
  x: number;
  y: number;
}
interface Ell {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export function intensityFor(score: number): number {
  return Math.min(1, Math.max(0, (90 - score) / 40));
}

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* geometry: landmarks -> viewbox, with fractional fallback             */
/* ------------------------------------------------------------------ */

export interface EyeGeom {
  outer: Pt;
  inner: Pt;
  center: Pt;
  upper: Pt[];
  lower: Pt[];
}

export interface FaceGeom {
  forehead: Pt;
  nose: Pt;
  chin: Pt;
  eyeL: EyeGeom;
  eyeR: EyeGeom;
  cheekL: Ell;
  cheekR: Ell;
  noseEll: Ell;
  chinEll: Ell;
  foreheadEll: Ell;
  jawL: Pt[];
  jawR: Pt[];
  templeL: Pt;
  templeR: Pt;
  face: Ell;
  centerX: number;
}

/** cover-fit projector: image-normalized (0..1) -> viewbox units. */
export function makeProjector(
  imgW: number,
  imgH: number,
): (x: number, y: number) => Pt {
  const a = imgW / imgH;
  const b = 75 / 100;
  if (a > b) {
    const w = 100 * a;
    const ox = (75 - w) / 2;
    return (x, y) => ({ x: x * w + ox, y: y * 100 });
  }
  const h = 75 / a;
  const oy = (100 - h) / 2;
  return (x, y) => ({ x: x * 75, y: y * h + oy });
}

const LEFT_RING = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
const LEFT_LOWER = [33, 7, 163, 144, 145, 153, 154, 155, 133];
const LEFT_UPPER = [133, 173, 157, 158, 159, 160, 161, 246, 33];
const RIGHT_RING = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466];
const RIGHT_LOWER = [263, 249, 390, 373, 374, 380, 381, 382, 362];
const RIGHT_UPPER = [362, 398, 384, 385, 386, 387, 388, 466, 263];

function avg(pts: Pt[]): Pt {
  return {
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
  };
}

function arcEye(
  outerX: number,
  innerX: number,
  y: number,
): { upper: Pt[]; lower: Pt[]; center: Pt } {
  const w = Math.abs(innerX - outerX);
  const dir = innerX > outerX ? 1 : -1;
  const upperPts: Pt[] = [];
  const lowerPts: Pt[] = [];
  for (let k = 0; k <= 8; k++) {
    const t = k / 8;
    const x = outerX + dir * w * t;
    upperPts.push({ x, y: y - Math.sin(t * Math.PI) * 1.8 });
    lowerPts.push({ x, y: y + Math.sin(t * Math.PI) * 2.4 });
  }
  return {
    upper: upperPts,
    lower: lowerPts,
    center: { x: (outerX + innerX) / 2, y },
  };
}

export function buildGeom(
  landmarks: Landmark[] | null,
  project: ((x: number, y: number) => Pt) | null,
): FaceGeom {
  if (landmarks && landmarks.length >= 478 && project) {
    const P = (idx: number): Pt => {
      const l = landmarks[idx];
      return project(l.x, l.y);
    };
    const eyeL: EyeGeom = {
      outer: P(33),
      inner: P(133),
      center: avg(LEFT_RING.map(P)),
      upper: LEFT_UPPER.map(P),
      lower: LEFT_LOWER.map(P),
    };
    const eyeR: EyeGeom = {
      outer: P(263),
      inner: P(362),
      center: avg(RIGHT_RING.map(P)),
      upper: RIGHT_UPPER.map(P),
      lower: RIGHT_LOWER.map(P),
    };
    const forehead = P(10);
    const nose = P(1);
    const chin = P(152);
    const cheekLc = P(234);
    const cheekRc = P(454);
    const templeL = P(127);
    const templeR = P(356);
    const jawLpt = P(172);
    const jawRpt = P(397);
    const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    return {
      forehead,
      nose,
      chin,
      eyeL,
      eyeR,
      cheekL: { cx: cheekLc.x, cy: cheekLc.y, rx: 7, ry: 8 },
      cheekR: { cx: cheekRc.x, cy: cheekRc.y, rx: 7, ry: 8 },
      noseEll: { cx: nose.x, cy: nose.y, rx: 4.5, ry: 7 },
      chinEll: { cx: chin.x, cy: chin.y - 3, rx: 7, ry: 5 },
      foreheadEll: { cx: forehead.x, cy: forehead.y + 1, rx: 12, ry: 7 },
      jawL: [templeL, mid(templeL, jawLpt), jawLpt, mid(jawLpt, chin)],
      jawR: [templeR, mid(templeR, jawRpt), jawRpt, mid(jawRpt, chin)],
      templeL,
      templeR,
      face: {
        cx: (forehead.x + chin.x) / 2,
        cy: (forehead.y + chin.y) / 2,
        rx: Math.abs(cheekRc.x - cheekLc.x) / 2 + 4,
        ry: Math.abs(chin.y - forehead.y) / 2 + 6,
      },
      centerX: (forehead.x + chin.x) / 2,
    };
  }

  /* fractional fallback — fractions of the 75x100 photo box. */
  const eyeLarc = arcEye(23, 32.5, 41);
  const eyeRarc = arcEye(52, 42.5, 41);
  return {
    forehead: { x: 37.5, y: 22 },
    nose: { x: 37.5, y: 50 },
    chin: { x: 37.5, y: 78 },
    eyeL: { outer: { x: 23, y: 41 }, inner: { x: 32.5, y: 41 }, ...eyeLarc },
    eyeR: { outer: { x: 52, y: 41 }, inner: { x: 42.5, y: 41 }, ...eyeRarc },
    cheekL: { cx: 21, cy: 53, rx: 7, ry: 8 },
    cheekR: { cx: 54, cy: 53, rx: 7, ry: 8 },
    noseEll: { cx: 37.5, cy: 50, rx: 4.5, ry: 7 },
    chinEll: { cx: 37.5, cy: 74, rx: 7, ry: 5 },
    foreheadEll: { cx: 37.5, cy: 22, rx: 13, ry: 7 },
    jawL: [
      { x: 14, y: 36 },
      { x: 18, y: 52 },
      { x: 23, y: 68 },
      { x: 30, y: 75 },
    ],
    jawR: [
      { x: 61, y: 36 },
      { x: 57, y: 52 },
      { x: 52, y: 68 },
      { x: 45, y: 75 },
    ],
    templeL: { x: 16, y: 34 },
    templeR: { x: 59, y: 34 },
    face: { cx: 37.5, cy: 50, rx: 20, ry: 30 },
    centerX: 37.5,
  };
}

/* ------------------------------------------------------------------ */
/* small drawing helpers                                                */
/* ------------------------------------------------------------------ */

function scatterInEllipse(rng: () => number, e: Ell, n: number): Pt[] {
  const pts: Pt[] = [];
  for (let k = 0; k < n; k++) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng());
    pts.push({ x: e.cx + Math.cos(a) * r * e.rx, y: e.cy + Math.sin(a) * r * e.ry });
  }
  return pts;
}

function pathThrough(pts: Pt[]): string {
  return (
    "M " + pts.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" L ")
  );
}

function offsetY(pts: Pt[], dy: number): Pt[] {
  return pts.map((p) => ({ x: p.x, y: p.y + dy }));
}

interface Ctx {
  geom: FaceGeom;
  i: number;
  rng: () => number;
  uid: string;
}

function softPatch(
  ctx: Ctx,
  id: string,
  color: string,
  opacity: number,
  zones: Ell[],
  scale = 1,
): ReactNode {
  return (
    <g key={id}>
      <defs>
        <radialGradient id={`${ctx.uid}-${id}`}>
          <stop offset="0%" stopColor={color} stopOpacity={opacity} />
          <stop offset="70%" stopColor={color} stopOpacity={opacity * 0.5} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </radialGradient>
      </defs>
      {zones.map((z, k) => (
        <ellipse
          key={k}
          cx={z.cx}
          cy={z.cy}
          rx={z.rx * scale}
          ry={z.ry * scale}
          fill={`url(#${ctx.uid}-${id})`}
        />
      ))}
    </g>
  );
}

function dots(
  key: string,
  pts: Pt[],
  color: string,
  rMin: number,
  rMax: number,
  rng: () => number,
  opacity = 0.9,
): ReactNode {
  return (
    <g key={key} fill={color} opacity={opacity}>
      {pts.map((p, k) => (
        <circle key={k} cx={p.x} cy={p.y} r={rMin + rng() * (rMax - rMin)} />
      ))}
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* the 18 styles                                                        */
/* ------------------------------------------------------------------ */

function styleRedness(c: Ctx): ReactNode {
  const { geom, i } = c;
  const s = 0.85 + 0.35 * i;
  return softPatch(c, "redness", "#f2a3b8", 0.35 + 0.2 * i, [
    geom.cheekL,
    geom.cheekR,
    geom.noseEll,
    geom.chinEll,
    geom.foreheadEll,
  ], s);
}

function stylePigmentation(c: Ctx): ReactNode {
  const { geom, i, rng } = c;
  const n = Math.round(40 * i);
  return dots("pigmentation", scatterInEllipse(rng, geom.face, n), "#b07a2a", 0.2, 0.55, rng, 0.9);
}

function stylePores(c: Ctx): ReactNode {
  const { geom, i, rng } = c;
  const n = Math.round(120 * i);
  const zones = [geom.foreheadEll, geom.noseEll, geom.chinEll];
  const per = Math.ceil(n / zones.length);
  const pts = zones.flatMap((z) => scatterInEllipse(rng, z, per)).slice(0, n);
  return dots("pores", pts, "#d99a1f", 0.15, 0.4, rng, 0.85);
}

function styleBreakouts(c: Ctx): ReactNode {
  const { geom, i, rng } = c;
  const n = Math.max(2, Math.round(12 * i));
  const zones = [geom.cheekL, geom.cheekR, geom.chinEll];
  const per = Math.ceil(n / zones.length);
  const pts = zones.flatMap((z) => scatterInEllipse(rng, z, per)).slice(0, n);
  return (
    <g key="breakouts">
      {pts.map((p, k) => {
        const r = 0.45 + rng() * 0.3;
        const arm = r * 1.1;
        return (
          <g key={k}>
            <circle cx={p.x} cy={p.y} r={r} fill="#3aa88f" opacity={0.9} />
            <line x1={p.x - arm} y1={p.y} x2={p.x + arm} y2={p.y} stroke="#ffffff" strokeWidth={0.22} />
            <line x1={p.x} y1={p.y - arm} x2={p.x} y2={p.y + arm} stroke="#ffffff" strokeWidth={0.22} />
          </g>
        );
      })}
    </g>
  );
}

function styleTexture(c: Ctx): ReactNode {
  const { geom, i, rng } = c;
  const n = Math.round(50 * i);
  const pts = scatterInEllipse(rng, geom.face, n);
  return (
    <g key="texture" stroke="#a06a2a" strokeWidth={0.32} opacity={0.8} strokeLinecap="round">
      {pts.map((p, k) => {
        const len = 1.2 + rng() * 1.6;
        const a = rng() * Math.PI;
        return (
          <line
            key={k}
            x1={p.x}
            y1={p.y}
            x2={p.x + Math.cos(a) * len}
            y2={p.y + Math.sin(a) * len}
          />
        );
      })}
    </g>
  );
}

function styleUnevenness(c: Ctx): ReactNode {
  const { geom } = c;
  return softPatch(c, "unevenness", "#e8c98a", 0.3, [
    geom.foreheadEll,
    geom.cheekL,
    geom.cheekR,
    geom.chinEll,
  ]);
}

function styleHydration(c: Ctx): ReactNode {
  const { geom, i, rng } = c;
  const n = Math.round(90 * i);
  const zones = [geom.foreheadEll, geom.cheekL, geom.cheekR];
  const per = Math.ceil(n / zones.length);
  const pts = zones.flatMap((z) => scatterInEllipse(rng, z, per)).slice(0, n);
  return dots("hydration", pts, "#4db8a5", 0.12, 0.28, rng, 0.25);
}

function styleLines(c: Ctx): ReactNode {
  const { geom, i } = c;
  const f = geom.forehead;
  const len = 11 + 13 * i;
  const lines = [-4.5, -1.8, 0.9].map((dy, k) => ({
    x1: f.x - (len * (1 - k * 0.12)) / 2,
    x2: f.x + (len * (1 - k * 0.12)) / 2,
    y: f.y + dy,
  }));
  const crows = (eye: EyeGeom, dir: 1 | -1) =>
    [0, 1, 2].map((k) => {
      const y0 = eye.outer.y - 1.4 + k * 1.7;
      const l = 1.6 + 1.6 * i;
      return {
        x1: eye.outer.x + dir * 0.8,
        y1: y0,
        x2: eye.outer.x + dir * (0.8 + l),
        y2: y0 - 0.7,
      };
    });
  return (
    <g key="lines" stroke="#d99a1f" strokeWidth={0.35} strokeLinecap="round">
      {lines.map((l, k) => (
        <line key={`f${k}`} x1={l.x1} y1={l.y} x2={l.x2} y2={l.y} />
      ))}
      {crows(geom.eyeL, -1).map((l, k) => (
        <line key={`l${k}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
      ))}
      {crows(geom.eyeR, 1).map((l, k) => (
        <line key={`r${k}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
      ))}
    </g>
  );
}

function styleFineLines(c: Ctx): ReactNode {
  // folded into the `lines` concern: extra short gold strokes.
  const { geom, rng } = c;
  const f = geom.forehead;
  const shorts = [0, 1, 2].map((k) => {
    const x = f.x - 6 + rng() * 12;
    return { x1: x, x2: x + 2.5 + rng() * 2, y: f.y - 3 + k * 2.6 };
  });
  const corner = (eye: EyeGeom, dir: 1 | -1, k: number) => ({
    x1: eye.outer.x + dir * 1.2,
    y1: eye.outer.y + 1 + k * 1.4,
    x2: eye.outer.x + dir * 3.4,
    y2: eye.outer.y + 0.6 + k * 1.4,
  });
  return (
    <g key="fine_lines" stroke="#d99a1f" strokeWidth={0.3} strokeLinecap="round" opacity={0.9}>
      {shorts.map((l, k) => (
        <line key={`s${k}`} x1={l.x1} y1={l.y} x2={l.x2} y2={l.y} />
      ))}
      {[0, 1].map((k) => {
        const l = corner(geom.eyeL, -1, k);
        return <line key={`l${k}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />;
      })}
      {[0, 1].map((k) => {
        const r = corner(geom.eyeR, 1, k);
        return <line key={`r${k}`} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} />;
      })}
    </g>
  );
}

function crescents(
  key: string,
  eye: EyeGeom,
  dy: number,
  color: string,
  widen = 0,
): ReactNode {
  const lower = eye.lower;
  const pts = offsetY(lower, dy);
  // widen: extend the arc slightly past the corners.
  const dir = eye.inner.x > eye.outer.x ? 1 : -1;
  const ext = (p: Pt, s: number): Pt => ({ x: p.x + dir * s * widen, y: p.y });
  const path = pathThrough([ext(pts[0], -1), ...pts.slice(1, -1), ext(pts[pts.length - 1], 1)]);
  return (
    <path
      key={key}
      d={path}
      fill="none"
      stroke={color}
      strokeWidth={0.45}
      strokeLinecap="round"
    />
  );
}

function styleDarkCircles(c: Ctx): ReactNode {
  return (
    <g key="dark_circles">
      {crescents("l", c.geom.eyeL, 1.9, "#e84393")}
      {crescents("r", c.geom.eyeR, 1.9, "#e84393")}
    </g>
  );
}

function styleUnderEyePuffiness(c: Ctx): ReactNode {
  return (
    <g key="under_eye_puffiness">
      {crescents("l", c.geom.eyeL, 3.4, "#e8b62a", 1.6)}
      {crescents("r", c.geom.eyeR, 3.4, "#e8b62a", 1.6)}
    </g>
  );
}

function styleTearTrough(c: Ctx): ReactNode {
  const trough = (eye: EyeGeom, dir: 1 | -1, key: string) => {
    const s = eye.inner;
    // from the inner corner, curving down and outward toward the cheek.
    const d = `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} Q ${(s.x + dir * 2).toFixed(2)} ${(s.y + 4.5).toFixed(2)} ${(s.x + dir * 4.2).toFixed(2)} ${(s.y + 7.5).toFixed(2)}`;
    return (
      <path key={key} d={d} fill="none" stroke="#e84393" strokeWidth={0.45} strokeLinecap="round" />
    );
  };
  // left eye inner corner is on the nose side; trough runs outward (-x).
  return (
    <g key="tear_trough">
      {trough(c.geom.eyeL, -1, "l")}
      {trough(c.geom.eyeR, 1, "r")}
    </g>
  );
}

function styleEyelidHeaviness(c: Ctx): ReactNode {
  const crease = (eye: EyeGeom, key: string) => (
    <path
      key={key}
      d={pathThrough(offsetY(eye.upper, -0.9))}
      fill="none"
      stroke="#3aa88f"
      strokeWidth={0.45}
      strokeLinecap="round"
    />
  );
  return (
    <g key="eyelid_heaviness">
      {crease(c.geom.eyeL, "l")}
      {crease(c.geom.eyeR, "r")}
    </g>
  );
}

function styleFirmness(c: Ctx): ReactNode {
  const { geom } = c;
  const centerX = geom.centerX;
  const draw = (jaw: Pt[], key: string) => {
    const solid = pathThrough(jaw);
    // dashed twin, pushed outward from the face center.
    const pushed = jaw.map((p) => {
      const dx = p.x - centerX;
      const dy = p.y - 50;
      const m = Math.hypot(dx, dy) || 1;
      return { x: p.x + (dx / m) * 2.4, y: p.y + (dy / m) * 2.4 };
    });
    // upward arrow ticks at three spots.
    const ticks = [1, 2, 3].map((k) => {
      const p = jaw[Math.min(k, jaw.length - 1)];
      return { x: p.x, y: p.y - 1 };
    });
    return (
      <g key={key}>
        <path d={solid} fill="none" stroke="#3aa88f" strokeWidth={0.45} strokeLinecap="round" />
        <path
          d={pathThrough(pushed)}
          fill="none"
          stroke="#3aa88f"
          strokeWidth={0.4}
          strokeDasharray="1.6 1.4"
          strokeLinecap="round"
        />
        {ticks.map((t, k) => (
          <polyline
            key={k}
            points={`${t.x - 1},${t.y + 1.1} ${t.x},${t.y} ${t.x + 1},${t.y + 1.1}`}
            fill="none"
            stroke="#3aa88f"
            strokeWidth={0.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </g>
    );
  };
  return (
    <g key="firmness">
      {draw(geom.jawL, "l")}
      {draw(geom.jawR, "r")}
    </g>
  );
}

function styleVolumeLoss(c: Ctx): ReactNode {
  const { geom } = c;
  const circle = (e: Ell, temple: Pt | null, dir: 1 | -1, key: string) => (
    <g key={key}>
      <circle
        cx={e.cx}
        cy={e.cy}
        r={5.2}
        fill="none"
        stroke="#3aa88f"
        strokeWidth={0.35}
        strokeDasharray="1.6 1.4"
      />
      {/* inward arrow */}
      <polyline
        points={`${e.cx - dir * 8},${e.cy} ${e.cx - dir * 5.6},${e.cy} ${e.cx - dir * 6.6},${e.cy - 0.9} M ${e.cx - dir * 5.6},${e.cy} ${e.cx - dir * 6.6},${e.cy + 0.9}`}
        fill="none"
        stroke="#3aa88f"
        strokeWidth={0.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {temple && (
        <circle
          cx={temple.x}
          cy={temple.y}
          r={3.2}
          fill="none"
          stroke="#3aa88f"
          strokeWidth={0.35}
          strokeDasharray="1.6 1.4"
        />
      )}
    </g>
  );
  return (
    <g key="volume_loss">
      {circle(geom.cheekL, geom.templeL, 1, "l")}
      {circle(geom.cheekR, geom.templeR, -1, "r")}
    </g>
  );
}

function styleOiliness(c: Ctx): ReactNode {
  const { geom, i, rng } = c;
  const n = Math.round(60 * i);
  const zones = [geom.foreheadEll, geom.noseEll, geom.chinEll];
  const per = Math.ceil(n / zones.length);
  const pts = zones.flatMap((z) => scatterInEllipse(rng, z, per)).slice(0, n);
  return dots("oiliness", pts, "#d99a1f", 0.15, 0.4, rng, 0.85);
}

function styleRadiance(c: Ctx): ReactNode {
  const { geom } = c;
  return softPatch(c, "radiance", "#e3c078", 0.3, [
    geom.foreheadEll,
    geom.cheekL,
    geom.cheekR,
  ]);
}

function styleSymmetry(c: Ctx): ReactNode {
  // diagnostic style only — no concern maps to it, no chip is wired.
  const { geom } = c;
  const cx = geom.centerX;
  return (
    <g key="symmetry" stroke="#e84393" fill="none">
      <circle cx={geom.cheekL.cx} cy={geom.cheekL.cy} r={6} strokeWidth={0.35} />
      <circle cx={geom.cheekR.cx} cy={geom.cheekR.cy} r={6} strokeWidth={0.35} />
      <line x1={cx} y1={8} x2={cx} y2={92} strokeWidth={0.35} strokeDasharray="2 1.6" />
      <line x1={cx - 18} y1={geom.eyeL.center.y} x2={cx + 18} y2={geom.eyeL.center.y} strokeWidth={0.3} strokeDasharray="2 1.6" />
      <line x1={cx - 14} y1={geom.chin.y - 8} x2={cx + 14} y2={geom.chin.y - 8} strokeWidth={0.3} strokeDasharray="2 1.6" />
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* public api                                                           */
/* ------------------------------------------------------------------ */

type StyleKey =
  | "redness"
  | "pigmentation"
  | "pores"
  | "breakouts"
  | "texture"
  | "unevenness"
  | "hydration"
  | "lines"
  | "fine_lines"
  | "dark_circles"
  | "under_eye_puffiness"
  | "tear_trough"
  | "eyelid_heaviness"
  | "firmness"
  | "volume_loss"
  | "oiliness"
  | "radiance"
  | "symmetry";

const STYLE_RENDERERS: Record<StyleKey, (c: Ctx) => ReactNode> = {
  redness: styleRedness,
  pigmentation: stylePigmentation,
  pores: stylePores,
  breakouts: styleBreakouts,
  texture: styleTexture,
  unevenness: styleUnevenness,
  hydration: styleHydration,
  lines: styleLines,
  fine_lines: styleFineLines,
  dark_circles: styleDarkCircles,
  under_eye_puffiness: styleUnderEyePuffiness,
  tear_trough: styleTearTrough,
  eyelid_heaviness: styleEyelidHeaviness,
  firmness: styleFirmness,
  volume_loss: styleVolumeLoss,
  oiliness: styleOiliness,
  radiance: styleRadiance,
  symmetry: styleSymmetry,
};

/** the 16 app concerns -> overlay styles (symmetry has no chip). */
export const CONCERN_STYLES: Record<ConcernKey, StyleKey[]> = {
  pores: ["pores"],
  breakouts: ["breakouts"],
  texture: ["texture"],
  oiliness: ["oiliness"],
  redness: ["redness"],
  pigmentation: ["pigmentation"],
  uniformness: ["unevenness"],
  radiance: ["radiance"],
  lines: ["lines", "fine_lines"],
  firmness: ["firmness"],
  volume_loss: ["volume_loss"],
  hydration: ["hydration"],
  dark_circles: ["dark_circles"],
  under_eye_puffiness: ["under_eye_puffiness"],
  tear_trough: ["tear_trough"],
  eyelid_heaviness: ["eyelid_heaviness"],
};

/**
 * render one concern's markings. returns null when the score says the
 * concern is clear (>= 90) — markings come from the actual result only.
 */
export function renderConcern(
  concern: ConcernKey,
  score: number,
  geom: FaceGeom,
  uid: string,
): ReactNode {
  if (score >= 90) return null;
  const i = intensityFor(score);
  const rng = mulberry32(hashStr(`treatme:${concern}`));
  const ctx: Ctx = { geom, i, rng, uid };
  return (
    <g key={concern}>
      {CONCERN_STYLES[concern].map((s) => STYLE_RENDERERS[s](ctx))}
    </g>
  );
}
