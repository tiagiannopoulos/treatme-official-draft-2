import { useId, useMemo } from "react";

/**
 * one stylised face diagram, reused by all 18 indicators. the patient's own photo
 * stays on the main results screen: a zoomed photo of your own pores is unkind,
 * a clean diagram says the same thing clinically.
 *
 * overlay_kind picks the drawing, accent picks the colour, region picks placement,
 * and the score drives a single density multiplier so all 18 respond the same way.
 */

const CREAM = "#FCFBF7";
const FACE = "#F1F0ED";
const FEATURE = "#DFDDDA";

export interface FaceMapProps {
  overlayKind: string;
  accent: string;
  region: string;
  /** 0 to 100, lower means more affected, so lower draws more */
  score: number;
  className?: string;
  /** thumbnails skip the heavier blurs and thin out the dot counts */
  compact?: boolean;
}

/** deterministic so the same indicator always draws the same way */
function rng(seed: number) {
  let t = seed + 0x6d2b79f5;
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedOf(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

interface Zone {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

const ZONES: Record<string, Zone[]> = {
  full_face: [{ cx: 100, cy: 102, rx: 40, ry: 60 }],
  t_zone: [
    { cx: 100, cy: 62, rx: 30, ry: 15 },
    { cx: 100, cy: 112, rx: 11, ry: 22 },
    { cx: 76, cy: 116, rx: 13, ry: 16 },
    { cx: 124, cy: 116, rx: 13, ry: 16 },
  ],
  forehead_eyes: [
    { cx: 100, cy: 60, rx: 31, ry: 13 },
    { cx: 66, cy: 92, rx: 9, ry: 8 },
    { cx: 134, cy: 92, rx: 9, ry: 8 },
  ],
  under_eye: [
    { cx: 79, cy: 104, rx: 14, ry: 6 },
    { cx: 121, cy: 104, rx: 14, ry: 6 },
  ],
  upper_eye: [
    { cx: 79, cy: 84, rx: 13, ry: 4 },
    { cx: 121, cy: 84, rx: 13, ry: 4 },
  ],
  jawline: [
    { cx: 78, cy: 140, rx: 16, ry: 12 },
    { cx: 122, cy: 140, rx: 16, ry: 12 },
  ],
  midface: [
    { cx: 76, cy: 112, rx: 15, ry: 14 },
    { cx: 124, cy: 112, rx: 15, ry: 14 },
  ],
};

function zonesFor(region: string): Zone[] {
  return ZONES[region] ?? ZONES.full_face!;
}

/** a point inside one of the region's zones, biased to the middle */
function pick(rand: () => number, zones: Zone[]): { x: number; y: number } {
  const z = zones[Math.floor(rand() * zones.length)] ?? zones[0]!;
  const a = rand() * Math.PI * 2;
  const r = Math.sqrt(rand());
  return { x: z.cx + Math.cos(a) * r * z.rx, y: z.cy + Math.sin(a) * r * z.ry };
}

/** lower score draws more. 90 reads almost clear, 40 reads clearly marked. */
/**
 * a few accents in the table sit almost exactly on the face fill, so drawing with
 * them literally reads as an empty card. keep the hue from the database and only
 * deepen it until it is actually visible.
 */
function readableAccent(accent: string): string {
  const hex = accent.replace("#", "");
  if (hex.length !== 6) return accent;
  let [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
  const dist = () => Math.abs(r - 241) + Math.abs(g - 240) + Math.abs(b - 237);
  for (let step = 0; step < 12 && dist() < 150; step += 1) {
    r = Math.round(r * 0.9);
    g = Math.round(g * 0.9);
    b = Math.round(b * 0.9);
  }
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("")}`;
}

function densityFor(score: number): number {
  const clamped = Math.max(0, Math.min(100, score));
  return Math.max(0.18, Math.min(1.25, (100 - clamped) / 55));
}

export function FaceMap({
  overlayKind,
  accent,
  region,
  score,
  className,
  compact = false,
}: FaceMapProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const softId = `soft${uid}`;
  const heavyId = `heavy${uid}`;

  const overlay = useMemo(
    () => drawOverlay({ overlayKind, accent, region, score, softId, heavyId, compact }),
    [overlayKind, accent, region, score, softId, heavyId, compact],
  );

  // some accents sit very close to the face fill, so one pass reads as nothing.
  // stacking the same drawing keeps the database colour and still shows up.


  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      role="img"
      aria-label={`face diagram for this indicator, score ${Math.round(score)} out of 100`}
    >
      <defs>
        <filter id={softId} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation={compact ? 2.5 : 4} />
        </filter>
        <filter id={heavyId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={compact ? 5 : 9} />
        </filter>
        <clipPath id={`face${uid}`}>
          <ellipse cx="100" cy="100" rx="47" ry="70" />
        </clipPath>
      </defs>

      <rect width="200" height="200" rx="16" fill={CREAM} />

      {/* the face, then the overlay clipped to it, then the features on top so the
          drawing never buries the face */}
      <ellipse cx="100" cy="100" rx="47" ry="70" fill={FACE} />
      <g clipPath={`url(#face${uid})`}>
        {overlay}
      </g>

      <rect x="70" y="88" width="19" height="5" rx="2.5" fill={FEATURE} />
      <rect x="111" y="88" width="19" height="5" rx="2.5" fill={FEATURE} />
      <path d="M100 104 L100 118 Q100 121 103 121" stroke={FEATURE} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M88 138 Q100 145 112 138" stroke={FEATURE} strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

interface DrawArgs {
  overlayKind: string;
  accent: string;
  region: string;
  score: number;
  softId: string;
  heavyId: string;
  compact: boolean;
}

function drawOverlay(a: DrawArgs) {
  const { overlayKind, region, score, softId, heavyId, compact } = a;
  const accent = readableAccent(a.accent);
  const d = densityFor(score);
  const rand = rng(seedOf(`${overlayKind}:${region}:${Math.round(score)}`));
  const zones = zonesFor(region);
  const soft = `url(#${softId})`;
  const heavy = `url(#${heavyId})`;
  const count = (base: number) => Math.max(2, Math.round(base * d * (compact ? 0.55 : 1)));

  switch (overlayKind) {
    case "bloom": {
      const cores: Zone[] = [
        { cx: 74, cy: 108, rx: 22, ry: 20 },
        { cx: 126, cy: 108, rx: 22, ry: 20 },
        { cx: 100, cy: 116, rx: 16, ry: 16 },
      ];
      return (
        <g opacity={0.45 * Math.min(1, 0.55 + d * 0.6)} filter={heavy}>
          {cores.map((c, i) => (
            <ellipse
              key={i}
              cx={c.cx}
              cy={c.cy}
              rx={c.rx * (0.7 + d * 0.5)}
              ry={c.ry * (0.7 + d * 0.5)}
              fill={accent}
            />
          ))}
        </g>
      );
    }

    case "patches":
    case "patches_soft": {
      const softer = overlayKind === "patches_soft";
      const n = count(softer ? 5 : 9);
      return (
        <g opacity={softer ? 0.45 : 0.55} filter={softer ? heavy : soft}>
          {Array.from({ length: n }, (_, i) => {
            const p = pick(rand, zones);
            const r = (softer ? 11 : 6) + rand() * (softer ? 9 : 6);
            return <ellipse key={i} cx={p.x} cy={p.y} rx={r} ry={r * (0.6 + rand() * 0.5)} fill={accent} />;
          })}
        </g>
      );
    }

    case "dots_dense":
    case "dots_scatter": {
      const dense = overlayKind === "dots_dense";
      const n = count(dense ? 200 : 150);
      return (
        <g opacity={dense ? 0.7 : 0.65}>
          {Array.from({ length: n }, (_, i) => {
            const p = pick(rand, zones);
            return <circle key={i} cx={p.x} cy={p.y} r={1} fill={accent} />;
          })}
        </g>
      );
    }

    case "spots": {
      const n = Math.max(1, Math.min(6, count(5)));
      return (
        <g>
          {Array.from({ length: n }, (_, i) => {
            const p = pick(rand, zones);
            return (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r={4} fill={accent} opacity={0.4} />
                <circle cx={p.x} cy={p.y} r={4} fill="none" stroke={accent} strokeWidth={1.5} />
              </g>
            );
          })}
        </g>
      );
    }

    case "hatch": {
      const n = count(36);
      return (
        <g stroke={accent} strokeWidth={1.5} strokeLinecap="round" opacity={0.75}>
          {Array.from({ length: n }, (_, i) => {
            const p = pick(rand, zones);
            const len = 3 + rand() * 5;
            const ang = rand() * Math.PI;
            return (
              <line
                key={i}
                x1={p.x - Math.cos(ang) * len}
                y1={p.y - Math.sin(ang) * len}
                x2={p.x + Math.cos(ang) * len}
                y2={p.y + Math.sin(ang) * len}
              />
            );
          })}
        </g>
      );
    }

    case "cloud": {
      const n = count(6);
      return (
        <g opacity={0.55} filter={soft}>
          {Array.from({ length: n }, (_, i) => {
            const p = pick(rand, zones);
            const r = 14 + rand() * 12;
            return <ellipse key={i} cx={p.x} cy={p.y} rx={r} ry={r * 0.72} fill={accent} opacity={0.7} />;
          })}
        </g>
      );
    }

    case "strokes_long":
    case "strokes_short": {
      const thin = overlayKind === "strokes_short";
      const rows = Math.max(2, Math.min(4, count(4)));
      const crow = Math.max(2, Math.min(3, count(3)));
      const w = thin ? 20 : 27;
      return (
        <g stroke={accent} strokeWidth={thin ? 1.5 : 2} strokeLinecap="round" fill="none" opacity={0.85}>
          {Array.from({ length: rows }, (_, i) => {
            const y = 52 + i * 8;
            return <path key={`f${i}`} d={`M${100 - w} ${y} Q100 ${y - 5} ${100 + w} ${y}`} />;
          })}
          {[-1, 1].map((side) =>
            Array.from({ length: crow }, (_, i) => {
              const x = 100 + side * (62 - i * 3);
              const y = 88 + i * 5;
              const len = thin ? 5 : 8;
              return (
                <line
                  key={`c${side}${i}`}
                  x1={x}
                  y1={y}
                  x2={x + side * len}
                  y2={y + len * 0.7}
                />
              );
            }),
          )}
        </g>
      );
    }

    case "crescent":
    case "crescent_soft": {
      const softer = overlayKind === "crescent_soft";
      const top = 97;
      const depth = 6 + d * 6;
      return (
        <g fill={accent} opacity={softer ? 0.5 : 0.6} filter={soft}>
          {[79, 121].map((cx) => (
            <path
              key={cx}
              d={`M${cx - 15} ${top} Q${cx} ${top + depth * 2.2} ${cx + 15} ${top} Q${cx} ${top + depth * 0.5} ${cx - 15} ${top} Z`}
            />
          ))}
        </g>
      );
    }

    case "crescent_thin": {
      return (
        <g stroke={accent} strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.85}>
          {[-1, 1].map((side) => (
            <path
              key={side}
              d={`M${100 + side * 8} 98 Q${100 + side * 20} ${102 + d * 4} ${100 + side * 30} ${112 + d * 4}`}
            />
          ))}
        </g>
      );
    }

    case "arc_upper": {
      return (
        <g stroke={accent} strokeWidth={2.5} fill="none" strokeLinecap="round" opacity={0.85}>
          {[79, 121].map((cx) => (
            <path key={cx} d={`M${cx - 15} 86 Q${cx} ${80 - d * 3} ${cx + 15} 86`} />
          ))}
        </g>
      );
    }

    case "contour": {
      return (
        <g stroke={accent} strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.85}>
          <path d="M60 116 Q66 150 100 162" />
          <path d="M140 116 Q134 150 100 162" />
          {[-1, 1].map((side) =>
            [0, 1, 2].map((i) => {
              const x = 100 + side * (36 - i * 8);
              const y = 138 + i * 7;
              return (
                <path
                  key={`${side}${i}`}
                  d={`M${x - 3} ${y} L${x} ${y + 4} L${x + 3} ${y}`}
                />
              );
            }),
          )}
        </g>
      );
    }

    case "deflate": {
      const spots: Zone[] = [
        { cx: 64, cy: 86, rx: 10, ry: 8 },
        { cx: 136, cy: 86, rx: 10, ry: 8 },
        { cx: 74, cy: 118, rx: 12, ry: 10 },
        { cx: 126, cy: 118, rx: 12, ry: 10 },
      ];
      return (
        <g stroke={accent} strokeWidth={1.5} fill="none" opacity={0.85}>
          {spots.map((s, i) => {
            const dir = s.cx < 100 ? 1 : -1;
            const tipX = s.cx + dir * 3;
            const tailX = s.cx + dir * (s.rx - 1);
            return (
              <g key={i}>
                <ellipse cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} strokeDasharray="3 3" />
                <line x1={tailX} y1={s.cy} x2={tipX} y2={s.cy} />
                <path d={`M${tipX + dir * 3} ${s.cy - 3} L${tipX} ${s.cy} L${tipX + dir * 3} ${s.cy + 3}`} />
              </g>
            );
          })}
        </g>
      );
    }

    case "axis": {
      const lean = 1 + d * 0.35;
      return (
        <g opacity={0.85}>
          <g stroke={accent} strokeWidth={1.2} strokeDasharray="4 4" opacity={0.7}>
            <line x1="100" y1="36" x2="100" y2="168" />
            <line x1="56" y1="78" x2="144" y2="78" />
            <line x1="58" y1="138" x2="142" y2="138" />
          </g>
          <circle cx="76" cy="112" r={12 * lean} fill={accent} opacity={0.35} filter={soft} />
          <circle cx="124" cy="112" r={12} fill={accent} opacity={0.35} filter={soft} />
        </g>
      );
    }

    default: {
      // an unknown kind still draws something honest rather than an empty box
      return (
        <g opacity={0.4} filter={soft}>
          <ellipse cx="100" cy="108" rx={26 * (0.6 + d * 0.5)} ry={22 * (0.6 + d * 0.5)} fill={accent} />
        </g>
      );
    }
  }
}
