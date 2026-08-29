import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Clock, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { PillButton } from "@/components/treatme/PillButton";
import { treatmentAreasQuery } from "@/lib/treatment-areas";
import { getTreatment } from "@/lib/treatments-data";


export const Route = createFileRoute("/treatments/$slug/")({
  head: ({ params }) => ({
    meta: [
      { title: `${params?.slug?.replace(/-/g, " ") ?? "treatment"} · treatme` },
      { name: "description", content: "before you book — what it is, what to expect, downtime." },
    ],
  }),
  loader: ({ params }) => {
    const t = getTreatment(params.slug);
    if (!t) throw notFound();
    return { treatment: t };
  },
  component: TreatmentDetail,
});

function TreatmentDetail() {
  const data = Route.useLoaderData() as { treatment: NonNullable<ReturnType<typeof getTreatment>> };
  const t = data.treatment;
  const { data: areas = [] } = useQuery(treatmentAreasQuery(t.slug));
  const [selected, setSelected] = useState<string | null>(null);

  const selectedArea = areas.find((a) => a.area_slug === selected) ?? null;
  const displayPrice = selectedArea?.price_from ?? t.priceFrom;

  return (
    <div className="pb-10">
      <div className="px-6 pt-4">
        <Link to="/treatments" className="inline-flex items-center gap-1 text-[13px] font-semibold lowercase text-ink-mute">
          <ArrowLeft className="size-4" /> all treatments
        </Link>
      </div>

      <div className="px-6 mt-3">
        <p className="brand-eyebrow">{t.category}</p>
        <h1 className="brand-display text-[36px] mt-2 text-balance">{t.name}<span className="text-hot">.</span></h1>
        <p className="mt-2 text-ink-mute text-[13px]">
          from <span className="text-ink font-bold">${displayPrice}</span>
          {selectedArea ? <span className="lowercase"> · {selectedArea.name}</span> : null}
        </p>
      </div>

      {areas.length > 0 && (
        <div className="px-6 mt-5">
          <p className="brand-eyebrow">choose your area</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {areas.map((a) => {
              const on = a.area_slug === selected;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelected(on ? null : a.area_slug)}
                  aria-pressed={on}
                  className={`rounded-2xl border p-3 text-left transition-colors ${
                    on ? "border-hot bg-bubblegum/45" : "border-line bg-card hover:bg-bubblegum/20"
                  }`}
                >
                  <p className="text-[14px] font-bold lowercase text-ink">{a.name}</p>
                  <p className="text-[12px] text-ink-mute mt-0.5">
                    {a.price_from != null ? `from $${a.price_from}` : "price at consult"}
                  </p>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[12px] text-ink-mute">optional. the clinic confirms the plan at consult.</p>
        </div>
      )}

      <div className="mx-6 mt-5 rounded-2xl bg-bubblegum/35 p-5">
        <p className="brand-eyebrow">before you book</p>
        <p className="mt-2 text-[15px] leading-relaxed text-ink">{t.whatItIs}</p>
      </div>

      <Section title="what to expect" body={t.whatToExpect} />
      <Section title="downtime" body={t.downtime} icon={<Clock className="size-4" />} />

      <div className="px-6 mt-5">
        <p className="brand-eyebrow">improves</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {t.improves.map((i: string) => (
            <span key={i} className="rounded-full bg-mint text-ink/80 px-3 py-1 text-[12px] font-medium lowercase">{i}</span>
          ))}
        </div>
      </div>

      <div className="px-6 mt-6 flex items-center gap-2 text-[12px] text-ink-mute">
        <ShieldCheck className="size-4 text-ink" />
        every clinic verified. every listing checked.
      </div>

      <div className="px-6 mt-6">
        <Link
          to="/book/consult"
          search={{ treatmentSlug: t.slug }}
        >
          <PillButton fullWidth>
            {selectedArea ? `book ${selectedArea.name.toLowerCase()}` : "book treatment"}
          </PillButton>
        </Link>
      </div>
    </div>
  );

}

function Section({ title, body, icon }: { title: string; body: string; icon?: React.ReactNode }) {
  return (
    <div className="px-6 mt-5">
      <p className="brand-eyebrow flex items-center gap-1">{icon}{title}</p>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">{body}</p>
    </div>
  );
}
