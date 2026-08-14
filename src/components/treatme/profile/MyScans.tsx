import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { PillButton } from "@/components/treatme/PillButton";

const INK = "#111111";

const MONTHS = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
];

function bandWord(score: number | null) {
  if (score == null) return "no read";
  if (score >= 90) return "excellent";
  if (score >= 80) return "good";
  if (score >= 50) return "worth a look";
  return "needs attention";
}

function shortDate(iso: string) {
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function MyScans() {
  const queryClient = useQueryClient();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const { data: scans = [] } = useQuery({
    queryKey: ["my-scans"],
    queryFn: async () => {
      const { data } = await supabase
        .from("scans")
        .select("id, created_at, overall_score, skin_type, photo_path, result")
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  const remove = useMutation({
    mutationFn: async (scan: { id: string; photo_path: string | null }) => {
      // consult chats point at the scan without a cascade, so unlink them first.
      await supabase.from("consult_chats").update({ scan_id: null }).eq("scan_id", scan.id);
      if (scan.photo_path) {
        await supabase.storage.from("scan-photos").remove([scan.photo_path]);
      }
      const { error } = await supabase.from("scans").delete().eq("id", scan.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setConfirmId(null);
      void queryClient.invalidateQueries({ queryKey: ["my-scans"] });
      toast.success("scan deleted");
    },
    onError: () => toast.error("couldn't delete that scan. try again."),
  });

  return (
    <section className="mt-8">
      <h2 className="text-[17px] font-semibold lowercase" style={{ color: INK }}>
        my scans
      </h2>

      {scans.length === 0 ? (
        <div className="mt-3 rounded-[18px] border border-line bg-white p-6 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full" style={{ backgroundColor: "#DFFFF8" }}>
            <Sparkles className="size-6" strokeWidth={1.6} />
          </span>
          <p className="mt-3 text-[15px] lowercase">no scans saved yet</p>
          <p className="mt-1 text-[12.5px] lowercase text-ink/55">your reads show up here so you can compare over time.</p>
          <Link to="/scan" className="mt-4 inline-block">
            <PillButton className="h-10 px-5 text-[13px]" variant="outline">
              start a scan
            </PillButton>
          </Link>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {scans.map((s) => {
            const reopenable = Boolean(s.result);
            const confirming = confirmId === s.id;
            const body = (
              <>
                <div className="min-w-0">
                  <p className="text-[14px] lowercase">{shortDate(s.created_at)}</p>
                  <p className="text-[12px] lowercase text-ink/55">
                    {reopenable
                      ? `${bandWord(s.overall_score)}${s.skin_type ? ` · ${s.skin_type.toLowerCase()}` : ""}`
                      : "full read not saved for this one"}
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-1">
                  <span className="text-[18px] font-semibold">{s.overall_score ?? "—"}</span>
                  {reopenable && <ChevronRight className="size-4 text-ink/40" strokeWidth={2} />}
                </span>
              </>
            );

            return (
              <div key={s.id} className="rounded-[16px] border border-line bg-white">
                <div className="flex items-center gap-1 pr-2">
                  {reopenable ? (
                    <Link
                      to="/scan/results"
                      search={{ id: s.id }}
                      className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3"
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3 opacity-60">
                      {body}
                    </div>
                  )}
                  <button
                    type="button"
                    aria-label="delete scan"
                    onClick={() => setConfirmId(confirming ? null : s.id)}
                    className="grid size-9 shrink-0 place-items-center rounded-full text-ink/45 active:bg-ink/5"
                  >
                    <Trash2 className="size-4" strokeWidth={1.8} />
                  </button>
                </div>

                {confirming && (
                  <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
                    <p className="text-[12.5px] lowercase text-ink/60">delete this scan and its photo?</p>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        className="text-[12.5px] lowercase text-ink/55"
                      >
                        keep
                      </button>
                      <button
                        type="button"
                        disabled={remove.isPending}
                        onClick={() => remove.mutate({ id: s.id, photo_path: s.photo_path })}
                        className="rounded-full px-3 py-1.5 text-[12.5px] lowercase disabled:opacity-60"
                        style={{ backgroundColor: "#F8A1C6", color: INK }}
                      >
                        {remove.isPending ? "deleting..." : "delete"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
