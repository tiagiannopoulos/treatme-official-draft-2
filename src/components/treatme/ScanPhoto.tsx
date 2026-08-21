import { useEffect, useState, type ReactNode } from "react";

import type { ScanPhotoSource } from "@/lib/scan-photo";

/**
 * renders a scan photo from a signed url, with children (overlays) on top.
 * never leaves an empty grey box: when there is no url, or the url fails to
 * load, it shows the cream "photo unavailable" card and logs why.
 */
export function ScanPhoto({
  source,
  alt = "your scan photo",
  className = "",
  children,
}: {
  source: ScanPhotoSource;
  alt?: string;
  className?: string;
  children?: ReactNode;
}) {
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [source.url]);

  const unavailable = !source.url || broken;

  useEffect(() => {
    if (!source.url && source.reason) {
      console.warn(`[treatme] scan photo unavailable: ${source.reason}`);
    }
  }, [source.url, source.reason]);

  if (unavailable) {
    return (
      <div
        className={`grid place-items-center border border-ink/10 ${className}`}
        style={{ backgroundColor: "#FCFBF7" }}
      >
        <p className="text-[13px] lowercase text-ink/50">photo unavailable</p>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ backgroundColor: "#FCFBF7" }}>
      <img
        src={source.url ?? undefined}
        alt={alt}
        className="absolute inset-0 h-full w-full object-cover"
        onError={() => {
          console.warn("[treatme] scan photo failed to load, signed url may have expired");
          setBroken(true);
        }}
      />
      {children}
    </div>
  );
}
