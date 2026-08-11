import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { PillButton } from "@/components/treatme/PillButton";
import {
  TIMES_OF_DAY,
  bookingOptionsQuery,
  slotDateLabel,
  submitBookingRequest,
  type PreferredSlot,
  type TimeOfDay,
} from "@/lib/booking";

export const Route = createFileRoute("/book/consult")({
  validateSearch: z.object({
    providerId: z.string().optional(),
    storefrontId: z.string().optional(),
    bundleId: z.string().optional(),
    treatmentSlug: z.string().optional(),
  }),

  head: () => ({
    meta: [
      { title: "request a booking · treatme" },
      { name: "description", content: "pick your times and we confirm one with your treatme provider." },
      { property: "og:title", content: "request a booking · treatme" },
      { property: "og:description", content: "pick your times and we confirm one with your treatme provider." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BookingFlow;
});

const STEPS = ["selection", "times", "details", "review"] as const;

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function BookingFlow() {
  const search = Route.useSearch();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [providerId, setProviderId] = useState(search.providerId ?? "");
  const [storefrontId, setStorefrontId] = useState(search.storefrontId ?? "");
  const [treatmentSlug, setTreatmentSlug] = useState(search.treatmentSlug ?? "");
  const [picker, setPicker] = useState<null | "provider" | "clinic" | "treatment">(null);

  const [slots, setSlots] = useState<PreferredSlot[]>([]);
  const [activeDate, setActiveDate] = useState<string>("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const { data: options } = useQuery(bookingOptionsQuery(providerId || undefined, storefrontId || undefined));

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      const user = data.session?.user ?? null;
      setUserId(user?.id ?? null);
      if (user?.email) setEmail((v) => v || user.email!);
      const meta = (user?.user_metadata ?? {}) as { full_name?: string; phone?: string };
      if (meta.full_name) setName((v) => v || meta.full_name!);
      if (meta.phone) setPhone((v) => v || meta.phone!);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user.id ?? null);
      if (session?.user.email) setEmail((v) => v || session.user.email!);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const provider = options?.providers.find((p) => p.id === providerId) ?? null;
  const clinic = options?.storefronts.find((s) => s.id === storefrontId) ?? null;
  const treatment = options?.treatments.find((t) => t.slug === treatmentSlug) ?? null;

  const days = useMemo(() => {
    const out: Date[] = [];
    const today = new Date();
    for (let i = 0; i < 30; i += 1) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      out.push(d);
    }
    return out;
  }, []);

  useEffect(() => {
    if (!activeDate && days[0]) setActiveDate(dateKey(days[0]));
  }, [activeDate, days]);

  function toggleSlot(date: string, time: TimeOfDay) {
    setSlots((prev) => {
      const exists = prev.find((s) => s.date === date && s.time_of_day === time);
      if (exists) return prev.filter((s) => !(s.date === date && s.time_of_day === time));
      if (prev.length >= 3) {
        toast("that's three times already. remove one to swap.");
        return prev;
      }
      return [...prev, { date, time_of_day: time }];
    });
  }

  const selectionReady = Boolean(providerId && storefrontId && treatmentSlug);
  const detailsReady = name.trim().length > 1 && phone.trim().length > 5 && /.+@.+\..+/.test(email);

  async function send() {
    if (!selectionReady || !userId) return;
    setSending(true);
    try {
      await submitBookingRequest({
        providerId,
        storefrontId,
        treatmentSlug,
        slots,
        note,
        name,
        phone,
        email,
      });
      setSent(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message.toLowerCase() : "something went wrong.");
    } finally {
      setSending(false);
    }
  }

  if (sent) return <SentScreen />;

  return (
    <div className="min-h-screen bg-cream pb-36">
      {/* header + progress */}
      <div className="px-5 pt-5">
        <button
          type="button"
          onClick={() => (step === 0 ? navigate({ to: "/search", search: { q: undefined, scope: undefined } }) : setStep(step - 1))}
          className="inline-flex items-center gap-1 text-[13px] font-semibold lowercase text-ink/60"
        >
          <ArrowLeft className="size-4" /> back
        </button>
        <p className="brand-eyebrow mt-4">step {step + 1} of 4 · {STEPS[step]}</p>
        <h1 className="brand-display text-[30px] mt-1.5 lowercase">
          {step === 0 && "confirm your pick"}
          {step === 1 && "pick a few times"}
          {step === 2 && "your details"}
          {step === 3 && "one last look"}
          <span className="text-hot">.</span>
        </h1>
        <div className="mt-4 flex gap-1.5">
          {STEPS.map((s, i) => (
            <span
              key={s}
              className="h-1 flex-1 rounded-full"
              style={{ backgroundColor: i <= step ? "#111111" : "rgba(17,17,17,0.12)" }}
            />
          ))}
        </div>
      </div>

      {/* step 1 */}
      {step === 0 && (
        <section className="px-5 mt-6">
          <div className="rounded-[18px] border border-line bg-white p-1">
            <SelectionRow
              label="treatment"
              value={treatment ? treatment.name.toLowerCase() : "not picked yet"}
              sub={treatment?.family ? treatment.family.toLowerCase() : null}
              onChange={() => setPicker("treatment")}
            />
            <SelectionRow
              label="provider"
              value={provider ? provider.name.toLowerCase() : "not picked yet"}
              sub={provider?.specialty ? provider.specialty.toLowerCase() : provider?.title?.toLowerCase() ?? null}
              onChange={() => setPicker("provider")}
            />
            <SelectionRow
              label="clinic"
              value={clinic ? clinic.name.toLowerCase() : "not picked yet"}
              sub={clinic ? (clinic.neighbourhood ?? clinic.city ?? "").toLowerCase() || null : null}
              onChange={() => setPicker("clinic")}
              last
            />
          </div>
          <p className="mt-3 text-[12px] lowercase text-ink/55 leading-relaxed">
            nothing is charged here. you are asking for a time, the clinic confirms it.
          </p>
        </section>
      )}

      {/* step 2 */}
      {step === 1 && (
        <section className="px-5 mt-6">
          <p className="text-[13px] lowercase text-ink/60">pick a few times that work. we confirm one.</p>

          <div className="mt-4 -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar">
            {days.map((d) => {
              const key = dateKey(d);
              const on = key === activeDate;
              const chosen = slots.some((s) => s.date === key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveDate(key)}
                  className="shrink-0 rounded-[14px] px-3 py-2 text-center"
                  style={{
                    backgroundColor: on ? "#111111" : chosen ? "#FFEDB4" : "#FFFFFF",
                    color: on ? "#FCFBF7" : "#111111",
                    border: on ? "1px solid #111111" : "1px solid rgba(17,17,17,0.10)",
                  }}
                >
                  <span className="block text-[10px] lowercase opacity-70">{WEEKDAYS[d.getDay()]}</span>
                  <span className="block text-[16px] font-semibold">{d.getDate()}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex gap-2">
            {TIMES_OF_DAY.map((t) => {
              const on = slots.some((s) => s.date === activeDate && s.time_of_day === t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleSlot(activeDate, t)}
                  className="flex-1 rounded-pill py-3 text-[13px] font-semibold lowercase"
                  style={{
                    backgroundColor: on ? "#111111" : "#FFFFFF",
                    color: on ? "#FCFBF7" : "#111111",
                    border: "1px solid rgba(17,17,17,0.12)",
                  }}
                >
                  {t}
                </button>
              );
            })}
          </div>

          <div className="mt-6">
            <p className="brand-eyebrow">your picks · {slots.length} of 3</p>
            <div className="mt-2 flex flex-col gap-2">
              {slots.length === 0 && (
                <p className="text-[13px] lowercase text-ink/45">no times picked yet.</p>
              )}
              {slots.map((s) => (
                <div
                  key={`${s.date}-${s.time_of_day}`}
                  className="flex items-center justify-between rounded-[14px] border border-line bg-white px-4 py-3"
                >
                  <p className="text-[14px] lowercase">
                    {slotDateLabel(s.date)} · {s.time_of_day}
                  </p>
                  <button
                    type="button"
                    onClick={() => toggleSlot(s.date, s.time_of_day)}
                    className="text-[12px] lowercase text-hot"
                  >
                    remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* step 3 */}
      {step === 2 && (
        <section className="px-5 mt-6">
          {!userId && <AuthPrompt />}
          <div className="mt-4 flex flex-col gap-3">
            <Field label="your name" value={name} onChange={setName} placeholder="first and last" />
            <Field label="phone" value={phone} onChange={setPhone} placeholder="best number to text" inputMode="tel" />
            <Field label="email" value={email} onChange={setEmail} placeholder="you@email.com" inputMode="email" />
            <label className="block">
              <span className="brand-eyebrow">anything the provider should know?</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                maxLength={600}
                placeholder="optional. allergies, past treatments, what you want out of it."
                className="mt-1.5 w-full rounded-[14px] border border-line bg-white px-4 py-3 text-[14px] lowercase outline-none focus:border-ink/40"
              />
            </label>
          </div>
        </section>
      )}

      {/* step 4 */}
      {step === 3 && (
        <section className="px-5 mt-6">
          <div className="rounded-[18px] border border-line bg-white p-5">
            <SummaryLine label="treatment" value={treatment?.name.toLowerCase() ?? "not picked"} />
            <SummaryLine label="provider" value={provider?.name.toLowerCase() ?? "not picked"} />
            <SummaryLine
              label="clinic"
              value={`${clinic?.name.toLowerCase() ?? "not picked"}${clinic?.neighbourhood ? ` · ${clinic.neighbourhood.toLowerCase()}` : ""}`}
            />
            <SummaryLine
              label="your times"
              value={slots.length ? slots.map((s) => `${slotDateLabel(s.date)} ${s.time_of_day}`).join(", ") : "any time"}
            />
            <SummaryLine label="name" value={name.toLowerCase()} />
            <SummaryLine label="phone" value={phone} />
            <SummaryLine label="email" value={email.toLowerCase()} />
            {note.trim() && <SummaryLine label="your note" value={note.trim().toLowerCase()} />}
          </div>
          {!userId && <div className="mt-4"><AuthPrompt /></div>}
        </section>
      )}

      {/* footer action */}
      <div className="fixed bottom-[76px] left-0 right-0 px-5">
        {step < 3 ? (
          <PillButton
            fullWidth
            disabled={(step === 0 && !selectionReady) || (step === 1 && slots.length === 0) || (step === 2 && !detailsReady)}
            onClick={() => setStep(step + 1)}
          >
            {step === 0 ? "looks right" : step === 1 ? "continue" : "review request"}
          </PillButton>
        ) : (
          <PillButton fullWidth disabled={sending || !userId || !selectionReady} onClick={send}>
            {sending ? "sending" : "request booking"}
          </PillButton>
        )}
      </div>

      {picker && options && (
        <PickerSheet
          kind={picker}
          options={options}
          onClose={() => setPicker(null)}
          onPick={(value) => {
            if (picker === "provider") setProviderId(value);
            if (picker === "clinic") setStorefrontId(value);
            if (picker === "treatment") setTreatmentSlug(value);
            setPicker(null);
          }}
        />
      )}
    </div>
  );
}

function SelectionRow({
  label,
  value,
  sub,
  onChange,
  last,
}: {
  label: string;
  value: string;
  sub?: string | null;
  onChange: () => void;
  last?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-4"
      style={{ borderBottom: last ? "none" : "1px solid rgba(17,17,17,0.08)" }}
    >
      <div className="flex-1">
        <p className="brand-eyebrow">{label}</p>
        <p className="mt-1 text-[16px] lowercase">{value}</p>
        {sub && <p className="text-[12px] lowercase text-ink/50">{sub}</p>}
      </div>
      <button type="button" onClick={onChange} className="text-[13px] font-semibold lowercase text-hot">
        change
      </button>
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-2.5" style={{ borderBottom: "1px solid rgba(17,17,17,0.06)" }}>
      <p className="brand-eyebrow">{label}</p>
      <p className="mt-0.5 text-[14px] lowercase leading-relaxed">{value}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  inputMode?: "tel" | "email";
}) {
  return (
    <label className="block">
      <span className="brand-eyebrow">{label}</span>
      <input
        value={value}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-[14px] border border-line bg-white px-4 py-3 text-[15px] lowercase outline-none focus:border-ink/40"
      />
    </label>
  );
}

/** browsing never needs an account. sending a request does. */
function AuthPrompt() {
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast("check your email to confirm, then come back to send your request.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast("you're in.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message.toLowerCase() : "that didn't work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-[18px] bg-butter p-5">
      <p className="text-[15px] font-semibold lowercase">
        {mode === "signup" ? "make an account to send this" : "log in to send this"}
      </p>
      <p className="mt-1 text-[12px] lowercase leading-relaxed text-ink/65">
        browsing is always free and open. we only need an account so the clinic can reach you.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        <input
          value={email}
          inputMode="email"
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email"
          className="w-full rounded-[14px] border border-ink/10 bg-white px-4 py-3 text-[15px] lowercase outline-none"
        />
        <input
          value={password}
          type="password"
          onChange={(e) => setPassword(e.target.value)}
          placeholder="password"
          className="w-full rounded-[14px] border border-ink/10 bg-white px-4 py-3 text-[15px] outline-none"
        />
        <PillButton fullWidth disabled={busy || !email || password.length < 6} onClick={go}>
          {mode === "signup" ? "sign up" : "log in"}
        </PillButton>
        <button
          type="button"
          onClick={() => setMode(mode === "signup" ? "login" : "signup")}
          className="text-[12px] lowercase text-ink/60"
        >
          {mode === "signup" ? "already have an account? log in" : "new here? sign up"}
        </button>
      </div>
    </div>
  );
}

function PickerSheet({
  kind,
  options,
  onPick,
  onClose,
}: {
  kind: "provider" | "clinic" | "treatment";
  options: NonNullable<ReturnType<typeof useBookingOptionsType>>;
  onPick: (value: string) => void;
  onClose: () => void;
}) {
  const rows =
    kind === "provider"
      ? options.providers.map((p) => ({ id: p.id, title: p.name, sub: p.specialty ?? p.title ?? "" }))
      : kind === "clinic"
        ? options.storefronts.map((s) => ({ id: s.id, title: s.name, sub: s.neighbourhood ?? s.city ?? "" }))
        : options.treatments.map((t) => ({ id: t.slug, title: t.name, sub: t.family ?? "" }));

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-ink/40" onClick={onClose}>
      <div
        className="max-h-[75vh] w-full overflow-y-auto rounded-t-[22px] bg-cream p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="brand-eyebrow">pick a {kind}</p>
        <div className="mt-3 flex flex-col">
          {rows.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onPick(r.id)}
              className="flex items-center gap-3 py-3 text-left"
              style={{ borderBottom: "1px solid rgba(17,17,17,0.07)" }}
            >
              <div className="flex-1">
                <p className="text-[15px] lowercase">{r.title.toLowerCase()}</p>
                {r.sub && <p className="text-[12px] lowercase text-ink/50">{r.sub.toLowerCase()}</p>}
              </div>
              <ChevronRight className="size-4 opacity-40" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// type helper so the sheet stays in sync with the query shape
declare function useBookingOptionsType(): ReturnType<typeof bookingOptionsQuery>["queryFn"] extends
  | undefined
  | ((...args: never[]) => Promise<infer R>)
  ? R
  : never;

function SentScreen() {
  return (
    <div className="min-h-screen bg-cream px-5 pt-24 pb-32">
      <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-mint">
        <Check className="size-6" />
      </div>
      <h1 className="brand-display text-[32px] mt-6 text-center lowercase">
        request sent<span className="text-hot">.</span>
      </h1>
      <p className="mt-3 text-center text-[14px] lowercase leading-relaxed text-ink/65">
        we'll confirm your time within 24 hours. keep an eye on your phone.
      </p>
      <div className="mt-8 flex flex-col gap-3">
        <Link to="/profile">
          <PillButton fullWidth>view my bookings</PillButton>
        </Link>
        <Link to="/search" search={{ q: undefined, scope: undefined }}>
          <PillButton fullWidth variant="outline">back to search</PillButton>
        </Link>
      </div>
    </div>
  );
}
