import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { PillButton } from "@/components/treatme/PillButton";
import { useScan } from "@/lib/scan-store";
import { detectVideoFrame, facemeshReady } from "@/lib/facemesh";
import { cn } from "@/lib/utils";

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
      className={cn(
        "px-3 py-1.5 rounded-full text-[11px] font-semibold lowercase whitespace-nowrap text-ink",
        state === "good" ? "bg-mint" : "bg-butter",
      )}
      style={{ backgroundColor: state === "good" ? "#DFFFF8" : "#FFEDB4" }}
    >
      {label}
    </span>
  );
}

function CapturePage() {
  const navigate = useNavigate();
  const { setPhoto } = useScan();
  const videoRef = useRef<HTMLVideoElement>(null);
  const workRef = useRef<HTMLCanvasElement | null>(null);
  const prevPixels = useRef<Uint8ClampedArray | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [still, setStill] = useState<string | null>(null);
  const [lighting, setLighting] = useState<ChipState>("adjust");
  const [position, setPosition] = useState<ChipState>("adjust");
  const [steady, setSteady] = useState<ChipState>("adjust");

  // camera
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1600 } },
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
      } catch {
        if (!cancelled) setError("we couldn't open your camera. check permissions and try again.");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  // live coaching loop
  useEffect(() => {
    if (still || error) return;
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
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

      // lighting: mean luminance in a comfortable band
      let sum = 0;
      for (let i = 0; i < frame.length; i += 4) {
        sum += 0.299 * frame[i] + 0.587 * frame[i + 1] + 0.114 * frame[i + 2];
      }
      const mean = sum / (frame.length / 4);
      setLighting(mean > 72 && mean < 215 ? "good" : "adjust");

      // hold still: mean absolute pixel delta between frames
      const prev = prevPixels.current;
      if (prev && prev.length === frame.length) {
        let diff = 0;
        for (let i = 0; i < frame.length; i += 4) diff += Math.abs(frame[i] - prev[i]);
        setSteady(diff / (frame.length / 4) < 9 ? "good" : "adjust");
      }
      prevPixels.current = new Uint8ClampedArray(frame);

      // face position: centred in the oval and filling enough of it
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
  }, [still, error]);

  const allGood = lighting === "good" && position === "good" && steady === "good";

  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;
    const scale = Math.min(1, 1024 / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1); // un-mirror the selfie view
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setStill(canvas.toDataURL("image/jpeg", 0.88));
  }, []);

  const useThis = () => {
    if (!still) return;
    setPhoto(still);
    navigate({ to: "/scan/analyzing" });
  };

  if (error) {
    return (
      <div className="px-6 pt-16 text-center min-h-[60vh]">
        <h1 className="brand-display text-[30px]">no camera<span className="text-hot">.</span></h1>
        <p className="mt-3 text-[14px] text-ink-mute">{error}</p>
        <div className="mt-6">
          <Link to="/">
            <PillButton variant="outline">back home</PillButton>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem-5.5rem)] px-4 py-4">
      <h1 className="px-2 pb-3 brand-display text-[22px] lowercase">line up your face</h1>
      <div className="relative flex-1 rounded-3xl overflow-hidden bg-ink">
        {still ? (
          <img src={still} alt="your scan photo" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
          />
        )}

        {!still && (
          <>
            <svg viewBox="0 0 100 125" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full" aria-hidden="true">
              <ellipse
                cx="50" cy="58" rx="29" ry="40"
                fill="none" stroke="#FCFBF7" strokeWidth="0.8"
                strokeDasharray="3 3" opacity="0.85"
              />
            </svg>

            <div className="absolute top-3 inset-x-0 flex justify-center gap-2 px-3">
              <Chip label={CHIP_COPY.lighting[lighting]} state={lighting} />
              <Chip label={CHIP_COPY.position[position]} state={position} />
              <Chip label={CHIP_COPY.still[steady]} state={steady} />
            </div>

            <div className="absolute inset-x-0 bottom-0 p-6 text-center">
              <p className="text-cream/85 text-[13px] max-w-[30ch] mx-auto">
                natural light, no makeup, hair back. we only need one photo.
              </p>
              <button
                type="button"
                onClick={capture}
                disabled={!allGood}
                aria-label="capture photo"
                className={cn(
                  "mt-5 mx-auto grid place-items-center size-[74px] rounded-full border-4 border-cream/70 transition-opacity",
                  allGood ? "bg-ink opacity-100" : "bg-ink opacity-40",
                )}
              >
                <span className="size-[54px] rounded-full bg-ink border border-cream/40" />
              </button>
            </div>
          </>
        )}
      </div>

      {still && (
        <div className="pt-5">
          <PillButton fullWidth onClick={useThis}>
            use this
          </PillButton>
          <div className="text-center mt-4">
            <button
              type="button"
              onClick={() => {
                setStill(null);
                prevPixels.current = null;
              }}
              className="text-[13px] font-semibold text-ink-mute lowercase"
            >
              retake
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
