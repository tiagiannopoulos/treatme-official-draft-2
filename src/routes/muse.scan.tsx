import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useScan, type PhotoAngle } from "@/features/muse/scan-store";
import {
  checkAlignment,
  coverMap,
  detectLandmarks,
  detectLandmarksFromDataUrl,
  frameBrightness,
  mapCoverPoint,
  tesselation,
  type Alignment,
  type CoverMap,
  type Landmark,
} from "@/features/muse/face-landmarks";

export const Route = createFileRoute("/muse/scan")({
  validateSearch: (search: Record<string, unknown>): { clinic?: string } => ({ clinic: typeof search.clinic === "string" ? search.clinic : undefined }),
  component: ScanPage,
});

const ANGLES: { key: PhotoAngle; title: string; hint: string; tip: string }[] = [
  {
    key: "front",
    title: "front",
    hint: "face the camera straight on. keep a neutral expression, hair away from your face.",
    tip: "chin level, eyes on the lens.",
  },
  {
    key: "left",
    title: "left side",
    hint: "turn your head to show your left cheek and jawline to the camera.",
    tip: "shoulders still, turn only your head.",
  },
  {
    key: "right",
    title: "right side",
    hint: "turn your head to show your right cheek and jawline to the camera.",
    tip: "shoulders still, turn only your head.",
  },
];

function downscale(dataUrl: string, maxDim = 1400): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      if (scale === 1) return resolve(dataUrl);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/** white wireframe mesh over a still preview; landmarks in 0..1 image space. */
function MeshSvg({ landmarks }: { landmarks: Landmark[] | null }) {
  const conns = useMemo(tesselation, []);
  if (!landmarks || landmarks.length < 100) return null;
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    >
      <g stroke="#ffffff" strokeWidth={0.3} opacity={0.85} fill="none">
        {conns.map((c, i) => {
          const a = landmarks[c.start];
          const b = landmarks[c.end];
          return (
            <line
              key={i}
              x1={a.x * 100}
              y1={a.y * 100}
              x2={b.x * 100}
              y2={b.y * 100}
            />
          );
        })}
      </g>
    </svg>
  );
}

function AlignmentPill({ alignment }: { alignment: Alignment | null }) {
  if (!alignment) return null;
  return (
    <div
      className={`absolute left-1/2 top-4 z-10 -translate-x-1/2 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold lowercase backdrop-blur ${
        alignment.ok ? "bg-hot text-white" : "bg-ink/70 text-white"
      }`}
    >
      {alignment.hint}
    </div>
  );
}

function clearMesh(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

/**
 * white wireframe mesh on the live preview.
 * landmarks are normalized to the FULL video frame, but the video element
 * uses object-fit: cover, so we map through the cover transform — drawing
 * straight to canvas pixels detaches the mesh on phones where the frame
 * aspect differs from the element aspect.
 * never draws when the mapping can't be trusted; callers clear instead.
 */
function drawLiveMesh(
  canvas: HTMLCanvasElement,
  landmarks: Landmark[],
  map: CoverMap,
  mirror: boolean,
  debug: boolean,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, map.ew, map.eh);
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = Math.max(1, map.ew / 420);
  ctx.beginPath();
  for (const c of tesselation()) {
    const a = landmarks[c.start];
    const b = landmarks[c.end];
    if (!a || !b) continue;
    const pa = mapCoverPoint(map, a.x, a.y, mirror);
    const pb = mapCoverPoint(map, b.x, b.y, mirror);
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
  }
  ctx.stroke();
  if (debug) {
    const lines = [
      `vid ${map.vw}x${map.vh}`,
      `el ${Math.round(map.ew)}x${Math.round(map.eh)} css`,
      `s ${map.s.toFixed(3)} crop ${Math.round(map.offsetX)},${Math.round(map.offsetY)}`,
      `lm ${landmarks.length} mirror ${mirror ? "y" : "n"}`,
    ];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.font = "11px monospace";
    const w = 190;
    const h = lines.length * 15 + 12;
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(6 * dpr, 6 * dpr, w, h);
    ctx.fillStyle = "#fff";
    lines.forEach((t, i) => ctx.fillText(t, 6 * dpr + 8, 6 * dpr + 20 + i * 15));
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

type CamMode = "starting" | "live" | "denied" | "preview";

function AngleCapture({
  angleKey,
  title,
  stepLabel,
  hint,
  tip,
  photo,
  storedLandmarks,
  onPhoto,
  onRetake,
}: {
  angleKey: PhotoAngle;
  title: string;
  stepLabel: string;
  hint: string;
  tip: string;
  photo: string | null;
  storedLandmarks: Landmark[] | null;
  onPhoto: (
    angle: PhotoAngle,
    dataUrl: string,
    landmarks: Landmark[] | null,
  ) => void;
  onRetake: (angle: PhotoAngle) => void;
}) {
  const [mode, setMode] = useState<CamMode>(photo ? "preview" : "starting");
  const [alignment, setAlignment] = useState<Alignment | null>(null);
  const [previewLandmarks, setPreviewLandmarks] = useState<Landmark[] | null>(
    storedLandmarks,
  );
  const [error, setError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function startCamera() {
    setMode("starting");
    setAlignment(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setMode("denied");
      return;
    }
    let settled = false;
    // headless / stuck permission prompts must not hang the ui: fall back
    // to the file-input flow after a few seconds.
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      stopCamera();
      setMode("denied");
    }, 7000);
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 } },
        audio: false,
      })
      .then((stream) => {
        clearTimeout(timer);
        if (settled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        settled = true;
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.play().catch(() => {});
        }
        setMode("live");
      })
      .catch(() => {
        clearTimeout(timer);
        if (settled) return;
        settled = true;
        setMode("denied");
      });
  }

  // start the camera when there is no photo yet.
  useEffect(() => {
    if (photo) {
      setMode("preview");
      return;
    }
    startCamera();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // live face-mesh + alignment loop.
  useEffect(() => {
    if (mode !== "live") return;
    const debug =
      new URLSearchParams(window.location.search).get("debug") === "mesh";
    // consecutive detection failures before the mesh is hidden. a stale mesh
    // is worse than no mesh: never show one that isn't tracking.
    let failures = 0;
    const id = setInterval(async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2 || video.videoWidth === 0)
        return;
      const cssW = video.clientWidth;
      const cssH = video.clientHeight;
      if (cssW === 0 || cssH === 0) return;
      // retina bitmap so the mesh stays crisp; all drawing in css px.
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const bw = Math.round(cssW * dpr);
      const bh = Math.round(cssH * dpr);
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }
      const map = coverMap(video.videoWidth, video.videoHeight, cssW, cssH);
      try {
        const pts = await detectLandmarks(video);
        const bright = frameBrightness(video);
        setAlignment(checkAlignment(pts, bright));
        if (!pts || pts.length < 100 || !map) {
          failures += 1;
          if (failures >= 2) clearMesh(canvas);
          return;
        }
        failures = 0;
        drawLiveMesh(canvas, pts, map, true, debug);
      } catch {
        failures += 1;
        if (failures >= 2) clearMesh(canvas);
      }
    }, 320);
    return () => clearInterval(id);
  }, [mode]);

  // landmarks for a still preview (non-front angles re-detect locally).
  useEffect(() => {
    if (!photo) return;
    if (storedLandmarks) {
      setPreviewLandmarks(storedLandmarks);
      return;
    }
    let cancelled = false;
    detectLandmarksFromDataUrl(photo).then((pts) => {
      if (!cancelled) setPreviewLandmarks(pts);
    });
    return () => {
      cancelled = true;
    };
  }, [photo, storedLandmarks]);

  async function captureStill() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || capturing) return;
    setCapturing(true);
    try {
      const c = document.createElement("canvas");
      c.width = video.videoWidth;
      c.height = video.videoHeight;
      c.getContext("2d")?.drawImage(video, 0, 0);
      const small = await downscale(c.toDataURL("image/jpeg", 0.9));
      stopCamera();
      // detect on the still so the preview gets its mesh; front-angle
      // landmarks are saved to the scan store by the parent.
      const pts = await detectLandmarksFromDataUrl(small);
      setPreviewLandmarks(pts);
      onPhoto(angleKey, small, pts);
    } finally {
      setCapturing(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("that file is not a photo. please choose an image.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setError("that photo is too large. try one under 12mb.");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const small = await downscale(reader.result as string);
      const pts = await detectLandmarksFromDataUrl(small);
      setPreviewLandmarks(pts);
      onPhoto(angleKey, small, pts);
    };
    reader.readAsDataURL(file);
  }

  function retake() {
    onRetake(angleKey);
    setPreviewLandmarks(null);
    startCamera();
  }

  return (
    <div className="tm-card overflow-hidden">
      <div className="relative bg-ink">
        {mode === "preview" && photo ? (
          <div className="flex justify-center">
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo}
                alt={`${title} preview`}
                className="block max-h-96 object-contain"
              />
              <MeshSvg landmarks={previewLandmarks} />
              <AlignmentPill
                alignment={previewLandmarks ? { ok: true, hint: "ok" } : null}
              />
            </div>
          </div>
        ) : (
          <div className="relative">
            {mode !== "denied" && (
              <>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="mx-auto block max-h-96 w-full -scale-x-100 object-cover"
                />
                <canvas
                  ref={canvasRef}
                  className="pointer-events-none absolute inset-0 mx-auto block h-full w-full"
                />
              </>
            )}
            {mode === "starting" && (
              <div className="absolute inset-0 flex items-center justify-center bg-ink">
                <div className="tm-pulse h-12 w-12 rounded-full bg-cream/30" />
              </div>
            )}
            {mode === "denied" && (
              /* no camera: existing file-input flow with the oval guide */
              <div className="flex aspect-[3/4] max-h-96 w-full items-center justify-center">
                <div className="flex h-64 w-48 items-center justify-center rounded-[50%] border-2 border-dashed border-cream/40">
                  <p className="px-6 text-center text-sm text-cream/60">
                    line your face up here
                  </p>
                </div>
              </div>
            )}
            {mode === "live" && <AlignmentPill alignment={alignment} />}
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={onFile}
        />
      </div>

      <div className="p-5">
        <h3 className="tm-display text-2xl">
          {stepLabel}. {title}.
        </h3>
        <p className="mt-1 text-ink-soft">{hint}</p>
        <p className="mt-1 text-sm font-medium text-ink-mute">{tip}</p>
        {error && (
          <p className="mt-2 text-sm font-medium text-hot-deep">{error}</p>
        )}
        <div className="mt-4 flex gap-3">
          {mode === "preview" ? (
            <button className="tm-btn-ghost flex-1" onClick={retake}>
              retake photo
            </button>
          ) : mode === "live" ? (
            <>
              <button
                className="tm-btn-hot flex-1"
                onClick={captureStill}
                disabled={capturing}
              >
                {capturing ? "saving..." : "capture photo"}
              </button>
              <button className="tm-btn-ghost" onClick={() => fileRef.current?.click()}>
                upload
              </button>
            </>
          ) : mode === "denied" ? (
            <button
              className="tm-btn-hot flex-1"
              onClick={() => fileRef.current?.click()}
            >
              take photo
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ScanPage() {
  const navigate = useNavigate();
  const { clinic } = Route.useSearch();
  const {
    photos,
    frontLandmarks,
    setPhoto,
    setFrontLandmarks,
    consent,
    setConsent,
    setClinicSlug,
  } = useScan();
  // A redirect back from sign-in may omit the clinic query. Preserve the original branded journey.
  useEffect(() => { if (clinic) setClinicSlug(clinic); }, [clinic, setClinicSlug]);
  const [step, setStep] = useState(0);

  const angle = ANGLES[step];
  const done = ANGLES.every((a) => photos[a.key]);

  async function handlePhoto(
    angleKey: PhotoAngle,
    dataUrl: string,
    landmarks: Landmark[] | null,
  ) {
    setPhoto(angleKey, dataUrl);
    if (angleKey === "front") setFrontLandmarks(landmarks);
    const idx = ANGLES.findIndex((a) => a.key === angleKey);
    if (idx < ANGLES.length - 1) setStep(idx + 1);
  }

  function handleRetake(angleKey: PhotoAngle) {
    setPhoto(angleKey, null);
    if (angleKey === "front") setFrontLandmarks(null);
  }

  return (
    <div className="mx-auto max-w-xl py-6">
      <h1 className="tm-display text-4xl">three quick photos.</h1>

      <div className="tm-card mt-6 bg-mist p-5">
        <p className="font-semibold">for the best read:</p>
        <ul className="mt-2 space-y-1.5 text-sm text-ink-soft">
          <li>face a window or bright light. no flash.</li>
          <li>no makeup if you can, or as little as possible.</li>
          <li>hold the phone at eye level, about an arm away.</li>
        </ul>
      </div>

      <label className="mt-5 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-1 h-5 w-5 accent-[#ff1f87]"
        />
        <span className="text-sm text-ink-soft">
          treatme is cosmetic and educational only, not a medical diagnosis. i consent to processing my photos for this skin report.
          photos are processed for your cosmetic report and are not shared with clinics without separate consent. photos remain in this browser session during scanning.
        </span>
      </label>

      <div className="mt-6 flex gap-2">
        {ANGLES.map((a, i) => (
          <button
            key={a.key}
            onClick={() => setStep(i)}
            className={`tm-chip flex-1 ${i === step ? "!border-hot !bg-hot-soft" : ""}`}
            data-active={Boolean(photos[a.key])}
          >
            {i + 1}. {a.title}
            {photos[a.key] && <span className="ml-1">✓</span>}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <AngleCapture
          key={angle.key}
          angleKey={angle.key}
          title={angle.title}
          stepLabel={`${step + 1} of 3`}
          hint={angle.hint}
          tip={angle.tip}
          photo={photos[angle.key]}
          storedLandmarks={angle.key === "front" ? frontLandmarks : null}
          onPhoto={handlePhoto}
          onRetake={handleRetake}
        />
      </div>

      <button
        disabled={!done || !consent}
        onClick={() => navigate({ to: "/muse/analyzing" })}
        className="tm-btn-hot mt-6 w-full"
      >
        {!consent ? "tick consent to continue" : done ? "analyze my skin" : `take ${3 - Object.values(photos).filter(Boolean).length} more photo${Object.values(photos).filter(Boolean).length === 2 ? "" : "s"}`}
      </button>
    </div>
  );
}
