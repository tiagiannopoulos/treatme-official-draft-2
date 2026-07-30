import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getRecommendations, type Recommendations } from "@/lib/recommendations";

export const Route = createFileRoute("/dev/recommendations")({
  head: () => ({
    meta: [
      { title: "recommendation engine test — treatme" },
      { name: "description", content: "Internal test harness for the treatme treatment recommendation engine." },
      { property: "og:title", content: "recommendation engine test — treatme" },
      { property: "og:description", content: "Internal test harness for the treatme treatment recommendation engine." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DevRecommendations,
});

const CASES: { concerns: string[]; goals: string[] }[] = [
  { concerns: ["pores", "texture"], goals: [] },
  { concerns: ["fineLines", "wrinkles", "laxity"], goals: ["lipEnhancement"] },
  { concerns: ["pigmentation", "darkSpots"], goals: [] },
];

function DevRecommendations() {
  const [results, setResults] = useState<(Recommendations & { input: string })[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const out = [];
        for (const c of CASES) {
          const r = await getRecommendations(c.concerns, c.goals);
          out.push({ ...r, input: JSON.stringify(c) });
          console.log("getRecommendations", c, r);
        }
        setResults(out);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  return (
    <main className="p-6 space-y-8">
      <h1 className="brand-display text-2xl">recommendation engine test</h1>
      {error && <p className="text-destructive text-sm">{error}</p>}
      {results.map((r) => (
        <section key={r.input} className="space-y-2">
          <h2 className="font-mono text-xs opacity-70">{r.input}</h2>
          <ol className="text-sm space-y-1">
            {r.scanDriven.map((t, i) => (
              <li key={t.slug}>
                {i + 1}. <strong>{t.slug}</strong> — score {t.score} — [{t.matchedConcerns.join(", ")}] — £{t.price_from}
              </li>
            ))}
          </ol>
          {r.goalDriven.length > 0 && (
            <ol className="text-sm space-y-1 opacity-80">
              {r.goalDriven.map((t, i) => (
                <li key={t.slug}>
                  goal {i + 1}. <strong>{t.slug}</strong> — score {t.score} — [{t.matchedConcerns.join(", ")}]
                </li>
              ))}
            </ol>
          )}
        </section>
      ))}
    </main>
  );
}
