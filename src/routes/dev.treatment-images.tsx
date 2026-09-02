import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { displayTreatmentName } from "@/lib/treatment-labels";
import { INK, CREAM } from "@/lib/treatment-catalog";

const BUCKET = "treatment-images";
/** ten years, in seconds. the bucket is private, so cards read a signed url. */
const SIGNED_TTL = 60 * 60 * 24 * 365 * 10;
const MAX_EDGE = 1400;

export const Route = createFileRoute("/dev/treatment-images")({
  head: () => ({
    meta: [
      { title: "treatment pictures — treatme" },
      { name: "description", content: "upload the picture shown on each treatment card in treatme." },
      { property: "og:title", content: "treatment pictures — treatme" },
      { property: "og:description", content: "upload the picture shown on each treatment card in treatme." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TreatmentImagesAdmin,
});

interface Row {
  slug: string;
  name: string;
  hero_image_url: string | null;
}

async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.86));
  if (!blob) throw new Error("could not read that picture");
  return blob;
}

function TreatmentImagesAdmin() {
  const queryClient = useQueryClient();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    let alive = true;
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        if (alive) setIsAdmin(false);
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", auth.user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (alive) setIsAdmin(Boolean(data));
    })();
    return () => {
      alive = false;
    };
  }, []);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-treatment-images"],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("treatments")
        .select("slug, name, hero_image_url, sort_order")
        .order("sort_order", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []).map((t) => ({
        slug: t.slug,
        name: displayTreatmentName(t.name, t.slug),
        hero_image_url: t.hero_image_url ?? null,
      }));
    },
    staleTime: 30_000,
  });

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => r.name.includes(term) || r.slug.includes(term));
  }, [rows, q]);

  async function upload(slug: string, file: File) {
    setBusy(slug);
    try {
      const blob = await shrink(file);
      const path = `${slug}/${Date.now()}.jpg`;
      const up = await supabase.storage.from(BUCKET).upload(path, blob, {
        contentType: "image/jpeg",
        upsert: true,
      });
      if (up.error) throw new Error(up.error.message);

      const signed = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL);
      if (signed.error || !signed.data?.signedUrl) {
        throw new Error(signed.error?.message ?? "could not build the picture link");
      }
      const url = signed.data.signedUrl;

      const { error } = await supabase
        .from("treatments")
        .update({ hero_image_url: url, poster_url: url, icon_url: url })
        .eq("slug", slug);
      if (error) throw new Error(error.message);

      await queryClient.invalidateQueries({ queryKey: ["admin-treatment-images"] });
      void queryClient.invalidateQueries({ queryKey: ["treatment-catalog"] });
      toast("picture saved");
    } catch (e) {
      console.error("treatment image upload failed", e);
      toast(e instanceof Error ? e.message : "upload failed, try again");
    } finally {
      setBusy(null);
    }
  }

  if (isAdmin === false) {
    return (
      <main className="min-h-dvh grid place-items-center px-6" style={{ backgroundColor: CREAM }}>
        <p className="text-[15px] lowercase" style={{ color: INK }}>
          sign in with the owner account to manage treatment pictures.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-dvh px-4 pb-24 pt-6" style={{ backgroundColor: CREAM }}>
      <h1 className="text-[22px] font-semibold lowercase" style={{ color: INK }}>
        treatment pictures
      </h1>
      <p className="mt-1 text-[13px] lowercase" style={{ color: "rgba(17,17,17,0.55)" }}>
        tap a treatment to pick a photo. it shows on the cards in the treatments tab and picked for you.
      </p>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value.toLowerCase())}
        placeholder="search treatments"
        className="mt-4 h-11 w-full rounded-full border px-4 text-[14px] lowercase outline-none"
        style={{ borderColor: "rgba(17,17,17,0.15)", backgroundColor: "#FFFFFF", color: INK }}
      />

      {(isLoading || isAdmin === null) && (
        <p className="mt-6 text-[13px] lowercase" style={{ color: "rgba(17,17,17,0.55)" }}>
          loading...
        </p>
      )}

      <ul className="mt-4 grid grid-cols-2 gap-3">
        {visible.map((r) => (
          <ImageTile
            key={r.slug}
            row={r}
            busy={busy === r.slug}
            onPick={(file) => void upload(r.slug, file)}
          />
        ))}
      </ul>
    </main>
  );
}

function ImageTile({
  row,
  busy,
  onPick,
}: {
  row: Row;
  busy: boolean;
  onPick: (file: File) => void;
}) {
  const input = useRef<HTMLInputElement | null>(null);

  return (
    <li
      className="overflow-hidden rounded-[18px] border"
      style={{ borderColor: "rgba(17,17,17,0.10)", backgroundColor: "#FFFFFF" }}
    >
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="block w-full text-left"
        disabled={busy}
      >
        <span className="block aspect-[4/3] w-full overflow-hidden" style={{ backgroundColor: "#F3F1EA" }}>
          {row.hero_image_url ? (
            <img
              src={row.hero_image_url}
              alt={`${row.name} card picture`}
              className="size-full object-cover"
              loading="lazy"
            />
          ) : (
            <span className="grid size-full place-items-center text-[12px] lowercase" style={{ color: "rgba(17,17,17,0.4)" }}>
              no picture
            </span>
          )}
        </span>
        <span className="block px-3 py-3">
          <span className="block text-[14px] font-semibold lowercase leading-tight" style={{ color: INK }}>
            {row.name}
          </span>
          <span className="mt-0.5 block text-[12px] lowercase" style={{ color: "rgba(17,17,17,0.55)" }}>
            {busy ? "uploading..." : row.hero_image_url ? "tap to replace" : "tap to upload"}
          </span>
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onPick(file);
        }}
      />
    </li>
  );
}
