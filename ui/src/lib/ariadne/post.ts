/**
 * Ariadne's posters. A venue gets auto-posting only when it has a sanctioned
 * API: Reddit comments via the script-app OAuth, Farcaster replies via a
 * Neynar-managed signer. HN has no posting API, so its drafts stay in the
 * run report for a human to paste.
 */

import type { Candidate } from "./scan";
import { redditToken } from "./scan";

const UA = "ariadne-scout/0.1 (theseus.network developer outreach)";

async function postReddit(c: Candidate, text: string): Promise<string> {
  const token = await redditToken();
  if (!token) throw new Error("no REDDIT_* credentials");
  if (!c.fullname) throw new Error("candidate has no reddit fullname");
  const res = await fetch("https://oauth.reddit.com/api/comment", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ api_type: "json", thing_id: c.fullname, text }),
  });
  const d = await res.json().catch(() => ({} as Record<string, unknown>));
  const errs: unknown[] = (d as { json?: { errors?: unknown[] } })?.json?.errors ?? [];
  if (!res.ok || errs.length) throw new Error(`reddit ${res.status} ${JSON.stringify(errs)}`);
  const thing = (d as { json?: { data?: { things?: { data?: { permalink?: string } }[] } } })
    ?.json?.data?.things?.[0]?.data;
  return thing?.permalink ? `https://reddit.com${thing.permalink}` : "(posted, no permalink returned)";
}

async function postFarcaster(c: Candidate, text: string): Promise<string> {
  const key = process.env.NEYNAR_API_KEY;
  const signer = process.env.FARCASTER_SIGNER_UUID;
  if (!key || !signer) throw new Error("need NEYNAR_API_KEY and FARCASTER_SIGNER_UUID");
  if (text.length > 900) throw new Error("draft too long for a cast, left in report");
  const res = await fetch("https://api.neynar.com/v2/farcaster/cast", {
    method: "POST",
    headers: { "x-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ signer_uuid: signer, text, parent: c.parentHash }),
  });
  const d = await res.json().catch(() => ({} as Record<string, unknown>));
  if (!res.ok) throw new Error(`neynar ${res.status} ${JSON.stringify(d).slice(0, 200)}`);
  const hash = (d as { cast?: { hash?: string } })?.cast?.hash;
  return hash ? `https://warpcast.com/~/conversations/${hash}` : "(posted)";
}

const POSTERS: [prefix: string, poster: (c: Candidate, text: string) => Promise<string>][] = [
  ["r/", postReddit],
  ["farcaster", postFarcaster],
];

export function posterFor(venue: string) {
  return POSTERS.find(([k]) => venue.startsWith(k))?.[1] ?? null;
}
