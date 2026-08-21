import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { PillButton } from "@/components/treatme/PillButton";
import { useScan } from "@/lib/scan-store";
import { topConcerns } from "@/lib/skinAnalysis";
import { resultFromAnalysis } from "@/lib/skinAnalysis/fromAnalysis";
import { getRecommendations } from "@/lib/recommendations";
import { uploadScanPhoto } from "@/lib/scan-photo";
import { landmarksFromDataUrl } from "@/lib/facemesh";
import { saveScan } from "@/lib/scan-persist";
import { AnalysisSchema, type SkinAnalysis } from "@/lib/skin-analysis";
import { updateProfile, type Fitzpatrick } from "@/lib/patient-store";
import { SCAN_CONCERN_LABEL } from "@/lib/scan-concerns";

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

const FACTS = [
  "your skin replaces itself roughly every 28 days.",
  "collagen starts slowing down in your mid twenties.",
  "sunscreen is the closest thing to an anti aging treatment.",
  "dehydrated skin can still be oily. they're different things.",
  "pore size is mostly genetic. how clear they look isn't.",
  "most injectables settle in around two weeks.",
  "your skin barrier repairs itself fastest while you sleep.",
];

/** the stage line changes so a slow read never feels stuck */
const STAGES = [
  "reading your photo",
  "looking at texture and tone",
  "checking hydration and pores",
  "almost there",
];

const TIMEOUT_MS = 60_000;
const RETRY_DELAYS = [2000, 5000];

type Phase = "working" | "quality" | "timeout" | "failed";
type Failure = "face" | "image" | "service";

const FAILURE_COPY: Record<Failure, string> = {
  face: "we could not find a face in that one. try again in better light, facing the camera.",
  image: "that photo did not upload properly. try taking a new one.",
  service: "our end had a problem. try again in a moment.",
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function useRotator(items: string[], active: boolean, everyMs: number) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setI((n) => (n + 1) % items.length), everyMs);
    return () => clearInterval(id);
  }, [active, everyMs, items.length]);
  return items[Math.min(i, items.length - 1)]!;
}

function AnalyzingPage() {
  const navigate = useNavigate();
  const { photoDataUrl, goals, storePhoto, setResult, setAnalysis, setPhotoPath, setScanMeta, setLandmarks, setScanId } = useScan();

  const started = useRef(false);
  const [phase, setPhase] = useState<Phase>("working");
  const [progress, setProgress] = useState(6);
  const pending = useRef<{ analysis: SkinAnalysis } | null>(null);
  const fact = useFactRotator(phase === "working");

  // progress creeps toward 92 and completes when we navigate
  useEffect(() => {
    if (phase !== "working") return;
    const id = setInterval(() => setProgress((p) => (p < 92 ? p + Math.max(1, (92 - p) / 12) : p)), 320);
    return () => clearInterval(id);
  }, [phase]);

  const finish = useCallback(
    async (analysis: SkinAnalysis, photoPath: string | null, landmarks: Awaited<ReturnType<typeof landmarksFromDataUrl>>) => {
      const result = resultFromAnalysis(analysis, crypto.randomUUID());
      const concerns = topConcerns(result);
      // write the read back into the patient profile so the rest of the app
      // (fitzpatrick filtering, "working on") reflects this scan.
      updateProfile({
        skinType: analysis.fitzpatrick.toLowerCase() as Fitzpatrick,
        workingOn: concerns.map((k) => SCAN_CONCERN_LABEL[k] ?? k).slice(0, 5),
      });
      const { scanDriven, goalDriven } = await getRecommendations(concerns, goals);

      const scanId = await saveScan({
        photoPath,
        storePhoto,
        landmarks,
        result,
        photoQuality: analysis.photoQuality,
        medicalFlag: analysis.medicalFlag,
        analysis,
      });

      setScanId(scanId);
      setLandmarks(landmarks);
      setAnalysis(analysis);
      setScanMeta({ medicalFlag: analysis.medicalFlag, photoQuality: analysis.photoQuality });
      setProgress(100);
      setResult(result, scanDriven, goalDriven);
      navigate({ to: "/scan/results" });
    },
    [goals, navigate, setAnalysis, setLandmarks, setResult, setScanMeta, setScanId, storePhoto],
  );

  const run = useCallback(async () => {
    if (!photoDataUrl) {
      navigate({ to: "/scan" });
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const [landmarks, photoPath] = await Promise.all([
        landmarksFromDataUrl(photoDataUrl),
        storePhoto ? uploadScanPhoto(photoDataUrl).catch(() => null) : Promise.resolve(null),
      ]);
      setPhotoPath(photoPath);

      const res = await fetch("/api/public/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: photoDataUrl }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error("analysis_failed");

      const json = (await res.json()) as { analysis?: unknown };
      const analysis = AnalysisSchema.parse(json.analysis);

      if (analysis.photoQuality === "poor") {
        pending.current = { analysis };
        pendingMeta.current = { photoPath, landmarks };
        setPhase("quality");
        return;
      }

      await finish(analysis, photoPath, landmarks);
    } catch (err) {
      clearTimeout(timer);
      const aborted = err instanceof DOMException && err.name === "AbortError";
      console.error("scan analysis failed", err);
      setPhase(aborted ? "timeout" : "failed");
    }
  }, [finish, navigate, photoDataUrl, setPhotoPath, storePhoto]);

  const pendingMeta = useRef<{ photoPath: string | null; landmarks: Awaited<ReturnType<typeof landmarksFromDataUrl>> }>({
    photoPath: null,
    landmarks: null,
  });

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void run();
  }, [run]);

  const useAnyway = () => {
    const held = pending.current;
    if (!held) return;
    setPhase("working");
    void finish(held.analysis, pendingMeta.current.photoPath, pendingMeta.current.landmarks);
  };

  const retake = () => navigate({ to: "/scan/capture" });

  return (
    <div className="px-6 pt-8 pb-10 min-h-[calc(100vh-3.5rem-5.5rem)] flex flex-col">
      <div className="relative rounded-3xl overflow-hidden bg-ink aspect-[4/5]">
        {photoDataUrl && (
          <img src={photoDataUrl} alt="your scan photo" className="absolute inset-0 w-full h-full object-cover" />
        )}
        {phase === "working" && (
          <>
            <div className="absolute inset-0 bg-ink/25" />
            <div className="absolute inset-x-0 h-[38%] scan-sweep bg-gradient-to-b from-transparent via-cream/45 to-transparent" />
          </>
        )}
      </div>

      {phase === "working" && (
        <div className="mt-7">
          <p className="brand-eyebrow">analyzing</p>
          <h1 className="brand-display text-[30px] mt-2">analyzing your skin<span className="text-hot">…</span></h1>
          <div className="mt-5 h-1.5 rounded-full bg-ink/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-ink transition-[width] duration-300"
              style={{ width: `${Math.round(progress)}%` }}
            />
          </div>
          <p className="mt-4 text-[13px] text-ink-mute">{fact}</p>
        </div>
      )}

      {phase === "quality" && (
        <div className="mt-7">
          <h1 className="brand-display text-[28px]">the lighting made that hard to read. want to retake?</h1>
          <div className="mt-6 space-y-3">
            <PillButton fullWidth onClick={retake}>
              retake
            </PillButton>
            <PillButton fullWidth variant="outline" onClick={useAnyway}>
              use it anyway
            </PillButton>
          </div>
        </div>
      )}

      {(phase === "timeout" || phase === "failed") && (
        <div className="mt-7">
          <h1 className="brand-display text-[28px]">that didn't go through. try again?</h1>
          <div className="mt-6">
            <PillButton fullWidth onClick={retake}>
              try again
            </PillButton>
          </div>
        </div>
      )}
    </div>
  );
}
