import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Camera, Upload } from "lucide-react";
import { useRef } from "react";
import { PillButton } from "@/components/treatme/PillButton";
import { useScan } from "@/lib/scan-store";
import { toast } from "sonner";

export const Route = createFileRoute("/scan/")({
  head: () => ({
    meta: [
      { title: "scan · treatme" },
      { name: "description", content: "take one photo. we'll read your skin in seconds." },
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

// downscale a data URL to max 1024px so the API payload stays small
async function downscale(dataUrl: string, max = 1024): Promise<string> {
  return new Promise((resolve) => {
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
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function ScanPage() {
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const { setPhoto } = useScan();
  const navigate = useNavigate();

  const onFile = async (file?: File | null) => {
    if (!file) return;
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
      toast.error("couldn't read that photo. try again.");
    }
  };

  return (
    <div className="px-6 pt-6">
      <p className="brand-eyebrow">step 01 of 03 · scan</p>
      <h1 className="brand-display text-[40px] mt-3 text-balance">
        let's see what your skin is asking for<span className="text-hot">.</span>
      </h1>

      <div className="mt-6 rounded-3xl bg-bubblegum/45 border border-bubblegum p-5">
        <div className="rounded-2xl bg-cream/80 border border-line/70 aspect-[4/5] grid place-items-center text-center px-6">
          <div>
            <div className="size-14 rounded-full bg-ink text-cream grid place-items-center mx-auto">
              <Camera className="size-6" strokeWidth={2.2} />
            </div>
            <p className="mt-4 font-semibold text-[15px]">center your face. good light. no makeup.</p>
            <p className="text-ink-mute text-[13px] mt-1">we read it instantly and never store it on a server.</p>
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

      <input ref={cameraRef} type="file" accept="image/*" capture="user" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      <input ref={uploadRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
    </div>
  );
}
