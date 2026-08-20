import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Check } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { PillButton } from "@/components/treatme/PillButton";
import { formatPhoneInput } from "@/lib/format";
import { directoryQuery } from "@/lib/search-data";

export const Route = createFileRoute("/claim/$id")({
  head: () => ({
    meta: [
      { title: "claim your clinic | treatme" },
      {
        name: "description",
        content:
          "leave your work email and phone number and the treatme team will reach out to verify your clinic and hand over the storefront.",
      },
      { property: "og:title", content: "claim your clinic | treatme" },
      {
        property: "og:description",
        content: "verify your clinic on treatme and take over your storefront.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(directoryQuery);
    const storefront = data.storefronts.find((s) => s.id === params.id || s.slug === params.id);
    return {
      clinic: storefront ? { id: storefront.id, name: storefront.name, city: storefront.city } : null,
    };
  },
  errorComponent: ({ error }) => (
    <div className="px-6 pt-10" role="alert">
      <h1 className="text-[24px] font-medium lowercase">couldn't load this page.</h1>
      <p className="mt-2 text-[13px] lowercase text-ink/60">{error.message}</p>
    </div>
  ),
  component: ClaimRoute,
});

function Field({
  label,
  value,
  onChange,
  type,
  inputMode,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  inputMode?: "email" | "tel";
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink/50">
        {label}
      </span>
      <input
        value={value}
        type={type}
        inputMode={inputMode}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-[14px] border border-ink/10 bg-white px-4 py-3 text-[15px] lowercase outline-none focus:border-ink/40"
      />
    </label>
  );
}

function ClaimRoute() {
  const { clinic } = Route.useLoaderData();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const emailOk = /.+@.+\..+/.test(email.trim());
  const phoneOk = phone.replace(/\D/g, "").length >= 10;
  const canSubmit = emailOk && phoneOk && !!clinic;

  async function submit() {
    if (!clinic) return;
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("storefront_claims").insert({
        storefront_id: clinic.id,
        contact_name: name.trim() || null,
        role: role.trim() || null,
        work_email: email.trim().toLowerCase(),
        work_phone: phone.trim(),
        note: note.trim() || null,
        created_by: auth.user?.id ?? null,
      });
      if (error) throw error;
      setSent(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message.toLowerCase() : "that didn't send.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-dvh bg-cream pb-24">
      <div className="flex items-center gap-2 px-4 pt-4">
        <button
          type="button"
          aria-label="go back"
          onClick={() => navigate({ to: "/storefront/$id", params: { id: clinic?.id ?? "" } })}
          className="grid size-9 place-items-center rounded-full border border-ink/10 bg-white"
        >
          <ChevronLeft className="size-5" />
        </button>
      </div>

      <div className="px-5 pt-4">
        <h1 className="text-[28px] font-medium lowercase leading-tight tracking-[-0.02em]">
          claim {clinic ? clinic.name.toLowerCase() : "this storefront"}
        </h1>

        {sent ? (
          <div className="mt-5 rounded-[18px] border border-ink/10 bg-white p-5">
            <span className="grid size-10 place-items-center rounded-full bg-[#F8A1C6]">
              <Check className="size-5" strokeWidth={3} />
            </span>
            <h2 className="mt-3 text-[18px] font-medium lowercase">we got it.</h2>
            <p className="mt-1.5 text-[13.5px] lowercase leading-relaxed text-ink/70">
              our team will reach out to {email.trim().toLowerCase()} or {phone} within two business
              days to verify you work here and hand over the page.
            </p>
            <Link
              to="/storefront/$id"
              params={{ id: clinic?.id ?? "" }}
              className="mt-4 inline-block rounded-pill bg-ink px-4 py-2 text-[13px] font-semibold lowercase text-cream"
            >
              back to the clinic
            </Link>
          </div>
        ) : (
          <>
            <p className="mt-2 text-[13.5px] lowercase leading-relaxed text-ink/70">
              leave your work email and phone number and we will contact you to verify you work here.
              then you can add your team, devices and booking.
            </p>

            <div className="mt-5 flex flex-col gap-3">
              <Field label="your name" value={name} onChange={setName} placeholder="first and last" />
              <Field
                label="your role"
                value={role}
                onChange={setRole}
                placeholder="owner, manager, injector"
              />
              <Field
                label="work email"
                value={email}
                onChange={setEmail}
                inputMode="email"
                type="email"
                placeholder="you@clinic.com"
              />
              <Field
                label="work phone number"
                value={phone}
                onChange={(v) => setPhone(formatPhoneInput(v))}
                inputMode="tel"
                placeholder="226-751-3325"
              />
              <label className="block">
                <span className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink/50">
                  anything else
                </span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="best time to reach you"
                  className="mt-1.5 w-full rounded-[14px] border border-ink/10 bg-white px-4 py-3 text-[15px] lowercase outline-none focus:border-ink/40"
                />
              </label>

              <PillButton fullWidth disabled={busy || !canSubmit} onClick={submit}>
                {busy ? "sending" : "request a call"}
              </PillButton>

              <p className="text-[11.5px] lowercase leading-relaxed text-ink/45">
                we only use these to verify the clinic. no marketing.
              </p>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
