import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PillButton } from "@/components/treatme/PillButton";
import { displayTreatmentName } from "@/lib/treatment-labels";
import { INK } from "@/lib/treatment-catalog";
import { cn } from "@/lib/utils";

/**
 * manual tx log entry. treatment and date are the only required answers,
 * because someone remembering a treatment from last year will not have the
 * rest and forcing it makes them close the sheet.
 */

export interface EditableEntry {
  id: string;
  treatment_slug: string;
  performed_at: string;
  storefront_id: string | null;
  storefront_name_text: string | null;
  provider_id: string | null;
  provider_name_text: string | null;
  product_name: string | null;
  price_paid: number | null;
  areas_treated: string[] | null;
  next_due_at: string | null;
  note: string | null;
}

const LINE = "rgba(17,17,17,0.10)";
const MUTE = "rgba(17,17,17,0.55)";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function dateOnly(iso: string | null) {
  return iso ? iso.slice(0, 10) : "";
}

function plusMonths(months: number) {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

const treatmentsQuery = {
  queryKey: ["tx-log-treatments"],
  queryFn: async () => {
    const { data, error } = await supabase.from("treatments").select("slug, name").order("name");
    if (error) throw error;
    return (data ?? []).map((t) => ({ slug: t.slug, name: displayTreatmentName(t.name, t.slug) }));
  },
  staleTime: 5 * 60_000,
};

const storefrontsQuery = {
  queryKey: ["tx-log-storefronts"],
  queryFn: async () => {
    const { data, error } = await supabase.from("storefronts").select("id, name, city").order("name");
    if (error) throw error;
    return data ?? [];
  },
  staleTime: 5 * 60_000,
};

const providersQuery = {
  queryKey: ["tx-log-providers"],
  queryFn: async () => {
    const [{ data: provs, error }, { data: links }] = await Promise.all([
      supabase.from("providers").select("id, name, title").order("name"),
      supabase.from("provider_storefronts").select("provider_id, storefront_id"),
    ]);
    if (error) throw error;
    return (provs ?? []).map((p) => ({
      ...p,
      storefrontIds: (links ?? []).filter((l) => l.provider_id === p.id).map((l) => l.storefront_id),
    }));
  },
  staleTime: 5 * 60_000,
};

function FieldLabel({ children, hint }: { children: string; hint?: string }) {
  return (
    <p className="text-[13px] font-semibold lowercase" style={{ color: INK }}>
      {children}
      {hint && (
        <span className="ml-1.5 font-normal" style={{ color: MUTE }}>
          {hint}
        </span>
      )}
    </p>
  );
}

const inputClass = "mt-1.5 w-full rounded-[14px] border bg-white px-4 py-3 text-[15px] lowercase outline-none";
const inputStyle = { borderColor: LINE, color: INK };

/** small search + pick list used for treatments, clinics and providers. */
function Picker({
  placeholder,
  options,
  value,
  onPick,
  otherLabel,
}: {
  placeholder: string;
  options: Array<{ id: string; label: string; sub?: string }>;
  value: { id: string | null; label: string | null };
  onPick: (next: { id: string | null; label: string | null; other?: boolean }) => void;
  otherLabel?: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = needle ? options.filter((o) => o.label.toLowerCase().includes(needle)) : options;
    return filtered.slice(0, 8);
  }, [options, q]);

  if (value.label && !open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setQ("");
        }}
        className={cn(inputClass, "flex items-center justify-between text-left")}
        style={inputStyle}
      >
        <span className="lowercase">{value.label.toLowerCase()}</span>
        <span className="text-[12px] lowercase" style={{ color: MUTE }}>
          change
        </span>
      </button>
    );
  }

  return (
    <div>
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={inputClass}
        style={inputStyle}
      />
      {open && (
        <div className="mt-1.5 overflow-hidden rounded-[14px] border" style={{ borderColor: LINE, backgroundColor: "#FFFFFF" }}>
          {list.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                onPick({ id: o.id, label: o.label });
                setOpen(false);
              }}
              className="flex w-full flex-col border-b px-4 py-3 text-left last:border-b-0"
              style={{ borderColor: "rgba(17,17,17,0.06)" }}
            >
              <span className="text-[14px] lowercase" style={{ color: INK }}>
                {o.label.toLowerCase()}
              </span>
              {o.sub && (
                <span className="text-[12px] lowercase" style={{ color: MUTE }}>
                  {o.sub.toLowerCase()}
                </span>
              )}
            </button>
          ))}
          {otherLabel && (
            <button
              type="button"
              onClick={() => {
                onPick({ id: null, label: null, other: true });
                setOpen(false);
              }}
              className="w-full px-4 py-3 text-left text-[14px] lowercase"
              style={{ color: MUTE }}
            >
              {otherLabel}
            </button>
          )}
          {list.length === 0 && !otherLabel && (
            <p className="px-4 py-3 text-[13px] lowercase" style={{ color: MUTE }}>
              nothing found
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function TxLogEntrySheet({
  open,
  onClose,
  entry,
}: {
  open: boolean;
  onClose: () => void;
  /** present when editing a self reported entry. */
  entry?: EditableEntry | null;
}) {
  const queryClient = useQueryClient();
  const { data: treatments = [] } = useQuery(treatmentsQuery);
  const { data: storefronts = [] } = useQuery(storefrontsQuery);
  const { data: providers = [] } = useQuery(providersQuery);

  const [slug, setSlug] = useState<string | null>(null);
  const [performedAt, setPerformedAt] = useState(today());
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeText, setStoreText] = useState("");
  const [storeOther, setStoreOther] = useState(false);
  const [provId, setProvId] = useState<string | null>(null);
  const [provText, setProvText] = useState("");
  const [provOther, setProvOther] = useState(false);
  const [product, setProduct] = useState("");
  const [price, setPrice] = useState("");
  const [areas, setAreas] = useState<string[]>([]);
  const [nextDue, setNextDue] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSlug(entry?.treatment_slug ?? null);
    setPerformedAt(entry ? dateOnly(entry.performed_at) : today());
    setStoreId(entry?.storefront_id ?? null);
    setStoreText(entry?.storefront_name_text ?? "");
    setStoreOther(Boolean(entry?.storefront_name_text));
    setProvId(entry?.provider_id ?? null);
    setProvText(entry?.provider_name_text ?? "");
    setProvOther(Boolean(entry?.provider_name_text));
    setProduct(entry?.product_name ?? "");
    setPrice(entry?.price_paid !== null && entry?.price_paid !== undefined ? String(entry.price_paid) : "");
    setAreas(entry?.areas_treated ?? []);
    setNextDue(dateOnly(entry?.next_due_at ?? null));
    setNote(entry?.note ?? "");
    setBusy(false);
  }, [open, entry]);

  const { data: areaOptions = [] } = useQuery({
    queryKey: ["tx-log-areas", slug],
    queryFn: async () => {
      if (!slug) return [] as string[];
      const { data } = await supabase.from("treatment_areas").select("name").eq("treatment_slug", slug).order("sort_order");
      return (data ?? []).map((a) => a.name);
    },
    enabled: Boolean(slug),
    staleTime: 5 * 60_000,
  });

  const chips = areaOptions.length > 0 ? areaOptions : ["forehead", "cheeks", "around the eyes", "jawline", "neck", "lips", "chin"];

  const treatmentName = slug ? (treatments.find((t) => t.slug === slug)?.name ?? slug.replace(/-/g, " ")) : null;
  const storeName = storeId ? (storefronts.find((s) => s.id === storeId)?.name ?? null) : null;
  const provName = provId ? (providers.find((p) => p.id === provId)?.name ?? null) : null;

  const providerOptions = providers
    .filter((p) => !storeId || p.storefrontIds.includes(storeId))
    .map((p) => ({ id: p.id, label: p.name, sub: p.title ?? undefined }));

  const canSave = Boolean(slug) && Boolean(performedAt) && !busy;

  async function save() {
    if (!slug || !performedAt) return;
    setBusy(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user.id;
      if (!uid) {
        toast("sign in to add to your record", { duration: 4000 });
        return;
      }
      const payload = {
        user_id: uid,
        treatment_slug: slug,
        performed_at: new Date(`${performedAt}T12:00:00`).toISOString(),
        storefront_id: storeOther ? null : storeId,
        storefront_name_text: storeOther ? (storeText.trim() || null) : null,
        provider_id: provOther ? null : provId,
        provider_name_text: provOther ? (provText.trim() || null) : null,
        product_name: product.trim() || null,
        price_paid: price.trim() === "" ? null : Number(price),
        areas_treated: areas.length > 0 ? areas : null,
        next_due_at: nextDue ? new Date(`${nextDue}T12:00:00`).toISOString() : null,
        note: note.trim() || null,
        source: "self_reported" as const,
      };

      const res = entry
        ? await supabase.from("treatment_log").update(payload).eq("id", entry.id)
        : await supabase.from("treatment_log").insert(payload);
      if (res.error) throw res.error;

      await queryClient.invalidateQueries({ queryKey: ["treatment-log"] });
      void queryClient.invalidateQueries({ queryKey: ["getting-started-counts"] });
      toast(entry ? "entry updated" : "added to your record", { duration: 3000 });
      onClose();
    } catch (error) {
      console.error("tx log save failed", error);
      toast("could not save, try again", { duration: 4000 });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!entry) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("treatment_log").delete().eq("id", entry.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["treatment-log"] });
      toast("entry removed", { duration: 3000 });
      onClose();
    } catch (error) {
      console.error("tx log remove failed", error);
      toast("could not save, try again", { duration: 4000 });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-[24px] bg-cream px-5 pb-8 pt-4">
        <SheetHeader className="pb-1 text-left">
          <SheetTitle className="brand-display text-[22px] lowercase">add a treatment you have had</SheetTitle>
        </SheetHeader>

        <div className="mt-3 flex flex-col gap-4">
          <div>
            <FieldLabel>what you had</FieldLabel>
            <Picker
              placeholder="search treatments"
              options={treatments.map((t) => ({ id: t.slug, label: t.name }))}
              value={{ id: slug, label: treatmentName }}
              onPick={(next) => setSlug(next.id)}
            />
          </div>

          <div>
            <FieldLabel>when</FieldLabel>
            <input
              type="date"
              value={performedAt}
              max={today()}
              onChange={(e) => setPerformedAt(e.target.value)}
              className={inputClass}
              style={inputStyle}
            />
          </div>

          <div>
            <FieldLabel hint="optional">where</FieldLabel>
            {storeOther ? (
              <input
                value={storeText}
                onChange={(e) => setStoreText(e.target.value)}
                placeholder="where was it"
                className={inputClass}
                style={inputStyle}
              />
            ) : (
              <Picker
                placeholder="search clinics"
                options={storefronts.map((s) => ({ id: s.id, label: s.name, sub: s.city }))}
                value={{ id: storeId, label: storeName }}
                otherLabel="somewhere else"
                onPick={(next) => {
                  if (next.other) {
                    setStoreOther(true);
                    setStoreId(null);
                    return;
                  }
                  setStoreId(next.id);
                }}
              />
            )}
            {storeOther && (
              <button
                type="button"
                onClick={() => {
                  setStoreOther(false);
                  setStoreText("");
                }}
                className="mt-1.5 text-[12px] lowercase underline"
                style={{ color: MUTE }}
              >
                pick a clinic instead
              </button>
            )}
          </div>

          <div>
            <FieldLabel hint="optional">who did it</FieldLabel>
            {provOther ? (
              <input
                value={provText}
                onChange={(e) => setProvText(e.target.value)}
                placeholder="who did it"
                className={inputClass}
                style={inputStyle}
              />
            ) : (
              <Picker
                placeholder="search providers"
                options={providerOptions}
                value={{ id: provId, label: provName }}
                otherLabel="someone else"
                onPick={(next) => {
                  if (next.other) {
                    setProvOther(true);
                    setProvId(null);
                    return;
                  }
                  setProvId(next.id);
                }}
              />
            )}
            {provOther && (
              <button
                type="button"
                onClick={() => {
                  setProvOther(false);
                  setProvText("");
                }}
                className="mt-1.5 text-[12px] lowercase underline"
                style={{ color: MUTE }}
              >
                pick a provider instead
              </button>
            )}
          </div>

          <div>
            <FieldLabel hint="optional">what they used</FieldLabel>
            <input
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              placeholder="product or device, if you know it"
              className={inputClass}
              style={inputStyle}
            />
          </div>

          <div>
            <FieldLabel hint="optional">how much</FieldLabel>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[15px]" style={{ color: MUTE }}>
                $
              </span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0"
                className={cn(inputClass, "pl-8")}
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <FieldLabel hint="optional">areas treated</FieldLabel>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {chips.map((c) => {
                const on = areas.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setAreas((prev) => (on ? prev.filter((a) => a !== c) : [...prev, c]))}
                    className="rounded-full border px-3 py-1.5 text-[12.5px] lowercase"
                    style={{
                      borderColor: on ? INK : LINE,
                      backgroundColor: on ? INK : "#FFFFFF",
                      color: on ? "#FCFBF7" : INK,
                    }}
                  >
                    {c.toLowerCase()}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <FieldLabel hint="optional">when you are due again</FieldLabel>
            <input
              type="date"
              value={nextDue}
              onChange={(e) => setNextDue(e.target.value)}
              className={inputClass}
              style={inputStyle}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                { label: "3 months", months: 3 },
                { label: "6 months", months: 6 },
                { label: "a year", months: 12 },
              ].map((q) => (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => setNextDue(plusMonths(q.months))}
                  className="rounded-full border px-3 py-1.5 text-[12.5px] lowercase"
                  style={{ borderColor: LINE, backgroundColor: "#FFFFFF", color: INK }}
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <FieldLabel hint="optional">notes</FieldLabel>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="how it went, what you would change"
              className={inputClass}
              style={inputStyle}
            />
          </div>

          <PillButton className="mt-1 h-12 w-full text-[15px]" onClick={() => void save()} disabled={!canSave}>
            {busy ? "saving" : entry ? "save changes" : "add to my record"}
          </PillButton>

          {entry && (
            <button
              type="button"
              onClick={() => void remove()}
              disabled={busy}
              className="text-[13px] lowercase underline"
              style={{ color: MUTE }}
            >
              remove
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
