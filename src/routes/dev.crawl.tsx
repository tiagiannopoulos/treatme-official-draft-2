import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";

import { backfillStorefrontWebsites, crawlAllStorefronts, crawlStorefront } from "@/lib/crawl.functions";

/** internal tool: run treatment discovery by hand. not linked from the app. */
export const Route = createFileRoute("/dev/crawl")({
  head: () => ({
    meta: [
      { title: "treatment discovery · treatme" },
      { name: "description", content: "internal tool for running clinic treatment discovery." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DevCrawl,
});

function DevCrawl() {
  const runAll = useServerFn(crawlAllStorefronts);
  const runOne = useServerFn(crawlStorefront);
  const [id, setId] = useState("");
  const [token, setToken] = useState("");

  const fill = useServerFn(backfillStorefrontWebsites);
  const websites = useMutation({
    mutationFn: () => fill({ data: { limit: 100, token: token || undefined } }),
  });

  const all = useMutation({
    mutationFn: () => runAll({ data: { limit: 25, token: token || undefined } }),
  });
  const one = useMutation({
    mutationFn: () => runOne({ data: { storefrontId: id.trim(), token: token || undefined } }),
  });

  const busy = all.isPending || one.isPending || websites.isPending;
  const result = all.data ?? one.data ?? websites.data ?? null;
  const error = (all.error ?? one.error ?? websites.error) as Error | null;

  return (
    <main className="mx-auto max-w-[640px] px-5 py-10">
      <h1 className="text-[24px] font-medium lowercase tracking-[-0.02em]">treatment discovery</h1>
      <p className="mt-2 text-[13px] lowercase leading-relaxed text-ink/60">
        reads a clinic's own public service pages and records which of our treatments they name, with a link back
        to the page. robots.txt is respected and a clinic's verified answer is never overwritten.
      </p>

      <div className="mt-6 space-y-3">
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="admin token, if one is set"
          className="w-full rounded-[14px] border border-line bg-transparent px-4 py-3 text-[14px] lowercase"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => websites.mutate()}
          className="w-full rounded-pill border border-line px-4 py-3 text-[14px] lowercase disabled:opacity-40"
        >
          {websites.isPending ? "finding websites" : "step one, find websites from google"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => all.mutate()}
          className="w-full rounded-pill bg-ink px-4 py-3 text-[14px] lowercase text-cream disabled:opacity-40"
        >
          {all.isPending ? "crawling every clinic due" : "run every clinic due"}
        </button>

        <input
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder="one storefront id"
          className="w-full rounded-[14px] border border-line bg-transparent px-4 py-3 text-[14px] lowercase"
        />
        <button
          type="button"
          disabled={busy || !id.trim()}
          onClick={() => one.mutate()}
          className="w-full rounded-pill border border-line px-4 py-3 text-[14px] lowercase disabled:opacity-40"
        >
          {one.isPending ? "crawling" : "run one clinic"}
        </button>
      </div>

      {error && (
        <p className="mt-5 rounded-[14px] bg-bubblegum px-4 py-3 text-[13px] lowercase">{error.message}</p>
      )}
      {result && (
        <pre className="mt-5 overflow-x-auto rounded-[14px] border border-line p-4 text-[12px] leading-relaxed">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </main>
  );
}
