import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Star } from "lucide-react";

import { treatmentDetailQuery } from "@/lib/treatment-detail";
import { treatmentReviewsQuery } from "@/lib/treatment-reviews";
import { reviewDate } from "@/lib/provider-profile";
import { directoryQuery } from "@/lib/search-data";

export const Route = createFileRoute("/treatment/$slug/reviews")({
  head: ({ params }) => {
    const pretty = params.slug.replace(/-/g, " ");
    const title = `what people think about ${pretty} · treatme`;
    const description = `real reviews of ${pretty} from verified providers and clinics on treatme, with before and after photos where shared.`;
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
  component: TreatmentReviewsPage,
});

const HOT = "#FF1F87";

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className="size-3.5"
          strokeWidth={2.2}
          style={{ color: i <= Math.round(rating) ? HOT : "rgba(17,17,17,0.2)" }}
          fill={i <= Math.round(rating) ? HOT : "transparent"}
        />
      ))}
    </span>
  );
}

function TreatmentReviewsPage() {
  const { slug } = Route.useParams();
  const { data: treatment } = useQuery(treatmentDetailQuery(slug));
  const { data: reviews, isLoading } = useQuery(treatmentReviewsQuery(slug));
  const { data: directory } = useQuery(directoryQuery);

  const providerById = useMemo(() => {
    const map = new Map<string, { name: string; clinic?: { id: string; name: string } }>();
    for (const p of directory?.providers ?? []) {
      const shop = p.storefronts.find((s) => s.is_primary) ?? p.storefronts[0];
      map.set(p.id, {
        name: p.name.toLowerCase(),
        clinic: shop ? { id: shop.id, name: shop.name.replace(/&/g, "and") } : undefined,
      });
    }
    return map;
  }, [directory]);

  return (
    <div className="pb-24">
      <div className="px-4 pt-2">
        <Link
          to="/treatment/$slug"
          params={{ slug }}
          className="inline-flex items-center gap-1.5 text-[13px] font-bold lowercase text-ink/55"
        >
          <ArrowLeft className="size-4" strokeWidth={2.4} /> back
        </Link>
      </div>

      <header className="px-4 pt-3">
        <p className="text-[11px] font-bold lowercase text-ink/55">what people think</p>
        <h1 className="mt-0.5 text-[22px] font-medium lowercase leading-[1.15] tracking-[-0.02em] text-ink">
          {treatment?.name ?? slug.replace(/-/g, " ")}
          <span style={{ color: HOT }}>.</span>
        </h1>
      </header>

      {isLoading ? (
        <p className="px-4 pt-6 text-[14px] lowercase text-ink/55">loading reviews...</p>
      ) : (reviews ?? []).length === 0 ? (
        <div className="mx-4 mt-5 rounded-[16px] border border-dashed border-[rgba(17,17,17,0.22)] px-4 py-6">
          <p className="text-[14px] font-bold lowercase text-ink">no reviews yet.</p>
          <p className="mt-1 text-[13px] lowercase text-ink/55">
            be the first to share your results.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-3 px-4">
          {(reviews ?? []).map((r) => {
            const p = providerById.get(r.provider_id);
            return (
              <article
                key={r.id}
                className="rounded-[16px] border border-[rgba(17,17,17,0.10)] px-4 py-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <Stars rating={r.rating} />
                  <span className="text-[12px] lowercase text-ink/50">
                    {reviewDate(r.reviewed_at)}
                  </span>
                </div>
                <p className="mt-2 text-[13px] font-bold lowercase text-ink">{r.reviewer_name}</p>
                <p className="mt-1.5 text-[14px] leading-[1.5] lowercase text-ink">{r.body}</p>

                {p && (
                  <div className="mt-3 rounded-[12px] bg-bubblegum/20 px-3 py-2.5">
                    <p className="text-[11px] font-bold lowercase text-ink/55">treated by</p>
                    <Link
                      to="/provider/$id"
                      params={{ id: r.provider_id }}
                      className="mt-0.5 block text-[13px] font-bold lowercase text-ink underline"
                    >
                      {p.name}
                    </Link>
                    {p.clinic && (
                      <Link
                        to="/storefront/$id"
                        params={{ id: p.clinic.id }}
                        className="mt-0.5 block text-[12px] lowercase text-ink/70 underline"
                      >
                        {p.clinic.name}
                      </Link>
                    )}
                  </div>
                )}

                {r.before_url && r.after_url && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {[
                      { label: "before", url: r.before_url },
                      { label: "after", url: r.after_url },
                    ].map((img) => (
                      <figure key={img.label} className="overflow-hidden rounded-[12px]">
                        <img
                          src={img.url}
                          alt={`${img.label} ${treatment?.name ?? "treatment"} with ${p?.name ?? "a verified provider"}`}
                          loading="lazy"
                          className="aspect-[3/4] w-full object-cover"
                        />
                        <figcaption className="mt-1 text-[11px] font-bold lowercase text-ink/55">
                          {img.label}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
