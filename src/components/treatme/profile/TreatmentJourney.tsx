import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useScan } from "@/lib/scan-store";
import { INK, MINT, HOT } from "@/lib/treatment-catalog";
import { PillButton } from "@/components/treatme/PillButton";

interface Counts {
  scans: number;
  saved: number;
  requests: number;
  log: number;
}

/** the checklist reads real rows, not whatever is in this session. */
async function fetchCounts(): Promise<Counts> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return { scans: 0, saved: 0, requests: 0, log: 0 };

  const head = { count: "exact" as const, head: true };
  const [scans, saved, requests, log] = await Promise.all([
    supabase.from("scans").select("id", head),
    supabase.from("journey_items").select("treatment_slug", head),
    supabase.from("booking_requests").select("id", head),
    supabase.from("treatment_log").select("id", head),
  ]);

  return {
    scans: scans.count ?? 0,
    saved: saved.count ?? 0,
    requests: requests.count ?? 0,
    log: log.count ?? 0,
  };
}

interface Step {
  key: string;
  label: string;
  detail: string;
  done: boolean;
  cta?: { label: string; go: () => void };
}

export function TreatmentJourney() {
  const navigate = useNavigate();
  const { data: counts, isLoading } = useQuery({
    queryKey: ["getting-started-counts"],
    queryFn: fetchCounts,
    staleTime: 30_000,
  });

  const scanCount = counts?.scans ?? 0;
  const savedCount = counts?.saved ?? 0;
  const requestCount = counts?.requests ?? 0;
  const logCount = counts?.log ?? 0;

  const steps: Step[] = [
    {
      key: "scan",
      label: "scan your skin",
      detail: scanCount > 0 ? `${scanCount} scan${scanCount === 1 ? "" : "s"} saved` : "one photo, we do the rest",
      done: scanCount > 0,
      cta: scanCount > 0 ? undefined : { label: "start scan", go: () => navigate({ to: "/scan" }) },
    },
    {
      key: "saved",
      label: "save what fits you",
      detail: savedCount > 0 ? `${savedCount} treatment${savedCount === 1 ? "" : "s"} saved` : "keep the treatments you are curious about",
      done: savedCount > 0,
      cta: savedCount > 0 ? undefined : { label: "browse treatments", go: () => navigate({ to: "/treatments" }) },
    },
    {
      key: "book",
      label: "book with a clinic",
      detail:
        requestCount > 0
          ? `${requestCount} request${requestCount === 1 ? "" : "s"} sent`
          : "pick your times, the clinic confirms one",
      done: requestCount > 0,
      cta: requestCount > 0 ? undefined : { label: "find a clinic", go: () => navigate({ to: "/search", search: { q: undefined, scope: undefined, treatment: undefined } }) },
    },
    {
      key: "record",
      label: "build your record",
      detail: logCount > 0 ? `${logCount} entr${logCount === 1 ? "y" : "ies"} in your tx log` : "your provider records what they did and when you are due again",
      done: logCount > 0,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;

  // once all four are done there is nothing to get started with.
  if (isLoading || doneCount === steps.length) return null;

  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <section className="mt-8">
      <h2 className="text-[17px] font-semibold lowercase" style={{ color: INK }}>
        getting started
      </h2>

      <div
        className="mt-3 rounded-[18px] border p-4"
        style={{ borderColor: "rgba(17,17,17,0.10)", backgroundColor: "#FFFFFF" }}
      >
        <div className="flex items-center gap-3">
          <div className="h-1 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: "rgba(17,17,17,0.08)" }}>
            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: HOT }} />
          </div>
          <p className="shrink-0 text-[11.5px] lowercase" style={{ color: "rgba(17,17,17,0.55)" }}>
            {doneCount} of {steps.length} done
          </p>
        </div>

        <ol className="mt-4 flex flex-col">
          {steps.map((s, i) => (
            <li key={s.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className="grid size-6 shrink-0 place-items-center rounded-full"
                  style={{
                    backgroundColor: s.done ? MINT : "#FCFBF7",
                    border: `1px solid ${s.done ? "rgba(17,17,17,0.10)" : "rgba(17,17,17,0.12)"}`,
                  }}
                >
                  {s.done ? (
                    <Check className="size-3.5" style={{ color: INK }} strokeWidth={2.2} />
                  ) : (
                    <span className="text-[11px]" style={{ color: "rgba(17,17,17,0.45)" }}>
                      {i + 1}
                    </span>
                  )}
                </span>
                {i < steps.length - 1 && (
                  <span className="my-1 w-px flex-1" style={{ backgroundColor: "rgba(17,17,17,0.10)" }} />
                )}
              </div>
              <div className={i < steps.length - 1 ? "pb-4" : ""}>
                <p className="text-[14px] font-medium lowercase" style={{ color: INK }}>
                  {s.label}
                </p>
                <p className="mt-0.5 text-[12.5px] lowercase leading-snug" style={{ color: "rgba(17,17,17,0.55)" }}>
                  {s.detail}
                </p>
                {s.cta && (
                  <PillButton className="mt-2 h-9 px-4 text-[12.5px]" variant="outline" onClick={s.cta.go}>
                    {s.cta.label}
                  </PillButton>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
