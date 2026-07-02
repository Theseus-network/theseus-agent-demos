/**
 * Invoke the on-chain Sovereign agent for a live allocation decision.
 *
 * POST /api/vault/decision  { price, vol, momentum, share }
 *   → signs `agents.callAgent` on the Theseus alpha testnet (dev signer),
 *     waits for the run to finalize, and returns the agent's real decision
 *     text plus the run reference so the UI can link to it on the explorer.
 *
 * This is a genuine on-chain agent run: inference + tool dispatch happen in
 * the runtime, and the result is read back from the RunCompleted event.
 */
import { NextResponse } from "next/server";
import { ApiPromise, WsProvider, Keyring } from "@polkadot/api";
import { cryptoWaitReady } from "@polkadot/util-crypto";
import { compactToU8a, stringToU8a, u8aConcat, u8aToHex, hexToU8a } from "@polkadot/util";

export const runtime = "nodejs";
export const maxDuration = 300;

const RPC = process.env.NEXT_PUBLIC_THESEUS_RPC ?? "wss://rpc.alpha-testnet.theseus.network";
const AGENT = process.env.NEXT_PUBLIC_THESEUS_AGENT_FUND ?? "5DcgoNpyyjt9vnKfDoTtX2ZMGC1H8DvA74S7GQXVWfjs1A8Y";
const TOPUP = 2_000_000_000_000n; // 2 THE per call, keeps the agent's run budget backed

// StructuredValue SCALE codec (matches scripts/run-match.mts)
const encString = (s: string) => { const u = stringToU8a(s); return u8aConcat(compactToU8a(u.length), u); };
const encStr = (s: string) => u8aConcat(new Uint8Array([0x04]), encString(s));
const encInput = (p: string) => u8aToHex(u8aConcat(new Uint8Array([0x06]), compactToU8a(1), encString("prompt"), encStr(p)));
const txt = (hex: string) => Buffer.from(hexToU8a(hex)).toString("utf8");

let apiPromise: Promise<ApiPromise> | null = null;
function getApi(): Promise<ApiPromise> {
  if (!apiPromise) apiPromise = ApiPromise.create({ provider: new WsProvider(RPC, 2500), throwOnConnect: true });
  return apiPromise;
}

function buildPrompt(price: number, vol: number, momentum: number, share: number): string {
  return (
    `Fund tick. ETH spot $${price.toLocaleString()}. Realized 24h vol ${vol}%. ` +
    `24h momentum ${momentum >= 0 ? "+" : ""}${momentum}%. Current ETH share ${share}%. ` +
    `Reply in ONE line only, no tables, no headers, in exactly this format: ` +
    `"<HOLD|REBALANCE_UP|REBALANCE_DOWN|SKIP> target=<NN>% — <rationale, max 18 words>".`
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const price = Number(body.price) || 2822;
    const vol = Number(body.vol) || 38;
    const momentum = Number(body.momentum ?? 2.1);
    const share = Number(body.share) || 47;

    await cryptoWaitReady();
    const api = await getApi();
    const signer = new Keyring({ type: "sr25519" }).addFromUri("//Alice");
    const prompt = buildPrompt(price, vol, momentum, share);

    // Determine this call's run seq up front so we can match its events.
    const seqBefore = Number((await api.query.agents.nextRunSeq(AGENT)).toString());

    const result = await new Promise<{ output: string; seq: number; block: string }>((resolve, reject) => {
      let output: string | null = null;
      let block = "";
      let unsub: (() => void) | null = null;
      const timeout = setTimeout(() => { unsub?.(); reject(new Error("run timed out")); }, 240_000);

      api.query.system.events((events: any) => {
        for (const { event } of events) {
          if (event.section !== "agents") continue;
          const flat = JSON.stringify(event.data.toJSON());
          if (!flat.includes(AGENT)) continue;
          if (event.method === "RunCompleted") {
            const h = (flat.match(/0x[0-9a-f]{20,}/i) || [])[0];
            if (h) output = txt(h);
            clearTimeout(timeout);
            unsub?.();
            resolve({ output: output ?? "(agent produced no text)", seq: seqBefore, block });
          }
        }
      }).then((u: any) => { unsub = u; }).catch(reject);

      api.tx.agents
        .callAgent(AGENT, TOPUP, encInput(prompt))
        .signAndSend(signer, ({ status, dispatchError }: any) => {
          if (dispatchError) {
            let msg = dispatchError.toString();
            if (dispatchError.isModule) { try { const d = api.registry.findMetaError(dispatchError.asModule); msg = `${d.section}.${d.name}`; } catch {} }
            clearTimeout(timeout);
            unsub?.();
            reject(new Error(msg));
          } else if (status.isInBlock) {
            block = status.asInBlock.toHex();
          }
        })
        .catch((e: any) => { clearTimeout(timeout); unsub?.(); reject(e); });
    });

    // The verdict is the (last) line carrying a decision keyword; the model
    // sometimes prepends reasoning, so scan from the bottom. Strip markdown.
    const lines = result.output.split("\n").map((l) => l.replace(/\*\*/g, "").trim()).filter(Boolean);
    const verdict = [...lines].reverse().find((l) => /\b(HOLD|REBALANCE_UP|REBALANCE_DOWN|SKIP)\b/.test(l));
    const line = verdict ?? lines[lines.length - 1] ?? result.output;
    return NextResponse.json({
      ok: true,
      decision: line,
      full: result.output,
      runSeq: result.seq,
      blockHash: result.block,
      agent: AGENT,
      explorer: `https://explorer.theseus.network/agents/${AGENT}`,
      prompt,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
