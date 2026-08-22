import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, Clock, Lock, Minus, Plus, Star } from "lucide-react";

import { ClinicsOffering } from "@/components/treatme/ClinicsOffering";
import { ProviderCard } from "@/components/treatme/ProviderCard";
import { treatmentDetailQuery, type TreatmentDetail } from "@/lib/treatment-detail";
import { directoryQuery, distanceKm, TORONTO_CENTROID } from "@/lib/search-data";

export const Route = createFileRoute("/treatment/$slug/")({
  head: ({ params }) => {
    const pretty = params.slug.replace(/-/g, " ");
    const title = `${pretty} · treatme`;
    const description = `what ${pretty} does, the downtime, the typical range, and the verified providers near you who offer it.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  errorComponent: ({ error }) => (
    <div className="px-6 pt-10" role="alert">
      <p className="brand-eyebrow">something broke</p>
      <h1 className="brand-display text-[26px] mt-2">couldn't load this treatment.</h1>
      <p className="mt-2 text-[13px] text-ink-mute">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => <div className="px-6 pt-10 lowercase">no treatment here.</div>,
  component: TreatmentDetailPage,
});

const MINT = "#DFFFF8";
const HOT = "#FF1F87";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[12px] font-bold lowercase text-ink">{children}</h2>;
}

function TreatmentDetailPage() {
  const { slug } = Route.useParams();
  const { data: treatment, isLoading } = useQuery(treatmentDetailQuery(slug));
  const { data: directory } = useQuery(directoryQuery);
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  const providers = useMemo(() => {
    if (!directory) return [];
    return directory.providers
      .filter((p) => p.treatments.some((t) => t.treatment_slug === slug))
      .slice(0, 2);
  }, [directory, slug]);


  if (isLoading) {
    return <div className="px-6 pt-8 text-[14px] lowercase text-ink/55">loading treatment...</div>;
  }
  if (!treatment) {
    return <div className="px-6 pt-8 text-[14px] lowercase text-ink/55">no treatment here.</div>;
  }

  const t: TreatmentDetail = treatment;
  const stats: Array<{ label: string; value: string; icon?: boolean }> = [];
  if (t.price_from !== null) stats.push({ label: "from", value: `$${Math.round(t.price_from)}` });
  if (t.session_minutes !== null) stats.push({ label: "session", value: `${t.session_minutes} min` });
  if (t.downtime_days !== null)
    stats.push({ label: "downtime", value: `${t.downtime_days} days`, icon: true });

  return (
    <div className="pb-28">
      <div className="px-4 pt-2">
        <Link
          to="/treatments"
          className="inline-flex items-center gap-1.5 text-[13px] font-bold lowercase text-ink/55"
        >
          <ArrowLeft className="size-4" strokeWidth={2.4} /> all treatments
        </Link>
      </div>

      {/* hero */}
      <div
        className="mx-4 mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3.5 rounded-[18px] px-4 py-5"
        style={{ backgroundColor: `${t.accent_color}2b` }}
      >
        <span className="grid size-[52px] shrink-0 place-items-center rounded-full bg-white/60 text-[19px] font-bold lowercase text-ink">
          {t.name.charAt(0)}
        </span>
        <div className="min-w-0">
          {t.family && <p className="truncate text-[11px] font-bold lowercase text-ink">{t.family}</p>}
          <h1 className="mt-0.5 text-[22px] font-medium lowercase leading-[1.15] tracking-[-0.02em] text-ink break-words hyphens-auto">
            {t.name}
            <span style={{ color: HOT }}>.</span>
          </h1>
        </div>
      </div>

      {/* stats */}
      {stats.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2 px-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="min-w-0 rounded-[14px] border border-[rgba(17,17,17,0.10)] bg-white px-2.5 py-2.5"
            >
              <p className="flex items-center gap-1 text-[11px] lowercase text-ink/55">
                {s.icon && <Clock className="size-3 shrink-0" />}
                <span className="truncate">{s.label}</span>
              </p>
              <p className="mt-0.5 text-[15px] font-medium lowercase text-ink">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 px-4">
        <Link
          to="/treatment/$slug/reviews"
          params={{ slug }}
          className="flex h-12 w-full items-center justify-center rounded-pill bg-ink text-[14px] font-bold lowercase text-white"
        >
          what people think
        </Link>
      </div>



      {/* concerns */}
      {t.improves.length > 0 && (
        <section className="mt-6 px-4">
          <SectionLabel>skin concerns it helps with</SectionLabel>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {t.improves.map((c) => (
              <span
                key={c}
                className="rounded-pill px-3 py-1.5 text-[12px] font-bold lowercase text-ink"
                style={{ backgroundColor: MINT }}
              >
                {c}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* what it is */}
      {t.what_it_is && (
        <section className="mt-5 px-4">
          <div className="rounded-[18px] bg-bubblegum/25 px-4 py-4">
            <h2 className="text-[12px] font-bold lowercase text-ink">what it is</h2>
            <p className="mt-1.5 text-[14px] leading-[1.5] lowercase text-ink">{t.what_it_is}</p>
          </div>
        </section>
      )}


      {/* who it's for */}
      {t.who_its_for.length > 0 && (
        <section className="mt-6 px-4">
          <SectionLabel>who it's for</SectionLabel>
          <ul className="mt-2.5 space-y-2">
            {t.who_its_for.map((w) => (
              <li key={w} className="flex gap-2.5">
                <span
                  className="mt-[7px] size-[6px] shrink-0 rounded-full"
                  style={{ backgroundColor: HOT }}
                />
                <span className="min-w-0 text-[14px] leading-[1.45] lowercase text-ink">{w}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* downtime */}
      {t.sensation && (
        <section className="mt-6 px-4">
          <SectionLabel>downtime</SectionLabel>
          <p className="mt-1.5 text-[14px] leading-[1.5] lowercase text-ink">{t.sensation}</p>
        </section>
      )}

      {/* real results */}
      <section className="mt-6 px-4">
        <SectionLabel>real results</SectionLabel>
        <div className="mt-2.5 flex items-center gap-3 rounded-[16px] border border-dashed border-[rgba(17,17,17,0.22)] px-3.5 py-4">
          <span
            className="grid size-9 shrink-0 place-items-center rounded-full"
            style={{ backgroundColor: MINT }}
          >
            <Lock className="size-4 text-ink" strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-bold lowercase text-ink">real results, coming soon</p>
            <p className="mt-0.5 text-[12px] leading-snug lowercase text-ink/55">
              consented before and afters from real patients. nothing simulated.
            </p>
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-pill border border-[rgba(17,17,17,0.12)] px-3 py-1.5 text-[12px] font-bold lowercase text-ink">
            <Star className="size-3.5 shrink-0" style={{ color: HOT }} strokeWidth={2.2} />
            treatme verified provider
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-pill border border-[rgba(17,17,17,0.12)] px-3 py-1.5 text-[12px] font-bold lowercase text-ink">
            <Check className="size-3.5 shrink-0" style={{ color: HOT }} strokeWidth={2.6} />
            license verified
          </span>
        </div>
      </section>

      {/* providers */}
      {providers.length > 0 && (
        <section className="mt-6 px-4">
          <SectionLabel>providers who offer this</SectionLabel>
          <div className="mt-2.5 space-y-3">
            {providers.map((p) => {
              const shops = [...p.storefronts].sort(
                (a, b) =>
                  distanceKm(TORONTO_CENTROID, { lat: a.lat, lng: a.lng }) -
                  distanceKm(TORONTO_CENTROID, { lat: b.lat, lng: b.lng }),
              );
              const km = shops[0]
                ? distanceKm(TORONTO_CENTROID, { lat: shops[0].lat, lng: shops[0].lng })
                : Number.NaN;
              return <ProviderCard key={p.id} provider={p} km={km} shops={shops} />;
            })}
          </div>
          <div className="mt-3.5 text-center">
            <Link
              to="/search"
              search={{ q: t.name, scope: "providers" }}
              className="text-[14px] font-bold lowercase text-ink underline"
            >
              see all providers
            </Link>
          </div>
        </section>
      )}

      <div className="px-4">
        <ClinicsOffering slug={t.slug} limit={6} />
      </div>

      {/* faqs */}
      {t.faqs.length > 0 && (
        <section className="mt-6 px-4">
          <SectionLabel>questions people ask</SectionLabel>
          <div className="mt-2.5 space-y-2.5">
            {t.faqs.map((f) => {
              const open = openFaq === f.id;
              return (
                <div
                  key={f.id}
                  className="rounded-[14px] border border-[rgba(17,17,17,0.10)] px-3.5 py-3.5"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(open ? null : f.id)}
                    aria-expanded={open}
                    className="flex w-full items-center justify-between gap-2.5 text-left"
                  >
                    <span className="min-w-0 text-[14px] font-bold lowercase text-ink">
                      {f.question}
                    </span>
                    {open ? (
                      <Minus className="size-4 shrink-0 text-ink/50" strokeWidth={2.4} />
                    ) : (
                      <Plus className="size-4 shrink-0 text-ink/50" strokeWidth={2.4} />
                    )}
                  </button>
                  {open && (
                    <p className="mt-2.5 text-[13px] leading-[1.5] lowercase text-ink/70">{f.answer}</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

    </div>
  );
}
