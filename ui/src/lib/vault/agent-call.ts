/**
 * Shared server-side helper: invoke the on-chain Sovereign agent and read its
 * decision back. Used by the live fund tick loop and the manual decision route.
 */
import { ApiPromise, WsProvider, Keyring } from "@polkadot/api";
import { cryptoWaitReady } from "@polkadot/util-crypto";
import { compactToU8a, stringToU8a, u8aConcat, u8aToHex, hexToU8a } from "@polkadot/util";

const RPC = process.env.NEXT_PUBLIC_THESEUS_RPC ?? "wss://rpc.alpha-testnet.theseus.network";
export const SOVEREIGN_AGENT = process.env.NEXT_PUBLIC_THESEUS_AGENT_FUND ?? "5C8RTTrk13NkNS7B7UqiCciL5oTMTePyiHCvpmEUbApPJ1L6";
const TOPUP = 2_000_000_000_000n; // 2 THE per call — backs the run's inference budget

const encString = (s: string) => { const u = stringToU8a(s); return u8aConcat(compactToU8a(u.length), u); };
const encStr = (s: string) => u8aConcat(new Uint8Array([0x04]), encString(s));
const encInput = (p: string) => u8aToHex(u8aConcat(new Uint8Array([0x06]), compactToU8a(1), encString("prompt"), encStr(p)));
const txt = (hex: string) => Buffer.from(hexToU8a(hex)).toString("utf8");

// Reuse one chain connection across requests within the dev server.
declare global { var __theseusApi: Promise<ApiPromise> | undefined; }
function getApi(): Promise<ApiPromise> {
  if (!globalThis.__theseusApi) {
    globalThis.__theseusApi = ApiPromise.create({ provider: new WsProvider(RPC, 2500), throwOnConnect: true });
  }
  return globalThis.__theseusApi;
}

export interface AgentDecision {
  decision: string;   // one-line verdict
  full: string;       // complete model output
  action: "HOLD" | "REBALANCE_UP" | "REBALANCE_DOWN" | "SKIP" | "UNKNOWN";
  target: number | null; // target ETH share %, if the agent gave one
  runSeq: number;
  blockHash: string;
  agent: string;
}

export function parseVerdict(output: string): { decision: string; action: AgentDecision["action"]; target: number | null } {
  const lines = output.split("\n").map((l) => l.replace(/\*\*/g, "").trim()).filter(Boolean);
  const verdict = [...lines].reverse().find((l) => /\b(HOLD|REBALANCE_UP|REBALANCE_DOWN|SKIP)\b/.test(l)) ?? lines[lines.length - 1] ?? output;
  const action = (verdict.match(/\b(HOLD|REBALANCE_UP|REBALANCE_DOWN|SKIP)\b/)?.[1] as AgentDecision["action"]) ?? "UNKNOWN";
  const tm = verdict.match(/target\s*=?\s*(\d{1,3})\s*%/i);
  const target = tm ? Math.max(0, Math.min(100, Number(tm[1]))) : null;
  return { decision: verdict, action, target };
}

export async function callSovereign(prompt: string, timeoutMs = 240_000): Promise<AgentDecision> {
  await cryptoWaitReady();
  const api = await getApi();
  const signer = new Keyring({ type: "sr25519" }).addFromUri("//Alice");
  const seqBefore = Number((await api.query.agents.nextRunSeq(SOVEREIGN_AGENT)).toString());

  const { output, block } = await new Promise<{ output: string; block: string }>((resolve, reject) => {
    let blk = "";
    let unsub: (() => void) | null = null;
    const timer = setTimeout(() => { unsub?.(); reject(new Error("run timed out")); }, timeoutMs);
    api.query.system.events((events: any) => {
      for (const { event } of events) {
        if (event.section !== "agents") continue;
        const j: any = event.data.toJSON();
        const flat = JSON.stringify(j);
        if (!flat.includes(SOVEREIGN_AGENT)) continue;
        if (event.method === "RunCompleted") {
          // Only resolve on OUR run: match the run sequence we initiated.
          const seq = Array.isArray(j) && j[0] && typeof j[0] === "object" ? Number(j[0].seq) : NaN;
          if (Number.isFinite(seq) && seq !== seqBefore) continue;
          const h = (flat.match(/0x[0-9a-f]{20,}/i) || [])[0];
          clearTimeout(timer); unsub?.();
          resolve({ output: h ? txt(h) : "(no text)", block: blk });
        }
      }
    }).then((u: any) => { unsub = u; }).catch(reject);

    api.tx.agents.callAgent(SOVEREIGN_AGENT, TOPUP, encInput(prompt)).signAndSend(signer, ({ status, dispatchError }: any) => {
      if (dispatchError) {
        let msg = dispatchError.toString();
        if (dispatchError.isModule) { try { const d = api.registry.findMetaError(dispatchError.asModule); msg = `${d.section}.${d.name}`; } catch {} }
        clearTimeout(timer); unsub?.(); reject(new Error(msg));
      } else if (status.isInBlock) { blk = status.asInBlock.toHex(); }
    }).catch((e: any) => { clearTimeout(timer); unsub?.(); reject(e); });
  });

  const { decision, action, target } = parseVerdict(output);
  return { decision, full: output, action, target, runSeq: seqBefore, blockHash: block, agent: SOVEREIGN_AGENT };
}

export function tickPrompt(price: number, vol: number, momentum: number, share: number): string {
  return (
    `Fund tick. ETH spot $${price.toLocaleString()}. Realized 24h vol ${vol}%. ` +
    `24h momentum ${momentum >= 0 ? "+" : ""}${momentum}%. Current ETH share ${share}%. ` +
    `Reply in ONE line only, no tables, no headers, exactly: ` +
    `"<HOLD|REBALANCE_UP|REBALANCE_DOWN|SKIP> target=<NN>% — <rationale, max 18 words>".`
  );
}

// --- Prediction-market trading ---
export type TradeAction = "BUY YES" | "BUY NO" | "PASS";

export function marketPrompt(question: string, yesPct: number): string {
  return (
    `Prediction market. Question: "${question}". ` +
    `The market prices Yes at ${yesPct}% (No ${100 - yesPct}%). ` +
    `State your own estimate of the true probability of Yes, then decide from the edge. ` +
    `Reply in ONE line, exactly: ` +
    `"<BUY YES|BUY NO|PASS> p=<your Yes estimate 0-100> size=<NN>% — <reason, max 16 words>".`
  );
}

export function parseTrade(output: string): { action: TradeAction; size: number; est: number | null; reason: string } {
  const lines = output.split("\n").map((l) => l.replace(/\*\*/g, "").trim()).filter(Boolean);
  const v = [...lines].reverse().find((l) => /\b(BUY\s+YES|BUY\s+NO|PASS)\b/i.test(l)) ?? lines[lines.length - 1] ?? output;
  const m = v.match(/\b(BUY\s+YES|BUY\s+NO|PASS)\b/i);
  const action = (m ? m[1].toUpperCase().replace(/\s+/g, " ") : "PASS") as TradeAction;
  const sm = v.match(/size\s*=?\s*(\d{1,3})\s*%/i);
  const size = sm ? Math.max(0, Math.min(25, Number(sm[1]))) : 0;
  const pm = v.match(/\bp\s*=\s*(\d{1,3})/i);
  const est = pm ? Math.max(0, Math.min(100, Number(pm[1]))) : null;
  const reason = v
    .replace(/^[\s"]*(BUY\s+YES|BUY\s+NO|PASS)\b/i, "")
    .replace(/\bp\s*=\s*\d{1,3}%?/i, "")
    .replace(/size\s*=?\s*\d{1,3}\s*%/i, "")
    .replace(/^[\s"—:-]+|[\s"]+$/g, "")
    .trim();
  return { action, size, est, reason };
}
