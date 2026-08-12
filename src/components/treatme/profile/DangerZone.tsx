import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { PillButton } from "@/components/treatme/PillButton";
import { deleteMyData } from "@/lib/account.functions";

const INK = "#111111";

type Mode = "photos" | "revoke_consent" | "account";

const COPY: Record<Mode, { action: string; sub: string; title: string; warning: string; confirm: string }> = {
  photos: {
    action: "delete my scan photos",
    sub: "removes every stored photo. your scores stay.",
    title: "delete your photos",
    warning: "this removes every photo. your scores stay.",
    confirm: "delete photos",
  },
  revoke_consent: {
    action: "withdraw scan consent",
    sub: "turns the scan off and clears everything it produced.",
    title: "withdraw scan consent",
    warning: "this deletes your photos and all your scan results, and turns the scan off.",
    confirm: "withdraw consent",
  },
  account: {
    action: "delete my account",
    sub: "wipes your account, scans, photos and chats for good.",
    title: "delete your account",
    warning: "this deletes your account, profile, scans, results, chats and photos. type delete to confirm.",
    confirm: "delete my account",
  },
};

export function DangerZone() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<Mode | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTyped("");
  }, [pending]);

  async function run() {
    if (!pending || busy) return;
    setBusy(true);
    try {
      const res = await deleteMyData({ data: { mode: pending } });
      if (pending === "account") {
        await supabase.auth.signOut();
        queryClient.clear();
        toast("your account is deleted.");
        navigate({ to: "/", replace: true });
      } else {
        await queryClient.invalidateQueries();
        toast(
          pending === "photos"
            ? res.removed > 0
              ? "your scan photos are gone."
              : "there were no stored photos."
            : "your consent is withdrawn and your scans are gone.",
        );
      }
      setPending(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message.toLowerCase() : "couldn't do that.");
    } finally {
      setBusy(false);
    }
  }

  const canRun = pending === "account" ? typed.trim().toLowerCase() === "delete" : true;

  return (
    <section className="mt-10">
      <h2 className="text-[17px] font-semibold lowercase" style={{ color: INK }}>
        your data
      </h2>
      <div className="mt-3 flex flex-col gap-2">
        {(["photos", "revoke_consent"] as Mode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setPending(mode)}
            className="rounded-[16px] border border-line bg-white px-4 py-4 text-left"
          >
            <p className="text-[14.5px] lowercase">{COPY[mode].action}</p>
            <p className="mt-0.5 text-[12px] lowercase text-ink/55">{COPY[mode].sub}</p>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPending("account")}
          className="rounded-[16px] px-4 py-4 text-left"
          style={{ backgroundColor: "#F8A1C6" }}
        >
          <p className="text-[14.5px] lowercase">{COPY.account.action}</p>
          <p className="mt-0.5 text-[12px] lowercase text-ink/60">{COPY.account.sub}</p>
        </button>
      </div>

      {pending && (
        <div className="fixed inset-0 z-[70] flex items-end bg-ink/45" onClick={() => setPending(null)}>
          <div
            className="w-full rounded-t-[24px] px-5 pb-8 pt-6"
            style={{ backgroundColor: "#FCFBF7" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="brand-display text-[24px] lowercase">
              {COPY[pending].title}
              <span className="text-hot">.</span>
            </h3>
            <p className="mt-2 text-[13px] lowercase leading-relaxed text-ink/60">{COPY[pending].warning}</p>

            {pending === "account" && (
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="type delete"
                autoCapitalize="none"
                className="mt-4 w-full rounded-[14px] border border-ink/10 bg-white px-4 py-3 text-[15px] lowercase outline-none focus:border-ink/40"
              />
            )}

            <div className="mt-5 flex flex-col gap-2">
              <PillButton fullWidth disabled={busy || !canRun} onClick={run}>
                {busy ? "working" : COPY[pending].confirm}
              </PillButton>
              <PillButton fullWidth variant="outline" onClick={() => setPending(null)}>
                keep everything
              </PillButton>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
