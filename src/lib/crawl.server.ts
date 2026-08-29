import { generateText } from "ai";
import { z } from "zod";

import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

/**
 * automatic treatment discovery. we read a clinic's own public service pages and
 * record what they say they offer, with a link a human can check. a crawl is a
 * guess: it never beats a clinic's verified answer and it is always labelled in
 * the ui as "listed on their website".
 */

export const USER_AGENT = "treatmebot/1.0 (+https://www.treatmeapp.com)";
export const MIN_CONFIDENCE = 0.6;
const PAGE_TIMEOUT_MS = 10_000;
const MAX_PAGES = 8;
const MAX_TEXT = 40_000;

const LINK_HINTS = [
  "services",
  "treatments",
  "treatment",
  "menu",
  "pricing",
  "price",
  "what we do",
  "offerings",
  "injectables",
  "laser",
  "skin",
  "book",
];

export type CrawlStatus =
  | "no_website"
  | "disallowed"
  | "fetch_failed"
  | "no_text"
  | "match_failed"
  | "ok";

export interface CrawlOutcome {
  status: CrawlStatus;
  url: string | null;
  pages_fetched: number;
  treatments_found: number;
  error: string | null;
}

async function fetchWithTimeout(url: string, ms = PAGE_TIMEOUT_MS): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function isHtml(res: Response): boolean {
  const type = res.headers.get("content-type") ?? "";
  return type.includes("text/html") || type.includes("application/xhtml");
}

/** the subset of robots.txt that matters to us: disallow rules for our agent or for *. */
export function robotsDisallows(body: string, agent = "treatmebot"): string[] {
  const lines = body.split(/\r?\n/).map((l) => l.replace(/#.*$/, "").trim());
  const groups: Array<{ agents: string[]; rules: Array<{ allow: boolean; path: string }> }> = [];
  let current: { agents: string[]; rules: Array<{ allow: boolean; path: string }> } | null = null;
  let expectingAgents = false;

  for (const line of lines) {
    const [rawKey, ...rest] = line.split(":");
    if (!rawKey || rest.length === 0) continue;
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(":").trim();

    if (key === "user-agent") {
      if (!current || !expectingAgents) {
        current = { agents: [], rules: [] };
        groups.push(current);
        expectingAgents = true;
      }
      current.agents.push(value.toLowerCase());
      continue;
    }
    if (!current) continue;
    expectingAgents = false;
    if (key === "disallow") current.rules.push({ allow: false, path: value });
    if (key === "allow") current.rules.push({ allow: true, path: value });
  }

  const mine = groups.filter((g) => g.agents.includes(agent));
  const wildcard = groups.filter((g) => g.agents.includes("*"));
  const chosen = mine.length ? mine : wildcard;
  return chosen
    .flatMap((g) => g.rules)
    .filter((r) => !r.allow && r.path !== "")
    .map((r) => r.path);
}

export function pathAllowed(path: string, disallows: string[]): boolean {
  return !disallows.some((rule) => {
    if (rule === "/") return true;
    return path.startsWith(rule.replace(/\*$/, ""));
  });
}

/** visible text only: scripts, styles, nav, header, footer and comments are dropped. */
export function visibleText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(nav|footer|header)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|section)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "and")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** internal links whose href or anchor text looks like a service or price page. */
export function candidateLinks(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const found = new Map<string, true>();
  const anchor = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;

  while ((m = anchor.exec(html))) {
    const href = m[1] ?? "";
    const text = visibleText(m[2] ?? "").toLowerCase();
    if (/^(mailto:|tel:|javascript:|#)/i.test(href)) continue;
    let url: URL;
    try {
      url = new URL(href, base);
    } catch {
      continue;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") continue;
    if (url.hostname.replace(/^www\./, "") !== base.hostname.replace(/^www\./, "")) continue;
    if (/\.(pdf|jpe?g|png|gif|webp|svg|zip|mp4|mov|css|js)$/i.test(url.pathname)) continue;

    const haystack = `${url.pathname.toLowerCase()} ${text}`;
    if (!LINK_HINTS.some((hint) => haystack.includes(hint))) continue;
    url.hash = "";
    if (url.toString() === baseUrl) continue;
    found.set(url.toString(), true);
  }
  return [...found.keys()];
}

export interface FetchedPage {
  url: string;
  text: string;
}

export interface SiteRead {
  status: Exclude<CrawlStatus, "match_failed" | "ok" | "no_website">| "ok";
  homepage: string;
  pages: FetchedPage[];
  error: string | null;
}

/** step 1: robots, homepage, then up to eight service-ish pages. */
export async function readSite(website: string): Promise<SiteRead> {
  let home: URL;
  try {
    home = new URL(website.startsWith("http") ? website : `https://${website}`);
  } catch {
    return { status: "fetch_failed", homepage: website, pages: [], error: "unparseable website url" };
  }
  const homepage = home.toString();

  const robotsRes = await fetchWithTimeout(new URL("/robots.txt", home).toString());
  let disallows: string[] = [];
  if (robotsRes && robotsRes.ok) {
    disallows = robotsDisallows(await robotsRes.text());
  }
  if (!pathAllowed(home.pathname || "/", disallows)) {
    return { status: "disallowed", homepage, pages: [], error: "robots.txt disallows this path" };
  }

  const homeRes = await fetchWithTimeout(homepage);
  if (!homeRes || !homeRes.ok || !isHtml(homeRes)) {
    return {
      status: "fetch_failed",
      homepage,
      pages: [],
      error: homeRes ? `homepage returned ${homeRes.status}` : "homepage did not respond",
    };
  }
  const homeHtml = await homeRes.text();
  const pages: FetchedPage[] = [{ url: homepage, text: visibleText(homeHtml) }];

  const links = candidateLinks(homeHtml, homepage).filter((link) => {
    try {
      return pathAllowed(new URL(link).pathname, disallows);
    } catch {
      return false;
    }
  });

  for (const link of links.slice(0, MAX_PAGES)) {
    const res = await fetchWithTimeout(link);
    if (!res || !res.ok || !isHtml(res)) continue;
    const text = visibleText(await res.text());
    if (text.length > 40) pages.push({ url: link, text });
  }

  return { status: "ok", homepage, pages, error: null };
}

/** one blob for the model, each page prefixed with its url so evidence can cite it. */
export function combineText(pages: FetchedPage[]): string {
  let out = "";
  for (const page of pages) {
    const block = `\n\n=== page: ${page.url} ===\n${page.text}`;
    if (out.length + block.length > MAX_TEXT) {
      out += block.slice(0, Math.max(0, MAX_TEXT - out.length));
      break;
    }
    out += block;
  }
  return out.trim();
}

const MatchSchema = z.object({
  matches: z.array(
    z.object({
      treatment_slug: z.string(),
      confidence: z.number().min(0).max(1),
      evidence_snippet: z.string(),
      evidence_url: z.string(),
      price_from: z.number().nullable(),
    }),
  ),
});

export type TreatmentMatch = z.infer<typeof MatchSchema>["matches"][number];

export interface CatalogEntry {
  slug: string;
  name: string;
  search_synonyms: string[];
}

const MODELS = ["anthropic/claude-sonnet-4-5", "google/gemini-3-flash-preview"];

/** step 2: which of our treatments does this clinic's own text actually name. */
export async function matchTreatments(
  text: string,
  catalog: CatalogEntry[],
  apiKey: string,
): Promise<{ matches: TreatmentMatch[]; error: string | null }> {
  const gateway = createLovableAiGatewayProvider(apiKey);
  const catalogLines = catalog
    .map((t) => {
      const syn = t.search_synonyms.length ? ` — also called: ${t.search_synonyms.join(", ")}` : "";
      return `${t.slug}: ${t.name}${syn}`;
    })
    .join("\n");

  const system = `you read a medical aesthetics clinic's own website text and report which treatments from a fixed catalog the clinic actually offers.

rules, follow them exactly:
- only include a treatment if the text names it or names one of its listed synonyms.
- never infer. a medspa does not offer botox just because it is a medspa. no category reasoning, no "probably".
- evidence_snippet must be an exact phrase copied from the text that justifies the match.
- evidence_url must be the "=== page: <url> ===" url of the block the snippet came from.
- price_from: a number in dollars only when a price is clearly stated for that treatment, otherwise null.
- confidence 0 to 1: how certain you are the clinic offers this specific treatment.
- if nothing matches, return an empty array. an empty array is a correct answer.

catalog:
${catalogLines}`;

  // the gateway's models do not all honour a response schema, so we ask for plain
  // json in the prompt and validate it ourselves. that keeps every model usable.
  const instruction = `answer with json only, no prose and no code fence, shaped exactly:
{"matches":[{"treatment_slug":"...","confidence":0.0,"evidence_snippet":"...","evidence_url":"...","price_from":null}]}`;

  let lastError: string | null = null;
  for (const modelId of MODELS) {
    try {
      const { text: raw } = await generateText({
        model: gateway(modelId),
        system,
        prompt: `${instruction}\n\nclinic website text:\n${text}`,
      });
      const parsed = parseMatches(raw);
      if (!parsed) {
        lastError = `unreadable answer from ${modelId}`;
        continue;
      }
      return { matches: parsed, error: null };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }
  return { matches: [], error: lastError };
}

/** the model's json, however it wrapped it. null when there is nothing usable. */
function parseMatches(raw: string): TreatmentMatch[] | null {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = trimmed.search(/[[{]/);
  if (start < 0) return null;
  const end = Math.max(trimmed.lastIndexOf("}"), trimmed.lastIndexOf("]"));
  let value: unknown;
  try {
    value = JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    return null;
  }
  const list = Array.isArray(value)
    ? value
    : Array.isArray((value as { matches?: unknown }).matches)
      ? (value as { matches: unknown[] }).matches
      : null;
  if (!list) return null;

  const out: TreatmentMatch[] = [];
  for (const item of list) {
    const row = MatchSchema.shape.matches.element.safeParse(item);
    if (row.success) out.push(row.data);
  }
  return out;
}


/** keep only real slugs, real evidence urls and confident matches. */
export function cleanMatches(
  matches: TreatmentMatch[],
  catalog: CatalogEntry[],
  pages: FetchedPage[],
): TreatmentMatch[] {
  const slugs = new Set(catalog.map((t) => t.slug));
  const urls = new Set(pages.map((p) => p.url));
  const fallbackUrl = pages[0]?.url ?? null;
  const bySlug = new Map<string, TreatmentMatch>();

  for (const m of matches) {
    if (!slugs.has(m.treatment_slug)) continue;
    if (typeof m.confidence !== "number" || m.confidence < MIN_CONFIDENCE) continue;
    const snippet = (m.evidence_snippet ?? "").trim().slice(0, 400);
    if (!snippet) continue;
    const url = urls.has(m.evidence_url) ? m.evidence_url : fallbackUrl;
    if (!url) continue;
    const price =
      typeof m.price_from === "number" && Number.isFinite(m.price_from) && m.price_from > 0
        ? Math.round(m.price_from)
        : null;
    const existing = bySlug.get(m.treatment_slug);
    if (existing && existing.confidence >= m.confidence) continue;
    bySlug.set(m.treatment_slug, {
      treatment_slug: m.treatment_slug,
      confidence: Math.min(1, m.confidence),
      evidence_snippet: snippet,
      evidence_url: url,
      price_from: price,
    });
  }
  return [...bySlug.values()];
}
