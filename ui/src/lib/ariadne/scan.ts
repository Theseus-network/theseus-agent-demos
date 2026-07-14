/**
 * Ariadne's scanners. Each source activates when its credentials exist:
 * HN needs none, Reddit needs the REDDIT_* script-app vars, Farcaster
 * needs NEYNAR_API_KEY. Loose queries on purpose; the model's
 * qualify-thread pass is the precision layer.
 */

export interface Candidate {
  id: string;
  venue: string;
  venueNote: string;
  title: string;
  author: string;
  url: string;
  body: string;
  created: number; // unix seconds
  trigger: string;
  fullname?: string; // reddit thing id (t3_...)
  parentHash?: string; // farcaster cast hash
}

const UA = "ariadne-scout/0.1 (theseus.network developer outreach)";

export const TRIGGERS = [
  "agent wallet", "give my agent a wallet", "agent own keys",
  "agent identity", "verifiable agent", "agent payments", "x402",
  "ERC-8004", "multi-agent trust", "agent escrow", "trust an agent",
];

export const SUBS: Record<string, string> = {
  AI_Agents: "Self-promo tolerated for builders; be a builder, one link ok.",
  AgentsOfAI: "General agent sub; answer first, one link ok.",
  LangChain: "Framework sub; answer their stack question first, link only if it truly fits.",
  AutoGenAI: "Framework sub; answer first.",
  ClaudeAI: "Lead with the format hook (THESEUS.md is authored like a Claude Code setup).",
  ChatGPTCoding: "Tool-agnostic coders; practical tone.",
  ethdev: "Technical sub; depth expected, no fluff.",
  CryptoTechnology: "Longform technical; no promo tone at all.",
  LocalLLaMA: "ANSWER ONLY. No links unless the author asks for a product.",
  Polkadot: "Theseus is Substrate-based; ecosystem-neighbor tone.",
};

export const FRESH_HOURS = 48;

async function getJSON(url: string, headers: Record<string, string> = {}) {
  const res = await fetch(url, { headers: { "User-Agent": UA, ...headers }, cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

export async function scanHN(log: (m: string) => void): Promise<Candidate[]> {
  const cutoff = Math.floor(Date.now() / 1000 - FRESH_HOURS * 3600);
  const out: Candidate[] = [];
  for (const q of TRIGGERS) {
    for (const tags of ["story", "comment"]) {
      try {
        const d = await getJSON(
          `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(q)}` +
          `&tags=${tags}&hitsPerPage=10&numericFilters=created_at_i>${cutoff}`,
        );
        const words = q.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
        for (const h of d.hits || []) {
          const text = String(h.story_text || h.comment_text || h.title || "").replace(/<[^>]+>/g, " ");
          const hay = `${h.title || h.story_title || ""} ${text}`.toLowerCase();
          if (!words.every((w) => hay.includes(w))) continue;
          out.push({
            id: `hn-${h.objectID}`,
            venue: "hackernews",
            venueNote: "Draft only; a human posts. Driest tone. No self-link unless asked.",
            title: h.title || h.story_title || "(comment)",
            author: h.author,
            url: `https://news.ycombinator.com/item?id=${h.objectID}`,
            body: text.slice(0, 1500),
            created: h.created_at_i,
            trigger: q,
          });
        }
      } catch (e) {
        log(`hn scan failed for ${q}: ${(e as Error).message}`);
      }
    }
  }
  return out;
}

export async function redditToken(): Promise<string | null> {
  const { REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD } = process.env;
  if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET || !REDDIT_USERNAME || !REDDIT_PASSWORD) return null;
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      "User-Agent": UA,
      Authorization: "Basic " + Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "password",
      username: REDDIT_USERNAME,
      password: REDDIT_PASSWORD,
    }),
  });
  if (!res.ok) throw new Error(`reddit auth ${res.status}`);
  return (await res.json()).access_token as string;
}

export async function scanReddit(log: (m: string) => void): Promise<Candidate[]> {
  let token: string | null;
  try {
    token = await redditToken();
  } catch (e) {
    log(`reddit auth failed: ${(e as Error).message}`);
    return [];
  }
  if (!token) {
    log("reddit: no REDDIT_* credentials, skipping");
    return [];
  }
  const cutoff = Date.now() / 1000 - FRESH_HOURS * 3600;
  const q = TRIGGERS.map((t) => (t.includes(" ") ? `"${t}"` : t)).join(" OR ");
  const out: Candidate[] = [];
  for (const [sub, note] of Object.entries(SUBS)) {
    try {
      const d = await getJSON(
        `https://oauth.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(q)}` +
        `&restrict_sr=1&sort=new&t=week&limit=25`,
        { Authorization: `Bearer ${token}` },
      );
      for (const c of d?.data?.children || []) {
        const p = c.data;
        if (p.created_utc < cutoff) continue;
        out.push({
          id: `rd-${p.id}`,
          fullname: p.name,
          venue: `r/${sub}`,
          venueNote: note,
          title: p.title,
          author: p.author,
          url: `https://reddit.com${p.permalink}`,
          body: String(p.selftext || "").slice(0, 1500),
          created: p.created_utc,
          trigger: "sub search",
        });
      }
    } catch (e) {
      log(`r/${sub} scan failed: ${(e as Error).message}`);
    }
  }
  return out;
}

export async function scanFarcaster(log: (m: string) => void): Promise<Candidate[]> {
  const key = process.env.NEYNAR_API_KEY;
  if (!key) {
    log("farcaster: no NEYNAR_API_KEY, skipping");
    return [];
  }
  const cutoff = Date.now() / 1000 - FRESH_HOURS * 3600;
  const out: Candidate[] = [];
  for (const q of TRIGGERS.slice(0, 6)) {
    try {
      const d = await getJSON(
        `https://api.neynar.com/v2/farcaster/cast/search?q=${encodeURIComponent(q)}&limit=10`,
        { "x-api-key": key },
      );
      for (const c of d?.result?.casts || []) {
        const ts = new Date(c.timestamp).getTime() / 1000;
        if (ts < cutoff) continue;
        out.push({
          id: `fc-${c.hash}`,
          parentHash: c.hash,
          venue: "farcaster",
          venueNote: "Casual builder tone; her agent nature is a first-class flex here. Keep it short.",
          title: "(cast)",
          author: c.author?.username,
          url: `https://warpcast.com/${c.author?.username}/${String(c.hash).slice(0, 10)}`,
          body: String(c.text || "").slice(0, 1500),
          created: ts,
          trigger: q,
        });
      }
    } catch (e) {
      log(`farcaster scan failed for ${q}: ${(e as Error).message}`);
    }
  }
  return out;
}
