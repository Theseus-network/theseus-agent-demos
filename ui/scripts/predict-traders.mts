// A trading round. Each autonomous trader agent (Kestrel, Atlas, Sage, Onyx)
// reads the whole board in one signed on-chain call and returns the trades it
// wants. We execute them through the same LMSR the humans use, so the agents'
// trades move real prices and build real volume, and we track each agent's
// play-money P&L. Writes agent-traders.json (the leaderboard + trade feed) and
// updates agent-markets.json with the post-round prices.
//
//   npx tsx scripts/predict-traders.mts
//
import { ApiPromise, WsProvider, Keyring } from "@polkadot/api";
import { compactToU8a, stringToU8a, u8aConcat, hexToU8a } from "@polkadot/util";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RPC = process.env.THESEUS_RPC ?? "wss://rpc.alpha-testnet.theseus.network";
const SIGNER = process.env.THESEUS_SIGNER_SEED ?? "//Alice";
const EXPLORER = "https://explorer.theseus.network/agents";
const HERE = dirname(fileURLToPath(import.meta.url));
const MARKETS = resolve(HERE, "../src/lib/predict/agent-markets.json");
const OUT = resolve(HERE, "../src/lib/predict/agent-traders.json");
const START_CASH = 10_000;
const TRADERS = [
  { name: "Kestrel", blurb: "Contrarian value. Fades overconfident prices." },
  { name: "Atlas", blurb: "Momentum. Backs what is already moving." },
  { name: "Sage", blurb: "Base rates. Trades its own estimate vs the price." },
  { name: "Onyx", blurb: "Multi-strategy. Whatever makes the most money." },
];

const utf8 = (h: string) => Buffer.from(String(h).replace(/^0x/, ""), "hex").toString("utf8");
const encStr = (s: string) => { const u = stringToU8a(s); return u8aConcat(new Uint8Array([0x04]), compactToU8a(u.length), u); };
const encInput = (p: string) => "0x" + Buffer.from(u8aConcat(new Uint8Array([0x06]), compactToU8a(1), (() => { const u = stringToU8a("prompt"); return u8aConcat(compactToU8a(u.length), u); })(), encStr(p))).toString("hex");
const extract = (hex: string) => ((Buffer.from(hexToU8a(hex)).toString("utf8").match(/[\x20-\x7e][\x20-\x7e\n\t]{12,}/g) || []).sort((a, b) => b.length - a.length)[0] || "").trim();

// --- LMSR (ported from src/lib/predict/amm.ts) ---
const priceYes = (qY: number, qN: number, b: number) => 1 / (1 + Math.exp((qN - qY) / b));
const cost = (qY: number, qN: number, b: number) => { const m = Math.max(qY, qN); return m + b * Math.log(Math.exp((qY - m) / b) + Math.exp((qN - m) / b)); };
const buyCost = (qY: number, qN: number, b: number, side: string, s: number) =>
  (side === "YES" ? cost(qY + s, qN, b) : cost(qY, qN + s, b)) - cost(qY, qN, b);
function seedShares(p0: number, b: number) { const d = b * Math.log(p0 / (1 - p0)); return d >= 0 ? { qY: d, qN: 0 } : { qY: 0, qN: -d }; }
function sharesForUsd(qY: number, qN: number, b: number, side: string, usd: number) {
  let lo = 0, hi = usd / 0.01 + 1;
  for (let i = 0; i < 64; i++) { const mid = (lo + hi) / 2; if (buyCost(qY, qN, b, side, mid) < usd) lo = mid; else hi = mid; }
  return lo;
}

const r2 = (x: number) => Math.round(x * 100) / 100;

async function callOnce(api: any, signer: any, addr: string, prompt: string): Promise<string> {
  let submitAt = Date.now();
  return await new Promise<string>(async (res) => {
    const timer = setTimeout(() => res(""), 200_000);
    const unsub: any = await api.query.system.events((events: any) => {
      if (Date.now() - submitAt < 15_000) return;
      for (const { event } of events) {
        if (event.section !== "agents" || event.method !== "RunCompleted") continue;
        const flat = JSON.stringify(event.data.toJSON());
        if (!flat.includes(addr)) continue;
        const hex = (flat.match(/0x[0-9a-f]{20,}/i) || [])[0];
        const t = hex ? extract(hex) : "";
        if (t) { clearTimeout(timer); unsub(); res(t); }
      }
    });
    const n = (await api.rpc.system.accountNextIndex(signer.address)).toNumber();
    submitAt = Date.now();
    await api.tx.agents.callAgent(addr, 0, encInput(prompt)).signAndSend(signer, { nonce: n });
  });
}

async function main() {
  const markets: any[] = JSON.parse(readFileSync(MARKETS, "utf8"));
  // working AMM state per market, seeded from the current price
  const amm: Record<number, { qY: number; qN: number; b: number }> = {};
  for (const m of markets) { const s = seedShares(m.initialYes, m.liquidityB); amm[m.id] = { qY: s.qY, qN: s.qN, b: m.liquidityB }; }
  const priceOf = (id: number) => priceYes(amm[id].qY, amm[id].qN, amm[id].b);

  const api = await ApiPromise.create({ provider: new WsProvider(RPC, 3000), throwOnConnect: true });
  const signer = new Keyring({ type: "sr25519" }).addFromUri(SIGNER);
  const entries = await api.query.agents.agents.entries();
  const addrOf = (name: string) => { const a = entries.filter(([, v]) => utf8((v.toJSON() as any).name) === name).map(([k]) => k.args[0].toString()); return a[a.length - 1]; };

  const prior = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : { traders: [] };
  const out: any = { updatedAt: new Date().toISOString(), round: (prior.round ?? 0) + 1, traders: [] };
  const today = new Date().toISOString().slice(0, 10);

  for (const t of TRADERS) {
    const addr = process.env[`TRADER_${t.name.toUpperCase()}`] || addrOf(t.name);
    const prev = (prior.traders || []).find((x: any) => x.name === t.name);
    const trader: any = prev
      ? { ...prev, blurb: t.blurb }
      : { name: t.name, blurb: t.blurb, cash: START_CASH, startCash: START_CASH, positions: {}, trades: [] };
    trader.address = addr || prev?.address || "";
    trader.explorerUrl = addr ? `${EXPLORER}/${addr}` : prev?.explorerUrl || "";
    if (!addr) { console.log(`${t.name}: not deployed, skipping`); out.traders.push(trader); continue; }

    await (api.tx.balances.transferKeepAlive(addr, 3_000_000_000_000n) as any).signAndSend(signer, { nonce: (await api.rpc.system.accountNextIndex(signer.address)).toNumber() }).catch(() => {});
    await new Promise((r) => setTimeout(r, 5000));

    const board = markets.map((m) => ({ id: m.id, q: m.shortTitle || m.question, cat: m.category, price: r2(priceOf(m.id)), deadline: m.deadlineISO }));
    const posSummary = Object.entries(trader.positions).map(([id, p]: any) => `#${id}:${p.yesShares > 0 ? r2(p.yesShares) + " YES" : ""}${p.noShares > 0 ? r2(p.noShares) + " NO" : ""}`).filter((s) => s.length > 4).join(", ") || "none";
    const prompt = `Today is ${today}. You have $${r2(trader.cash)} in cash. Your current positions: ${posSummary}.\n\nThe board (price is the current YES probability, 0 to 1):\n${JSON.stringify(board)}\n\nMake your trades for this round. Return ONLY {"trades":[...]}.`;

    const text = await callOnce(api, signer, addr, prompt);
    let trades: any[] = [];
    const mObj = text.match(/\{[\s\S]*\}/);
    if (mObj) { try { trades = (JSON.parse(mObj[0]).trades) || []; } catch { try { trades = (JSON.parse(mObj[0].replace(/,\s*([\]}])/g, "$1")).trades) || []; } catch { trades = []; } } }

    let made = 0;
    for (const tr of trades) {
      const id = Number(tr.marketId);
      const side = String(tr.side).toUpperCase();
      if (!amm[id] || (side !== "YES" && side !== "NO")) continue;
      let usd = Math.min(Number(tr.usd) || 0, trader.cash);
      if (usd < 10) continue;
      const { qY, qN, b } = amm[id];
      const shares = sharesForUsd(qY, qN, b, side, usd);
      if (shares <= 0) continue;
      const price = usd / shares;
      if (side === "YES") amm[id].qY += shares; else amm[id].qN += shares;
      trader.cash = r2(trader.cash - usd);
      const pos = trader.positions[id] || { yesShares: 0, noShares: 0, cost: 0 };
      if (side === "YES") pos.yesShares = r2(pos.yesShares + shares); else pos.noShares = r2(pos.noShares + shares);
      pos.cost = r2(pos.cost + usd);
      trader.positions[id] = pos;
      const mk = markets.find((m) => m.id === id);
      mk.volumeUsd = (mk.volumeUsd || 0) + Math.round(usd);
      trader.trades.unshift({ marketId: id, q: mk.shortTitle || mk.question, side, usd: Math.round(usd), shares: r2(shares), price: r2(price), reason: String(tr.reason || "").slice(0, 160), ts: Date.now() });
      made++;
    }
    trader.trades = trader.trades.slice(0, 40);
    console.log(`${t.name}: ${made} trades, cash $${r2(trader.cash)}`);
    out.traders.push(trader);
  }

  // mark prices to market, compute P&L, persist
  for (const m of markets) m.initialYes = Math.min(0.97, Math.max(0.03, r2(priceOf(m.id))));
  for (const tr of out.traders) {
    let posVal = 0;
    for (const [id, p] of Object.entries(tr.positions) as any) {
      const pr = amm[id] ? priceOf(Number(id)) : 0.5;
      posVal += p.yesShares * pr + p.noShares * (1 - pr);
    }
    tr.value = r2(tr.cash + posVal);
    tr.pnl = r2(tr.value - tr.startCash);
    tr.pnlPct = r2((tr.pnl / tr.startCash) * 100);
  }
  out.traders.sort((a: any, b: any) => (b.value ?? 0) - (a.value ?? 0));

  writeFileSync(MARKETS, JSON.stringify(markets, null, 2));
  writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(`\nround ${out.round} written. leaderboard: ${out.traders.map((t: any) => `${t.name} $${t.value}`).join(" | ")}`);
  await api.disconnect();
}
main().catch((e) => { console.error("ERR:", e?.message ?? e); process.exit(1); });
