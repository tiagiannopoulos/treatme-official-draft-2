import { Bookmark } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { BUBBLEGUM, INK } from "@/lib/treatment-catalog";
import { isSaved, removeTreatment, saveTreatment, usePatient } from "@/lib/patient-store";
import { cn } from "@/lib/utils";

/**
 * one save control for stories, library cards and recommendation rows. keeps
 * the toggle from bubbling into whatever it sits on, and asks for an account
 * only when the save actually needs to persist.
 */
export function useSaveTreatment(slug: string) {
  const patient = usePatient();
  const { user, openAuth } = useAuth();
  const saved = isSaved(patient, slug);

  function toggle(hooks?: { onPause?: () => void; onResume?: () => void }) {
    if (saved) {
      removeTreatment(slug);
      return;
    }
    if (!user) {
      hooks?.onPause?.();
      openAuth({
        reason: "make an account to keep your saved treatments.",
        onDone: () => {
          saveTreatment(slug);
          hooks?.onResume?.();
        },
        onDismiss: () => hooks?.onResume?.(),
      });
      return;
    }
    saveTreatment(slug);
  }

  return { saved, toggle };
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
  const { saved, toggle } = useSaveTreatment(slug);
  return (
    <button
      type="button"
      aria-label={saved ? `unsave ${name ?? "treatment"}` : `save ${name ?? "treatment"}`}
      aria-pressed={saved}
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
        className="transition-all duration-300 ease-out"
        style={{
          width: size,
          height: size,
          color: saved ? BUBBLEGUM : INK,
          fill: saved ? BUBBLEGUM : "transparent",
          transform: saved ? "scale(1.08)" : "scale(1)",
        }}
        strokeWidth={2}
      />
    </button>
  );
}
