import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { fetchScanPdf, shareOrDownloadPdf } from "@/lib/scan-pdf";
import type { SkinAnalysis } from "@/lib/skin-analysis";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scanId: string | null;
  analysis: SkinAnalysis | null;
}

type Pending = "without" | "with" | null;

/** the small sheet behind "download my results" */
export function SharePdfSheet({ open, onOpenChange, scanId, analysis }: Props) {
  const [pending, setPending] = useState<Pending>(null);
  const [failed, setFailed] = useState<Pending>(null);

  const run = async (which: Exclude<Pending, null>) => {
    if (!scanId || pending) return;
    setPending(which);
    setFailed(null);
    try {
      const file = await fetchScanPdf({ scanId, includePhoto: which === "with", analysis });
      await shareOrDownloadPdf(file);
      onOpenChange(false);
    } catch {
      setFailed(which);
    } finally {
      setPending(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-cream border-ink/10 rounded-t-3xl px-6 pb-10 pt-6">
        <SheetHeader className="p-0 text-left">
          <SheetTitle className="brand-display text-[24px] lowercase">share my results.</SheetTitle>
        </SheetHeader>

        <p className="mt-2 text-[13px] leading-snug text-ink-mute lowercase">
          your scan is a photo of your face. we default to sharing without it.
        </p>

        <div className="mt-5 space-y-3">
          <button
            type="button"
            onClick={() => run("without")}
            disabled={pending !== null || !scanId}
            className="w-full h-12 rounded-full bg-ink text-cream text-[15px] font-semibold lowercase flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {pending === "without" && <Loader2 className="size-4 animate-spin" />}
            {pending === "without" ? "building your pdf" : "share without my photo"}
          </button>

          <button
            type="button"
            onClick={() => run("with")}
            disabled={pending !== null || !scanId}
            className="w-full h-12 rounded-full border border-ink/25 text-ink text-[15px] font-semibold lowercase flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {pending === "with" && <Loader2 className="size-4 animate-spin" />}
            {pending === "with" ? "building your pdf" : "share with my photo"}
          </button>
        </div>

        {!scanId && (
          <p className="mt-4 text-[13px] text-ink-mute lowercase">
            we couldn't find a saved scan to share. run a new scan and it'll be here.
          </p>
        )}

        {failed && (
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-[13px] text-ink lowercase">couldn't build that. try again?</p>
            <button
              type="button"
              onClick={() => run(failed)}
              className="shrink-0 rounded-full border border-ink/25 px-4 h-9 text-[13px] font-semibold lowercase"
            >
              retry
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
