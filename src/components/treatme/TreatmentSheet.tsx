import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Play } from "lucide-react";

import { TreatmentIcon } from "@/components/treatme/TreatmentIcon";
import { ClinicsOffering } from "@/components/treatme/ClinicsOffering";
import { ProviderCard } from "@/components/treatme/ProviderCard";
import { treatmentCatalogQuery } from "@/lib/treatment-catalog";
import { directoryQuery } from "@/lib/search-data";
import { useNearbyKm } from "@/lib/nearby";

/** bottom sheet version of a treatment. the short read, with one door to the story. */
export function TreatmentSheet({ slug, onClose }: { slug: string; onClose: () => void }) {
  const navigate = useNavigate();
  const { data: catalog = [] } = useQuery(treatmentCatalogQuery);
  const { data: directory } = useQuery(directoryQuery);
  const near = useNearbyKm();
  const treatment = catalog.find((t) => t.slug === slug);

  const [full, setFull] = useState(false);
  const [dragY, setDragY] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const providers = useMemo(() => {
    if (!directory) return [];
    return directory.providers
      .filter((p) => p.treatments.some((t) => t.treatment_slug === slug))
      .slice(0, 5);
  }, [directory, slug]);

  function toSearch() {
    navigate({ to: "/search", search: { q: undefined, scope: "medspas", treatment: slug } });
  }

  function onPointerDown(e: ReactPointerEvent) {
    startRef.current = e.clientY;
  }
  function onPointerMove(e: ReactPointerEvent) {
    if (startRef.current === null) return;
    const dy = e.clientY - startRef.current;
    setDragY(Math.max(-40, dy));
  }
  function onPointerUp() {
    if (dragY > 110) onClose();
    else if (dragY < -20) setFull(true);
    setDragY(0);
    startRef.current = null;
  }

  return (
    <div className="fixed inset-0 z-[120] flex flex-col justify-end">
      <button
        type="button"
        aria-label="dismiss"
        onClick={onClose}
        className="absolute inset-0 bg-ink/40"
      />
      <div
        className="relative w-full overflow-y-auto rounded-t-[24px] bg-white pb-10"
        style={{
          height: full ? "94vh" : "75vh",
          transform: `translateY(${Math.max(dragY, 0)}px)`,
          transition:
            startRef.current === null ? "transform 200ms ease, height 200ms ease" : "none",
        }}
      >
        <div
          className="sticky top-0 z-10 flex touch-none justify-center bg-white pb-2 pt-3"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <span className="h-1 w-10 rounded-full bg-ink/15" />
        </div>

        {!treatment ? (
          <div className="px-5 pt-6 text-[14px] lowercase text-ink/60">loading treatment...</div>
        ) : (
          <div className="px-5">
            <div className="flex items-center gap-3">
              <TreatmentIcon
                name={treatment.name}
                iconUrl={treatment.icon_url}
                accentColor={treatment.accent_color}
                showLabel={false}
              />
              <div className="min-w-0">
                <h2 className="text-[22px] font-semibold lowercase leading-tight text-ink">
                  {treatment.name}
                </h2>
                <p className="mt-0.5 text-[13px] lowercase text-ink/60">
                  {treatment.downtime_label} downtime
                </p>
              </div>
            </div>

            <p className="mt-4 text-[15px] leading-relaxed lowercase text-ink/80">
              {treatment.blurb}
            </p>

            {treatment.has_story && (
              <button
                type="button"
                onClick={() =>
                  navigate({ to: "/treatment/$slug/story", params: { slug: treatment.slug } })
                }
                className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-pill text-[15px] font-semibold lowercase text-ink"
                style={{ backgroundColor: "#DFFFF8" }}
              >
                <Play className="size-4" strokeWidth={2.2} />
                learn more
              </button>
            )}

            <section className="mt-7">
              <p className="brand-eyebrow">providers who offer this</p>
              <div className="mt-3 space-y-2.5">
                {providers.length === 0 ? (
                  <p className="text-[13px] lowercase text-ink/55">
                    no verified provider has listed this yet. search nearby to ask.
                  </p>
                ) : (
                  providers.map((p) => (
                    <ProviderCard
                      key={p.id}
                      provider={p}
                      km={p.storefronts[0] ? near.kmFor(p.storefronts[0].id) : null}
                      shops={p.storefronts}
                    />
                  ))
                )}
              </div>
            </section>

            <ClinicsOffering slug={treatment.slug} />

            <button
              type="button"
              onClick={toSearch}
              className="mt-6 w-full text-center text-[14px] font-semibold lowercase text-ink underline"
            >
              find a clinic
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** mounted once at the root so any tab can raise the sheet. */
export function TreatmentSheetHost({
  slug,
  onClose,
}: {
  slug: string | null;
  onClose: () => void;
}) {
  if (!slug) return null;
  return <TreatmentSheet slug={slug} onClose={onClose} />;
}
