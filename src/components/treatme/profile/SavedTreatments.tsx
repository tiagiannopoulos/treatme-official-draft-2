import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bookmark } from "lucide-react";
import { toast } from "sonner";

import { PosterCard } from "@/components/treatme/PosterCard";
import { treatmentCatalogQuery, INK, MINT } from "@/lib/treatment-catalog";
import {
  usePatient,
  removeTreatment,
  restoreTreatment,
  setTreatmentStatus,
  JOURNEY_STATUSES,
  type JourneyStatus,
  type SavedTreatment,
} from "@/lib/patient-store";
import { PillButton } from "@/components/treatme/PillButton";

export function SavedTreatments() {
  const navigate = useNavigate();
  const { saved } = usePatient();
  const { data: catalog = [] } = useQuery(treatmentCatalogQuery);
  const [pressing, setPressing] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rows = saved
    .map((s) => ({ saved: s, treatment: catalog.find((t) => t.slug === s.slug) }))
    .filter((r): r is { saved: SavedTreatment; treatment: NonNullable<typeof r.treatment> } => Boolean(r.treatment));

  function drop(entry: SavedTreatment, name: string) {
    removeTreatment(entry.slug);
    toast(`removed ${name}`, {
      duration: 4000,
      action: { label: "undo", onClick: () => restoreTreatment(entry) },
    });
  }

  function startPress(entry: SavedTreatment, name: string) {
    setPressing(entry.slug);
    timer.current = setTimeout(() => {
      setPressing(null);
      drop(entry, name);
    }, 550);
  }

  function endPress() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setPressing(null);
  }

  return (
    <section className="mt-8">
      <h2 className="text-[17px] font-semibold lowercase" style={{ color: INK }}>
        saved treatments
      </h2>

      <div
        className="mt-3 rounded-[18px] border p-4"
        style={{ borderColor: "rgba(17,17,17,0.10)", backgroundColor: "#FFFFFF" }}
      >
        {rows.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-center">
            <span className="grid size-14 place-items-center rounded-full" style={{ backgroundColor: MINT }}>
              <Bookmark className="size-6" style={{ color: INK }} strokeWidth={1.6} />
            </span>
            <p className="mt-3 text-[15px] font-medium lowercase" style={{ color: INK }}>
              nothing saved yet
            </p>
            <p className="mt-1 max-w-[260px] text-[12.5px] lowercase leading-snug" style={{ color: "rgba(17,17,17,0.55)" }}>
              tap the bookmark on any treatment to keep it here
            </p>
            <PillButton
              className="mt-4 h-10 px-5 text-[13px]"
              variant="outline"
              onClick={() => navigate({ to: "/treatments" })}
            >
              browse treatments
            </PillButton>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {rows.map(({ saved: entry, treatment }) => (
              <div
                key={entry.slug}
                className="relative transition-opacity"
                style={{ opacity: pressing === entry.slug ? 0.6 : 1 }}
                onPointerDown={() => startPress(entry, treatment.name)}
                onPointerUp={endPress}
                onPointerLeave={endPress}
                onContextMenu={(e) => e.preventDefault()}
              >
                <PosterCard
                  name={treatment.name}
                  posterUrl={treatment.poster_url}
                  accentColor={treatment.accent_color}
                  meta={treatment.downtime_label || undefined}
                  hasStory={treatment.has_story}
                  onPress={() => navigate({ to: "/treatment/$slug", params: { slug: entry.slug } })}
                  className="w-full"
                />
                <StatusPill entry={entry} />
                <button
                  type="button"
                  aria-label={`remove ${treatment.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    drop(entry, treatment.name);
                  }}
                  className="absolute right-2 top-2 grid size-7 place-items-center rounded-full"
                  style={{ backgroundColor: "rgba(252,251,247,0.92)" }}
                >
                  <Bookmark className="size-[14px]" style={{ color: "#FF1F87" }} fill="#FF1F87" strokeWidth={1.6} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

const STATUS_TINT: Record<JourneyStatus, string> = {
  curious: "#FCFBF7",
  planning: "#DFFFF8",
  booked: "#F8A1C6",
  done: "#FFEDB4",
};

function StatusPill({ entry }: { entry: SavedTreatment }) {
  const status: JourneyStatus = entry.status ?? "curious";
  return (
    <button
      type="button"
      aria-label={`status ${status}, tap to change`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        const next = JOURNEY_STATUSES[(JOURNEY_STATUSES.indexOf(status) + 1) % JOURNEY_STATUSES.length];
        setTreatmentStatus(entry.slug, next);
      }}
      className="mt-2 rounded-full px-2.5 py-1 text-[11px] lowercase"
      style={{ backgroundColor: STATUS_TINT[status], border: "1px solid rgba(17,17,17,0.10)", color: "#111111" }}
    >
      {status}
    </button>
  );
}
