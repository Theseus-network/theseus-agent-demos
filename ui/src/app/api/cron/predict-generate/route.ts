/**
 * Vercel Cron: Mercer refreshes the board. Each run funds the desk agent and has
 * it mint a fresh batch of long-tail YES/NO markets for a rotating pair of
 * categories (two per run to stay inside the 300s function limit), appends them
 * to the board with on-chain provenance, and persists via the Blob-backed store.
 *
 * Port of scripts/predict-generate.mts adapted for serverless persistence.
 * Env: THESEUS_RPC, THESEUS_SIGNER_SEED (//Alice), CRON_SECRET, optional MARKETMAKER_ADDR.
 */
import { ApiPromise, WsProvider, Keyring } from "@polkadot/api";
import { compactToU8a, stringToU8a, u8aConcat, hexToU8a } from "@polkadot/util";
import { baselineState, writeState } from "@/lib/predict/traders-store";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const RPC = process.env.THESEUS_RPC ?? "wss://rpc.alpha-testnet.theseus.network";
const EXPLORER = "https://explorer.theseus.network/agents";
const CATS_PER_RUN = 2;

const utf8 = (h: string) => Buffer.from(String(h).replace(/^0x/, ""), "hex").toString("utf8");
const encStr = (s: string) => { const u = stringToU8a(s); return u8aConcat(new Uint8Array([0x04]), compactToU8a(u.length), u); };
const encInput = (p: string) => "0x" + Buffer.from(u8aConcat(new Uint8Array([0x06]), compactToU8a(1), (() => { const u = stringToU8a("prompt"); return u8aConcat(compactToU8a(u.length), u); })(), encStr(p))).toString("hex");
const extract = (hex: string) => ((Buffer.from(hexToU8a(hex)).toString("utf8").match(/[\x20-\x7e][\x20-\x7e\n\t]{12,}/g) || []).sort((a, b) => b.length - a.length)[0] || "").trim();

const CAT_ICON: Record<string, string> = { Crypto: "📈", Politics: "🇺🇸", Economy: "🏛️", Tech: "🤖", Science: "🚀", Culture: "🎬", Sports: "🏆", Trending: "🔥" };
const iconFor = (q: string, cat: string) => { const s = q.toLowerCase(); if (/bitcoin|btc/.test(s)) return "₿"; if (/ethereum|\beth\b/.test(s)) return "Ξ"; if (/solana|\bsol\b/.test(s)) return "◎"; return CAT_ICON[cat] ?? "📊"; };
const slugify = (q: string, id: number) => q.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 56) + "-" + id;
function seedVolume(id: number, initialYes: number): number {
  const tight = 1 - Math.abs(initialYes - 0.5) * 2;
  const base = 250_000 + tight * 6_000_000;
  const jitter = ((id * 2654435761) % 1000) / 1000;
  return Math.round((base * (0.5 + jitter)) / 1000) * 1000;
}
const FALLBACK_TOPICS: Record<string, string[]> = {
  Crypto: ["a specific token's post-listing price milestone", "a named protocol's TVL threshold", "a specific NFT or memecoin event"],
  Tech: ["a named repo crossing a star/commit milestone", "a specific model or app launch date", "a named product's App Store rank"],
  Politics: ["a named bill's vote or deadline", "a specific confirmation or appointment", "a local or state-level outcome"],
  Economy: ["a niche commodity or regional print", "a specific company's guidance", "a named index component move"],
  Science: ["a specific mission or launch milestone", "a named clinical trial readout", "a specific record attempt"],
  Sports: ["a named player scoring in a specific match", "a specific transfer by a deadline", "a niche league title race"],
  Culture: ["a specific film's opening-weekend number", "a named artist's chart debut", "a specific release date holding"],
};

function buildPrompt(category: string, topics: string[]) {
  const today = new Date().toISOString().slice(0, 10);
  const lines = topics.map((t) => "- " + t).join("\n");
  return `Today is ${today}. Every deadline must be a real future date after today.

Category: ${category}

Threads surfacing right now:
${lines}

You are building the LONG TAIL: specific, niche markets that Polymarket and Kalshi would never bother to list because they are too small or too specific. This is the whole point of the desk.

Hard rules:
- Do NOT write macro/head markets. No "will bitcoin hit $X", no "will the Fed cut rates", no broad index or rate or top-line price bets.
- DRILL DOWN to something specific: a named person, product, repo, game, song, creator, team, protocol, or token, and a precise metric from a named public source.
- Objectively decidable from a named public source, genuinely uncertain, with a future deadline.

Return ONLY a JSON array of 3 objects, each with EXACTLY these keys: "question" (ends with ?), "shortTitle" (under 70 chars), "description" (one sentence), "category" ("${category}"), "resolutionCriteria" (exact, objective, names a source and the deadline), "resolutionSource" (named source), "deadlineISO" ("YYYY-MM-DD", after ${today}), "initialYes" (number 0.05-0.95). No text before or after the array.`;
}
function parseMarkets(raw: string): any[] {
  const m = raw.match(/\[[\s\S]*\]/);
  if (!m) return [];
  try { return JSON.parse(m[0]); } catch { try { return JSON.parse(m[0].replace(/,\s*([\]}])/g, "$1")); } catch { return []; } }
}

async function askMercer(api: any, signer: any, addr: string, prompt: string): Promise<string> {
  return new Promise<string>(async (resolve) => {
    let submitAt = Date.now();
    const timer = setTimeout(() => resolve(""), 120_000);
    const unsub: any = await api.query.system.events((events: any) => {
      if (Date.now() - submitAt < 18_000) return; // ignore the previous run's replayed event
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
  let maxId = markets.reduce((m, x) => Math.max(m, x.id || 0), 5199);

  // Rotate which categories we mint so the board fills out over successive runs.
  const cats = Object.keys(FALLBACK_TOPICS);
  const offset = markets.length % cats.length;
  const chosen = Array.from({ length: CATS_PER_RUN }, (_, i) => cats[(offset + i) % cats.length]);

  const api = await ApiPromise.create({ provider: new WsProvider(RPC, 3000), throwOnConnect: true });
  try {
    const signer = new Keyring({ type: "sr25519" }).addFromUri(process.env.THESEUS_SIGNER_SEED ?? "//Alice");
    const entries = await api.query.agents.agents.entries();
    const byName = (name: string) => { const a = entries.filter(([, v]: any) => utf8((v.toJSON() as any).name) === name).map(([k]: any) => k.args[0].toString()); return a[a.length - 1]; };
    const addr = process.env.MARKETMAKER_ADDR || byName("Mercer");
    if (!addr) return Response.json({ error: "Mercer not on chain" }, { status: 500 });

    let n = (await api.rpc.system.accountNextIndex(signer.address)).toNumber();
    await (api.tx.balances.transferKeepAlive(addr, 5_000_000_000_000n) as any).signAndSend(signer, { nonce: n }).catch(() => {});
    await new Promise((r) => setTimeout(r, 6000));

    const createdAtISO = new Date().toISOString();
    const added: any[] = [];
    for (const category of chosen) {
      const text = await askMercer(api, signer, addr, buildPrompt(category, FALLBACK_TOPICS[category]));
      for (const mk of parseMarkets(text)) {
        if (!mk?.question || !mk?.resolutionCriteria || !mk?.deadlineISO) continue;
        const initialYes = Math.min(0.95, Math.max(0.05, Number(mk.initialYes) || 0.5));
        const vol = seedVolume(++maxId, initialYes);
        added.push({
          id: maxId, slug: slugify(String(mk.question), maxId), question: String(mk.question),
          shortTitle: String(mk.shortTitle || mk.question).slice(0, 80), description: String(mk.description || ""),
          category, icon: iconFor(String(mk.question), category), resolutionCriteria: String(mk.resolutionCriteria),
          resolutionSource: String(mk.resolutionSource || "Public record"), deadlineISO: String(mk.deadlineISO).slice(0, 10),
          initialYes, liquidityB: Math.min(20000, Math.max(2500, 2500 + vol / 1500)), volumeUsd: vol, resolvable: false,
          createdBy: { agent: "Mercer", address: addr, createdAtISO, explorerUrl: `${EXPLORER}/${addr}` },
        });
      }
    }

    if (!added.length) return Response.json({ ok: false, error: "no markets generated", categories: chosen }, { status: 502 });
    await writeState({ round: baseline.round, updatedAt: createdAtISO, traders: baseline.traders, markets: [...markets, ...added] });
    return Response.json({ ok: true, added: added.length, categories: chosen, total: markets.length + added.length });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  } finally {
    await api.disconnect();
  }
}
