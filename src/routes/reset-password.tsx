import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { PillButton } from "@/components/treatme/PillButton";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "set a new password · treatme" },
      { name: "description", content: "choose a new password for your treatme account." },
      { property: "og:title", content: "set a new password · treatme" },
      { property: "og:description", content: "choose a new password for your treatme account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast("password changed. you're in.");
      navigate({ to: "/profile" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message.toLowerCase() : "that didn't work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[70vh] bg-cream px-6 pt-10">
      <p className="brand-eyebrow">account</p>
      <h1 className="brand-display text-[30px] mt-2 lowercase">
        set a new password<span className="text-hot">.</span>
      </h1>
      <p className="mt-3 text-[13px] lowercase leading-relaxed text-ink/60">
        pick something you'll remember. six characters or more.
      </p>
      <label className="mt-6 block">
        <span className="brand-eyebrow">new password</span>
        <input
          value={password}
          type="password"
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1.5 w-full rounded-[14px] border border-ink/10 bg-white px-4 py-3 text-[15px] outline-none focus:border-ink/40"
        />
      </label>
      <div className="mt-5">
        <PillButton fullWidth disabled={busy || password.length < 6} onClick={save}>
          {busy ? "saving" : "save password"}
        </PillButton>
      </div>
    </div>
  );
}
