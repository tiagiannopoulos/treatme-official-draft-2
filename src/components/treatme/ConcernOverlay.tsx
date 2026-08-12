import { useMemo } from "react";
import type { Landmark } from "@/lib/facemesh";
import {
  CONCERN_OVERLAY,
  CONCERN_REGIONS,
  DEFAULT_FACE_BOX,
  faceBoxFromLandmarks,
  type Shape,
} from "@/lib/scan-overlay";

interface Props {
  /** canonical concern key, e.g. "dark_circles" */
  concernKey: string;
  /** tint for the concern's band */
  tint: string;
  landmarks?: Landmark[] | null;
  /** per-region health scores; lower score paints heavier */
  regionScores?: Record<string, number> | null;
  /** when set, only these region keys are drawn */
  regionFilter?: string[] | null;
}

/** maps a face-local (0..100) coordinate into photo space (0..100) */
function place(box: { x: number; y: number; w: number; h: number }) {
  return {
    px: (v: number) => (box.x + (v / 100) * box.w) * 100,
    py: (v: number) => (box.y + (v / 100) * box.h) * 100,
    sx: (v: number) => (v / 100) * box.w * 100,
    sy: (v: number) => (v / 100) * box.h * 100,
  };
}

/** rewrites a face-local path so it lands inside the face box */
function mapPath(d: string, t: ReturnType<typeof place>) {
  const numbers = d.match(/-?\d*\.?\d+|[A-Za-z]/g) ?? [];
  let out = "";
  let axis = 0;
  let cmd = "M";
  for (const token of numbers) {
    if (/[A-Za-z]/.test(token)) {
      cmd = token;
      axis = 0;
      out += `${token} `;
      continue;
    }
    const n = Number(token);
    if (cmd === "V") out += `${t.py(n).toFixed(2)} `;
    else if (cmd === "H") out += `${t.px(n).toFixed(2)} `;
    else {
      out += `${(axis % 2 === 0 ? t.px(n) : t.py(n)).toFixed(2)} `;
      axis += 1;
    }
  }
  return out.trim();
}

/** how hard to paint a region: worse score = stronger */
function intensity(score: number | undefined, filled: boolean) {
  const severity = score === undefined ? 55 : Math.max(0, Math.min(100, 100 - score));
  const base = filled ? 0.16 : 0.5;
  const span = filled ? 0.5 : 0.5;
  return base + (severity / 100) * span;
}

export function ConcernOverlay({ concernKey, tint, landmarks, regionScores, regionFilter }: Props) {
  const spec = CONCERN_OVERLAY[concernKey];
  const box = useMemo(
    () => (landmarks?.length ? faceBoxFromLandmarks(landmarks) : DEFAULT_FACE_BOX),
    [landmarks],
  );

  if (!spec) return null;
  const t = place(box);
  const filled = spec.mode === "filled";

  const regions = CONCERN_REGIONS[concernKey];
  const groups: { key: string; shapes: Shape[]; opacity: number }[] = regions
    ? regions
        .filter((r) => !regionFilter?.length || regionFilter.includes(r.key))
        .map((r) => ({
          key: r.key,
          shapes: r.shapes,
          opacity: intensity(regionScores?.[r.key], filled),
        }))
    : [{ key: "all", shapes: spec.shapes, opacity: filled ? 0.42 : 0.95 }];

  const render = (shape: Shape, i: number, opacity: number) => {
    if (shape.kind === "ellipse") {
      return (
        <ellipse
          key={i}
          cx={t.px(shape.cx)}
          cy={t.py(shape.cy)}
          rx={t.sx(shape.rx)}
          ry={t.sy(shape.ry)}
          fill={filled ? tint : "none"}
          stroke={filled ? "none" : tint}
          strokeWidth={spec.mode === "outline" ? 1.1 : 0.9}
          opacity={opacity}
        />
      );
    }
    return (
      <path
        key={i}
        d={mapPath(shape.d, t)}
        fill={filled ? tint : "none"}
        stroke={filled ? "none" : tint}
        strokeWidth={0.9}
        strokeLinecap="round"
        opacity={opacity}
      />
    );
  };

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
    >
      {groups.map((g) => (
        <g key={g.key} style={filled ? { filter: "blur(0.6px)" } : undefined}>
          {g.shapes.map((shape, i) => render(shape, i, g.opacity))}
        </g>
      ))}
    </svg>
  );
}
