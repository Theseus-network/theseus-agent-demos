/**
 * Actually invoke the on-chain Sovereign agent: submit agents.callAgent with a
 * fund-tick prompt, wait for the run to complete, and read back the agent's
 * real decision. Proves the interaction mechanism end-to-end.
 *
 *   npx tsx scripts/call-sovereign.mts
 */
import { ApiPromise, WsProvider, Keyring } from "@polkadot/api";
import { compactToU8a, stringToU8a, u8aConcat, u8aToHex, hexToU8a } from "@polkadot/util";

const RPC = "wss://rpc.alpha-testnet.theseus.network";
const AGENT = "5DcgoNpyyjt9vnKfDoTtX2ZMGC1H8DvA74S7GQXVWfjs1A8Y";

// SCALE codec for the agent input (StructuredValue), matching scripts/run-match.mts
const encString = (s: string) => { const u = stringToU8a(s); return u8aConcat(compactToU8a(u.length), u); };
const encStr = (s: string) => u8aConcat(new Uint8Array([0x04]), encString(s));
const encInput = (p: string) => u8aToHex(u8aConcat(new Uint8Array([0x06]), compactToU8a(1), encString("prompt"), encStr(p)));
const txt = (hex: string) => Buffer.from(hexToU8a(hex)).toString("utf8");

const PROMPT =
  "Fund tick. ETH spot $2,822. Realized 24h vol 38%. 24h momentum +2.1%. " +
  "Current ETH share 47%. Give one allocation decision (HOLD / REBALANCE_UP / " +
  "REBALANCE_DOWN / SKIP) with target ETH share and a one-line rationale.";

const api = await ApiPromise.create({ provider: new WsProvider(RPC, 3000), throwOnConnect: true });
const alice = new Keyring({ type: "sr25519" }).addFromUri("//Alice");
console.log("caller:", alice.address, "\nagent:", AGENT);

let output: string | null = null;
let runId: string | null = null;
const unsub = await api.query.system.events((events: any) => {
  for (const { event } of events) {
    if (event.section !== "agents") continue;
    const flat = JSON.stringify(event.data.toJSON());
    if (!flat.includes(AGENT) && !(runId && flat.includes(runId))) continue;
    console.log(`  agents.${event.method}: ${flat.slice(0, 140)}`);
    if (event.method === "RunStarted" || event.method === "AgentCalled") {
      const m = flat.match(/"runId":\s*"?(0x[0-9a-f]+|\d+)"?/i) || flat.match(/0x[0-9a-f]{6,}/i);
      if (m) runId = m[1] ?? m[0];
    }
    if (event.method === "RunCompleted" || event.method === "RunFinished") {
      const h = (flat.match(/0x[0-9a-f]{20,}/i) || [])[0];
      if (h) output = txt(h);
    }
  }
});

const VALUE = 50_000_000_000_000n; // 50 THE — tops up the agent so the run can reserve an inference budget
console.log("\nsubmitting callAgent (value 50 THE) ...");
await api.tx.agents.callAgent(AGENT, VALUE, encInput(PROMPT)).signAndSend(alice, ({ status, dispatchError }: any) => {
  if (dispatchError) console.log("dispatchError:", dispatchError.toString().slice(0, 80));
  if (status.isInBlock) console.log("in block", status.asInBlock.toHex().slice(0, 14));
});

// Poll up to ~2 min for the run to complete.
for (let t = 0; t < 60 && !output; t++) await new Promise((r) => setTimeout(r, 2000));
unsub();

console.log("\n=== AGENT OUTPUT ===");
console.log(output ? output : "(no output within timeout — run may still be processing)");

// Also read the agent's last recorded run for verification.
try {
  const seq: any = await api.query.agents.nextRunSeq(AGENT);
  console.log("\nnextRunSeq:", seq?.toString?.());
} catch {}
console.log("explorer:", `https://explorer.theseus.network/agents/${AGENT}`);
await api.disconnect();
