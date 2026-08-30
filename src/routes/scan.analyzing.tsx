import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { PillButton } from "@/components/treatme/PillButton";
import { useScan } from "@/lib/scan-store";
import { topConcerns } from "@/lib/skinAnalysis";
import { resultFromAnalysis } from "@/lib/skinAnalysis/fromAnalysis";
import { getRecommendations } from "@/lib/recommendations";
import { uploadScanPhoto, type StoredScanPhoto } from "@/lib/scan-photo";
import { faceMapFromDataUrl } from "@/lib/facemesh";
import type { FaceMap } from "@/lib/face-zones";
import { measureSkin, type Measured } from "@/lib/skin-measure";
import { saveScan } from "@/lib/scan-persist";
import { AnalysisSchema, type SkinAnalysis } from "@/lib/skin-analysis";
import { updateProfile, type Fitzpatrick } from "@/lib/patient-store";
import { SCAN_CONCERN_LABEL } from "@/lib/scan-concerns";
import { isPhotoReason, photoReasonMessages, type PhotoReason } from "@/lib/photo-check";

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

type Phase = "working" | "quality" | "photo" | "timeout" | "failed";
type Failure = "face" | "image" | "service" | "config";

const FAILURE_COPY: Record<Failure, string> = {
  face: "we could not find a face in that one. try again in better light, facing the camera.",
  image: "that photo did not upload properly. try taking a new one.",
  service: "our end had a problem. try again in a moment.",
  config: "scanning isn't configured on this deployment yet.",
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
  const { photoDataUrl, goals, storePhoto, setResult, setAnalysis, setPhotoPath, setScanMeta, setFaceMap, setMeasured, setScanId } = useScan();

  const started = useRef(false);
  const [phase, setPhase] = useState<Phase>("working");
  const [progress, setProgress] = useState(6);
  const [failure, setFailure] = useState<Failure>("service");
  const [photoReasons, setPhotoReasons] = useState<PhotoReason[]>([]);
  // set by "use anyway": skips the gate and flags the read as low quality.
  const forceRef = useRef(false);
  const pending = useRef<{ analysis: SkinAnalysis } | null>(null);
  const fact = useRotator(FACTS, phase === "working", 4000);
  const stage = useRotator(STAGES, phase === "working", 5000);

  // progress creeps toward 92 and completes when we navigate
  useEffect(() => {
    if (phase !== "working") return;
    const id = setInterval(() => setProgress((p) => (p < 92 ? p + Math.max(1, (92 - p) / 12) : p)), 320);
    return () => clearInterval(id);
  }, [phase]);

  const finish = useCallback(
    async (analysis: SkinAnalysis, photo: StoredScanPhoto, faceMap: FaceMap | null, measured: Measured | null) => {
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
        photoPath: photo.path,
        thumbPath: photo.thumbPath,
        storePhoto,
        faceMap,
        measured,
        result,
        photoQuality: analysis.photoQuality,
        medicalFlag: analysis.medicalFlag,
        analysis,
      });

      setScanId(scanId);
      setFaceMap(faceMap);
      setMeasured(measured);
      setAnalysis(analysis);
      setScanMeta({ medicalFlag: analysis.medicalFlag, photoQuality: analysis.photoQuality });
      setProgress(100);
      setResult(result, scanDriven, goalDriven);
      navigate({ to: "/scan/results" });
    },
    [goals, navigate, setAnalysis, setFaceMap, setMeasured, setResult, setScanMeta, setScanId, storePhoto],
  );

  const run = useCallback(async () => {
    if (!photoDataUrl) {
      navigate({ to: "/scan" });
      return;
    }

    setPhase("working");
    setProgress(6);

    /** one attempt. throws { retryable, failure } shaped errors. */
    const attempt = async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await fetch("/api/public/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageDataUrl: photoDataUrl, skipValidation: forceRef.current }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { code?: string; detail?: string; reasons?: unknown };
          if (res.status === 422 && body.code === "photo") {
            const reasons = (Array.isArray(body.reasons) ? body.reasons : []).filter(isPhotoReason);
            throw Object.assign(new Error("photo_check_failed"), { retryable: false, photoReasons: reasons });
          }
          console.error("scan analysis rejected", res.status, body.code, body.detail);
          // a missing server key is not something a retry can fix.
          const isConfig = body.code === "config";
          const retryable = !isConfig && (res.status === 429 || res.status >= 500);
          const failure: Failure = isConfig ? "config" : body.code === "image" ? "image" : "service";
          throw Object.assign(new Error(body.detail ?? `status_${res.status}`), { retryable, failure });
        }

        const json = (await res.json()) as { analysis?: unknown };
        return AnalysisSchema.parse(json.analysis);
      } finally {
        clearTimeout(timer);
      }
    };

    try {
      // layer 1 runs on the still before the analysis call. everything that
      // places a marker depends on it.
      const [faceMap, photo] = await Promise.all([
        faceMapFromDataUrl(photoDataUrl),
        storePhoto
          ? uploadScanPhoto(photoDataUrl).catch<StoredScanPhoto>(() => ({ path: null, thumbPath: null }))
          : Promise.resolve<StoredScanPhoto>({ path: null, thumbPath: null }),
      ]);
      setPhotoPath(photo.path);

      // layers 2 and 3: measured straight from the pixels and the landmark
      // geometry. runs alongside the model call, not after it.
      const measuring = measureSkin(photoDataUrl, faceMap);

      let analysis: SkinAnalysis | null = null;
      let lastError: unknown = null;

      for (let i = 0; i <= RETRY_DELAYS.length; i += 1) {
        try {
          analysis = await attempt();
          break;
        } catch (err) {
          lastError = err;
          const meta = err as { retryable?: boolean };
          const aborted = err instanceof DOMException && err.name === "AbortError";
          const canRetry = (meta.retryable || aborted) && i < RETRY_DELAYS.length;
          if (!canRetry) throw err;
          await sleep(RETRY_DELAYS[i]!);
        }
      }

      if (!analysis) throw lastError ?? new Error("analysis_failed");

      if (forceRef.current) {
        await finish({ ...analysis, photoQuality: "poor" }, photo, faceMap, await measuring);
        return;
      }

      if (analysis.photoQuality === "poor") {
        pending.current = { analysis };
        pendingMeta.current = { photo, faceMap, measured: await measuring };
        setPhase("quality");
        return;
      }

      await finish(analysis, photo, faceMap, await measuring);
    } catch (err) {
      console.error("scan analysis failed", err);
      const withReasons = err as { photoReasons?: PhotoReason[] };
      if (withReasons.photoReasons) {
        setPhotoReasons(withReasons.photoReasons);
        setPhase("photo");
        return;
      }
      const aborted = err instanceof DOMException && err.name === "AbortError";
      const meta = err as { failure?: Failure };
      const message = err instanceof Error ? err.message.toLowerCase() : "";
      setFailure(
        aborted ? "service" : message.includes("face") ? "face" : (meta.failure ?? "service"),
      );
      setPhase(aborted ? "timeout" : "failed");
    }
  }, [finish, navigate, photoDataUrl, setPhotoPath, storePhoto]);

  const pendingMeta = useRef<{ photo: StoredScanPhoto; faceMap: FaceMap | null; measured: Measured | null }>({
    photo: { path: null, thumbPath: null },
    faceMap: null,
    measured: null,
  });

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void run();
  }, [run]);

  const usePendingAnyway = () => {
    const held = pending.current;
    if (!held) return;
    setPhase("working");
    void finish(held.analysis, pendingMeta.current.photo, pendingMeta.current.faceMap, pendingMeta.current.measured);
  };

  const retake = () => navigate({ to: "/scan/capture" });

  /** three tries in and it still will not pass: let them through, flagged. */
  const useAnyway = () => {
    forceRef.current = true;
    void run();
  };

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
          <p className="mt-3 text-[13px] text-ink">{stage}</p>
          <p className="mt-1 text-[13px] text-ink-mute">{fact}</p>
        </div>
      )}

      {phase === "quality" && (
        <div className="mt-7">
          <h1 className="brand-display text-[28px]">the lighting made that hard to read. want to retake?</h1>
          <div className="mt-6 space-y-3">
            <PillButton fullWidth onClick={retake}>
              retake
            </PillButton>
            <PillButton fullWidth variant="outline" onClick={usePendingAnyway}>
              use it anyway
            </PillButton>
          </div>
        </div>
      )}

      {phase === "photo" && (
        <div className="mt-7">
          {photoReasonMessages(photoReasons).map((line) => (
            <p key={line} className="brand-display text-[22px] leading-snug mb-2 lowercase">
              {line}
            </p>
          ))}
          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={retake}
              className="w-full rounded-pill py-3.5 text-[15px] font-semibold lowercase text-cream"
              style={{ backgroundColor: "#FF1F87" }}
            >
              retake
            </button>
            <button
              type="button"
              onClick={useAnyway}
              className="block w-full py-1 text-center text-[13px] lowercase text-ink/55 underline decoration-transparent"
            >
              use anyway
            </button>
          </div>
        </div>
      )}

      {(phase === "timeout" || phase === "failed") && (
        <div className="mt-7">
          <h1 className="brand-display text-[26px]">
            {phase === "timeout" ? FAILURE_COPY.service : FAILURE_COPY[failure]}
          </h1>
          <div className="mt-6 space-y-3">
            <PillButton fullWidth onClick={() => void run()}>
              try again
            </PillButton>
            <PillButton fullWidth variant="outline" onClick={retake}>
              retake
            </PillButton>
          </div>
        </div>
      )}
    </div>
  );
}
