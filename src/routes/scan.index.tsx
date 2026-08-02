import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Camera, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { PillButton } from "@/components/treatme/PillButton";
import { useScan } from "@/lib/scan-store";
import { toast } from "sonner";
import { DevConcernToggle } from "@/components/treatme/DevConcernToggle";

export const Route = createFileRoute("/scan/")({
  head: () => ({
    meta: [
      { title: "scan · treatme" },
      { name: "description", content: "take one photo. we'll read your skin in seconds." },
      { property: "og:title", content: "scan · treatme" },
      { property: "og:description", content: "take one photo. we'll read your skin in seconds." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ScanPage,
});

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// downscale a data URL to max 1024px so the payload stays small.
async function downscale(dataUrl: string, max = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => reject(new Error("decode_failed"));
    img.src = dataUrl;
  });
}

function isHeic(file: File) {
  const t = (file.type || "").toLowerCase();
  const n = file.name.toLowerCase();
  return t.includes("heic") || t.includes("heif") || n.endsWith(".heic") || n.endsWith(".heif");
}

function ScanPage() {
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const { setPhoto } = useScan();
  const navigate = useNavigate();
  const [taps, setTaps] = useState(0);

  const onFile = async (file?: File | null) => {
    if (!file) return;
    if (isHeic(file)) {
      toast.error("heic photos aren't supported yet. switch your iphone camera to 'most compatible' (settings → camera → formats), or upload a jpg/png.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("photo too large. try a smaller one.");
      return;
    }
    try {
      const raw = await fileToDataUrl(file);
      const small = await downscale(raw);
      setPhoto(small);
      navigate({ to: "/scan/analyzing" });
    } catch {
      toast.error("couldn't read that photo. try a jpg or png.");
    }
  };

  return (
    <div className="px-6 pt-6">
      {/* tap the eyebrow 5x to reveal the dev toggle */}
      <button
        type="button"
        onClick={() => setTaps((t) => t + 1)}
        className="brand-eyebrow select-none"
      >
        treatme
      </button>
      <h1 className="brand-display text-[40px] mt-3 text-balance">
        step 1 of 3 - scan<span className="text-hot">.</span>
      </h1>


      <div className="mt-6 rounded-3xl bg-bubblegum/45 border border-bubblegum p-5">
        {/* face guide */}
        <div className="relative rounded-2xl bg-cream/80 border border-line/70 aspect-[4/5] overflow-hidden">
          <svg viewBox="0 0 100 125" className="absolute inset-0 w-full h-full" aria-hidden="true">
            <ellipse
              cx="50" cy="58" rx="29" ry="40"
              fill="none" stroke="#FF1F87" strokeWidth="0.9"
              strokeDasharray="3 3" opacity="0.75"
            />
            <line x1="50" y1="20" x2="50" y2="30" stroke="#FF1F87" strokeWidth="0.6" opacity="0.5" />
            <line x1="21" y1="58" x2="29" y2="58" stroke="#FF1F87" strokeWidth="0.6" opacity="0.5" />
            <line x1="71" y1="58" x2="79" y2="58" stroke="#FF1F87" strokeWidth="0.6" opacity="0.5" />
          </svg>
          <div className="absolute inset-x-0 bottom-0 p-5 text-center">
            <div className="size-12 rounded-full bg-ink text-cream grid place-items-center mx-auto">
              <Camera className="size-5" strokeWidth={2.2} />
            </div>
            <p className="mt-3 font-semibold text-[15px]">line your face up inside the oval.</p>
            <p className="text-ink-mute text-[13px] mt-1">good light. no makeup. straight on.</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 mt-5">
          <PillButton fullWidth onClick={() => cameraRef.current?.click()} icon={<Camera className="size-[18px]" />}>
            scan me
          </PillButton>
          <PillButton fullWidth variant="outline" onClick={() => uploadRef.current?.click()} icon={<Upload className="size-[18px]" />}>
            upload a photo
          </PillButton>
        </div>
      </div>

      <ul className="mt-6 flex flex-wrap gap-2">
        {["good light", "no makeup", "face the camera", "hair pulled back"].map((c) => (
          <li key={c} className="rounded-full bg-mint text-ink/80 px-3 py-1 text-[12px] font-medium">{c}</li>
        ))}
      </ul>

      {taps >= 5 && <DevConcernToggle />}

      <input ref={cameraRef} type="file" accept="image/jpeg,image/png" capture="user" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      <input ref={uploadRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => onFile(e.target.files?.[0])} />
    </div>
  );
}
