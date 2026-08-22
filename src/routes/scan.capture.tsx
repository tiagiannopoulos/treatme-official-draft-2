import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Image as ImageIcon, RefreshCw, CameraOff, RotateCcw } from "lucide-react";
import { PillButton } from "@/components/treatme/PillButton";
import { useScan } from "@/lib/scan-store";
import { detectVideoFrame, facemeshReady } from "@/lib/facemesh";
import { cn } from "@/lib/utils";
import { fileToScanJpeg, videoToScanJpeg } from "@/lib/image-process";

type CameraError =
  | "permission"
  | "none"
  | "busy"
  | "constraints"
  | "security"
  | "unknown";

const ERROR_COPY: Record<
  Exclude<CameraError, "permission">,
  { title: string; body: string }
> = {
  none: {
    title: "no camera found",
    body: "we couldn't find a camera on this device. try uploading a photo instead.",
  },
  busy: {
    title: "camera is busy",
    body: "another app is using your camera. close it and try again, or upload a photo.",
  },
  constraints: {
    title: "this camera won't work",
    body: "your camera can't meet our framing needs. try flipping it, or upload a photo.",
  },
  security: {
    title: "connection not secure",
    body: "cameras need a secure (https) connection. upload a photo to continue instead.",
  },
  unknown: {
    title: "camera hit a snag",
    body: "something went wrong opening the camera. give it another go, or upload a photo.",
  },
};

function classifyCameraError(err: unknown): CameraError {
  const name = (err as { name?: string })?.name ?? "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") return "permission";
  if (name === "NotFoundError" || name === "DevicesNotFoundError") return "none";
  if (name === "NotReadableError" || name === "TrackStartError") return "busy";
  if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") return "constraints";
  if (name === "SecurityError" || name === "NotSupportedError") return "security";
  return "unknown";
}

export const Route = createFileRoute("/scan/capture")({
  head: () => ({
    meta: [
      { title: "line up your face · treatme" },
      { name: "description", content: "one photo, natural light, hair back. we handle the rest." },
      { property: "og:title", content: "line up your face · treatme" },
      { property: "og:description", content: "one photo, natural light, hair back. we handle the rest." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CapturePage,
});

type ChipState = "adjust" | "good";

const CHIP_COPY: Record<"lighting" | "position" | "still", Record<ChipState, string>> = {
  lighting: { adjust: "find more light", good: "lighting good" },
  position: { adjust: "line up your face", good: "face position good" },
  still: { adjust: "hold still", good: "holding still" },
};

function Chip({ label, state }: { label: string; state: ChipState }) {
  return (
    <span
      className="px-3 py-1.5 rounded-full text-[11px] font-semibold lowercase whitespace-nowrap text-ink"
      style={{ backgroundColor: state === "good" ? "#DFFFF8" : "#FFEDB4" }}
    >
      {label}
    </span>
  );
}

const HOLD_MS = 1500;

function CapturePage() {
  const navigate = useNavigate();
  const { setPhoto } = useScan();
  const videoRef = useRef<HTMLVideoElement>(null);
  const workRef = useRef<HTMLCanvasElement | null>(null);
  const prevPixels = useRef<Uint8ClampedArray | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [camError, setCamError] = useState<CameraError | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [still, setStill] = useState<string | null>(null);
  const [lighting, setLighting] = useState<ChipState>("adjust");
  const [position, setPosition] = useState<ChipState>("adjust");
  const [steady, setSteady] = useState<ChipState>("adjust");
  const [holdProgress, setHoldProgress] = useState(0);
  const holdingRef = useRef(false);
  const steadyRef = useRef<ChipState>("adjust");

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) video.srcObject = null;
  }, []);

  // camera. re-opened whenever the facing mode or retry changes, torn down on unmount.
  useEffect(() => {
    if (still) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      // no camera api at all: skip straight to the file picker
      setCamError("security");
      fileRef.current?.click();
      return;
    }
    setCamError(null);
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facing,
            aspectRatio: { ideal: CAPTURE_ASPECT },
            width: { ideal: 1080 },
            height: { ideal: 1440 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (err) {
        if (!cancelled) setCamError(classifyCameraError(err));
      }
    })();
    return () => {
      cancelled = true;
      stopStream();
    };
  }, [facing, still, stopStream, retryKey]);

  // stop the camera when the tab is backgrounded or the page is left
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") stopStream();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", stopStream);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", stopStream);
      stopStream();
    };
  }, [stopStream]);

  // live coaching loop. samples the same cropped region the preview shows.
  useEffect(() => {
    if (still || camError) return;
    let alive = true;
    let meshAvailable = true;
    void facemeshReady().then((ok) => {
      meshAvailable = ok;
    });

    const tick = async () => {
      const video = videoRef.current;
      if (!alive || !video || video.readyState < 2) return;

      const canvas = (workRef.current ??= document.createElement("canvas"));
      canvas.width = 64;
      canvas.height = 80;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      const crop = coverCrop(video.videoWidth, video.videoHeight);
      ctx.drawImage(video, crop.x, crop.y, crop.w, crop.h, 0, 0, canvas.width, canvas.height);
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

      let sum = 0;
      for (let i = 0; i < frame.length; i += 4) {
        sum += 0.299 * frame[i] + 0.587 * frame[i + 1] + 0.114 * frame[i + 2];
      }
      const mean = sum / (frame.length / 4);
      setLighting(mean > 72 && mean < 215 ? "good" : "adjust");

      const prev = prevPixels.current;
      if (prev && prev.length === frame.length) {
        let diff = 0;
        for (let i = 0; i < frame.length; i += 4) diff += Math.abs(frame[i] - prev[i]);
        // loosened: a slightly imperfect photo that succeeds beats a perfect
        // one nobody waits for.
        const next: ChipState = diff / (frame.length / 4) < 18 ? "good" : "adjust";
        steadyRef.current = next;
        setSteady(next);
      }
      prevPixels.current = new Uint8ClampedArray(frame);

      if (meshAvailable) {
        const face = await detectVideoFrame(video, performance.now());
        const centred = Math.abs(face.cx - 0.5) < 0.14 && Math.abs(face.cy - 0.47) < 0.16;
        setPosition(face.found && centred && face.size > 0.34 && face.size < 0.92 ? "good" : "adjust");
      } else {
        setPosition("good");
      }
    };

    const id = setInterval(() => void tick(), 220);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [still, camError]);

  const readyToShoot = lighting === "good" && position === "good";

  const takeFrame = useCallback(() => {
    holdingRef.current = false;
    setHoldProgress(0);
    const video = videoRef.current;
    if (!video) return;
    void videoToScanJpeg(video).then((url) => {
      if (url) setStill(url); // freeze on the captured frame
    });
    stopStream();
  }, [stopStream]);

  // the hold: at most 1.5s, ends early once the frame settles, and a second
  // tap on the shutter fires straight away.
  const onShutter = useCallback(() => {
    if (holdingRef.current) {
      takeFrame();
      return;
    }
    if (!readyToShoot) return;
    holdingRef.current = true;
    const start = performance.now();
    const frame = () => {
      if (!holdingRef.current) return;
      const elapsed = performance.now() - start;
      setHoldProgress(Math.min(1, elapsed / HOLD_MS));
      if (steadyRef.current === "good" && elapsed > 350) {
        takeFrame();
        return;
      }
      if (elapsed >= HOLD_MS) {
        takeFrame(); // time is up: shoot anyway rather than wait forever
        return;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, [readyToShoot, takeFrame]);

  useEffect(() => () => {
    holdingRef.current = false;
  }, []);

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    stopStream();
    try {
      setStill(await fileToScanJpeg(file));
    } catch {
      /* ignore unreadable files */
    }
  };


  const useThis = () => {
    if (!still) return;
    stopStream();
    setPhoto(still);
    navigate({ to: "/scan/analyzing" });
  };

  const picker = (
    <input
      ref={fileRef}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={(e) => void onPick(e.target.files?.[0])}
    />
  );

  if (camError && !still) {
    const isPermission = camError === "permission";
    const copy = isPermission
      ? { title: "we need camera access", body: "allow camera in your browser settings, or upload a photo instead." }
      : ERROR_COPY[camError];
    return (
      <div className="min-h-[70vh] bg-cream px-6 pt-16">
        {picker}
        <div className="mx-auto max-w-[360px] rounded-[26px] bg-white p-6 shadow-xl">
          <div className="mb-4 grid size-11 place-items-center rounded-full bg-butter">
            <CameraOff className="size-5 text-ink" aria-hidden="true" />
          </div>
          <h1 className="brand-display text-[26px] lowercase leading-tight">
            {copy.title}
            <span className="text-hot">.</span>
          </h1>
          <p className="mt-3 text-[13.5px] leading-relaxed lowercase text-ink-mute">
            {copy.body}
          </p>
          <div className="mt-6 flex flex-col gap-3">
            {!isPermission && (
              <button
                type="button"
                onClick={() => setRetryKey((k) => k + 1)}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-ink px-5 py-3.5 text-[14px] font-semibold lowercase text-cream"
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                try again
              </button>
            )}
            <PillButton fullWidth onClick={() => fileRef.current?.click()}>
              upload a photo
            </PillButton>
            <Link to="/" className="text-center text-[13px] font-semibold lowercase text-ink-mute">
              back home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-ink">
      {picker}

      {/* the stream, this box and the capture canvas all share one 3:4 shape */}
      <div
        className="relative w-full max-w-[460px] overflow-hidden bg-ink"
        style={{ aspectRatio: "3 / 4" }}
      >
        {still ? (
          <img src={still} alt="your scan photo" className="absolute inset-0 size-full object-cover" />
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            disablePictureInPicture
            className="absolute inset-0 size-full object-cover"
            style={{
              // same zoom factor the capture crop uses, so preview and photo match
              transform: `scale(${facing === "user" ? -CAPTURE_ZOOM : CAPTURE_ZOOM}, ${CAPTURE_ZOOM})`,
            }}
          />
        )}

        {!still && (
          <>
            <svg
              viewBox="0 0 300 400"
              className="absolute inset-0 size-full"
              aria-hidden="true"
            >
              <ellipse
                cx="150"
                cy="188"
                rx="104"
                ry="140"
                fill="none"
                stroke="#FCFBF7"
                strokeWidth="2"
                strokeDasharray="9 9"
                opacity="0.6"
              />
            </svg>

            <div className="absolute inset-x-0 top-3 flex justify-center gap-2 px-3">
              <Chip label={CHIP_COPY.lighting[lighting]} state={lighting} />
              <Chip label={CHIP_COPY.position[position]} state={position} />
              <Chip label={CHIP_COPY.still[steady]} state={steady} />
            </div>

            <p className="absolute inset-x-0 bottom-4 text-center text-[13px] font-semibold lowercase text-cream/80">
              fill the oval, face the light
            </p>
          </>
        )}
      </div>

      {!still && (
        <>


          <div className="absolute inset-x-0 bottom-20 flex items-center justify-center gap-8 p-6">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              aria-label="upload a photo"
              className="grid size-11 place-items-center rounded-full bg-cream/15 text-cream"
            >
              <ImageIcon className="size-5" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={onShutter}
              disabled={!readyToShoot && holdProgress === 0}
              aria-label={holdProgress > 0 ? "capture now" : "capture photo"}
              className={cn(
                "relative grid size-[86px] place-items-center rounded-full transition-opacity",
                readyToShoot || holdProgress > 0 ? "opacity-100" : "opacity-40",
              )}
            >
              {/* thin ring that fills over the hold so the wait is visible */}
              <svg viewBox="0 0 86 86" className="absolute inset-0 size-full -rotate-90" aria-hidden="true">
                <circle cx="43" cy="43" r="40" fill="none" stroke="#FCFBF7" strokeOpacity="0.25" strokeWidth="3" />
                <circle
                  cx="43"
                  cy="43"
                  r="40"
                  fill="none"
                  stroke="#FF1F87"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 40}
                  strokeDashoffset={2 * Math.PI * 40 * (1 - holdProgress)}
                />
              </svg>
              <span
                className="grid size-[68px] place-items-center rounded-full border-4 border-cream/70"
                style={{ backgroundColor: "#FF1F87" }}
              >
                <span className="size-[48px] rounded-full border border-cream/40" />
              </span>
            </button>


            <button
              type="button"
              onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
              aria-label="flip camera"
              className="grid size-11 place-items-center rounded-full bg-cream/15 text-cream"
            >
              <RefreshCw className="size-5" aria-hidden="true" />
            </button>
          </div>
        </>
      )}

      {still && (
        <div className="absolute inset-x-0 bottom-20 flex flex-col items-center gap-4 p-6">
          <PillButton fullWidth onClick={useThis}>
            use this
          </PillButton>
          <button
            type="button"
            onClick={() => {
              setStill(null);
              prevPixels.current = null;
            }}
            className="text-[13px] font-semibold text-cream/80 lowercase"
          >
            retake
          </button>
        </div>
      )}
    </div>
  );
}
