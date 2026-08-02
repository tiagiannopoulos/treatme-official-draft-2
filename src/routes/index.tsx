import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Sparkles, Lock, BookOpen, TrendingUp, ArrowRight } from "lucide-react";
import { searchTreatmentsQuery, type SearchTreatment } from "@/lib/search-data";
import { useTreatmentStory } from "@/lib/treatment-story-store";
import { PosterCard } from "@/components/treatme/PosterCard";
import { treatmentCatalogQuery } from "@/lib/treatment-catalog";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "treatme — get treated." },
      { name: "description", content: "your tx, matched. scan your skin, find verified providers nearby." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(searchTreatmentsQuery);
  },
  errorComponent: ({ error }) => (
    <div className="px-6 pt-10" role="alert">
      <h1 className="brand-display text-[26px]">couldn't load treatments.</h1>
      <p className="text-[13px] text-ink-mute mt-2">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => <div className="px-6 pt-10">nothing here.</div>,
  component: MenuPage,
});

function MenuPage() {
  const { data: treatments } = useSuspenseQuery(searchTreatmentsQuery);
  const forYou = treatments.slice(0, 4);
  const trending = treatments.slice(4, 8);


  return (
    <div className="pt-5 pb-4 space-y-10">
      {/* 1. CTA / unlock banner */}
      <section className="px-6">

        <div className="mt-6 rounded-3xl bg-bubblegum/45 p-5">
          <div className="flex items-start gap-3">
            <div className="size-11 rounded-full bg-cream grid place-items-center shrink-0">
              <Lock className="size-[18px] text-ink" strokeWidth={2.2} />
            </div>
            <div className="flex-1">
              <p className="font-bold text-[16px] tracking-tight leading-tight">
                your personalized skin consult is waiting
              </p>
              <p className="text-[13px] text-ink-soft mt-1 leading-snug">
                unlock ai-powered treatment recommendations tailored to you.
              </p>
            </div>
          </div>
          <Link
            to="/scan"
            className="mt-4 flex items-center justify-center gap-2 rounded-full bg-cream h-12 font-semibold text-[15px] tracking-tight lowercase shadow-[0_1px_0_rgba(0,0,0,0.04)]"
          >
            <Sparkles className="size-[18px] text-hot" />
            unlock with free scan
          </Link>
        </div>
      </section>

      {/* 2. For you */}
      <TreatmentRail
        eyebrow="For you"
        title="Picked for your skin"
        sub="based on your last scan."
        items={forYou}
        tone="butter"
      />

      {/* 3. Trending now */}
      <TreatmentRail
        eyebrow="Trending now"
        title="What people are booking"
        sub="this week, near you."
        items={trending}
        tone="mint"
        icon={<TrendingUp className="size-[18px] text-ink" strokeWidth={2.2} />}
      />

      {/* 3b. learn about treatments */}
      <StoryRail />

      {/* 4. Education */}
      <section className="px-6">
        <div className="flex items-center gap-2">
          <BookOpen className="size-[18px] text-ink" strokeWidth={2.2} />
          <h2 className="brand-display text-[26px]">Skin education</h2>
        </div>
        <p className="text-[13px] text-ink-mute mt-1">learn the basics before you treat.</p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <EduCard title="what is skin structure?" sub="understanding the layers of your skin." />
          <EduCard title="skin health vs structure" sub="learn the key differences." />
          <EduCard title="common concerns" sub="what affects your skin most." />
          <EduCard title="treatment types explained" sub="from injectables to lasers." />
        </div>
      </section>
    </div>
  );
}

function TreatmentRail({
  eyebrow,
  title,
  sub,
  items,
  tone,
  icon,
}: {
  eyebrow: string;
  title: string;
  sub: string;
  items: SearchTreatment[];
  tone: "butter" | "mint" | "bubblegum";
  icon?: React.ReactNode;
}) {
  const bg = { butter: "bg-butter", mint: "bg-mint", bubblegum: "bg-bubblegum/60" }[tone];
  return (
    <section>
      <div className="px-6 flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2">
            {icon}
            <p className="brand-eyebrow">{eyebrow}</p>
          </div>
          <h2 className="brand-display text-[24px] mt-1">{title}</h2>
          <p className="text-[12px] text-ink-mute">{sub}</p>
        </div>
        <Link to="/treatments" className="text-[12px] font-semibold lowercase text-ink-soft inline-flex items-center gap-0.5">
          see all <ArrowRight className="size-3" />
        </Link>
      </div>

      <div className="mt-4 flex gap-3 overflow-x-auto scrollbar-none px-6 snap-x snap-mandatory">
        {items.map((t) => (
          <StoryCard key={t.slug} t={t} bg={bg} />
        ))}
      </div>
    </section>
  );
}

function StoryCard({ t, bg }: { t: SearchTreatment; bg: string }) {
  const { open } = useTreatmentStory();
  return (
    <button
      type="button"
      onClick={() => open(t.slug)}
      className="snap-start shrink-0 w-[200px] rounded-2xl border border-line bg-cream overflow-hidden text-left"
    >
      <div className={`h-28 ${bg} grid place-items-center overflow-hidden`}>
        {t.hero_image_url ? (
          <img src={t.hero_image_url} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <Sparkles className="size-7 text-ink/40" strokeWidth={1.6} />
        )}
      </div>
      <div className="p-3">
        <p className="font-bold text-[14px] tracking-tight leading-tight lowercase">{t.name}</p>
        <p className="text-[11px] text-ink-mute mt-1 leading-snug line-clamp-2">{t.category || t.family}</p>
        {t.price_from !== null && (
          <p className="text-[11px] text-ink-soft font-semibold mt-2">from ${Math.round(t.price_from)}</p>
        )}
      </div>
    </button>
  );
}


function EduCard({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-line p-4 bg-cream">
      <div className="size-8 rounded-full bg-bubblegum/40 grid place-items-center mb-3">
        <BookOpen className="size-4 text-ink" strokeWidth={2.2} />
      </div>
      <p className="font-bold text-[13px] tracking-tight leading-tight lowercase">{title}</p>
      <p className="text-[11px] text-ink-mute mt-1 leading-snug">{sub}</p>
    </div>
  );
}

/** horizontal poster rail. only treatments with a real story appear here. */
function StoryRail() {
  const navigate = useNavigate();
  const { data: catalog = [] } = useQuery(treatmentCatalogQuery);
  const posters = catalog.filter((t) => t.has_story).slice(0, 10);
  if (posters.length === 0) return null;

  return (
    <section>
      <div className="px-6">
        <p className="brand-eyebrow">learn about treatments</p>
        <p className="mt-1 text-[13px] lowercase text-ink-mute">a minute each, no pressure.</p>
      </div>
      <div className="mt-4 flex gap-3 overflow-x-auto px-6 no-scrollbar">
        {posters.map((t) => (
          <PosterCard
            key={t.slug}
            name={t.name}
            posterUrl={t.poster_url}
            accentColor={t.accent_color}
            hasStory
            meta={t.downtime_label}
            className="w-[150px] shrink-0"
            onPress={() => navigate({ to: "/treatment/$slug", params: { slug: t.slug } })}
          />
        ))}
      </div>
    </section>
  );
}
