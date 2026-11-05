import { useEffect, useId, useMemo, useState } from "react";
import {
  CONCERN_KEYS,
  CONCERN_LABELS,
  type ConcernKey,
} from "@/features/muse/concerns";
import { loadImage, type Landmark } from "@/features/muse/face-landmarks";
import { buildGeom, makeProjector, renderConcern } from "./face-overlays";

/**
 * toggleable per-concern face map.
 *
 * markings come from the actual analysis result only: a concern is never
 * rendered when its score is >= 90. "all" shows every concern scoring < 90.
 * positions use facelandmarker anchors when landmarks exist, else the
 * fractional fallback zones.
 */

export function FaceMap({
  photo,
  scores,
  landmarks = null,
}: {
  photo: string;
  scores: Partial<Record<ConcernKey, number>>;
  landmarks?: Landmark[] | null;
}) {
  const [active, setActive] = useState<ConcernKey | "all">("all");
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");

  useEffect(() => {
    let cancelled = false;
    setImgSize(null);
    loadImage(photo).then((img) => {
      if (!cancelled && img) {
        setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [photo]);

  const project = useMemo(
    () => (imgSize ? makeProjector(imgSize.w, imgSize.h) : null),
    [imgSize],
  );
  const geom = useMemo(
    () => buildGeom(landmarks ?? null, project),
    [landmarks, project],
  );

  const flagged = useMemo(
    () => CONCERN_KEYS.filter((k) => (scores[k] ?? 100) < 90),
    [scores],
  );
  const visible =
    active === "all" ? flagged : flagged.includes(active) ? [active] : [];

  const overlays = useMemo(
    () =>
      visible.map((k) => renderConcern(k, scores[k] ?? 100, geom, uid)),
    [visible, scores, geom, uid],
  );

  return (
    <div>
      <div className="tm-chip-row mb-3">
        <button
          className="tm-chip"
          data-active={active === "all"}
          onClick={() => setActive("all")}
        >
          all
        </button>
        {flagged.map((k) => (
          <button
            key={k}
            className="tm-chip"
            data-active={active === k}
            onClick={() => setActive(active === k ? "all" : k)}
          >
            {CONCERN_LABELS[k]} · {scores[k]}
          </button>
        ))}
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-line bg-ink">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo}
          alt="your scan photo with skin markings"
          className="block aspect-[3/4] w-full object-cover"
        />
        <svg
          viewBox="0 0 75 100"
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden
        >
          {overlays}
        </svg>
      </div>

      {flagged.length === 0 && (
        <p className="mt-3 text-center text-sm text-ink-mute">
          nothing to flag — looking clear across the board.
        </p>
      )}
    </div>
  );
}
