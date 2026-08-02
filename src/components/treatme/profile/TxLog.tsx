import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { INK } from "@/lib/treatment-catalog";
import { displayTreatmentName } from "@/lib/treatment-labels";

interface LogMedia {
  id: string;
  url: string;
  kind: string;
}

interface LogEntry {
  id: string;
  treatment_slug: string;
  performed_at: string;
  product_name: string | null;
  amount: number | null;
  amount_unit: string | null;
  price_paid: number | null;
  areas_treated: string[] | null;
  provider_notes: string | null;
  next_due_at: string | null;
  provider_id: string | null;
  provider_name: string | null;
  storefront_name: string | null;
  provider_slug: string | null;
  treatment_name: string;
  media: LogMedia[];
}

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

function shortDate(iso: string) {
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]?.slice(0, 3)} ${d.getDate()}, ${d.getFullYear()}`;
}

function monthYear(iso: string) {
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

async function fetchLog(): Promise<LogEntry[]> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return [];
  const { data, error } = await supabase
    .from("treatment_log")
    .select(
      "id, treatment_slug, performed_at, product_name, amount, amount_unit, price_paid, areas_treated, provider_notes, next_due_at, provider_id",
    )
    .order("performed_at", { ascending: false });
  if (error || !data || data.length === 0) return [];

  const ids = data.map((r) => r.id);
  const providerIds = Array.from(new Set(data.map((r) => r.provider_id).filter((v): v is string => Boolean(v))));
  const slugs = Array.from(new Set(data.map((r) => r.treatment_slug)));

  const [mediaRes, provRes, txRes] = await Promise.all([
    supabase.from("treatment_log_media").select("id, log_id, url, kind").in("log_id", ids),
    providerIds.length
      ? supabase.from("providers").select("id, slug, name").in("id", providerIds)
      : Promise.resolve({ data: [], error: null } as const),
    supabase.from("treatments").select("slug, name").in("slug", slugs),
  ]);

  const storefrontRes = providerIds.length
    ? await supabase
        .from("provider_storefronts")
        .select("provider_id, is_primary, storefronts(name)")
        .in("provider_id", providerIds)
    : ({ data: [] } as { data: Array<{ provider_id: string; is_primary: boolean; storefronts: { name: string } | null }> });

  return data.map((r) => {
    const prov = (provRes.data ?? []).find((p) => p.id === r.provider_id);
    const store = (storefrontRes.data ?? []).find((s) => s.provider_id === r.provider_id);
    const tx = (txRes.data ?? []).find((t) => t.slug === r.treatment_slug);
    return {
      ...r,
      provider_name: prov?.name ?? null,
      provider_slug: prov?.slug ?? null,
      storefront_name: store?.storefronts?.name ?? null,
      treatment_name: displayTreatmentName(tx?.name ?? r.treatment_slug.replace(/-/g, " ")),
      media: (mediaRes.data ?? []).filter((m) => m.log_id === r.id).map((m) => ({ id: m.id, url: m.url, kind: m.kind })),
    };
  });
}

export function TxLog() {
  const navigate = useNavigate();
  const [zoom, setZoom] = useState<string | null>(null);
  const { data: entries = [] } = useQuery({ queryKey: ["treatment-log"], queryFn: fetchLog });

  let lastYear: number | null = null;

  return (
    <section className="mt-8">
      <h2 className="text-[17px] font-semibold lowercase" style={{ color: INK }}>
        tx log
      </h2>

      {entries.length === 0 ? (
        <p className="mt-2 text-[12.5px] lowercase" style={{ color: "rgba(17,17,17,0.55)" }}>
          your record starts with your first booking.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {entries.map((e) => {
            const year = new Date(e.performed_at).getFullYear();
            const showYear = lastYear !== null && year !== lastYear;
            lastYear = year;
            const pills = [
              e.amount !== null ? `${e.amount}${e.amount_unit ? ` ${e.amount_unit}` : ""}` : null,
              e.price_paid !== null ? `$${e.price_paid}` : null,
              ...(e.areas_treated ?? []),
            ].filter((v): v is string => Boolean(v));

            return (
              <div key={e.id}>
                {showYear && (
                  <p className="mb-2 text-[11px] lowercase tracking-widest" style={{ color: "rgba(17,17,17,0.45)" }}>
                    {year}
                  </p>
                )}
                <article
                  className="rounded-[18px] border p-4"
                  style={{ borderColor: "rgba(17,17,17,0.10)", backgroundColor: "#FFFFFF" }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[14.5px] font-medium lowercase" style={{ color: INK }}>
                      {e.treatment_name}
                      {e.product_name ? ` · ${e.product_name.toLowerCase()}` : ""}
                    </p>
                    <p className="shrink-0 text-[12px] lowercase" style={{ color: "rgba(17,17,17,0.50)" }}>
                      {shortDate(e.performed_at)}
                    </p>
                  </div>

                  {pills.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {pills.map((p) => (
                        <span
                          key={p}
                          className="rounded-full px-2.5 py-1 text-[11.5px] lowercase"
                          style={{ backgroundColor: "#FCFBF7", border: "1px solid rgba(17,17,17,0.10)", color: INK }}
                        >
                          {p.toLowerCase()}
                        </span>
                      ))}
                    </div>
                  )}

                  {(e.provider_name || e.storefront_name) && (
                    <button
                      type="button"
                      disabled={!e.provider_slug}
                      onClick={() =>
                        e.provider_slug && navigate({ to: "/providers/$slug", params: { slug: e.provider_slug } })
                      }
                      className="mt-2 block text-left text-[12.5px] lowercase"
                      style={{ color: "rgba(17,17,17,0.60)" }}
                    >
                      {[e.provider_name, e.storefront_name].filter(Boolean).join(" at ")?.toLowerCase()}
                    </button>
                  )}

                  {e.provider_notes && (
                    <p
                      className="mt-3 rounded-[14px] border p-3 text-[12.5px] lowercase leading-snug"
                      style={{ borderColor: "rgba(17,17,17,0.08)", backgroundColor: "#FFFFFF", color: "rgba(17,17,17,0.75)" }}
                    >
                      {e.provider_notes.toLowerCase()}
                    </p>
                  )}

                  {e.media.length > 0 && (
                    <div className="mt-3 flex gap-2 overflow-x-auto">
                      {e.media.map((m) => (
                        <button key={m.id} type="button" onClick={() => setZoom(m.url)} className="shrink-0">
                          <img src={m.url} alt={m.kind} className="size-16 rounded-[12px] object-cover" />
                        </button>
                      ))}
                    </div>
                  )}

                  {e.next_due_at && (
                    <div className="mt-3 flex items-center gap-1.5">
                      <Bell className="size-[13px]" style={{ color: "#FF1F87" }} strokeWidth={2} />
                      <span className="text-[12px] lowercase" style={{ color: INK }}>
                        due again around {monthYear(e.next_due_at)}
                      </span>
                    </div>
                  )}
                </article>
              </div>
            );
          })}
        </div>
      )}

      {zoom && (
        <div className="fixed inset-0 z-50 grid place-items-center" style={{ backgroundColor: "rgba(17,17,17,0.92)" }}>
          <button
            type="button"
            aria-label="close"
            onClick={() => setZoom(null)}
            className="absolute right-5 top-5 grid size-9 place-items-center rounded-full"
            style={{ backgroundColor: "rgba(252,251,247,0.15)" }}
          >
            <X className="size-5" style={{ color: "#FCFBF7" }} />
          </button>
          <img src={zoom} alt="treatment photo" className="max-h-[80vh] max-w-[92vw] rounded-[18px] object-contain" />
        </div>
      )}
    </section>
  );
}
