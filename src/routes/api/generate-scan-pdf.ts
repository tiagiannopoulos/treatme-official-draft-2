import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { CONCERN_GROUPS, SCAN_CONCERN_LABEL } from "@/lib/scan-concerns";

/**
 * builds the shareable pdf of one scan. the caller must be signed in and own
 * the scan (rls does the owning check for us). include_photo decides whether
 * the user's face goes in the file at all — we default to leaving it out.
 */

const BodySchema = z.object({
  scan_id: z.string().uuid(),
  include_photo: z.boolean().default(false),
  analysis: z
    .object({
      skinType: z.string().optional(),
      fitzpatrick: z.union([z.string(), z.number()]).optional(),
      skinAge: z.union([z.string(), z.number()]).optional(),
      blurb: z.string().optional(),
    })
    .optional(),
});

const CREAM = rgb(0.988, 0.984, 0.969);
const INK = rgb(0.067, 0.067, 0.067);
const MUTE = rgb(0.42, 0.42, 0.42);
const HOT = rgb(1, 0.122, 0.529);

function wrap(text: string, font: import("pdf-lib").PDFFont, size: number, maxWidth: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export const Route = createFileRoute("/api/generate-scan-pdf")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const SUPABASE_URL = process.env["SUPABASE_URL"];
        const SUPABASE_PUBLISHABLE_KEY = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          return new Response("server not configured", { status: 500 });
        }

        const authHeader = request.headers.get("authorization");
        if (!authHeader) return new Response("unauthorized", { status: 401 });

        const parsed = BodySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("bad request", { status: 400 });
        const { scan_id, include_photo, analysis } = parsed.data;

        const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          auth: { persistSession: false },
          global: {
            headers: { Authorization: authHeader },
            fetch: (input, init) => {
              const headers = new Headers(init?.headers);
              headers.set("apikey", SUPABASE_PUBLISHABLE_KEY);
              headers.set("Authorization", authHeader);
              return fetch(input, { ...init, headers });
            },
          },
        });

        const { data: user } = await supabase.auth.getUser();
        if (!user.user) return new Response("unauthorized", { status: 401 });

        const { data: scan, error: scanError } = await supabase
          .from("scans")
          .select("id, created_at, overall_score, photo_path, medical_flag")
          .eq("id", scan_id)
          .maybeSingle();
        if (scanError || !scan) return new Response("scan not found", { status: 404 });

        const { data: results } = await supabase
          .from("scan_results")
          .select("concern_key, score, band")
          .eq("scan_id", scan_id);
        const rows = results ?? [];

        const pdf = await PDFDocument.create();
        const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
        const body = await pdf.embedFont(StandardFonts.Helvetica);

        const W = 595.28;
        const H = 841.89;
        const M = 48;
        let page = pdf.addPage([W, H]);
        page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: CREAM });
        let y = H - M;

        const newPage = () => {
          page = pdf.addPage([W, H]);
          page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: CREAM });
          y = H - M;
        };
        const room = (needed: number) => {
          if (y - needed < M) newPage();
        };

        page.drawText("treatme", { x: M, y: y - 22, size: 24, font: bold, color: INK });
        page.drawText(".", {
          x: M + bold.widthOfTextAtSize("treatme", 24),
          y: y - 22,
          size: 24,
          font: bold,
          color: HOT,
        });
        y -= 34;
        page.drawText("your skin analysis", { x: M, y: y - 16, size: 16, font: bold, color: INK });
        y -= 26;
        const dated = new Date(scan.created_at ?? Date.now()).toLocaleDateString("en-CA");
        page.drawText(dated, { x: M, y: y - 12, size: 11, font: body, color: MUTE });
        y -= 30;

        // photo, only when the user asked for it
        if (include_photo && scan.photo_path) {
          const { data: file } = await supabase.storage.from("scan-photos").download(scan.photo_path);
          if (file) {
            try {
              const bytes = new Uint8Array(await file.arrayBuffer());
              const img = await pdf.embedJpg(bytes);
              const w = 190;
              const h = (img.height / img.width) * w;
              room(h + 16);
              page.drawImage(img, { x: M, y: y - h, width: w, height: h });
              y -= h + 20;
            } catch {
              /* not a jpeg we can embed — skip the photo */
            }
          }
        }

        // headline numbers
        const stats: [string, string][] = [
          ["overall", `${scan.overall_score ?? 0}/100`],
          ...(analysis?.skinType ? ([["skin type", String(analysis.skinType).toLowerCase()]] as [string, string][]) : []),
          ...(analysis?.fitzpatrick ? ([["skin tone", `fitzpatrick ${analysis.fitzpatrick}`]] as [string, string][]) : []),
          ...(analysis?.skinAge ? ([["skin age", String(analysis.skinAge)]] as [string, string][]) : []),
        ];
        room(52);
        let sx = M;
        for (const [label, value] of stats) {
          page.drawText(label, { x: sx, y: y - 10, size: 9, font: body, color: MUTE });
          page.drawText(value, { x: sx, y: y - 26, size: 13, font: bold, color: INK });
          sx += 124;
        }
        y -= 44;

        if (analysis?.blurb) {
          room(60);
          page.drawText("the read", { x: M, y: y - 12, size: 12, font: bold, color: INK });
          y -= 22;
          for (const line of wrap(analysis.blurb.toLowerCase(), body, 11, W - M * 2)) {
            room(16);
            page.drawText(line, { x: M, y: y - 11, size: 11, font: body, color: INK });
            y -= 15;
          }
          y -= 12;
        }

        // every concern, grouped
        for (const group of CONCERN_GROUPS) {
          const groupRows = group.concerns
            .map((key) => rows.find((r) => r.concern_key === key))
            .filter((r): r is (typeof rows)[number] => Boolean(r));
          if (groupRows.length === 0) continue;

          room(30 + groupRows.length * 18);
          page.drawText(group.label.toLowerCase(), { x: M, y: y - 12, size: 12, font: bold, color: INK });
          y -= 24;
          for (const row of groupRows) {
            room(18);
            const label = (SCAN_CONCERN_LABEL[row.concern_key as keyof typeof SCAN_CONCERN_LABEL] ?? row.concern_key) as string;
            page.drawText(label.toLowerCase(), { x: M, y: y - 10, size: 11, font: body, color: INK });
            page.drawText(`${row.score}/100`, { x: W - M - 110, y: y - 10, size: 11, font: bold, color: INK });
            page.drawText(String(row.band ?? "").toLowerCase(), {
              x: W - M - 56,
              y: y - 10,
              size: 10,
              font: body,
              color: MUTE,
            });
            y -= 17;
          }
          y -= 10;
        }

        if (scan.medical_flag) {
          room(40);
          for (const line of wrap(
            "there's something here worth having a doctor look at rather than an aesthetics provider.",
            body,
            10,
            W - M * 2,
          )) {
            page.drawText(line, { x: M, y: y - 10, size: 10, font: body, color: INK });
            y -= 14;
          }
          y -= 10;
        }

        room(34);
        for (const line of wrap(
          "this is an ai estimate, not a medical diagnosis. a provider will confirm what's worth treating.",
          body,
          9,
          W - M * 2,
        )) {
          page.drawText(line, { x: M, y: y - 9, size: 9, font: body, color: MUTE });
          y -= 12;
        }

        const bytes = await pdf.save();
        return new Response(bytes as unknown as BodyInit, {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="treatme-analysis.pdf"`,
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
