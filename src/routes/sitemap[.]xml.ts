import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "https://treatmeapp.com";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/treatments", changefreq: "weekly", priority: "0.9" },
          { path: "/search", changefreq: "weekly", priority: "0.8" },
          { path: "/skin-analysis", changefreq: "monthly", priority: "0.8" },
          { path: "/scan", changefreq: "monthly", priority: "0.7" },
          { path: "/legal/privacy", changefreq: "yearly", priority: "0.2" },
          { path: "/legal/terms", changefreq: "yearly", priority: "0.2" },
        ];

        const { createClient } = await import("@supabase/supabase-js");
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
        const supabase = createClient(process.env["SUPABASE_URL"]!, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (input, init) => {
              const headers = new Headers(init?.headers);
              if (key.startsWith("sb_") && headers.get("Authorization") === "Bearer " + key) {
                headers.delete("Authorization");
              }
              headers.set("apikey", key);
              return fetch(input, { ...init, headers });
            },
          },
        });

        const pageSize = 1000;
        const collect = async (table: string, prefix: string) => {
          for (let offset = 0; ; offset += pageSize) {
            const { data, error } = await supabase
              .from(table)
              .select("slug")
              .order("slug")
              .range(offset, offset + pageSize - 1);
            if (error) throw error;
            const rows = (data ?? []) as { slug: string | null }[];
            entries.push(
              ...rows
                .filter((r) => Boolean(r.slug))
                .map((r) => ({
                  path: `${prefix}/${encodeURIComponent(r.slug!)}`,
                  changefreq: "monthly" as const,
                  priority: "0.6",
                })),
            );
            if (rows.length < pageSize) break;
          }
        };

        await collect("treatments", "/treatment");
        await collect("storefronts", "/medspas");
        await collect("providers", "/providers");

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
