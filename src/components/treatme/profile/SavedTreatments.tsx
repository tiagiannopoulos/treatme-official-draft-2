import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { Bookmark, ChevronRight, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { displayTreatmentName } from "@/lib/treatment-labels";
import { INK, MINT } from "@/lib/treatment-catalog";
import {
  usePatient,
  removeTreatment,
  restoreTreatment,
  type SavedTreatment,
} from "@/lib/patient-store";
import { PillButton } from "@/components/treatme/PillButton";

interface SavedRow {
  slug: string;
  name: string;
  price_from: number | null;
}

const savedPricesQuery = queryOptions({
  queryKey: ["saved-treatment-prices"],
  queryFn: async (): Promise<SavedRow[]> => {
    const { data, error } = await supabase.from("treatments").select("slug, name, price_from");
    if (error) throw error;
    return (data ?? []).map((t) => ({
      slug: t.slug,
      name: displayTreatmentName(t.name, t.slug),
      price_from: t.price_from === null ? null : Number(t.price_from),
    }));
  },
  staleTime: 5 * 60_000,
});

export function SavedTreatments() {
  const navigate = useNavigate();
  const { saved } = usePatient();
  const { data: all = [] } = useQuery(savedPricesQuery);

  const rows = saved
    .map((s) => ({ saved: s, treatment: all.find((t) => t.slug === s.slug) }))
    .filter((r): r is { saved: SavedTreatment; treatment: SavedRow } => Boolean(r.treatment));

  function drop(entry: SavedTreatment, name: string) {
    removeTreatment(entry.slug);
    toast(`removed ${name}`, {
      duration: 4000,
      action: { label: "undo", onClick: () => restoreTreatment(entry) },
    });
  }

  return (
    <section className="mt-8">
      <h2 className="text-[17px] font-semibold lowercase" style={{ color: INK }}>
        saved
      </h2>

      <div
        className="mt-3 overflow-hidden rounded-[18px] border"
        style={{ borderColor: "rgba(17,17,17,0.10)", backgroundColor: "#FFFFFF" }}
      >
        {rows.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-8 text-center">
            <span className="grid size-14 place-items-center rounded-full" style={{ backgroundColor: MINT }}>
              <Bookmark className="size-6" style={{ color: INK }} strokeWidth={1.6} />
            </span>
            <p className="mt-3 text-[15px] font-medium lowercase" style={{ color: INK }}>
              nothing saved yet.
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
          <ul>
            {rows.map(({ saved: entry, treatment }) => (
              <SavedRowItem
                key={entry.slug}
                name={treatment.name}
                priceFrom={treatment.price_from}
                onOpen={() => navigate({ to: "/treatment/$slug/story", params: { slug: entry.slug } })}
                onRemove={() => drop(entry, treatment.name)}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** swipe left or long press to reveal remove. */
function SavedRowItem({
  name,
  priceFrom,
  onOpen,
  onRemove,
}: {
  name: string;
  priceFrom: number | null;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const [offset, setOffset] = useState(0);
  const startX = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const open = offset < -40;

  function clearHold() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }

  return (
    <li className="relative border-b last:border-b-0" style={{ borderColor: "rgba(17,17,17,0.08)" }}>
      <button
        type="button"
        aria-label={`remove ${name}`}
        onClick={() => {
          setOffset(0);
          onRemove();
        }}
        className="absolute inset-y-0 right-0 grid w-[84px] place-items-center"
        style={{ backgroundColor: "#F8A1C6" }}
      >
        <Trash2 className="size-4" style={{ color: INK }} strokeWidth={2} />
      </button>

      <button
        type="button"
        onPointerDown={(e) => {
          startX.current = e.clientX;
          clearHold();
          timer.current = setTimeout(() => setOffset(-84), 500);
        }}
        onPointerMove={(e) => {
          if (startX.current === null) return;
          const dx = e.clientX - startX.current;
          if (Math.abs(dx) > 6) clearHold();
          if (dx < 0) setOffset(Math.max(-84, dx));
        }}
        onPointerUp={(e) => {
          clearHold();
          const start = startX.current;
          startX.current = null;
          const dx = start === null ? 0 : e.clientX - start;
          if (dx < -50) {
            setOffset(-84);
            return;
          }
          setOffset(0);
          if (Math.abs(dx) < 10 && !open) onOpen();
        }}
        onPointerCancel={() => {
          clearHold();
          startX.current = null;
          setOffset(0);
        }}
        className="relative flex w-full items-center gap-3 px-4 py-4 text-left transition-transform"
        style={{ transform: `translateX(${offset}px)`, backgroundColor: "#FFFFFF" }}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold lowercase leading-tight" style={{ color: INK }}>
            {name}
          </span>
          <span className="mt-0.5 block text-[12px] lowercase" style={{ color: "rgba(17,17,17,0.55)" }}>
            {priceFrom !== null ? `from $${Math.round(priceFrom)}` : "price varies"}
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0" style={{ color: "rgba(17,17,17,0.4)" }} />
      </button>
    </li>
  );
}
