import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Sparkles } from "lucide-react";

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
  const { data: scans = [] } = useQuery({
    queryKey: ["my-scans"],
    queryFn: async () => {
      const { data } = await supabase
        .from("scans")
        .select("id, created_at, overall_score, skin_type, photo_path")
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
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
          {scans.map((s) => (
            <Link
              key={s.id}
              to="/scan/results"
              search={{ id: s.id }}
              className="flex items-center justify-between gap-3 rounded-[16px] border border-line bg-white px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-[14px] lowercase">{shortDate(s.created_at)}</p>
                <p className="text-[12px] lowercase text-ink/55">
                  {bandWord(s.overall_score)}
                  {s.skin_type ? ` · ${s.skin_type.toLowerCase()}` : ""}
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-1">
                <span className="text-[18px] font-semibold">{s.overall_score ?? "—"}</span>
                <ChevronRight className="size-4 text-ink/40" strokeWidth={2} />
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
