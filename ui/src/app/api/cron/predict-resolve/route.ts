/**
 * Vercel Cron: settle markets whose deadline has passed. For each due market the
 * Polymarket Adjudicator agent is asked for a verdict (YES / NO / UNRESOLVABLE);
 * we pay out the trader desk's positions accordingly, mark the market resolved,
 * persist via the Blob-backed store, and best-effort post the resolution on-chain
 * to Base Sepolia. Caps due markets per run to stay inside the 300s limit.
 *
 * Mirrors the AMM/value model in predict-traders (positions {yesShares,noShares,cost};
 * value = cash + Σ yesShares·price + noShares·(1-price)). YES/NO share pays $1 on win;
 * UNRESOLVABLE refunds cost basis.
 * Env: THESEUS_RPC, THESEUS_SIGNER_SEED, CRON_SECRET, optional ADJUDICATOR_ADDR.
 */
import { ApiPromise, WsProvider, Keyring } from "@polkadot/api";
import { compactToU8a, stringToU8a, u8aConcat, hexToU8a } from "@polkadot/util";
import { baselineState, writeState } from "@/lib/predict/traders-store";
import { resolveOnChain } from "@/lib/predict/resolve-onchain";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const RPC = process.env.THESEUS_RPC ?? "wss://rpc.alpha-testnet.theseus.network";
const MAX_PER_RUN = 3;

const utf8 = (h: string) => Buffer.from(String(h).replace(/^0x/, ""), "hex").toString("utf8");
const encStr = (s: string) => { const u = stringToU8a(s); return u8aConcat(new Uint8Array([0x04]), compactToU8a(u.length), u); };
const encInput = (p: string) => "0x" + Buffer.from(u8aConcat(new Uint8Array([0x06]), compactToU8a(1), (() => { const u = stringToU8a("prompt"); return u8aConcat(compactToU8a(u.length), u); })(), encStr(p))).toString("hex");
const extract = (hex: string) => ((Buffer.from(hexToU8a(hex)).toString("utf8").match(/[\x20-\x7e][\x20-\x7e\n\t]{8,}/g) || []).sort((a, b) => b.length - a.length)[0] || "").trim();
const r2 = (x: number) => Math.round(x * 100) / 100;
const priceYes = (qY: number, qN: number, b: number) => 1 / (1 + Math.exp((qN - qY) / b));
const seedShares = (p0: number, b: number) => { const d = b * Math.log(p0 / (1 - p0)); return d >= 0 ? { qY: d, qN: 0 } : { qY: 0, qN: -d }; };

function verdictFrom(text: string): "YES" | "NO" | "UNRESOLVABLE" {
  const up = text.toUpperCase();
  const m = up.match(/\b(UNRESOLVABLE|YES|NO)\b/g);
  return (m ? (m[m.length - 1] as any) : "UNRESOLVABLE");
}

async function askAgent(api: any, signer: any, addr: string, prompt: string): Promise<string> {
  return new Promise<string>(async (resolve) => {
    let submitAt = Date.now();
    const timer = setTimeout(() => resolve(""), 120_000);
    const unsub: any = await api.query.system.events((events: any) => {
      if (Date.now() - submitAt < 18_000) return;
      for (const { event } of events) {
        if (event.section !== "agents" || event.method !== "RunCompleted") continue;
        const flat = JSON.stringify(event.data.toJSON());
        if (!flat.includes(addr)) continue;
        const hex = (flat.match(/0x[0-9a-f]{20,}/i) || [])[0];
        const t = hex ? extract(hex) : "";
        if (t) { clearTimeout(timer); unsub(); resolve(t); }
      }
    });
    const n = (await api.rpc.system.accountNextIndex(signer.address)).toNumber();
    submitAt = Date.now();
    await api.tx.agents.callAgent(addr, 0, encInput(prompt)).signAndSend(signer, { nonce: n }).catch(() => { clearTimeout(timer); resolve(""); });
  });
}

export async function GET(req: Request) {
  if (process.env.CRON_SECRET && req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return Response.json({ error: "unauthorized" }, { status: 401 });

  const baseline = await baselineState();
  if (!baseline) return Response.json({ error: "no baseline state" }, { status: 500 });
  const markets: any[] = baseline.markets || [];
  const traders: any[] = baseline.traders || [];
  const today = new Date().toISOString().slice(0, 10);

  const due = markets
    .filter((m) => !m.resolved && String(m.deadlineISO).slice(0, 10) < today)
    .sort((a, b) => String(a.deadlineISO).localeCompare(String(b.deadlineISO)))
    .slice(0, MAX_PER_RUN);
  if (!due.length) return Response.json({ ok: true, resolved: [], open: markets.filter((m) => !m.resolved).length });

  const api = await ApiPromise.create({ provider: new WsProvider(RPC, 3000), throwOnConnect: true });
  try {
    const signer = new Keyring({ type: "sr25519" }).addFromUri(process.env.THESEUS_SIGNER_SEED ?? "//Alice");
    const entries = await api.query.agents.agents.entries();
    const byName = (name: string) => { const a = entries.filter(([, v]: any) => utf8((v.toJSON() as any).name) === name).map(([k]: any) => k.args[0].toString()); return a[a.length - 1]; };
    const addr = process.env.ADJUDICATOR_ADDR || byName("Polymarket Adjudicator");
    if (!addr) return Response.json({ error: "adjudicator not on chain" }, { status: 500 });

    await (api.tx.balances.transferKeepAlive(addr, 5_000_000_000_000n) as any)
      .signAndSend(signer, { nonce: (await api.rpc.system.accountNextIndex(signer.address)).toNumber() }).catch(() => {});
    await new Promise((r) => setTimeout(r, 6000));

    const resolved: { id: number; winner: string; onChain: string | null }[] = [];
    for (const m of due) {
      const prompt = `Resolve this prediction market as of ${today}.\n\nQuestion: ${m.question}\nResolution criteria: ${m.resolutionCriteria}\nSource: ${m.resolutionSource}\n\nDecide the outcome. Reply with exactly one word on its own line: YES, NO, or UNRESOLVABLE (use UNRESOLVABLE only if it genuinely cannot be determined).`;
      const winner = verdictFrom(await askAgent(api, signer, addr, prompt));

      // pay out every trader's position on this market, then clear it
      for (const tr of traders) {
        const p = tr.positions?.[m.id];
        if (!p) continue;
        const payout = winner === "YES" ? p.yesShares : winner === "NO" ? p.noShares : (p.cost || 0);
        tr.cash = r2((tr.cash || 0) + payout);
        delete tr.positions[m.id];
      }
      m.resolved = true; m.winner = winner; m.resolvedAt = new Date().toISOString();
      const tx = winner === "UNRESOLVABLE" ? null : await resolveOnChain(m.id, winner as "YES" | "NO").catch(() => null);
      resolved.push({ id: m.id, winner, onChain: tx });
    }

    // rebuild the AMM from remaining open markets and re-mark every trader's value
    const amm: Record<number, { qY: number; qN: number; b: number }> = {};
    for (const m of markets) { if (m.resolved) continue; const s = seedShares(m.initialYes, m.liquidityB); amm[m.id] = { qY: s.qY, qN: s.qN, b: m.liquidityB }; }
    const priceOf = (id: number) => (amm[id] ? priceYes(amm[id].qY, amm[id].qN, amm[id].b) : 0.5);
    for (const tr of traders) {
      let posVal = 0;
      for (const [id, p] of Object.entries(tr.positions || {}) as any) posVal += p.yesShares * priceOf(Number(id)) + p.noShares * (1 - priceOf(Number(id)));
      tr.value = r2((tr.cash || 0) + posVal); tr.pnl = r2(tr.value - tr.startCash); tr.pnlPct = r2((tr.pnl / tr.startCash) * 100);
    }
    traders.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    await writeState({ round: baseline.round, updatedAt: new Date().toISOString(), traders, markets });
    return Response.json({ ok: true, resolved, open: markets.filter((m) => !m.resolved).length });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  } finally {
    await api.disconnect();
  }
}
