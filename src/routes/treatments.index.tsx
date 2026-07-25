import { createFileRoute } from "@tanstack/react-router";
import { TREATMENTS, GROUP_ORDER, GROUP_LABEL, type Treatment } from "@/lib/treatments-data";
import { useTreatmentStory } from "@/lib/treatment-story-store";

export const Route = createFileRoute("/treatments/")({
  head: () => ({
    meta: [
      { title: "treatments · treatme" },
      { name: "description", content: "the treatment library. learn what each one actually does." },
    ],
  }),
  component: TreatmentsPage,
});

function TreatmentsPage() {
  const grouped = GROUP_ORDER.map((g) => ({
    group: g,
    items: TREATMENTS.filter((t) => t.group === g),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="px-6 pt-6 pb-6">
      <p className="brand-eyebrow">the menu</p>
      <h1 className="brand-display text-[36px] mt-2 text-balance">
        treatment library<span className="text-hot">.</span>
      </h1>
      <p className="mt-3 text-ink-mute text-[14px]">
        tap a treatment to open its story.
      </p>

      <div className="mt-8 space-y-10">
        {grouped.map(({ group, items }) => (
          <section key={group}>
            <div className="flex items-baseline justify-between">
              <h2 className="brand-display text-[22px]">{GROUP_LABEL[group]}</h2>
              <p className="text-[11px] text-ink-mute lowercase">{items.length} treatments</p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {items.map((t) => (
                <CoverCard key={t.slug} t={t} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function toneClass(tone: Treatment["heroTone"]) {
  switch (tone) {
    case "butter_scrim": return "bg-butter/60";
    case "mint_scrim": return "bg-mint/60";
    case "bubblegum_scrim": return "bg-bubblegum/55";
    default: return "bg-cream/40";
  }
}

function CoverCard({ t }: { t: Treatment }) {
  const { open } = useTreatmentStory();
  return (
    <button
      type="button"
      onClick={() => open(t.slug)}
      className="text-left rounded-2xl overflow-hidden border border-line bg-cream active:scale-[0.98] transition"
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden">
        <img
          src={t.heroImage}
          alt=""
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className={`absolute inset-0 ${toneClass(t.heroTone)}`} aria-hidden />
      </div>
      <div className="p-3">
        <p className="font-bold text-[14px] tracking-tight leading-tight lowercase line-clamp-1">
          {t.name}
        </p>
        <p className="text-[11px] text-ink-mute mt-1 leading-snug line-clamp-2 lowercase">
          {t.descriptor}
        </p>
        <p className="text-[11px] text-ink-soft font-semibold mt-2">from ${t.priceFrom}</p>
      </div>
    </button>
  );
}
