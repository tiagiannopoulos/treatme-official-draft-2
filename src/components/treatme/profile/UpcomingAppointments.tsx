import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, MapPin } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { INK, HOT } from "@/lib/treatment-catalog";
import { PillButton } from "@/components/treatme/PillButton";
import { displayTreatmentName } from "@/lib/treatment-labels";
import { myBookingsQuery, slotDateLabel, statusChip } from "@/lib/booking";
import { PROVIDERS_ENABLED } from "@/lib/features";

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

interface Upcoming {
  id: string;
  treatment_name: string;
  due_at: string;
  provider_name: string | null;
  provider_slug: string | null;
  storefront_name: string | null;
  storefront_id: string | null;
}

function longDate(iso: string) {
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function daysAway(iso: string) {
  const diff = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  if (diff <= 0) return "due now";
  if (diff === 1) return "tomorrow";
  if (diff < 30) return `in ${diff} days`;
  const months = Math.round(diff / 30);
  return months === 1 ? "in about a month" : `in about ${months} months`;
}

async function fetchUpcoming(): Promise<Upcoming[]> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return [];

  const { data, error } = await supabase
    .from("treatment_log")
    .select("id, treatment_slug, next_due_at, provider_id")
    .not("next_due_at", "is", null)
    .gte("next_due_at", new Date().toISOString())
    .order("next_due_at", { ascending: true });
  if (error || !data || data.length === 0) return [];

  const providerIds = Array.from(new Set(data.map((r) => r.provider_id).filter((v): v is string => Boolean(v))));
  const slugs = Array.from(new Set(data.map((r) => r.treatment_slug)));

  const [provRes, txRes] = await Promise.all([
    providerIds.length && PROVIDERS_ENABLED
      ? supabase.from("providers").select("id, slug, name").in("id", providerIds)
      : Promise.resolve({ data: [] as Array<{ id: string; slug: string; name: string }> }),
    supabase.from("treatments").select("slug, name").in("slug", slugs),
  ]);

  const storefrontRes = providerIds.length && PROVIDERS_ENABLED
    ? await supabase
        .from("provider_storefronts")
        .select("provider_id, is_primary, storefronts(id, name)")
        .in("provider_id", providerIds)
    : ({ data: [] as Array<{ provider_id: string; is_primary: boolean; storefronts: { id: string; name: string } | null }> });

  return data.map((r) => {
    const prov = (provRes.data ?? []).find((p) => p.id === r.provider_id);
    const store = (storefrontRes.data ?? []).find((s) => s.provider_id === r.provider_id);
    const tx = (txRes.data ?? []).find((t) => t.slug === r.treatment_slug);
    return {
      id: r.id,
      treatment_name: displayTreatmentName(tx?.name ?? r.treatment_slug.replace(/-/g, " ")),
      due_at: r.next_due_at as string,
      provider_name: prov?.name ?? null,
      provider_slug: prov?.slug ?? null,
      storefront_name: store?.storefronts?.name ?? null,
      storefront_id: store?.storefronts?.id ?? null,
    };
  });
}

export function UpcomingAppointments() {
  const navigate = useNavigate();
  const { data: rows = [] } = useQuery({ queryKey: ["upcoming-appointments"], queryFn: fetchUpcoming });
  const { data: requests = [] } = useQuery(myBookingsQuery);
  const isEmpty = rows.length === 0;

  return (
    <section className="mt-8">
      {requests.length > 0 && (
        <div className="mb-8">
          <h2 className="text-[17px] font-semibold lowercase" style={{ color: INK }}>
            requested
          </h2>
          <div className="mt-3 flex flex-col gap-3">
        {requests.map((b) => {
            const chip = statusChip(b.status);
            return (
              <article
                key={b.id}
                className="rounded-[18px] border p-4"
                style={{ borderColor: "rgba(17,17,17,0.14)", backgroundColor: "#FCFBF7" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[14.5px] font-medium lowercase" style={{ color: INK }}>
                    {b.treatmentName.toLowerCase()}
                  </p>
                  <span
                    className="shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-semibold lowercase"
                    style={{ backgroundColor: "#FCFBF7", border: "1px solid rgba(17,17,17,0.14)", color: INK }}
                  >
                    {chip.label}
                  </span>
                </div>
                <p
                  className="mt-2 flex flex-wrap items-center gap-1.5 text-[12.5px] lowercase"
                  style={{ color: "rgba(17,17,17,0.60)" }}
                >
                  <MapPin className="size-3.5" strokeWidth={1.6} />
                  <span>{b.providerName.toLowerCase()}</span>
                  <span>at</span>
                  {b.storefrontId ? (
                    <Link to="/storefront/$id" params={{ id: b.storefrontId }} className="underline decoration-transparent">
                      {b.storefrontName.toLowerCase()}
                      {b.neighbourhood ? ` · ${b.neighbourhood.toLowerCase()}` : ""}
                    </Link>
                  ) : (
                    <span>{b.storefrontName.toLowerCase()}</span>
                  )}
                </p>
                {b.slots.length > 0 && (
                  <p className="mt-2 text-[12px] lowercase" style={{ color: "rgba(17,17,17,0.50)" }}>
                    you asked for {b.slots.map((s) => `${slotDateLabel(s.date)} ${s.time_of_day}`).join(", ")}
                  </p>
                )}
              </article>
            );
          })}
          </div>
        </div>
      )}

      <h2 className="text-[17px] font-semibold lowercase" style={{ color: INK }}>
        upcoming appointments
      </h2>

      {isEmpty ? (
        <div
          className="mt-3 rounded-[18px] border p-6"
          style={{ borderColor: "rgba(17,17,17,0.10)", backgroundColor: "#FFFFFF" }}
        >
          <div className="flex flex-col items-center text-center">
            <span className="grid size-14 place-items-center rounded-full" style={{ backgroundColor: "#F8A1C6" }}>
              <CalendarClock className="size-6" style={{ color: INK }} strokeWidth={1.6} />
            </span>
            <p className="mt-3 text-[15px] font-medium lowercase" style={{ color: INK }}>
              nothing booked yet
            </p>
            <p className="mt-1 max-w-[280px] text-[12.5px] lowercase leading-snug" style={{ color: "rgba(17,17,17,0.55)" }}>
              when you book through treatme, your next visit shows up here with the time, the person doing it, and where to go.
            </p>
            <PillButton
              className="mt-4 h-10 px-5 text-[13px]"
              variant="outline"
              onClick={() => navigate({ to: "/search", search: { q: undefined, scope: undefined } })}
            >
              find a clinic
            </PillButton>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {rows.map((r) => (
            <article
              key={r.id}
              className="rounded-[18px] border p-4"
              style={{ borderColor: "rgba(17,17,17,0.10)", backgroundColor: "#FFFFFF" }}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-[14.5px] font-medium lowercase" style={{ color: INK }}>
                  {r.treatment_name.toLowerCase()}
                </p>
                <span
                  className="shrink-0 rounded-full px-2.5 py-1 text-[11.5px] lowercase"
                  style={{ backgroundColor: "#FCFBF7", border: "1px solid rgba(17,17,17,0.10)", color: HOT }}
                >
                  {daysAway(r.due_at)}
                </span>
              </div>
              <p className="mt-1 text-[12.5px] lowercase" style={{ color: "rgba(17,17,17,0.55)" }}>
                {longDate(r.due_at)}
              </p>
              {(r.provider_name || r.storefront_name) && (
                <p
                  className="mt-2 flex flex-wrap items-center gap-1.5 text-[12.5px] lowercase"
                  style={{ color: "rgba(17,17,17,0.60)" }}
                >
                  <MapPin className="size-3.5" strokeWidth={1.6} />
                  {r.provider_name && (
                    r.provider_slug ? (
                      <Link
                        to="/providers/$slug"
                        params={{ slug: r.provider_slug }}
                        className="underline decoration-transparent"
                      >
                        {r.provider_name.toLowerCase()}
                      </Link>
                    ) : (
                      <span>{r.provider_name.toLowerCase()}</span>
                    )
                  )}
                  {r.provider_name && r.storefront_name && <span>at</span>}
                  {r.storefront_name && (
                    r.storefront_id ? (
                      <Link
                        to="/storefront/$id"
                        params={{ id: r.storefront_id }}
                        className="underline decoration-transparent"
                      >
                        {r.storefront_name}
                      </Link>
                    ) : (
                      <span>{r.storefront_name}</span>
                    )
                  )}
                </p>
              )}
            </article>
          ))}

        </div>
      )}
    </section>
  );
}
