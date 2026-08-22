import { useCallback, useState } from "react";
import { Bookmark } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth";
import { BUBBLEGUM, INK } from "@/lib/treatment-catalog";
import { JOURNEY_QUERY_KEY, NotSignedInError, journeyQuery, removeJourneyItem, saveJourneyItem } from "@/lib/journey";
import { removeTreatment, saveTreatment } from "@/lib/patient-store";
import { cn } from "@/lib/utils";

/**
 * one save control for stories, library cards and recommendation rows. the
 * icon only fills once journey_items confirms the row, and a failed write
 * puts the icon back where it was.
 */
export function useSaveTreatment(slug: string) {
  const queryClient = useQueryClient();
  const { openAuth } = useAuth();
  const { data: rows = [] } = useQuery(journeyQuery);
  const [pending, setPending] = useState(false);
  const saved = rows.some((r) => r.slug === slug);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: JOURNEY_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: ["getting-started-counts"] });
  }, [queryClient]);

  const run = useCallback(
    async (
      next: "save" | "remove",
      hooks?: { onPause?: () => void; onResume?: () => void },
    ): Promise<void> => {
      setPending(true);
      try {
        if (next === "remove") {
          await removeJourneyItem(slug);
          removeTreatment(slug);
        } else {
          await saveJourneyItem(slug);
          saveTreatment(slug);
        }
        await refresh();
      } catch (error) {
        if (error instanceof NotSignedInError) {
          hooks?.onPause?.();
          openAuth({
            headline: "save this to your profile",
            reason: "sign in so your journey, your scans, and your record stay with you",
            onDone: () => {
              void run(next, hooks).then(() => hooks?.onResume?.());
            },
            onDismiss: () => hooks?.onResume?.(),
          });
          return;
        }
        console.error("save treatment failed", error);
        toast("could not save, try again", { duration: 4000 });
      } finally {
        setPending(false);
      }
    },
    [openAuth, refresh, slug],
  );

  const toggle = useCallback(
    (hooks?: { onPause?: () => void; onResume?: () => void }) => {
      if (pending) return;
      void run(saved ? "remove" : "save", hooks);
    },
    [pending, run, saved],
  );

  return { saved, pending, toggle };
}

export function SaveTreatmentButton({
  slug,
  name,
  size = 20,
  className,
  bg,
  onPause,
  onResume,
}: {
  slug: string;
  name?: string;
  size?: number;
  className?: string;
  /** background behind the icon, so it reads on any slide colour. */
  bg?: string;
  onPause?: () => void;
  onResume?: () => void;
}) {
  const { saved, pending, toggle } = useSaveTreatment(slug);
  return (
    <button
      type="button"
      aria-label={saved ? `unsave ${name ?? "treatment"}` : `save ${name ?? "treatment"}`}
      aria-pressed={saved}
      aria-busy={pending}
      disabled={pending}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle({ onPause, onResume });
      }}
      className={cn("grid place-items-center rounded-full transition-transform active:scale-90", className)}
      style={bg ? { backgroundColor: bg } : undefined}
    >
      <Bookmark
        className={cn("transition-all duration-300 ease-out", pending && "animate-pulse")}
        style={{
          width: size,
          height: size,
          color: saved ? BUBBLEGUM : INK,
          fill: saved ? BUBBLEGUM : "transparent",
          opacity: pending ? 0.5 : 1,
          transform: saved ? "scale(1.08)" : "scale(1)",
        }}
        strokeWidth={2}
      />
    </button>
  );
}
