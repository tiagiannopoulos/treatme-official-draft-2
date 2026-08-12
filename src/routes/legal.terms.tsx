import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/legal/terms")({
  head: () => ({
    meta: [
      { title: "terms · treatme" },
      { name: "description", content: "the ground rules for using treatme scans, chats, and bookings." },
      { property: "og:title", content: "terms · treatme" },
      { property: "og:description", content: "the ground rules for using treatme scans, chats, and bookings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermsPage,
});

const SECTIONS: { h: string; p: string }[] = [
  {
    h: "this isn't medical advice",
    p: "a treatme scan is an estimate from a photo. it doesn't diagnose anything. see a doctor for anything that concerns you.",
  },
  {
    h: "your photo, your call",
    p: "you decide whether we save your photo, and you can delete it and the scan built from it whenever you like.",
  },
  {
    h: "bookings",
    p: "treatme passes your request to the clinic. the clinic confirms the time and performs the treatment, and their own policies apply.",
  },
  {
    h: "alpha",
    p: "treatme is early. things will change, and we'll tell you when something meaningful does.",
  },
];

function TermsPage() {
  return (
    <div className="px-6 pt-6 pb-12">
      <Link to="/scan" className="inline-flex items-center gap-1 text-[13px] font-semibold text-ink-mute lowercase">
        <ChevronLeft className="size-4" /> back
      </Link>
      <h1 className="brand-display text-[32px] mt-4">terms<span className="text-hot">.</span></h1>
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
