import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, MapPin, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PillButton } from "@/components/treatme/PillButton";
import { CLINICS, getTreatment } from "@/lib/treatments-data";

export const Route = createFileRoute("/treatments/$slug/book")({
  head: () => ({
    meta: [
      { title: "book · treatme" },
      { name: "description", content: "verified providers near you. first visit is always a free 15-min consult." },
    ],
  }),
  loader: ({ params }) => {
    const t = getTreatment(params.slug);
    if (!t) throw notFound();
    return { treatment: t };
  },
  component: BookPage,
});

function BookPage() {
  const { treatment } = Route.useLoaderData();
  const [unit, setUnit] = useState<"km" | "mi">("km");
  const [radius, setRadius] = useState(25);

  const clinics = useMemo(() => {
    const factor = unit === "km" ? 1 : 0.621;
    return CLINICS
      .map((c) => ({ ...c, dist: c.kmFromCentre * factor }))
      .filter((c) => c.dist <= radius)
      .sort((a, b) => a.dist - b.dist);
  }, [unit, radius]);

  return (
    <div className="pb-10">
      <div className="px-6 pt-4">
        <Link to="/treatments/$slug" params={{ slug: treatment.slug }} className="inline-flex items-center gap-1 text-[13px] font-semibold lowercase text-ink-mute">
          <ArrowLeft className="size-4" /> back
        </Link>
      </div>

      <div className="px-6 mt-3">
        <p className="brand-eyebrow">book · {treatment.name}</p>
        <h1 className="brand-display text-[30px] mt-2">verified hands near you<span className="text-hot">.</span></h1>
      </div>

      <div className="mx-6 mt-5 rounded-2xl bg-butter p-4">
        <p className="text-[12px] font-bold uppercase tracking-widest text-ink/80">first visit · always</p>
        <p className="mt-1 text-[15px] font-semibold text-ink">free 15-min consult.</p>
        <p className="text-[12px] text-ink/70 mt-1">you and your provider decide together before any treatment happens.</p>
      </div>

      {/* location/radius */}
      <div className="px-6 mt-5">
        <div className="flex items-center justify-between">
          <p className="brand-eyebrow flex items-center gap-1"><MapPin className="size-3.5" /> within {radius} {unit}</p>
          <button onClick={() => setUnit(unit === "km" ? "mi" : "km")} className="text-[12px] font-semibold lowercase text-ink-mute underline-offset-4 hover:underline">
            switch to {unit === "km" ? "mi" : "km"}
          </button>
        </div>
        <input type="range" min={5} max={50} step={5} value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-full mt-3 accent-[#FF1F87]" />
      </div>

      {/* clinics */}
      <div className="px-6 mt-5 flex flex-col gap-3">
        {clinics.length === 0 && (
          <p className="text-ink-mute text-[14px]">no verified clinics within {radius} {unit}. widen your radius.</p>
        )}
        {clinics.map((c) => {
          const price = Math.round(treatment.priceFrom * c.basePriceMultiplier);
          return (
            <div key={c.id} className="rounded-2xl bg-card border border-line p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-[16px]">{c.name}</p>
                  <p className="text-[12px] text-ink-mute mt-0.5">{c.area} · {c.dist.toFixed(1)} {unit} · {c.injectorTitle}</p>
                </div>
                <div className="text-right">
                  <p className="text-[14px] font-bold flex items-center gap-1"><Star className="size-3.5 fill-ink text-ink" />{c.rating}</p>
                  <p className="text-[11px] text-ink-mute">{c.reviewCount} reviews</p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-bubblegum/50 text-ink/85 px-3 py-1 text-[11px] font-semibold">first visit · free 15-min consult</span>
                {c.verified && <span className="rounded-full bg-mint text-ink/85 px-3 py-1 text-[11px] font-semibold">verified ✓</span>}
                <span className="rounded-full border border-line text-ink-soft px-3 py-1 text-[11px] font-semibold">from ${price}</span>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span className="text-[12px] text-ink-mute">next · {c.nextSlot}</span>
                <PillButton onClick={() => toast.success(`consult requested at ${c.name}. we'll text you to confirm.`)} className="h-10 px-5 text-[13px]">
                  book consult
                </PillButton>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
