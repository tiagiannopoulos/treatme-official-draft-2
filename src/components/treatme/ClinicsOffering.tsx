import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, MapPin } from "lucide-react";

import { directoryQuery, formatDistance } from "@/lib/search-data";
import { useNearbyKm } from "@/lib/nearby";

/**
 * clinics that offer a treatment, read from the clinic's own listing rather than
 * a provider record, so a clinic with nobody on their roster still shows up.
 */
export function ClinicsOffering({ slug, limit = 4 }: { slug: string; limit?: number }) {
  const { data } = useQuery(directoryQuery);
  const near = useNearbyKm();

  const rows = (data?.storefronts ?? [])
    .map((s) => {
      const offer = s.listed.find((o) => o.slug === slug);
      const roster = (data?.providers ?? []).some(
        (p) =>
          p.storefronts.some((x) => x.id === s.id) &&
          p.treatments.some((t) => t.treatment_slug === slug),
      );
      if (!offer && !roster) return null;
      return {
        s,
        km: near.kmFor(s.id),
        from: offer?.price_from ?? null,
        viaWebsite: Boolean(offer) && !offer?.verified && !roster,
        evidenceUrl: offer?.verified ? null : (offer?.evidence_url ?? null),
      };
    })
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity))
    .slice(0, limit);

  if (rows.length === 0) return null;

  return (
    <section className="mt-6">
      <p className="brand-eyebrow">clinics that offer this</p>
      <div className="mt-2.5">
        {rows.map((r, i) => (
          <Link
            key={r.s.id}
            to="/storefront/$id"
            params={{ id: r.s.id }}
            className="flex items-center gap-3 py-3"
            style={{ borderTop: i === 0 ? "none" : "1px solid rgba(17,17,17,0.08)" }}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] lowercase">{r.s.name.toLowerCase()}</span>
              <span className="mt-0.5 flex items-center gap-1 text-[11.5px] lowercase text-ink/55">
                <MapPin className="size-3" />
                {r.s.city.toLowerCase()}
                {r.km !== null && ` · ${formatDistance(r.km)}`}
              </span>
              {r.viaWebsite && (
                <span className="mt-1 block text-[11px] lowercase text-ink/45">
                  listed on their website
                  {r.evidenceUrl && (
                    <>
                      {" "}
                      <span className="underline">see the page</span>
                    </>
                  )}
                </span>
              )}
            </span>
            {r.from !== null && (
              <span className="shrink-0 text-[13px] lowercase text-ink/60">
                from ${Math.round(r.from)}
              </span>
            )}
            <ChevronRight className="size-4 shrink-0 text-ink/30" />
          </Link>
        ))}
      </div>
    </section>
  );
}
