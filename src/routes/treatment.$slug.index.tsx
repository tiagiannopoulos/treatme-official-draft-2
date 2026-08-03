import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, Clock, Lock, Minus, Plus, Star } from "lucide-react";

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
  return <p className="text-[13px] font-bold lowercase text-ink">{children}</p>;
}

function TreatmentDetailPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { data: treatment, isLoading } = useQuery(treatmentDetailQuery(slug));
  const { data: directory } = useQuery(directoryQuery);
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  const providers = useMemo(() => {
    if (!directory) return [];
    return directory.providers
      .filter((p) => p.treatments.some((t) => t.treatment_slug === slug))
      .slice(0, 2);
  }, [directory, slug]);

  function book() {
    navigate({ to: "/treatments/$slug/book", params: { slug }, search: { area: undefined } });
  }

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
    <div className="pb-32">
      <div className="px-5 pt-2">
        <Link
          to="/treatments"
          className="inline-flex items-center gap-2 text-[15px] font-bold lowercase text-ink/55"
        >
          <ArrowLeft className="size-5" strokeWidth={2.4} /> all treatments
        </Link>
      </div>

      {/* hero */}
      <div
        className="mx-5 mt-5 flex items-center gap-5 rounded-[20px] px-6 py-7"
        style={{ backgroundColor: `${t.accent_color}2b` }}
      >
        <span className="grid size-[74px] shrink-0 place-items-center rounded-full bg-white/60 text-[26px] font-bold lowercase text-ink">
          {t.name.charAt(0)}
        </span>
        <div className="min-w-0">
          {t.family && <p className="text-[13px] font-bold lowercase text-ink">{t.family}</p>}
          <h1 className="mt-1 text-[32px] font-medium lowercase leading-tight tracking-[-0.02em] text-ink break-words">
            {t.name}
            <span style={{ color: HOT }}>.</span>
          </h1>
        </div>
      </div>

      {/* stats */}
      {stats.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-2.5 px-5">
          {stats.map((s) => (
            <div
              key={s.label}
              className="min-w-0 rounded-[16px] border border-[rgba(17,17,17,0.10)] bg-white px-3 py-3"
            >

              <p className="flex items-center gap-1 text-[13px] lowercase text-ink/55">
                {s.icon && <Clock className="size-3.5" />}
                {s.label}
              </p>
              <p className="mt-1 text-[20px] font-medium lowercase text-ink">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* concerns */}
      {t.improves.length > 0 && (
        <section className="mt-7 px-5">
          <SectionLabel>skin concerns it helps with</SectionLabel>
          <div className="mt-3 flex flex-wrap gap-2">
            {t.improves.map((c) => (
              <span
                key={c}
                className="rounded-pill px-4 py-2.5 text-[14px] font-bold lowercase text-ink"
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
        <section className="mt-6 px-5">
          <div className="rounded-[20px] bg-bubblegum/25 px-5 py-5">
            <p className="text-[13px] font-bold lowercase text-ink">what it is</p>
            <p className="mt-2 text-[16px] leading-[1.55] lowercase text-ink">{t.what_it_is}</p>
          </div>
        </section>
      )}

      <div className="mt-6 px-5">
        <button
          type="button"
          onClick={book}
          className="h-14 w-full rounded-pill bg-ink text-[16px] font-bold lowercase text-white"
        >
          book treatment
        </button>
      </div>

      {/* who it's for */}
      {t.who_its_for.length > 0 && (
        <section className="mt-7 px-5">
          <SectionLabel>who it's for</SectionLabel>
          <ul className="mt-3 space-y-2.5">
            {t.who_its_for.map((w) => (
              <li key={w} className="flex gap-3">
                <span
                  className="mt-2 size-[7px] shrink-0 rounded-full"
                  style={{ backgroundColor: HOT }}
                />
                <span className="text-[16px] leading-[1.45] lowercase text-ink">{w}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* downtime */}
      {t.sensation && (
        <section className="mt-7 px-5">
          <SectionLabel>downtime</SectionLabel>
          <p className="mt-2 text-[16px] leading-[1.5] lowercase text-ink">{t.sensation}</p>
        </section>
      )}

      {/* real results */}
      <section className="mt-8 px-5">
        <SectionLabel>real results</SectionLabel>
        <div className="mt-3 flex items-center gap-4 rounded-[18px] border border-dashed border-[rgba(17,17,17,0.22)] px-4 py-5">
          <span
            className="grid size-11 shrink-0 place-items-center rounded-full"
            style={{ backgroundColor: MINT }}
          >
            <Lock className="size-5 text-ink" strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-bold lowercase text-ink">real results, coming soon</p>
            <p className="mt-0.5 text-[14px] leading-snug lowercase text-ink/55">
              consented before and afters from real patients. nothing simulated.
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2.5">
          <span className="inline-flex items-center gap-2 rounded-pill border border-[rgba(17,17,17,0.12)] px-4 py-2.5 text-[14px] font-bold lowercase text-ink">
            <Star className="size-4" style={{ color: HOT }} strokeWidth={2.2} />
            treatme verified provider
          </span>
          <span className="inline-flex items-center gap-2 rounded-pill border border-[rgba(17,17,17,0.12)] px-4 py-2.5 text-[14px] font-bold lowercase text-ink">
            <Check className="size-4" style={{ color: HOT }} strokeWidth={2.6} />
            license verified
          </span>
        </div>
      </section>

      {/* providers */}
      {providers.length > 0 && (
        <section className="mt-8 px-5">
          <SectionLabel>providers who offer this</SectionLabel>
          <div className="mt-3 space-y-3">
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
          <div className="mt-4 text-center">
            <Link
              to="/search"
              search={{ q: t.name, scope: "providers" }}
              className="text-[16px] font-bold lowercase text-ink underline"
            >
              see all providers
            </Link>
          </div>
        </section>
      )}

      {/* faqs */}
      {t.faqs.length > 0 && (
        <section className="mt-8 px-5">
          <SectionLabel>questions people ask</SectionLabel>
          <div className="mt-3 space-y-3">
            {t.faqs.map((f) => {
              const open = openFaq === f.id;
              return (
                <div
                  key={f.id}
                  className="rounded-[16px] border border-[rgba(17,17,17,0.10)] px-4 py-4"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(open ? null : f.id)}
                    aria-expanded={open}
                    className="flex w-full items-center justify-between gap-3 text-left"
                  >
                    <span className="text-[16px] font-bold lowercase text-ink">{f.question}</span>
                    {open ? (
                      <Minus className="size-5 shrink-0 text-ink/50" strokeWidth={2.4} />
                    ) : (
                      <Plus className="size-5 shrink-0 text-ink/50" strokeWidth={2.4} />
                    )}
                  </button>
                  {open && (
                    <p className="mt-3 text-[15px] leading-[1.5] lowercase text-ink/70">{f.answer}</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* floating book bar */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[70px] z-40 px-4 pb-[env(safe-area-inset-bottom)]">
        <button
          type="button"
          onClick={book}
          className="pointer-events-auto h-14 w-full rounded-pill bg-ink text-[16px] font-bold lowercase text-white shadow-[0_12px_30px_-8px_rgba(17,17,17,0.55)] ring-1 ring-white/10 transition-transform duration-200 active:scale-[0.98]"
        >
          book treatment
        </button>
      </div>

    </div>
  );
}
