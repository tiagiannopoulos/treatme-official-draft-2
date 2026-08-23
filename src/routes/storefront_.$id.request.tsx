import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, ChevronDown, Search } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { directoryQuery } from "@/lib/search-data";
import { storefrontTreatmentsQuery } from "@/lib/storefront-treatments";
import { submitBookingRequest, slotDateLabel, type Flexibility, type PreferredSlot, type TimeOfDay } from "@/lib/booking";
import { sendBookingRequestEmail } from "@/lib/booking-email.functions";
import { displayTreatmentName } from "@/lib/treatment-labels";

const CREAM = "#FCFBF7";
const INK = "#111111";
const MINT = "#DFFFF8";

interface Search_ {
  treatment?: string;
}

export const Route = createFileRoute("/storefront_/$id/request")({
  validateSearch: (search: Record<string, unknown>): Search_ => ({
    treatment: typeof search["treatment"] === "string" ? search["treatment"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "request a time · treatme" },
      {
        name: "description",
        content:
          "tell us when suits you and the treatme team arranges the visit with the clinic for you. this is a request, not a confirmed appointment.",
      },
      { property: "og:title", content: "request a time · treatme" },
      {
        property: "og:description",
        content: "send three times that suit you and we will arrange it with the clinic.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RequestPage,
});

const TIME_LABELS: TimeOfDay[] = ["morning", "afternoon", "evening"];
const FLEX: Flexibility[] = ["very", "somewhat", "these times only"];

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function RequestPage() {
  const { id } = Route.useParams();
  const { treatment: prefill } = Route.useSearch();
  const navigate = useNavigate();

  const { data: directory } = useQuery(directoryQuery);
  const { data: listed = [] } = useQuery(storefrontTreatmentsQuery(id));

  const storefront = directory?.storefronts.find((s) => s.id === id);
  const roster = (directory?.providers ?? []).filter((p) => p.storefronts.some((x) => x.id === id));
  const accent = storefront?.brand_accent || "#F8A1C6";
  const clinicName = (storefront?.name ?? "this clinic").toLowerCase();

  // only what this clinic offers: their own listing first, their roster otherwise.
  const options = useMemo<Array<{ slug: string; name: string }>>(() => {
    if (listed.length) return listed.map((l) => ({ slug: l.slug, name: l.name.toLowerCase() }));
    const seen = new Map<string, string>();
    for (const p of roster) {
      for (const t of p.treatments) {
        if (!seen.has(t.treatment_slug)) {
          seen.set(t.treatment_slug, displayTreatmentName(t.name, t.treatment_slug).toLowerCase());
        }
      }
    }
    return [...seen].map(([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [listed, roster]);

  const [slug, setSlug] = useState(prefill ?? "");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [providerId, setProviderId] = useState("");
  const [slots, setSlots] = useState<Array<{ date: string; time: TimeOfDay }>>([
    { date: "", time: "morning" },
    { date: "", time: "morning" },
    { date: "", time: "morning" },
  ]);
  const [flex, setFlex] = useState<Flexibility>("somewhat");
  const [firstTime, setFirstTime] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (prefill) setSlug(prefill);
  }, [prefill]);

  // prefill the patient's own details when there is a session. signing in is never required.
  useEffect(() => {
    let live = true;
    void (async () => {
      const { data: session } = await supabase.auth.getSession();
      const user = session.session?.user;
      if (!user || !live) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, phone, email")
        .eq("id", user.id)
        .maybeSingle();
      if (!live) return;
      setName((v) => v || (profile?.first_name ?? "").toLowerCase());
      setEmail((v) => v || profile?.email || user.email || "");
      setPhone((v) => v || (profile?.phone ?? ""));
    })();
    return () => {
      live = false;
    };
  }, []);

  const treatmentName = options.find((o) => o.slug === slug)?.name ?? "";
  const ready = Boolean(slug && slots[0]?.date && name.trim() && email.trim() && phone.trim());

  async function submit() {
    if (!ready || busy || !storefront) return;
    setBusy(true);
    setError(null);
    const chosen: PreferredSlot[] = slots
      .filter((s) => s.date)
      .map((s) => ({ date: s.date, time_of_day: s.time }));
    try {
      const requestId = await submitBookingRequest({
        providerId: providerId || null,
        storefrontId: storefront.id,
        treatmentSlug: slug,
        slots: chosen,
        note: notes,
        name,
        phone,
        email,
        flexibility: flex,
        isFirstTime: firstTime,
      });
      // the request is saved. email is best effort and never blocks the patient.
      try {
        await sendBookingRequestEmail({
          data: {
            requestId,
            patientName: name.trim(),
            patientEmail: email.trim(),
            patientPhone: phone.trim(),
            storefrontName: storefront.name,
            storefrontPhone: storefront.phone ?? null,
            storefrontAddress: `${storefront.address_line}, ${storefront.city} ${storefront.postcode ?? ""}`.trim(),
            treatmentName: treatmentName || slug.replace(/-/g, " "),
            providerName: roster.find((p) => p.id === providerId)?.name ?? null,
            preferred: chosen.map((s) => `${slotDateLabel(s.date)} ${s.time_of_day}`),
            flexibility: flex,
            isFirstTime: firstTime,
            notes: notes.trim() || null,
          },
        });
      } catch (mailErr) {
        console.error("booking request email call failed", mailErr);
      }
      setSent(true);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message.toLowerCase() : "something went wrong, try again");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <main className="min-h-dvh px-5 pb-24 pt-16" style={{ backgroundColor: CREAM, color: INK }}>
        <div className="mx-auto max-w-[390px] text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-full" style={{ backgroundColor: MINT }}>
            <Check className="size-7" strokeWidth={2.2} />
          </span>
          <h1 className="mt-5 text-[26px] font-medium lowercase tracking-[-0.02em]">request sent</h1>
          <p className="mt-2.5 text-[14.5px] lowercase leading-relaxed" style={{ color: "rgba(17,17,17,0.65)" }}>
            we will call {clinicName} and confirm a time with you. you will hear back within one business day.
          </p>
          <p className="mt-3 text-[12.5px] lowercase leading-relaxed" style={{ color: "rgba(17,17,17,0.45)" }}>
            this is not a confirmed appointment yet. do not go to the clinic until we come back to you.
          </p>
          <Link
            to="/storefront/$id"
            params={{ id }}
            className="mt-7 block w-full rounded-pill py-3.5 text-[15px] font-semibold lowercase"
            style={{ backgroundColor: accent, color: INK }}
          >
            back to {clinicName}
          </Link>
          <Link to="/profile" className="mt-4 inline-block text-[13.5px] lowercase underline">
            see your requests
          </Link>
        </div>
      </main>
    );
  }

  const filtered = pickerQuery
    ? options.filter((o) => o.name.includes(pickerQuery.trim().toLowerCase()))
    : options;

  return (
    <main className="min-h-dvh px-5 pb-32 pt-4" style={{ backgroundColor: CREAM, color: INK }}>
      <div className="mx-auto max-w-[390px]">
        <button
          type="button"
          onClick={() => navigate({ to: "/storefront/$id", params: { id } })}
          className="flex items-center gap-1.5 text-[13.5px] lowercase"
          style={{ color: "rgba(17,17,17,0.6)" }}
        >
          <ArrowLeft className="size-4" /> back
        </button>

        <h1 className="mt-4 text-[26px] font-medium lowercase tracking-[-0.02em]">request a time</h1>
        <p className="mt-1 text-[14px] lowercase" style={{ color: "rgba(17,17,17,0.6)" }}>
          {clinicName}
        </p>
        <p className="mt-3 text-[13px] lowercase leading-relaxed" style={{ color: "rgba(17,17,17,0.55)" }}>
          this is a request, not a confirmed appointment. we arrange it with the clinic and come back to you.
        </p>

        {/* what you want */}
        <Field label="what you want" required>
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className="flex h-12 w-full items-center justify-between rounded-[14px] border px-4 text-[14.5px] lowercase"
            style={{ borderColor: "rgba(17,17,17,0.14)", backgroundColor: "#FFFFFF" }}
          >
            <span style={{ color: slug ? INK : "rgba(17,17,17,0.4)" }}>
              {treatmentName || (slug ? slug.replace(/-/g, " ") : "choose a treatment")}
            </span>
            <ChevronDown className="size-4" style={{ color: "rgba(17,17,17,0.4)" }} />
          </button>
          {pickerOpen && (
            <div
              className="mt-2 rounded-[14px] border"
              style={{ borderColor: "rgba(17,17,17,0.12)", backgroundColor: "#FFFFFF" }}
            >
              <label className="flex items-center gap-2 px-3.5 py-2.5" style={{ borderBottom: "1px solid rgba(17,17,17,0.08)" }}>
                <Search className="size-4" style={{ color: "rgba(17,17,17,0.35)" }} />
                <input
                  value={pickerQuery}
                  onChange={(e) => setPickerQuery(e.target.value)}
                  placeholder="search what they offer"
                  className="w-full bg-transparent text-[14px] lowercase outline-none"
                />
              </label>
              <div className="max-h-[240px] overflow-y-auto">
                {filtered.length === 0 ? (
                  <p className="px-3.5 py-3 text-[13px] lowercase" style={{ color: "rgba(17,17,17,0.5)" }}>
                    nothing listed under that name. ask for it in the notes below.
                  </p>
                ) : (
                  filtered.map((o) => (
                    <button
                      key={o.slug}
                      type="button"
                      onClick={() => {
                        setSlug(o.slug);
                        setPickerOpen(false);
                        setPickerQuery("");
                      }}
                      className="flex w-full items-center justify-between px-3.5 py-3 text-left text-[14px] lowercase"
                    >
                      {o.name}
                      {o.slug === slug && <Check className="size-4" />}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </Field>

        {/* who with */}
        <Field label="who with">
          <div className="flex flex-wrap gap-2">
            <Chip active={providerId === ""} onClick={() => setProviderId("")}>
              no preference
            </Chip>
            {roster.map((p) => (
              <Chip key={p.id} active={providerId === p.id} onClick={() => setProviderId(p.id)}>
                {p.name.toLowerCase()}
              </Chip>
            ))}
          </div>
        </Field>

        {/* three preferred times */}
        <Field label="three preferred times" required>
          <p className="mb-2 text-[12.5px] lowercase" style={{ color: "rgba(17,17,17,0.5)" }}>
            pick a day and a rough time. we do not hold slots, we ask the clinic.
          </p>
          <div className="flex flex-col gap-2.5">
            {slots.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="date"
                  min={todayIso()}
                  value={s.date}
                  onChange={(e) =>
                    setSlots((prev) => prev.map((row, j) => (j === i ? { ...row, date: e.target.value } : row)))
                  }
                  className="h-12 flex-1 rounded-[14px] border px-3.5 text-[14px] lowercase"
                  style={{ borderColor: "rgba(17,17,17,0.14)", backgroundColor: "#FFFFFF", color: INK }}
                />
                <select
                  value={s.time}
                  onChange={(e) =>
                    setSlots((prev) =>
                      prev.map((row, j) => (j === i ? { ...row, time: e.target.value as TimeOfDay } : row)),
                    )
                  }
                  className="h-12 rounded-[14px] border px-3 text-[14px] lowercase"
                  style={{ borderColor: "rgba(17,17,17,0.14)", backgroundColor: "#FFFFFF", color: INK }}
                >
                  {TIME_LABELS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </Field>

        {/* flexibility */}
        <Field label="how flexible are you">
          <div className="flex flex-wrap gap-2">
            {FLEX.map((f) => (
              <Chip key={f} active={flex === f} onClick={() => setFlex(f)}>
                {f}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="have you been here before">
          <div className="flex gap-2">
            <Chip active={firstTime === false} onClick={() => setFirstTime(false)}>
              yes
            </Chip>
            <Chip active={firstTime === true} onClick={() => setFirstTime(true)}>
              no
            </Chip>
          </div>
        </Field>

        <Field label="your name" required>
          <TextInput value={name} onChange={setName} placeholder="first and last name" />
        </Field>
        <Field label="your email" required>
          <TextInput value={email} onChange={setEmail} placeholder="you@email.com" type="email" />
        </Field>
        <Field label="your phone" required>
          <TextInput value={phone} onChange={setPhone} placeholder="416 000 0000" type="tel" />
        </Field>

        <Field label="anything else">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="anything the clinic should know"
            className="w-full rounded-[14px] border px-3.5 py-3 text-[14px] lowercase"
            style={{ borderColor: "rgba(17,17,17,0.14)", backgroundColor: "#FFFFFF", color: INK }}
          />
        </Field>

        {error && (
          <p className="mt-4 text-[13px] lowercase" style={{ color: "#B00020" }}>
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={!ready || busy}
          onClick={() => void submit()}
          className="mt-6 w-full rounded-pill py-3.5 text-[15px] font-semibold lowercase disabled:opacity-45"
          style={{ backgroundColor: accent, color: INK }}
        >
          {busy ? "sending" : "send request"}
        </button>
        <p className="mt-3 text-center text-[12px] lowercase" style={{ color: "rgba(17,17,17,0.45)" }}>
          you do not need an account to send this
        </p>
      </div>
    </main>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <p className="mb-2 text-[13px] font-semibold lowercase">
        {label}
        {required && <span style={{ color: "rgba(17,17,17,0.4)" }}> required</span>}
      </p>
      {children}
    </section>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-12 w-full rounded-[14px] border px-3.5 text-[14.5px]"
      style={{ borderColor: "rgba(17,17,17,0.14)", backgroundColor: "#FFFFFF", color: INK }}
    />
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-pill px-3.5 py-2 text-[13px] lowercase"
      style={{
        backgroundColor: active ? INK : "#FFFFFF",
        color: active ? CREAM : INK,
        border: `1px solid ${active ? INK : "rgba(17,17,17,0.14)"}`,
      }}
    >
      {children}
    </button>
  );
}
