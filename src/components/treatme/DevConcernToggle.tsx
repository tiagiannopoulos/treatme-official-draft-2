import { useEffect, useState } from "react";
import { CONCERN_KEYS, CONCERN_LABEL, getForcedConcerns, setForcedConcerns, type ConcernKey } from "@/lib/skinAnalysis";
import { cn } from "@/lib/utils";

/** hidden alpha helper: force which concerns come back elevated */
export function DevConcernToggle() {
  const [keys, setKeys] = useState<ConcernKey[]>([]);

  useEffect(() => {
    setKeys(getForcedConcerns());
  }, []);

  const toggle = (k: ConcernKey) => {
    const next = keys.includes(k) ? keys.filter((x) => x !== k) : [...keys, k];
    setKeys(next);
    setForcedConcerns(next);
  };

  const clear = () => {
    setKeys([]);
    setForcedConcerns([]);
  };

  return (
    <div className="mt-6 rounded-2xl border border-dashed border-ink/30 p-4">
      <p className="brand-eyebrow">dev · force concerns</p>
      <p className="text-[12px] text-ink-mute mt-1">
        pick the concerns the mock scan should score high, in order.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {CONCERN_KEYS.map((k) => {
          const i = keys.indexOf(k);
          return (
            <button
              key={k}
              type="button"
              onClick={() => toggle(k)}
              className={cn(
                "rounded-full px-3 h-8 text-[12px] font-semibold lowercase border transition",
                i >= 0
                  ? "bg-hot text-white border-hot"
                  : "bg-cream border-line text-ink-soft hover:border-ink/40",
              )}
            >
              {i >= 0 ? `${i + 1} · ` : ""}{CONCERN_LABEL[k]}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={clear}
        className="mt-3 text-[12px] font-semibold text-ink-mute lowercase underline"
      >
        clear override
      </button>
    </div>
  );
}
