import { useEffect, useState, type ReactNode } from "react";

import type { ScanPhotoSource } from "@/lib/scan-photo";

/**
 * renders a scan photo from a signed url, with children (overlays) on top.
 * the photo never blocks the screen around it: while the url is still being
 * signed it shows a soft skeleton, the image fades in when it arrives, and a
 * missing or broken url shows the cream "photo unavailable" card.
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
  const [shown, setShown] = useState(false);

  useEffect(() => {
    setBroken(false);
    setShown(false);
  }, [source.url]);

  // no url and no reason yet means we are still signing it
  const pending = !source.url && !source.reason && !broken;
  const unavailable = (!source.url && Boolean(source.reason)) || broken;

  useEffect(() => {
    if (!source.url && source.reason) {
      console.warn(`[treatme] scan photo unavailable: ${source.reason}`);
    }
  }, [source.url, source.reason]);

  if (pending) {
    return (
      <div
        className={`animate-pulse border border-ink/10 ${className}`}
        style={{ backgroundColor: "#F1F0ED", position: "relative" }}
        aria-hidden="true"
      />
    );
  }

  if (unavailable) {
    return (
      <div
        className={`grid place-items-center border border-ink/10 ${className}`}
        style={{ backgroundColor: "#FCFBF7", position: "relative" }}
      >
        <p className="text-[13px] lowercase text-ink/50">photo unavailable</p>
      </div>
    );
  }

  return (
    <div
      className={`overflow-hidden ${className}`}
      style={{ backgroundColor: "#FCFBF7", position: "relative" }}
    >
      <img
        src={source.url ?? undefined}
        alt={alt}
        decoding="async"
        loading="lazy"
        onLoad={() => setShown(true)}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
          shown ? "opacity-100" : "opacity-0"
        }`}
        onError={() => {
          console.warn("[treatme] scan photo failed to load, signed url may have expired");
          setBroken(true);
        }}
      />
      {children}
    </div>
  );
}
