import { Link, useNavigate } from "@tanstack/react-router";
import { MapPin, Star } from "lucide-react";
import { formatDistance, type Provider, type Storefront } from "@/lib/search-data";
import { cn } from "@/lib/utils";
import { useTreatmentSheet } from "@/lib/treatment-sheet-store";

export function Avatar({
  name,
  url,
  size = "size-14",
}: {
  name: string;
  url: string | null;
  size?: string;
}) {
  const initials = name
    .split(" ")
    .filter((w) => !w.startsWith("dr"))
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  if (url) return <img src={url} alt={name} className={cn(size, "rounded-full object-cover")} loading="lazy" />;
  return (
    <span className={cn(size, "rounded-full bg-bubblegum/50 text-ink grid place-items-center font-bold text-[15px]")}>
      {initials}
    </span>
  );
}

/** the core search result unit: a human, always tagged to the storefront they work at. */
export function ProviderCard({
  provider,
  via,
  km,
  shops,
}: {
  provider: Provider;
  via?: string;
  km: number;
  shops: Array<Storefront & { is_primary: boolean }>;
}) {
  const navigate = useNavigate();
  const { openTreatment } = useTreatmentSheet();
  const nearest = shops[0] ?? provider.storefronts[0];
  const otherCount = Math.max(shops.length - 1, 0);
  const specialties = provider.treatments.slice(0, 3);
  const extraSpecialties = Math.max(provider.treatments.length - specialties.length, 0);
  const reviewed = provider.review_count >= 3;

  return (
    <Link
      to="/providers/$slug"
      params={{ slug: provider.slug }}
      className="flex gap-3 rounded-2xl bg-cream p-3.5 border border-[rgba(17,17,17,0.06)] active:scale-[0.98] transition-transform"
    >
      <Avatar name={provider.name} url={provider.avatar_url} size="size-16" />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[16px] font-semibold text-ink lowercase leading-tight truncate">{provider.name}</p>
            <p className="text-[13px] text-ink/60 lowercase truncate">{provider.title}</p>
          </div>
          {Number.isFinite(km) && (
            <span className="shrink-0 text-[12px] text-ink/50 lowercase">{formatDistance(km)}</span>
          )}
        </div>

        {nearest && (
          <span
            role="link"
            tabIndex={0}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              navigate({ to: "/storefront/$id", params: { id: nearest.id } });
            }}
            onKeyDown={(e) => {
              if (e.key !== "Enter" && e.key !== " ") return;
              e.preventDefault();
              e.stopPropagation();
              navigate({ to: "/storefront/$id", params: { id: nearest.id } });
            }}
            className="mt-1.5 inline-flex items-center gap-1 rounded-pill bg-bubblegum/30 px-2 py-1 text-[12px] text-ink lowercase"
          >
            <MapPin className="size-3" />
            at {nearest.name}
            {otherCount > 0 && <span className="text-ink/60">+{otherCount} more</span>}
          </span>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {specialties.map((t) => (
            <span
              key={t.treatment_slug}
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openTreatment(t.treatment_slug);
              }}
              onKeyDown={(e) => {
                if (e.key !== "Enter" && e.key !== " ") return;
                e.preventDefault();
                e.stopPropagation();
                openTreatment(t.treatment_slug);
              }}
              className="rounded-pill border border-[rgba(17,17,17,0.12)] px-2 py-0.5 text-[11px] lowercase"
            >
              {t.name}
            </span>
          ))}
          {extraSpecialties > 0 && <span className="text-[11px] text-ink/50 lowercase">+{extraSpecialties}</span>}
        </div>

        <div className="mt-2 flex items-center gap-2">
          {reviewed ? (
            <span className="inline-flex items-center gap-1 text-[12px] text-ink lowercase">
              <Star className="size-3 fill-ink text-ink" />
              {provider.rating.toFixed(1)}
              <span className="text-ink/60">({provider.review_count})</span>
            </span>
          ) : (
            <span className="rounded-pill bg-butter px-2 py-0.5 text-[11px] font-semibold lowercase">
              new to treatme
            </span>
          )}
          {via && <span className="text-[11px] text-hot lowercase truncate">matched: {via}</span>}
        </div>
      </div>
    </Link>
  );
}

/** compact horizontal-rail card for search results. */
export function ProviderCardCompact({
  provider,
  via,
  km,
  shops,
  widthClass = "w-[172px]",
  matchesSkinType = false,
}: {
  provider: Provider;
  via?: string;
  km: number;
  shops: Array<Storefront & { is_primary: boolean }>;
  widthClass?: string;
  matchesSkinType?: boolean;
}) {
  const navigate = useNavigate();
  const nearest = shops[0] ?? provider.storefronts[0];
  const otherCount = Math.max(shops.length - 1, 0);
  const reviewed = provider.review_count >= 3;

  return (
    <Link
      to="/providers/$slug"
      params={{ slug: provider.slug }}
      className={cn(
        "shrink-0 rounded-[20px] border border-line bg-white p-3.5 active:scale-[0.98] transition-transform",
        widthClass,
      )}
    >
      <Avatar name={provider.name} url={provider.avatar_url} size="size-12" />
      {matchesSkinType && (
        <span className="mt-2.5 inline-block rounded-pill bg-mint px-2 py-0.5 text-[10px] font-semibold lowercase">
          matches your skin type
        </span>
      )}

      <p className="mt-3 text-[14px] font-semibold lowercase leading-tight truncate">{provider.name}</p>
      <p className="text-[12px] text-ink/60 lowercase truncate">{provider.title}</p>
      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-ink/70 lowercase">
        {Number.isFinite(km) && <span>{formatDistance(km)}</span>}
        {Number.isFinite(km) && nearest && <span className="text-ink/30">·</span>}
        {nearest && (
          <span
            role="link"
            tabIndex={0}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              navigate({ to: "/storefront/$id", params: { id: nearest.id } });
            }}
            onKeyDown={(e) => {
              if (e.key !== "Enter" && e.key !== " ") return;
              e.preventDefault();
              e.stopPropagation();
              navigate({ to: "/storefront/$id", params: { id: nearest.id } });
            }}
            className="truncate underline decoration-ink/20"
          >
            {nearest.name}
            {otherCount > 0 && <span className="text-ink/50"> +{otherCount}</span>}
          </span>
        )}
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        {reviewed ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-ink lowercase">
            <Star className="size-3 fill-ink text-ink" />
            {provider.rating.toFixed(1)}
          </span>
        ) : (
          <span className="rounded-pill bg-butter px-2 py-0.5 text-[10px] font-semibold lowercase">new</span>
        )}
        {via && <span className="text-[10px] text-hot lowercase truncate">{via}</span>}
      </div>
    </Link>
  );
}

