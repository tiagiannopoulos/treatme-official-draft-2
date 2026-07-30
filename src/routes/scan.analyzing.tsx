import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useScan } from "@/lib/scan-store";
import { analyze, topConcerns, ANALYSIS_MIN_MS } from "@/lib/skinAnalysis";
import { getRecommendations } from "@/lib/recommendations";
import { uploadScanPhoto } from "@/lib/scan-photo";

export const Route = createFileRoute("/scan/analyzing")({
  head: () => ({
    meta: [
      { title: "reading your skin · treatme" },
      { name: "description", content: "your scan is being read, marker by marker." },
      { property: "og:title", content: "reading your skin · treatme" },
      { property: "og:description", content: "your scan is being read, marker by marker." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AnalyzingPage,
});

const STEPS = [
  "checking the light",
  "mapping your face",
  "reading 15 markers",
  "matching treatments",
];

function AnalyzingPage() {
  const { photoDataUrl, setResult, setPhotoPath } = useScan();
  const navigate = useNavigate();
  const started = useRef(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % STEPS.length), ANALYSIS_MIN_MS / STEPS.length);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (started.current) return;
    if (!photoDataUrl) {
      navigate({ to: "/scan" });
      return;
    }
    started.current = true;

    (async () => {
      const hold = new Promise((r) => setTimeout(r, ANALYSIS_MIN_MS));
      try {
        const storagePath = await uploadScanPhoto(photoDataUrl).catch(() => null);
        setPhotoPath(storagePath);

        const result = await analyze([{ dataUrl: photoDataUrl, storagePath }]);
        if (!result.image_quality.ok) {
          await hold;
          toast.error("that photo was hard to read. try again in better light.");
          navigate({ to: "/scan" });
          return;
        }

        const concerns = topConcerns(result);
        const { scanDriven } = await getRecommendations(concerns);

        await hold;
        setResult(result, scanDriven);
        navigate({ to: "/scan/results" });
      } catch (e) {
        console.error(e);
        await hold;
        toast.error("couldn't finish that scan. try again.");
        navigate({ to: "/scan" });
      }
    })();
  }, [photoDataUrl, setResult, setPhotoPath, navigate]);

  return (
    <div className="px-6 pt-10 min-h-[70vh] flex flex-col items-center justify-center text-center">
      <div className="relative size-32">
        <div className="absolute inset-0 rounded-full bg-bubblegum/60 animate-ping" />
        <div className="absolute inset-2 rounded-full bg-bubblegum" />
        <div className="absolute inset-6 rounded-full bg-hot" />
      </div>
      <p className="brand-eyebrow mt-8">analyzing</p>
      <h1 className="brand-display text-[34px] mt-2">reading your skin<span className="text-hot">…</span></h1>
      <p className="mt-3 text-ink-mute text-[14px] max-w-[28ch]">{STEPS[step]}</p>
    </div>
  );
}
