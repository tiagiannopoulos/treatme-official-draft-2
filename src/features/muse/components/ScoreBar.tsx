import { bandFor, type Band } from "@/features/muse/concerns";

const BAND_STYLES: Record<Band, { text: string; bar: string; bg: string }> = {
  great: { text: "text-emerald-700", bar: "bg-emerald-500", bg: "bg-emerald-50" },
  good: { text: "text-ink", bar: "bg-ink", bg: "bg-mist" },
  average: { text: "text-amber-700", bar: "bg-amber-400", bg: "bg-amber-50" },
  "focus here": { text: "text-hot-deep", bar: "bg-hot", bg: "bg-hot-soft" },
};

export function BandBadge({ score }: { score: number }) {
  const band = bandFor(score);
  const s = BAND_STYLES[band];
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold lowercase ${s.bg} ${s.text}`}
    >
      {band}
    </span>
  );
}

export function ScoreBar({
  score,
  label,
  blurb,
}: {
  score: number;
  label: string;
  blurb?: string;
}) {
  const band = bandFor(score);
  const s = BAND_STYLES[band];
  return (
    <div className="py-3">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="font-semibold lowercase">{label}</p>
          {blurb && <p className="mt-0.5 text-sm lowercase text-ink-mute">{blurb}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-lg font-bold tabular-nums">{score}</span>
          <BandBadge score={score} />
        </div>
      </div>
      <div className="score-track mt-2">
        <div className={`score-fill ${s.bar}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}
