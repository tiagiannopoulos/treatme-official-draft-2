import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/legal/privacy")({
  head: () => ({
    meta: [
      { title: "privacy policy · treatme" },
      { name: "description", content: "how treatme handles your photos, scan data, and bookings." },
      { property: "og:title", content: "privacy policy · treatme" },
      { property: "og:description", content: "how treatme handles your photos, scan data, and bookings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

const SECTIONS: { h: string; p: string }[] = [
  {
    h: "what we collect",
    p: "the photo you scan, the face map we build from it, the scores we produce, and the details you type when you request a booking.",
  },
  {
    h: "why it counts as biometric",
    p: "a face map is information about your body, so we treat it as biometric information and only process it with your consent.",
  },
  {
    h: "how long we keep it",
    p: "if you asked us to save your photo, we keep it so you can compare future scans. you can delete any scan and its photo from your profile at any time.",
  },
  {
    h: "who sees it",
    p: "no provider or clinic sees your scan unless you choose to share it when you request a booking.",
  },
  {
    h: "questions",
    p: "email hello@treatme.app and a human will answer.",
  },
];

function PrivacyPage() {
  return (
    <div className="px-6 pt-6 pb-12">
      <Link to="/scan" className="inline-flex items-center gap-1 text-[13px] font-semibold text-ink-mute lowercase">
        <ChevronLeft className="size-4" /> back
      </Link>
      <h1 className="brand-display text-[32px] mt-4">privacy policy<span className="text-hot">.</span></h1>
      <p className="mt-3 text-[13px] text-ink-mute">alpha version. plain words, no fine print.</p>
      <div className="mt-6 space-y-5">
        {SECTIONS.map((s) => (
          <div key={s.h} className="rounded-2xl border border-ink/10 bg-white p-4">
            <h2 className="font-semibold text-[15px] lowercase">{s.h}</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-mute">{s.p}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
