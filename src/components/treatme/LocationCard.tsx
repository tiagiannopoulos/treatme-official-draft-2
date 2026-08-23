import { useState } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { geocodePlace } from "@/lib/geocode.functions";
import { usePatientLocation } from "@/lib/patient-location";
import { cn } from "@/lib/utils";

/**
 * the in context ask. shown in place of distance based results, never on app
 * open and never as a modal.
 */
export function LocationCard({
  onDone,
  compact = false,
}: {
  onDone?: () => void;
  compact?: boolean;
}) {
  const { save } = usePatientLocation();
  const geocode = useServerFn(geocodePlace);

  const [mode, setMode] = useState<"ask" | "manual">("ask");
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [pending, setPending] = useState<{ lat: number; lng: number; label: string } | null>(null);

  async function useGps() {
    setNote(null);
    setBusy(true);
    const { requestGpsLocation } = await import("@/lib/patient-location");
    const point = await requestGpsLocation();
    if (!point) {
      setBusy(false);
      setMode("manual");
      setNote("we could not read your location. type where you are instead.");
      return;
    }
    const res = await geocode({ data: { query: `${point.lat},${point.lng}` } }).catch(() => null);
    save({
      lat: point.lat,
      lng: point.lng,
      label: res && res.ok ? res.label : "your location",
      source: "gps",
    });
    setBusy(false);
    onDone?.();
  }

  async function lookUp() {
    const query = text.trim();
    if (query.length < 2) return;
    setNote(null);
    setBusy(true);
    const res = await geocode({ data: { query } }).catch(() => null);
    setBusy(false);
    if (!res || !res.ok) {
      setNote("we could not find that. try a postal code or a city.");
      return;
    }
    setPending({ lat: res.lat, lng: res.lng, label: res.label });
  }

  return (
    <div
      className={cn(
        "rounded-[20px] border border-[rgba(17,17,17,0.10)] bg-cream",
        compact ? "p-4" : "p-5",
      )}
    >
      {pending ? (
        <>
          <p className="text-[13px] text-ink/60 lowercase">is this right?</p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-[17px] font-semibold text-ink lowercase">
            <MapPin className="size-4 text-hot" />
            {pending.label}
          </p>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                save({ lat: pending.lat, lng: pending.lng, label: pending.label, source: "manual" });
                onDone?.();
              }}
              className="rounded-pill bg-hot px-4 py-2 text-[13px] font-semibold text-cream lowercase"
            >
              yes, use this
            </button>
            <button
              type="button"
              onClick={() => setPending(null)}
              className="text-[13px] text-ink/60 lowercase underline"
            >
              try again
            </button>
          </div>
        </>
      ) : (
        <>
          <h3 className="brand-display text-[20px] lowercase">where are you?</h3>
          <p className="mt-1 text-[13px] text-ink/60 lowercase">
            so we can show you clinics you can actually get to
          </p>

          {mode === "ask" ? (
            <div className="mt-4 flex items-center gap-4">
              <button
                type="button"
                disabled={busy}
                onClick={useGps}
                className="inline-flex items-center gap-2 rounded-pill bg-hot px-4 py-2 text-[13px] font-semibold text-cream lowercase disabled:opacity-60"
              >
                {busy && <Loader2 className="size-3.5 animate-spin" />}
                use my location
              </button>
              <button
                type="button"
                onClick={() => setMode("manual")}
                className="text-[13px] text-ink/60 lowercase underline"
              >
                enter it manually
              </button>
            </div>
          ) : (
            <div className="mt-4">
              <div className="flex items-center gap-2">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void lookUp();
                  }}
                  placeholder="postal code, neighbourhood or city"
                  aria-label="your postal code, neighbourhood or city"
                  className="min-w-0 flex-1 rounded-pill border border-[rgba(17,17,17,0.12)] bg-white px-4 py-2.5 text-[13px] lowercase placeholder:text-ink-mute focus:outline-none focus:border-[rgba(17,17,17,0.22)]"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={lookUp}
                  className="inline-flex items-center gap-1.5 rounded-pill bg-ink px-4 py-2.5 text-[13px] font-semibold text-cream lowercase disabled:opacity-60"
                >
                  {busy && <Loader2 className="size-3.5 animate-spin" />}
                  find
                </button>
              </div>
              <button
                type="button"
                onClick={() => setMode("ask")}
                className="mt-3 text-[12px] text-ink/60 lowercase underline"
              >
                use my location instead
              </button>
            </div>
          )}
        </>
      )}

      {note && <p className="mt-3 text-[12px] text-ink/60 lowercase">{note}</p>}
    </div>
  );
}

/** the chip that shows the real place and reopens the picker. */
export function LocationChip({ onClick }: { onClick: () => void }) {
  const { location } = usePatientLocation();
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-pill border border-[rgba(17,17,17,0.10)] px-2.5 py-1 text-[11px] text-ink-mute lowercase"
    >
      <MapPin className="size-3" />
      {location ? location.label : "set your location"}
    </button>
  );
}
