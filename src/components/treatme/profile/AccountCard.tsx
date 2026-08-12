import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PillButton } from "@/components/treatme/PillButton";
import { myProfileQuery, saveMyProfile } from "@/lib/profile";
import { useAuth } from "@/lib/auth";

const INK = "#111111";

export function AccountCard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: profile } = useQuery(myProfileQuery);

  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setFirstName(profile?.first_name ?? "");
    setPhone(profile?.phone ?? "");
    setCity(profile?.city ?? "toronto");
  }, [profile?.first_name, profile?.phone, profile?.city]);

  async function save() {
    setBusy(true);
    try {
      await saveMyProfile({
        first_name: firstName.trim() || null,
        phone: phone.trim() || null,
        city: city.trim().toLowerCase() || null,
      });
      await queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      setEditing(false);
      toast("saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message.toLowerCase() : "couldn't save that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-[18px] border border-line bg-white p-5">
      {editing ? (
        <div className="flex flex-col gap-3">
          <Input label="first name" value={firstName} onChange={setFirstName} />
          <Input label="phone" value={phone} onChange={setPhone} />
          <Input label="city" value={city} onChange={setCity} />
          <div className="flex gap-2">
            <PillButton className="h-10 flex-1 text-[13px]" disabled={busy} onClick={save}>
              {busy ? "saving" : "save"}
            </PillButton>
            <PillButton className="h-10 flex-1 text-[13px]" variant="outline" onClick={() => setEditing(false)}>
              cancel
            </PillButton>
          </div>
        </div>
      ) : (
        <>
          <p className="text-[18px] lowercase" style={{ color: INK }}>
            {(profile?.first_name ?? "").toLowerCase() || "your account"}
          </p>
          <p className="mt-1 text-[13px] lowercase text-ink/60">{(user?.email ?? "").toLowerCase()}</p>
          <p className="text-[13px] lowercase text-ink/60">{profile?.phone || "no phone yet"}</p>
          <p className="text-[13px] lowercase text-ink/45">{(profile?.city ?? "toronto").toLowerCase()}</p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-3 text-[13px] font-semibold lowercase text-hot"
          >
            edit details
          </button>
        </>
      )}
    </section>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="brand-eyebrow">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-[14px] border border-ink/10 bg-white px-4 py-3 text-[15px] lowercase outline-none focus:border-ink/40"
      />
    </label>
  );
}
