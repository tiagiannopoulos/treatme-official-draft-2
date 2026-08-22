import { useEffect, useState } from "react";
import { formatPhoneInput } from "@/lib/format";
import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { PillButton } from "@/components/treatme/PillButton";
import { saveMyProfile } from "@/lib/profile";

type Mode = "signup" | "login" | "forgot" | "confirm" | "setup";


const INK = "#111111";

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
      <span className="brand-eyebrow">{label}</span>
      <input
        value={value}
        type={type}
        inputMode={inputMode}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-[14px] border border-ink/10 bg-white px-4 py-3 text-[15px] outline-none focus:border-ink/40"
      />
    </label>
  );
}

export function AuthSheet({
  open,
  headline,
  reason,
  onClose,
  onDone,
}: {
  open: boolean;
  headline?: string;
  reason?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("toronto");
  const [busy, setBusy] = useState(false);
  const [adult, setAdult] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode("signup");
    setPassword("");
    setAdult(false);
    setBusy(false);
  }, [open]);

  if (!open) return null;

  async function submit() {
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.session) {
          setMode("setup");
        } else {
          setMode("confirm");
        }
      } else if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await queryClient.invalidateQueries();
        onDone();
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast("check your email for the reset link.");
        setMode("login");
      } else if (mode === "setup") {
        await saveMyProfile({
          first_name: firstName.trim() || null,
          phone: phone.trim() || null,
          city: city.trim().toLowerCase() || "toronto",
        });
        await queryClient.invalidateQueries();
        onDone();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message.toLowerCase() : "that didn't work.");
    } finally {
      setBusy(false);
    }
  }

  const emailOk = /.+@.+\..+/.test(email);
  const canSubmit =
    mode === "forgot"
      ? emailOk
      : mode === "setup"
        ? firstName.trim().length > 1
        : mode === "confirm"
          ? true
          : mode === "signup"
            ? emailOk && password.length >= 6 && adult
            : emailOk && password.length >= 6;

  return (
    <div className="fixed inset-0 z-[60] flex items-end bg-ink/45" onClick={onClose}>
      <div
        className="w-full rounded-t-[24px] px-5 pb-8 pt-5 max-h-[92vh] overflow-y-auto bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="brand-display text-[26px] lowercase">
              {mode === "setup"
                ? "a couple of details"
                : mode === "forgot"
                  ? "reset your password"
                  : mode === "confirm"
                    ? "check your email"
                    : (headline ?? "save your results")}
            </h2>
            <p className="mt-2 text-[13px] lowercase leading-relaxed text-ink/60">
              {mode === "setup"
                ? "so we don't ask you to type them again when you book."
                : mode === "forgot"
                  ? "we'll email you a link to set a new password."
                  : mode === "confirm"
                    ? "tap the link we sent to finish setting up, then come back here."
                    : (reason ?? "you'll need an account to scan and to book. takes a second.")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="close"
            className="mt-1 grid size-8 shrink-0 place-items-center rounded-full border border-ink/10 bg-white"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-3">
          {mode === "setup" && (
            <>
              <Field label="first name" value={firstName} onChange={setFirstName} placeholder="what we call you" />
              <Field label="phone number" value={phone} onChange={(v: string) => setPhone(formatPhoneInput(v))} inputMode="tel" placeholder="best number to text" />
              <Field label="city" value={city} onChange={setCity} placeholder="toronto" />
            </>
          )}

          {(mode === "signup" || mode === "login" || mode === "forgot") && (
            <Field label="email" value={email} onChange={setEmail} inputMode="email" placeholder="you@email.com" />
          )}

          {(mode === "signup" || mode === "login") && (
            <Field label="password" value={password} onChange={setPassword} type="password" placeholder="six characters or more" />
          )}

          {mode === "signup" && (
            <button
              type="button"
              onClick={() => setAdult((v) => !v)}
              aria-pressed={adult}
              className="flex items-start gap-3 rounded-[14px] border border-ink/10 bg-white px-4 py-3 text-left"
            >
              <span
                className={`mt-[1px] grid size-5 shrink-0 place-items-center rounded-[7px] border ${adult ? "border-ink bg-ink text-cream" : "border-ink/25"}`}
              >
                {adult && <Check className="size-[13px]" strokeWidth={3} />}
              </span>
              <span className="text-[13px] lowercase leading-snug">you must be 18 or older</span>
            </button>
          )}

          {mode === "confirm" ? (
            <PillButton fullWidth onClick={onClose}>
              got it
            </PillButton>
          ) : (
            <PillButton fullWidth disabled={busy || !canSubmit} onClick={submit} style={{ backgroundColor: INK }}>
              {busy ? "one sec" : mode === "setup" ? "done" : mode === "forgot" ? "send reset link" : "continue"}
            </PillButton>
          )}

          {mode === "login" && (
            <button
              type="button"
              onClick={() => setMode("forgot")}
              className="text-[12.5px] lowercase text-ink/60"
            >
              forgot password
            </button>
          )}

          {(mode === "signup" || mode === "login" || mode === "forgot") && (
            <button
              type="button"
              onClick={() => setMode(mode === "signup" ? "login" : "signup")}
              className="text-[12.5px] lowercase text-ink/60"
            >
              {mode === "signup" ? "log in instead" : "sign up instead"}
            </button>
          )}
        </div>

        <p className="mt-4 text-[11.5px] lowercase leading-relaxed text-ink/45">
          browsing treatme is always open. an account is only for scanning and booking. by continuing you agree to our{" "}
          <Link to="/terms" onClick={onClose} className="underline">
            terms
          </Link>{" "}
          and{" "}
          <Link to="/privacy" onClick={onClose} className="underline">
            privacy policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
