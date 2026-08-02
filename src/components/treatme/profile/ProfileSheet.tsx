import { useEffect, type ReactNode } from "react";
import { CREAM, INK } from "@/lib/treatment-catalog";

/** small bottom sheet used by the about your skin rows. cream, hairline, no shadow. */
export function ProfileSheet({
  title,
  intro,
  onClose,
  children,
}: {
  title: string;
  intro?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="close"
        onClick={onClose}
        className="absolute inset-0"
        style={{ backgroundColor: "rgba(17,17,17,0.35)" }}
      />
      <div
        role="dialog"
        aria-label={title}
        className="relative w-full max-w-[520px] max-h-[82vh] overflow-y-auto rounded-t-[22px] border px-5 pb-8 pt-4"
        style={{ backgroundColor: CREAM, borderColor: "rgba(17,17,17,0.10)" }}
      >
        <div className="mx-auto mb-4 h-[3px] w-9 rounded-full" style={{ backgroundColor: "rgba(17,17,17,0.15)" }} />
        <p className="text-[17px] font-semibold lowercase" style={{ color: INK }}>
          {title}
        </p>
        {intro && (
          <p className="mt-1 text-[12.5px] lowercase leading-snug" style={{ color: "rgba(17,17,17,0.55)" }}>
            {intro}
          </p>
        )}
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

/** pill option row used inside the sheets. */
export function SheetOption({
  label,
  hint,
  selected,
  onPress,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      className="mb-2 flex w-full items-start justify-between gap-3 rounded-[14px] border px-4 py-3 text-left transition-colors"
      style={{
        borderColor: selected ? "#FF1F87" : "rgba(17,17,17,0.10)",
        backgroundColor: selected ? "#DFFFF8" : "#FFFFFF",
      }}
    >
      <span>
        <span className="block text-[14px] lowercase" style={{ color: INK }}>
          {label}
        </span>
        {hint && (
          <span className="mt-0.5 block text-[12px] lowercase leading-snug" style={{ color: "rgba(17,17,17,0.55)" }}>
            {hint}
          </span>
        )}
      </span>
    </button>
  );
}

/** small toggle row for the safety sheet and md only. */
export function SheetToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className="mb-2 flex w-full items-center justify-between gap-3 rounded-[14px] border px-4 py-3"
      style={{ borderColor: "rgba(17,17,17,0.10)", backgroundColor: "#FFFFFF" }}
    >
      <span className="text-[14px] lowercase" style={{ color: INK }}>
        {label}
      </span>
      <span
        className="relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors"
        style={{ backgroundColor: value ? "#FF1F87" : "rgba(17,17,17,0.15)" }}
      >
        <span
          className="absolute top-[3px] size-4 rounded-full transition-all"
          style={{ backgroundColor: "#FFFFFF", left: value ? 19 : 3 }}
        />
      </span>
    </button>
  );
}
