import { BUBBLEGUM } from "@/lib/treatment-catalog";
import { cn } from "@/lib/utils";

/**
 * 9:16 poster. the segmented track along the top edge is the visual promise
 * that the card opens a story, so it only appears when slides exist.
 */
export function PosterCard({
  name,
  posterUrl,
  accentColor = BUBBLEGUM,
  meta,
  hasStory = false,
  onPress,
  className,
}: {
  name: string;
  posterUrl: string | null;
  accentColor?: string;
  meta?: string;
  hasStory?: boolean;
  onPress: () => void;
  className?: string;
}) {
  const accent = accentColor || BUBBLEGUM;
  return (
    <button
      type="button"
      onClick={onPress}
      className={cn(
        "relative aspect-[9/16] overflow-hidden rounded-[18px] text-left transition-transform active:scale-[0.97]",
        className,
      )}
      style={{ backgroundColor: posterUrl ? "#FCFBF7" : accent }}
    >
      {posterUrl ? (
        <img
          src={posterUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <span
          className="absolute inset-0 grid place-items-center px-3 text-center text-[20px] font-semibold lowercase leading-tight"
          style={{ color: "#111111" }}
        >
          {name}
        </span>
      )}

      {posterUrl && (
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-[45%]"
          style={{ background: "linear-gradient(to bottom, rgba(17,17,17,0), rgba(17,17,17,0.75))" }}
        />
      )}

      {hasStory && (
        <span aria-hidden className="absolute inset-x-0 top-0 flex gap-[2px] p-[3px]">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="h-[2px] flex-1 rounded-full"
              style={{ backgroundColor: "rgba(252,251,247,0.4)" }}
            />
          ))}
        </span>
      )}

      {posterUrl && (
        <span className="absolute inset-x-0 bottom-0 block p-3">
          <span
            className="block text-[15px] font-semibold lowercase leading-tight"
            style={{ color: "#FCFBF7" }}
          >
            {name}
          </span>
          {meta && (
            <span
              className="mt-0.5 block text-[11px] lowercase leading-tight"
              style={{ color: "rgba(252,251,247,0.7)" }}
            >
              {meta}
            </span>
          )}
        </span>
      )}
    </button>
  );
}
