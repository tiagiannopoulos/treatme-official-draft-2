import { useState } from "react";

import { INK, MINT } from "@/lib/treatment-catalog";
import {
  usePatient,
  updateProfile,
  updateFlags,
  answeredCount,
  consequenceLines,
  type Fitzpatrick,
} from "@/lib/patient-store";
import { ProfileSheet, SheetOption, SheetToggle } from "@/components/treatme/profile/ProfileSheet";

type RowKey =
  | "skinType"
  | "workingOn"
  | "goals"
  | "downtime"
  | "budget"
  | "travelKm"
  | "providerPreference"
  | "languages"
  | "needleComfort"
  | "mdOnly"
  | "safety";

const FITZ: Array<{ value: Fitzpatrick; hint: string }> = [
  { value: "i", hint: "always burns, never tans" },
  { value: "ii", hint: "burns easily, tans a little" },
  { value: "iii", hint: "sometimes burns, tans slowly" },
  { value: "iv", hint: "rarely burns, tans well" },
  { value: "v", hint: "very rarely burns, tans deeply" },
  { value: "vi", hint: "never burns, deeply pigmented" },
];

const CONCERNS = ["acne", "pigment", "texture", "fine lines", "volume", "laxity", "redness", "scarring", "hair"];
const DOWNTIME = ["none", "a day", "a weekend", "a full week"] as const;
const BUDGET = ["under $300", "$300 to $800", "$800 to $1500", "$1500 plus"] as const;
const PREFERENCE = ["no preference", "woman", "man"] as const;
const NEEDLES = ["fine", "nervous", "prefer to avoid"] as const;
const LANGUAGES = ["english", "french", "mandarin", "cantonese", "spanish", "portuguese", "farsi", "arabic", "hindi", "punjabi", "russian", "korean"];

function toggleIn(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function AboutYourSkin() {
  const patient = usePatient();
  const p = patient.profile;
  const [open, setOpen] = useState<RowKey | null>(null);
  const { filled, total } = answeredCount(patient);
  const lines = consequenceLines(patient);

  const flagCount = [
    patient.flags.pregnantOrBreastfeeding,
    patient.flags.keloidHistory,
    patient.flags.recentIsotretinoin,
    patient.flags.autoimmuneCondition,
    patient.flags.bloodThinners,
  ].filter(Boolean).length;

  const rows: Array<{ key: RowKey; label: string; value: string }> = [
    { key: "skinType", label: "skin type", value: p.skinType ? `fitzpatrick ${p.skinType}` : "add" },
    { key: "workingOn", label: "working on", value: p.workingOn.length ? p.workingOn.join(", ") : "add" },
    { key: "goals", label: "your goals", value: p.goals.trim() || "add" },
    { key: "downtime", label: "downtime you can take", value: p.downtime ?? "add" },
    { key: "budget", label: "budget per visit", value: p.budget ?? "add" },
    { key: "travelKm", label: "how far you will travel", value: p.travelKm !== null ? `${p.travelKm} km` : "add" },
    { key: "providerPreference", label: "provider preference", value: p.providerPreference ?? "add" },
    { key: "languages", label: "languages", value: p.languages.length ? p.languages.join(", ") : "add" },
    { key: "needleComfort", label: "comfort with needles", value: p.needleComfort ?? "add" },
    { key: "mdOnly", label: "md only", value: p.mdOnly === null ? "add" : p.mdOnly ? "yes" : "no" },
    {
      key: "safety",
      label: "safety",
      value: patient.flags.answered ? (flagCount > 0 ? `${flagCount} noted` : "nothing to note") : "add",
    },
  ];

  return (
    <section className="mt-8 mb-4">
      <h2 className="text-[17px] font-semibold lowercase" style={{ color: INK }}>
        about your skin
      </h2>

      <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full" style={{ backgroundColor: "rgba(17,17,17,0.10)" }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${(filled / total) * 100}%`, backgroundColor: "#FF1F87" }}
        />
      </div>
      <p className="mt-1.5 text-[12px] lowercase" style={{ color: "rgba(17,17,17,0.55)" }}>
        {filled} of {total} answered
      </p>

      <div
        className="mt-3 overflow-hidden rounded-[18px] border"
        style={{ borderColor: "rgba(17,17,17,0.10)", backgroundColor: "#FFFFFF" }}
      >
        {rows.map((row, i) => (
          <button
            key={row.key}
            type="button"
            onClick={() => setOpen(row.key)}
            className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
            style={{ borderTop: i === 0 ? "none" : "1px solid rgba(17,17,17,0.08)" }}
          >
            <span className="text-[13.5px] lowercase" style={{ color: "rgba(17,17,17,0.60)" }}>
              {row.label}
            </span>
            <span className="max-w-[55%] truncate text-right text-[13.5px] lowercase" style={{ color: INK }}>
              {row.value}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-3 rounded-[18px] p-4" style={{ backgroundColor: MINT }}>
        {lines.map((l) => (
          <p key={l} className="mb-1.5 text-[12.5px] lowercase leading-snug last:mb-0" style={{ color: INK }}>
            {l}
          </p>
        ))}
      </div>

      {open === "skinType" && (
        <ProfileSheet title="skin type" onClose={() => setOpen(null)}>
          {FITZ.map((f) => (
            <SheetOption
              key={f.value}
              label={`fitzpatrick ${f.value}`}
              hint={f.hint}
              selected={p.skinType === f.value}
              onPress={() => {
                updateProfile({ skinType: f.value });
                setOpen(null);
              }}
            />
          ))}
        </ProfileSheet>
      )}

      {open === "workingOn" && (
        <ProfileSheet title="working on" onClose={() => setOpen(null)}>
          {CONCERNS.map((c) => (
            <SheetOption
              key={c}
              label={c}
              selected={p.workingOn.includes(c)}
              onPress={() => updateProfile({ workingOn: toggleIn(p.workingOn, c) })}
            />
          ))}
        </ProfileSheet>
      )}

      {open === "goals" && (
        <ProfileSheet title="your goals" onClose={() => setOpen(null)}>
          <textarea
            value={p.goals}
            onChange={(e) => updateProfile({ goals: e.target.value.toLowerCase() })}
            rows={3}
            placeholder="softer lines, less redness"
            className="w-full rounded-[14px] border px-4 py-3 text-[14px] lowercase outline-none"
            style={{ borderColor: "rgba(17,17,17,0.10)", backgroundColor: "#FFFFFF", color: INK }}
          />
        </ProfileSheet>
      )}

      {open === "downtime" && (
        <ProfileSheet title="downtime you can take" onClose={() => setOpen(null)}>
          {DOWNTIME.map((d) => (
            <SheetOption
              key={d}
              label={d}
              selected={p.downtime === d}
              onPress={() => {
                updateProfile({ downtime: d });
                setOpen(null);
              }}
            />
          ))}
        </ProfileSheet>
      )}

      {open === "budget" && (
        <ProfileSheet title="budget per visit" onClose={() => setOpen(null)}>
          {BUDGET.map((b) => (
            <SheetOption
              key={b}
              label={b}
              selected={p.budget === b}
              onPress={() => {
                updateProfile({ budget: b });
                setOpen(null);
              }}
            />
          ))}
        </ProfileSheet>
      )}

      {open === "travelKm" && (
        <ProfileSheet title="how far you will travel" onClose={() => setOpen(null)}>
          <p className="text-[14px] lowercase" style={{ color: INK }}>
            {p.travelKm ?? 15} km
          </p>
          <input
            type="range"
            min={2}
            max={100}
            step={1}
            value={p.travelKm ?? 15}
            onChange={(e) => updateProfile({ travelKm: Number(e.target.value) })}
            className="mt-3 w-full"
            style={{ accentColor: "#FF1F87" }}
          />
        </ProfileSheet>
      )}

      {open === "providerPreference" && (
        <ProfileSheet title="provider preference" onClose={() => setOpen(null)}>
          {PREFERENCE.map((v) => (
            <SheetOption
              key={v}
              label={v}
              selected={p.providerPreference === v}
              onPress={() => {
                updateProfile({ providerPreference: v });
                setOpen(null);
              }}
            />
          ))}
        </ProfileSheet>
      )}

      {open === "languages" && (
        <ProfileSheet title="languages" onClose={() => setOpen(null)}>
          {LANGUAGES.map((l) => (
            <SheetOption
              key={l}
              label={l}
              selected={p.languages.includes(l)}
              onPress={() => updateProfile({ languages: toggleIn(p.languages, l) })}
            />
          ))}
        </ProfileSheet>
      )}

      {open === "needleComfort" && (
        <ProfileSheet title="comfort with needles" onClose={() => setOpen(null)}>
          {NEEDLES.map((v) => (
            <SheetOption
              key={v}
              label={v}
              selected={p.needleComfort === v}
              onPress={() => {
                updateProfile({ needleComfort: v });
                setOpen(null);
              }}
            />
          ))}
        </ProfileSheet>
      )}

      {open === "mdOnly" && (
        <ProfileSheet title="md only" intro="only show clinics with a physician on site" onClose={() => setOpen(null)}>
          <SheetToggle label="md only" value={p.mdOnly === true} onChange={(v) => updateProfile({ mdOnly: v })} />
        </ProfileSheet>
      )}

      {open === "safety" && (
        <ProfileSheet
          title="safety"
          intro="these change what is safe to show you. nothing here is shared with providers unless you book."
          onClose={() => setOpen(null)}
        >
          <SheetToggle
            label="pregnant or breastfeeding"
            value={patient.flags.pregnantOrBreastfeeding}
            onChange={(v) => updateFlags({ pregnantOrBreastfeeding: v })}
          />
          <SheetToggle
            label="keloid scarring history"
            value={patient.flags.keloidHistory}
            onChange={(v) => updateFlags({ keloidHistory: v })}
          />
          <SheetToggle
            label="isotretinoin in the last six months"
            value={patient.flags.recentIsotretinoin}
            onChange={(v) => updateFlags({ recentIsotretinoin: v })}
          />
          <SheetToggle
            label="autoimmune condition"
            value={patient.flags.autoimmuneCondition}
            onChange={(v) => updateFlags({ autoimmuneCondition: v })}
          />
          <SheetToggle
            label="blood thinners"
            value={patient.flags.bloodThinners}
            onChange={(v) => updateFlags({ bloodThinners: v })}
          />
          <textarea
            value={patient.flags.allergies}
            onChange={(e) => updateFlags({ allergies: e.target.value.toLowerCase() })}
            rows={2}
            placeholder="allergies"
            className="mt-2 w-full rounded-[14px] border px-4 py-3 text-[14px] lowercase outline-none"
            style={{ borderColor: "rgba(17,17,17,0.10)", backgroundColor: "#FFFFFF", color: INK }}
          />
        </ProfileSheet>
      )}
    </section>
  );
}
