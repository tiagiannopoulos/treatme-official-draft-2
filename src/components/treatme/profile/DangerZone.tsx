import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { PillButton } from "@/components/treatme/PillButton";
import { deleteMyAccount, deleteMyScanPhotos } from "@/lib/account.functions";

const INK = "#111111";

type Pending = null | "photos" | "account";

export function DangerZone() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!pending) return;
    setBusy(true);
    try {
      if (pending === "photos") {
        const res = await deleteMyScanPhotos();
        await queryClient.invalidateQueries();
        toast(res.removed > 0 ? "your scan photos are gone." : "there were no stored photos.");
      } else {
        await deleteMyAccount();
        await supabase.auth.signOut();
        queryClient.clear();
        toast("your account is deleted.");
        navigate({ to: "/", replace: true });
      }
      setPending(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message.toLowerCase() : "couldn't do that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-10">
      <h2 className="text-[17px] font-semibold lowercase" style={{ color: INK }}>
        your data
      </h2>
      <div className="mt-3 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setPending("photos")}
          className="rounded-[16px] border border-line bg-white px-4 py-4 text-left"
        >
          <p className="text-[14.5px] lowercase">delete my scan photos</p>
          <p className="mt-0.5 text-[12px] lowercase text-ink/55">removes every stored photo. your scores stay.</p>
        </button>
        <button
          type="button"
          onClick={() => setPending("account")}
          className="rounded-[16px] px-4 py-4 text-left"
          style={{ backgroundColor: "#F8A1C6" }}
        >
          <p className="text-[14.5px] lowercase">delete my account</p>
          <p className="mt-0.5 text-[12px] lowercase text-ink/60">wipes your account, scans, photos and chats for good.</p>
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
              {pending === "photos" ? "delete your photos" : "delete your account"}
              <span className="text-hot">.</span>
            </h3>
            <p className="mt-2 text-[13px] lowercase leading-relaxed text-ink/60">
              {pending === "photos"
                ? "every photo we stored for you is removed. this can't be undone."
                : "your account, profile, scans, results, chats and photos are removed. this can't be undone."}
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <PillButton fullWidth disabled={busy} onClick={run}>
                {busy ? "working" : pending === "photos" ? "delete photos" : "delete my account"}
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
