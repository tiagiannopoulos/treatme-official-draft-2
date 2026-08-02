import { BUBBLEGUM } from "@/lib/treatment-catalog";
import { cn } from "@/lib/utils";

/**
 * 64px treatment identity mark. the accent overlay in multiply is what makes
 * photos from different shoots read as one family. it is never skipped.
 */
export function TreatmentIcon({
  name,
  iconUrl,
  accentColor = BUBBLEGUM,
  showLabel = true,
  className,
}: {
  name: string;
  iconUrl: string | null;
  accentColor?: string;
  showLabel?: boolean;
  className?: string;
}) {
  const accent = accentColor || BUBBLEGUM;
  return (
    <span className={cn("flex w-16 flex-col items-center gap-1.5", className)}>
      <span
        className="relative size-16 shrink-0 overflow-hidden rounded-full"
        style={{
          backgroundColor: iconUrl ? "#FCFBF7" : `${accent}33`,
          border: "1px solid rgba(17,17,17,0.08)",
        }}
      >
        {iconUrl ? (
          <>
            <img
              src={iconUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 size-full object-cover"
            />
            <span
              aria-hidden
              className="absolute inset-0"
              style={{ backgroundColor: accent, opacity: 0.25, mixBlendMode: "multiply" }}
            />
          </>
        ) : (
          <span
            className="absolute inset-0 grid place-items-center text-[24px] font-semibold lowercase"
            style={{ color: "#111111" }}
          >
            {name.trim().charAt(0).toLowerCase()}
          </span>
        )}
      </span>
      {showLabel && (
        <span className="line-clamp-2 text-center text-[12px] leading-tight lowercase text-ink">
          {name}
        </span>
      )}
    </span>
  );
}
