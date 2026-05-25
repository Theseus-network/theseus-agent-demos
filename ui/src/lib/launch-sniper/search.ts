/**
 * Brave Search API client.
 *
 * Used by the Sniper's narrative-research step to fetch real web
 * mentions of a candidate token before the agent decides. Brave's
 * free tier is 2,000 queries/month; Pro is ~$5/mo for 20,000. The
 * Sniper gates research behind a credibility check so the actual
 * query volume sits well inside the free tier.
 *
 * If BRAVE_SEARCH_API_KEY is not set, fetchWebMentions returns null
 * and the narrative step in the dossier surfaces "research
 * unavailable" — the agent then falls back to tokenomics-only.
 */

const BRAVE_API = "https://api.search.brave.com/res/v1/web/search";
const FETCH_TIMEOUT_MS = 8000;

export interface WebMention {
  title: string;
  url: string;
  description: string;
}

interface BraveWebResultRaw {
  title?: string;
  url?: string;
  description?: string;
}

interface BraveResponseRaw {
  web?: { results?: BraveWebResultRaw[] };
}

/** Fetch up to `count` web results for the query. Returns null when
 *  the API key is unset or the call errored (caller treats null as
 *  "research unavailable"). */
export async function fetchWebMentions(
  query: string,
  count: number = 8,
): Promise<WebMention[] | null> {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) return null;

  const url = new URL(BRAVE_API);
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(count));

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      headers: {
        accept: "application/json",
        "X-Subscription-Token": key,
      },
      signal: ctrl.signal,
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as BraveResponseRaw;
    const results = json.web?.results ?? [];
    return results
      .slice(0, count)
      .filter((r): r is BraveWebResultRaw & { title: string; url: string } => {
        return typeof r.title === "string" && typeof r.url === "string";
      })
      .map((r) => ({
        title: r.title,
        url: r.url,
        description: r.description ?? "",
      }));
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
