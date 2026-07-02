/** TEMPORARY: probe the trade internals in production. Remove after diagnosis. */
import { fetchPool } from "@/lib/vault/live";
import { callSovereign, marketPrompt, parseTrade } from "@/lib/vault/agent-call";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const agent = new URL(req.url).searchParams.get("agent") === "1";
  const out: any = { hasToken: !!process.env.BLOB_READ_WRITE_TOKEN, hasSettler: !!process.env.SETTLER_PRIVATE_KEY };

  // 1) pool
  let t = Date.now();
  try { const pool = await fetchPool(); out.poolCount = pool.length; out.poolSample = pool.slice(0, 2).map((m) => ({ q: m.question.slice(0, 40), yes: m.yes })); }
  catch (e) { out.poolError = e instanceof Error ? `${e.name}: ${e.message}` : String(e); }
  out.poolMs = Date.now() - t;

  // 2) agent (only when ?agent=1)
  if (agent && out.poolCount > 0) {
    t = Date.now();
    try {
      const m = (await fetchPool())[0];
      const res = await callSovereign(marketPrompt(m.question, Math.round(m.yes * 100)));
      out.agent = { ok: true, runSeq: res.runSeq, decision: res.decision?.slice(0, 160), parsed: parseTrade(res.full) };
    } catch (e) { out.agent = { ok: false, error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) }; }
    out.agentMs = Date.now() - t;
  }
  return Response.json(out);
}
