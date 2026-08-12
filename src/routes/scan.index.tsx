import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Check } from "lucide-react";
import { PillButton } from "@/components/treatme/PillButton";
import { useScan } from "@/lib/scan-store";
import { recordConsent } from "@/lib/scan-consent";
import { warmFacemesh } from "@/lib/facemesh";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/scan/")({
  head: () => ({
    meta: [
      { title: "before we scan · treatme" },
      { name: "description", content: "what we do with your photo, in plain words, before the camera opens." },
      { property: "og:title", content: "before we scan · treatme" },
      { property: "og:description", content: "what we do with your photo, in plain words, before the camera opens." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConsentPage,
});

function CheckRow({
  checked,
  onToggle,
  children,
}: {
  checked: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={checked}
      className="w-full flex items-start gap-3 text-left rounded-2xl border border-ink/10 bg-white px-4 py-4"
    >
      <span
        className={cn(
          "mt-[1px] size-5 shrink-0 rounded-[7px] border grid place-items-center transition-colors",
          checked ? "bg-ink border-ink text-cream" : "border-ink/25 bg-transparent",
        )}
      >
        {checked && <Check className="size-[13px]" strokeWidth={3} />}
      </span>
      <span className="text-[14px] leading-snug lowercase">{children}</span>
    </button>
  );
}

function ConsentPage() {
  const navigate = useNavigate();
  const { setStorePhoto } = useScan();
  const [processing, setProcessing] = useState(false);
  const [policy, setPolicy] = useState(false);
  const [keepPhoto, setKeepPhoto] = useState(true);
  const [busy, setBusy] = useState(false);

  const ready = processing && policy;

  const onContinue = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setStorePhoto(keepPhoto);
    warmFacemesh();
    await recordConsent(keepPhoto);
    navigate({ to: "/scan/capture" });
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem-5.5rem)] px-6 pt-8 pb-8 flex flex-col">
      <p className="brand-eyebrow">consent</p>
      <h1 className="brand-display text-[34px] mt-2">before we scan<span className="text-hot">.</span></h1>

      <p className="mt-4 text-[14px] leading-relaxed text-ink-mute">
        treatme analyses a photo of your face to estimate skin concerns. that photo and the map we
        build from it are biometric information. we store them so you can compare future scans, and
        you can delete them any time from your profile.
      </p>

      <div className="mt-6 space-y-3">
        <CheckRow checked={processing} onToggle={() => setProcessing((v) => !v)}>
          i consent to treatme processing a photo of my face to produce a skin analysis.
        </CheckRow>

        <CheckRow checked={policy} onToggle={() => setPolicy((v) => !v)}>
          i've read the{" "}
          <Link to="/legal/privacy" onClick={(e) => e.stopPropagation()} className="underline">
            privacy policy
          </Link>{" "}
          and{" "}
          <Link to="/legal/terms" onClick={(e) => e.stopPropagation()} className="underline">
            terms
          </Link>
          .
        </CheckRow>

        <CheckRow checked={keepPhoto} onToggle={() => setKeepPhoto((v) => !v)}>
          save my photo so i can compare future scans.
        </CheckRow>

        {!keepPhoto && (
          <p className="text-[12px] text-ink-mute px-1">
            we'll read this photo in memory and never write it to storage.
          </p>
        )}
      </div>

      <div className="mt-auto pt-8">
        <PillButton fullWidth disabled={!ready || busy} onClick={onContinue}>
          continue
        </PillButton>
        <div className="text-center mt-4">
          <Link to="/" className="text-[13px] font-semibold text-ink-mute lowercase">
            not now
          </Link>
        </div>
      </div>
    </div>
  );
}
