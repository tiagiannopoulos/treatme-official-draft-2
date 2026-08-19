import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Sparkles, Lock, BookOpen, ArrowRight, Star, BadgeCheck } from "lucide-react";
import { searchTreatmentsQuery, type SearchTreatment } from "@/lib/search-data";
import { directoryQuery, neighbourhood, type Storefront } from "@/lib/search-data";
import { eduStoriesQuery } from "@/lib/education-story";
import { useAuth } from "@/lib/auth";
import { scanPicksQuery } from "@/lib/home-recommendations";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "treatme | ai skin analysis & med spa booking in toronto" },
      { name: "description", content: "scan your skin free, see what's actually going on, and book the treatment for it at a verified toronto clinic. botox, filler, lasers and more, mapped to your skin." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(searchTreatmentsQuery);
    context.queryClient.ensureQueryData(eduStoriesQuery);
    context.queryClient.ensureQueryData(directoryQuery);
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

/** default city until the patient sets a location. */
const DEFAULT_CITY = "toronto";

function MenuPage() {
  const { data: treatments } = useSuspenseQuery(searchTreatmentsQuery);
  const { data: eduStories } = useSuspenseQuery(eduStoriesQuery);
  const { data: directory } = useSuspenseQuery(directoryQuery);
  const { user } = useAuth();
  const { data: scanPicks } = useQuery(scanPicksQuery(user?.id ?? null));

  const scanned = Boolean(scanPicks?.treatments.length);
  const forYou: SearchTreatment[] = scanned
    ? scanPicks!.treatments.map((r) => ({
        slug: r.slug,
        name: r.name,
        category: r.category,
        family: r.matchedConcerns[0] ?? "",
        price_from: r.price_from,
        hero_image_url: r.hero_image_url,
      }) as unknown as SearchTreatment)
    : treatments.slice(0, 4);

  const clinicsInCity = directory.storefronts.filter((s) =>

    s.city.toLowerCase().includes(DEFAULT_CITY),
  );
  const clinicPool = clinicsInCity.length ? clinicsInCity : directory.storefronts;
  const topClinics = [...clinicPool]
    .sort((a, b) => b.rating - a.rating || b.review_count - a.review_count)
    .slice(0, 10);




  return (
    <div className="pt-5 pb-4 space-y-10">
      {/* 1. CTA / unlock banner, only until the patient has a scan */}
      {!scanned && (
        <section className="px-6">

          <div className="mt-6 rounded-3xl bg-bubblegum/45 p-5">
            <div className="flex items-start gap-3">
              <div className="size-11 rounded-full bg-cream grid place-items-center shrink-0">
                <Lock className="size-[18px] text-ink" strokeWidth={2.2} />
              </div>
              <div className="flex-1">
                <h1 className="font-bold text-[16px] tracking-tight leading-tight">
                  your personalized skin consult is waiting
                </h1>
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
      )}

      {/* 2. For you */}
      <TreatmentRail
        eyebrow={scanned ? "from your scan" : "For you"}
        title="picked for your skin"
        sub={scanned ? "matched to what your scan found" : undefined}
        items={forYou}
        tone="butter"
        headingLevel={scanned ? "h1" : "h2"}
      />
      {/* 3. Clinics near you */}
      <ClinicRail clinics={topClinics} />




      {/* 4. Education */}
      <section className="px-6">
        <div className="flex items-center gap-2">
          <BookOpen className="size-[18px] text-ink" strokeWidth={2.2} />
          <h2 className="brand-display text-[26px]">skin education</h2>
        </div>
        

        <EducationCards stories={eduStories} />
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
  headingLevel = "h2",
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  items: SearchTreatment[];
  tone: "butter" | "mint" | "bubblegum";
  icon?: React.ReactNode;
  headingLevel?: "h1" | "h2";
}) {
  const bg = { butter: "bg-butter", mint: "bg-mint", bubblegum: "bg-bubblegum/60" }[tone];
  const Heading = headingLevel;
  return (
    <section>
      <div className="px-6 flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2">
            {icon}
            <p className="brand-eyebrow">{eyebrow}</p>
          </div>
          <Heading className="brand-display text-[24px] mt-1">{title}</Heading>
          {sub && <p className="text-[12px] text-ink-mute">{sub}</p>}
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

function ClinicRail({ clinics }: { clinics: Storefront[] }) {
  if (!clinics.length) return null;
  return (
    <section>
      <div className="px-6 flex items-end justify-between">
        <div>
          <p className="brand-eyebrow">near you</p>
          <h2 className="brand-display text-[24px] mt-1">clinics near you</h2>
        </div>
        <Link
          to="/search"
          search={{ q: undefined, scope: "medspas" }}
          className="text-[12px] font-semibold lowercase text-ink-soft inline-flex items-center gap-0.5"
        >
          see all <ArrowRight className="size-3" />
        </Link>
      </div>

      <div className="mt-4 flex gap-3 overflow-x-auto scrollbar-none px-6 snap-x snap-mandatory">
        {clinics.map((s) => (
          <ClinicRailCard key={s.id} s={s} />
        ))}
      </div>
    </section>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toLowerCase();
}

function ClinicRailCard({ s }: { s: Storefront }) {
  const hasNative = s.review_count >= 3;
  return (
    <Link
      to="/storefront/$id"
      params={{ id: s.id }}
      className="snap-start shrink-0 w-[200px] rounded-2xl border border-line bg-cream overflow-hidden text-left p-3"
    >
      <div className="flex items-center gap-2">
        {s.logo_url ? (
          <img
            src={s.logo_url}
            alt=""
            loading="lazy"
            className="size-12 rounded-full object-cover shrink-0"
          />
        ) : (
          <div className="size-12 rounded-full bg-mint grid place-items-center shrink-0">
            <span className="font-bold text-[14px] text-ink">{initials(s.name)}</span>
          </div>
        )}
        {s.claimed && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold lowercase text-ink-soft">
            <BadgeCheck className="size-3.5 text-hot" strokeWidth={2.4} />
            verified
          </span>
        )}
      </div>

      <p className="font-bold text-[14px] tracking-tight leading-tight lowercase mt-3 line-clamp-2">
        {s.name.toLowerCase()}
      </p>
      <p className="text-[11px] text-ink-mute mt-0.5 leading-snug lowercase line-clamp-2">
        {neighbourhood(s)} · {s.city.toLowerCase()}
      </p>

      <div className="mt-2">
        {hasNative ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink">
            <Star className="size-3 fill-ink text-ink" />
            {s.rating.toFixed(1)}
            <span className="text-ink-mute font-normal">({s.review_count})</span>
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-bubblegum/50 px-2 py-0.5 text-[10px] font-semibold lowercase text-ink">
            new to treatme
          </span>
        )}
      </div>
    </Link>
  );
}


/** menu cards go to the treatment one pager, never the story player. */
function StoryCard({ t, bg }: { t: SearchTreatment; bg: string }) {

  return (
    <Link
      to="/treatment/$slug"
      params={{ slug: t.slug }}
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
    </Link>
  );
}



function EducationCards({ stories }: { stories: { slug: string; title: string; subtitle: string }[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? stories : stories.slice(0, 4);
  const hiddenCount = stories.length - 4;
  if (!stories.length) return null;
  return (
    <div className="mt-4">
      <div className="grid grid-cols-2 gap-3">
        {visible.map((s) => (
          <EduCard key={s.slug} slug={s.slug} title={s.title} sub={s.subtitle} />
        ))}
      </div>
      {!expanded && hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-4 w-full h-12 rounded-full border border-line bg-cream flex items-center justify-center gap-2 text-[13px] font-semibold lowercase text-ink"
        >
          show {hiddenCount} more
        </button>
      )}
    </div>
  );
}

function EduCard({ slug, title, sub }: { slug: string; title: string; sub: string }) {
  return (
    <Link
      to="/learn/$slug"
      params={{ slug }}
      className="block rounded-2xl border border-line p-4 bg-cream text-left"
    >
      <div className="size-8 rounded-full bg-bubblegum/40 grid place-items-center mb-3">
        <BookOpen className="size-4 text-ink" strokeWidth={2.2} />
      </div>
      <p className="font-bold text-[13px] tracking-tight leading-tight lowercase">{title}</p>
      <p className="text-[11px] text-ink-mute mt-1 leading-snug">{sub}</p>
    </Link>
  );
}
