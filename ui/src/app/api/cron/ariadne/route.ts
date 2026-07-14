// Vercel Cron endpoint: Ariadne's outreach tick. Scan HN/Reddit/Farcaster for
// developers stuck on problems Theseus solves, qualify + draft each candidate
// with the Anthropic API, auto-post where a sanctioned API exists (Reddit,
// Farcaster), and write the full run report to Vercel Blob. Schedule lives in
// vercel.json. Env vars in the Vercel project:
//   ANTHROPIC_API_KEY       model access (already set for the other agents)
//   CRON_SECRET             Vercel Cron sends it as a Bearer token
//   BLOB_READ_WRITE_TOKEN   ledger + run reports (already set)
//   BLOB_PUBLIC_BASE_URL    to read the ledger back (already set)
//   REDDIT_CLIENT_ID/SECRET/USERNAME/PASSWORD   unlocks Reddit scan + post
//   NEYNAR_API_KEY, FARCASTER_SIGNER_UUID       unlocks Farcaster scan + post
//   ARIADNE_POST            "0" = draft-only mode (default posts when creds exist)
//   ARIADNE_MAX_DRAFTS      default 6
//   ARIADNE_MAX_POSTS       default 3
import Anthropic from "@anthropic-ai/sdk";
import { PERSONA, buildTaskPrompt } from "@/lib/ariadne/prompt";
import { scanHN, scanReddit, scanFarcaster, type Candidate } from "@/lib/ariadne/scan";
import { loadLedger, saveLedger, saveRunReport } from "@/lib/ariadne/store";
import { posterFor } from "@/lib/ariadne/post";

export const runtime = "nodejs";
export const maxDuration = 300;

const MODEL = "claude-sonnet-4-6";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface RunResult extends Candidate {
  verdict: string;
  note: string;
  draft?: string;
  permalink?: string;
  postError?: string;
}

async function qualifyAndDraft(anthropic: Anthropic, c: Candidate) {
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: PERSONA,
    messages: [{ role: "user", content: buildTaskPrompt(c) }],
  });
  const text = msg.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
  const first = text.split("\n")[0].trim();
  const m = first.match(/^`?(ENGAGE|SKIP)\s*([^`]*)`?/i);
  if (!m) return { verdict: "SKIP", note: "unparseable verdict", draft: undefined };
  return {
    verdict: m[1].toUpperCase(),
    note: m[2].trim(),
    draft: text.split("\n").slice(1).join("\n").trim() || undefined,
  };
}

export async function GET(req: Request) {
  if (process.env.CRON_SECRET && req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return Response.json({ error: "unauthorized" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY)
    return Response.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });

  const MAX_DRAFTS = parseInt(process.env.ARIADNE_MAX_DRAFTS ?? "6", 10);
  const MAX_POSTS = parseInt(process.env.ARIADNE_MAX_POSTS ?? "3", 10);
  const POSTING = process.env.ARIADNE_POST !== "0";

  const logs: string[] = [];
  const log = (m: string) => logs.push(m);

  const [ledger, ...scans] = await Promise.all([
    loadLedger(),
    scanHN(log),
    scanReddit(log),
    scanFarcaster(log),
  ]);
  const all = scans.flat();

  const seen = new Set<string>();
  const candidates = all
    .filter((c) => !ledger.threads[c.id] && c.title !== "[dead]")
    .filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)))
    .sort((a, b) => b.created - a.created)
    .slice(0, MAX_DRAFTS);

  const anthropic = new Anthropic();
  const results: RunResult[] = [];
  let posted = 0;

  for (const c of candidates) {
    try {
      const r = await qualifyAndDraft(anthropic, c);
      const entry: RunResult = { ...c, ...r };
      if (r.verdict === "ENGAGE" && r.draft && POSTING) {
        const poster = posterFor(c.venue);
        if (poster && posted < MAX_POSTS) {
          try {
            entry.permalink = await poster(c, r.draft);
            posted++;
            await sleep(10_000); // pace outbound posts
          } catch (e) {
            entry.postError = (e as Error).message;
          }
        } else if (!poster) {
          entry.postError = "no posting API for this venue, paste from report";
        } else {
          entry.postError = `over ARIADNE_MAX_POSTS cap (${MAX_POSTS})`;
        }
      }
      results.push(entry);
      ledger.threads[c.id] = {
        ts: Date.now(),
        verdict: r.verdict,
        url: c.url,
        ...(entry.permalink ? { permalink: entry.permalink } : {}),
      };
    } catch (e) {
      log(`draft failed for ${c.id}: ${(e as Error).message}`);
    }
  }

  await saveLedger(ledger);

  const engaged = results.filter((r) => r.verdict === "ENGAGE");
  const report = {
    at: new Date().toISOString(),
    scanned: all.length,
    fresh: candidates.length,
    engaged: engaged.map(({ id, venue, title, url, note, draft, permalink, postError }) => ({
      id, venue, title, url, confidence: note, draft, permalink, postError,
    })),
    skipped: results
      .filter((r) => r.verdict !== "ENGAGE")
      .map(({ id, venue, title, url, note }) => ({ id, venue, title, url, reason: note })),
    posted,
    posting: POSTING,
    logs,
  };
  const reportUrl = await saveRunReport(report);

  return Response.json({ ok: true, ...report, reportUrl });
}
