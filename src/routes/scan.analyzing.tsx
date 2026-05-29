import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useScan } from "@/lib/scan-store";
import type { SkinAnalysis } from "@/lib/skin-analysis";

export const Route = createFileRoute("/scan/analyzing")({
  head: () => ({
    meta: [
      { title: "reading your skin · treatme" },
      { name: "description", content: "analyzing your scan." },
    ],
  }),
  component: AnalyzingPage,
});

function AnalyzingPage() {
  const { photoDataUrl, setAnalysis } = useScan();
  const navigate = useNavigate();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    if (!photoDataUrl) {
      navigate({ to: "/scan" });
      return;
    }
    started.current = true;

    (async () => {
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageDataUrl: photoDataUrl }),
        });
        const json = (await res.json()) as { analysis?: SkinAnalysis; error?: string };
        if (!res.ok || !json.analysis) {
          toast.error(json.error ?? "couldn't get a clear read. try again.");
          navigate({ to: "/scan" });
          return;
        }
        setAnalysis(json.analysis);
        navigate({ to: "/scan/results" });
      } catch (e) {
        console.error(e);
        toast.error("network hiccup. try again.");
        navigate({ to: "/scan" });
      }
    })();
  }, [photoDataUrl, setAnalysis, navigate]);

  return (
    <div className="px-6 pt-10 min-h-[70vh] flex flex-col items-center justify-center text-center">
      <div className="relative size-32">
        <div className="absolute inset-0 rounded-full bg-bubblegum/60 animate-ping" />
        <div className="absolute inset-2 rounded-full bg-bubblegum" />
        <div className="absolute inset-6 rounded-full bg-hot" />
      </div>
      <p className="brand-eyebrow mt-8">analyzing</p>
      <h1 className="brand-display text-[34px] mt-2">reading your skin<span className="text-hot">…</span></h1>
      <p className="mt-3 text-ink-mute text-[14px] max-w-[28ch]">
        13 markers. one honest read. usually 10–20 seconds.
      </p>
    </div>
  );
}
