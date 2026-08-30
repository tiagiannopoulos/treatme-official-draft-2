import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, NotebookPen, Pencil, Plus, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { INK } from "@/lib/treatment-catalog";
import { PillButton } from "@/components/treatme/PillButton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { displayTreatmentName } from "@/lib/treatment-labels";
import { TxLogEntrySheet, type EditableEntry } from "@/components/treatme/profile/TxLogEntrySheet";

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
  storefront_id: string | null;
  storefront_name_text: string | null;
  provider_name_text: string | null;
  note: string | null;
  source: string;
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
      "id, treatment_slug, performed_at, product_name, amount, amount_unit, price_paid, areas_treated, provider_notes, next_due_at, provider_id, storefront_id, storefront_name_text, provider_name_text, note, source",
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
      provider_name: prov?.name ?? r.provider_name_text ?? null,
      provider_slug: prov?.slug ?? null,
      storefront_name: store?.storefronts?.name ?? r.storefront_name_text ?? null,
      treatment_name: displayTreatmentName(tx?.name ?? r.treatment_slug.replace(/-/g, " ")),
      media: (mediaRes.data ?? []).filter((m) => m.log_id === r.id).map((m) => ({ id: m.id, url: m.url, kind: m.kind })),
    };
  });
}

export function TxLog() {
  const navigate = useNavigate();
  const [zoom, setZoom] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<EditableEntry | null>(null);
  const [reading, setReading] = useState<LogEntry | null>(null);
  const { data: entries = [] } = useQuery({ queryKey: ["treatment-log"], queryFn: fetchLog });

  let lastYear: number | null = null;

  function openAdd() {
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(e: LogEntry) {
    setEditing({
      id: e.id,
      treatment_slug: e.treatment_slug,
      performed_at: e.performed_at,
      storefront_id: e.storefront_id,
      storefront_name_text: e.storefront_name_text,
      provider_id: e.provider_id,
      provider_name_text: e.provider_name_text,
      product_name: e.product_name,
      price_paid: e.price_paid,
      areas_treated: e.areas_treated,
      next_due_at: e.next_due_at,
      note: e.note,
    });
    setSheetOpen(true);
  }

  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[17px] font-semibold lowercase" style={{ color: INK }}>
          tx log
        </h2>
        <button
          type="button"
          onClick={openAdd}
          className="flex items-center gap-1 text-[13px] lowercase"
          style={{ color: INK }}
        >
          <Plus className="size-[14px]" strokeWidth={2} />
          add
        </button>
      </div>
      <p className="mt-1 text-[12.5px] lowercase" style={{ color: "rgba(17,17,17,0.55)" }}>
        every treatment you have had, in one place
      </p>

      {entries.length === 0 ? (
        <div
          className="mt-3 rounded-[18px] border p-6"
          style={{ borderColor: "rgba(17,17,17,0.10)", backgroundColor: "#FFFFFF" }}
        >
          <div className="flex flex-col items-center text-center">
            <span className="grid size-14 place-items-center rounded-full" style={{ backgroundColor: "#FFEDB4" }}>
              <NotebookPen className="size-6" style={{ color: INK }} strokeWidth={1.6} />
            </span>
            <p className="mt-3 text-[15px] font-medium lowercase" style={{ color: INK }}>
              your record starts with your first booking
            </p>
            <p className="mt-1 max-w-[280px] text-[12.5px] lowercase leading-snug" style={{ color: "rgba(17,17,17,0.55)" }}>
              book through treatme and your provider records what they did, what they used, and when you are due again. it stays yours, wherever you go next.
            </p>
            <PillButton
              className="mt-4 h-10 px-5 text-[13px]"
              variant="outline"
              onClick={() => navigate({ to: "/search", search: { q: undefined, scope: undefined, treatment: undefined } })}
            >
              find a clinic
            </PillButton>
            <button
              type="button"
              onClick={openAdd}
              className="mt-3 text-[12.5px] lowercase underline"
              style={{ color: "rgba(17,17,17,0.55)" }}
            >
              or add one you have already had
            </button>
          </div>
        </div>
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
                    <div className="flex shrink-0 items-center gap-1.5">
                      <p className="text-[12px] lowercase" style={{ color: "rgba(17,17,17,0.50)" }}>
                        {shortDate(e.performed_at)}
                      </p>
                      {e.source === "self_reported" && (
                        <span
                          className="rounded-full px-2 py-0.5 text-[10.5px] lowercase"
                          style={{
                            backgroundColor: "#FCFBF7",
                            border: "1px solid rgba(17,17,17,0.10)",
                            color: "rgba(17,17,17,0.55)",
                          }}
                        >
                          added by you
                        </span>
                      )}
                    </div>
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
                  {e.source === "self_reported" ? (
                    <button
                      type="button"
                      onClick={() => openEdit(e)}
                      className="mt-3 flex items-center gap-1.5 text-[12.5px] lowercase"
                      style={{ color: INK }}
                    >
                      <Pencil className="size-[13px]" strokeWidth={2} />
                      edit this entry
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setReading(e)}
                      className="mt-3 text-[12.5px] lowercase underline"
                      style={{ color: "rgba(17,17,17,0.55)" }}
                    >
                      view details
                    </button>
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
      <TxLogEntrySheet open={sheetOpen} entry={editing} onClose={() => setSheetOpen(false)} />

      {reading && <ReadOnlyDetail entry={reading} onClose={() => setReading(null)} />}
    </section>
  );
}

/** provider recorded entries open read only. no edit, no delete, anywhere. */
function ReadOnlyDetail({ entry, onClose }: { entry: LogEntry; onClose: () => void }) {
  const rows: Array<[string, string]> = [
    ["when", shortDate(entry.performed_at)],
    entry.provider_name ? ["who did it", entry.provider_name.toLowerCase()] : null,
    entry.storefront_name ? ["where", entry.storefront_name.toLowerCase()] : null,
    entry.product_name ? ["what they used", entry.product_name.toLowerCase()] : null,
    entry.amount !== null ? ["how much was used", `${entry.amount}${entry.amount_unit ? ` ${entry.amount_unit}` : ""}`] : null,
    entry.price_paid !== null ? ["what it cost", `$${entry.price_paid}`] : null,
    entry.areas_treated && entry.areas_treated.length > 0 ? ["areas treated", entry.areas_treated.join(", ").toLowerCase()] : null,
    entry.next_due_at ? ["due again", monthYear(entry.next_due_at)] : null,
    entry.provider_notes ? ["notes from your provider", entry.provider_notes.toLowerCase()] : null,
  ].filter((r): r is [string, string] => Boolean(r));

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-[24px] bg-cream px-5 pb-8 pt-4">
        <SheetHeader className="pb-1 text-left">
          <SheetTitle className="brand-display text-[22px] lowercase">{entry.treatment_name}</SheetTitle>
        </SheetHeader>
        <p className="text-[12.5px] lowercase" style={{ color: "rgba(17,17,17,0.55)" }}>
          recorded by the person who did it
        </p>
        <div
          className="mt-4 overflow-hidden rounded-[18px] border"
          style={{ borderColor: "rgba(17,17,17,0.10)", backgroundColor: "#FFFFFF" }}
        >
          {rows.map(([label, value]) => (
            <div key={label} className="border-b px-4 py-3 last:border-b-0" style={{ borderColor: "rgba(17,17,17,0.08)" }}>
              <p className="text-[11.5px] lowercase" style={{ color: "rgba(17,17,17,0.50)" }}>
                {label}
              </p>
              <p className="mt-0.5 text-[14px] lowercase" style={{ color: INK }}>
                {value}
              </p>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
