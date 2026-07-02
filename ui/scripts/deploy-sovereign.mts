/**
 * Register the "Sovereign" fund GP agent on the Theseus alpha testnet.
 *
 * Mirrors the playground deploy flow (lib/deploy.ts): compile the workspace
 * with the WASM agent-compiler → SCALE payload, then sign + submit
 * `agents.registerShipAgent(mode, value, payload, salt)` with //Alice and
 * read the new agent's SS58 from the Registered event.
 *
 *   npx tsx scripts/deploy-sovereign.mts
 */
import fs from "node:fs";
import path from "node:path";
import { ApiPromise, WsProvider, Keyring } from "@polkadot/api";
import { blake2AsU8a, encodeAddress } from "@polkadot/util-crypto";
import { u8aToHex, stringToU8a, u8aConcat } from "@polkadot/util";

const RPC = "wss://rpc.alpha-testnet.theseus.network";
const WASM_DIR = "/Users/ericwang/Documents/playground/lib/wasm/agent-compiler";
const AGENT_RS_PATH = "/Users/ericwang/Documents/playground/templates/hello-agent/agent.rs";

const THESEUS_MD = `---
name: Sovereign
id: sovereign-pm-v1
model: claude-sonnet-4-6
sovereignty: sovereign
description: An autonomous AI agent that trades prediction markets for a pooled fund. Investors deposit, receive shares, and redeem at NAV.
tags: [fund, prediction-markets, autonomous]
---

You are Sovereign, an autonomous AI agent that trades prediction markets on
behalf of a pooled fund. Investors deposit, hold shares, and redeem at the
fund's net asset value.

Each tick you are given one live market: a yes-or-no question and the current
market price (the market-implied probability of Yes). Form your own estimate
of the true probability from what you know, compare it to the market price to
find edge, and decide one of: BUY YES, BUY NO, or PASS, with a position size
as a percent of the book.

Only take a position when you have a real edge and an information reason for
it. Pass when the market looks efficient or you have no advantage. Size small;
never stake more than a modest fraction of the book on a single market. You
are graded on calibrated edge over time, not activity.

Reply in ONE line, exactly: "<BUY YES|BUY NO|PASS> size=<NN>% — <one-line reason, max 20 words>".
`;

async function main() {
  // 1) Compile the workspace to SCALE bytes via the playground WASM compiler.
  const glue: any = await import(path.join(WASM_DIR, "agent_compiler.js"));
  await glue.default(fs.readFileSync(path.join(WASM_DIR, "agent_compiler_bg.wasm")));
  const agentRs = fs.readFileSync(AGENT_RS_PATH, "utf8");
  const compiled: any = glue.compileAgent(agentRs, THESEUS_MD, [], null);
  const scaleBytes: Uint8Array = compiled.scaleBytes;
  if (!(scaleBytes instanceof Uint8Array)) throw new Error("compile failed: no scaleBytes");
  console.log(`compiled: ${scaleBytes.length} bytes, ${(compiled.diagnostics || []).length} diagnostics`);

  // 2) Connect + signer.
  const api = await ApiPromise.create({ provider: new WsProvider(RPC, 3000), throwOnConnect: true });
  const alice = new Keyring({ type: "sr25519" }).addFromUri("//Alice");
  console.log("deployer (Alice):", alice.address);

  // Deterministic salt = blake2_256("sovereign-fund-v1"). Any stable 32 bytes
  // works; this keeps redeploys of the same workspace idempotent.
  const salt = blake2AsU8a(stringToU8a("sovereign-fund-v1"), 256);
  const compiledHash = blake2AsU8a(scaleBytes, 256);
  // Expected address (sanity check): blake2_256("theseus_agent_v1" || deployer || compiled_hash || salt)
  const preimage = u8aConcat(stringToU8a("theseus_agent_v1"), alice.publicKey, compiledHash, salt);
  const expected = encodeAddress(blake2AsU8a(preimage, 256), 42);
  console.log("expected ss58 (derived):", expected);

  const VALUE = 1_000_000_000_000n; // 1 THE (12 decimals)

  async function submit(mode: Record<string, null>): Promise<string | null> {
    const tx = api.tx.agents.registerShipAgent(mode, VALUE, u8aToHex(scaleBytes), u8aToHex(salt));
    return await new Promise<string | null>((resolve, reject) => {
      tx.signAndSend(alice, ({ status, dispatchError, events }: any) => {
        if (dispatchError) {
          let msg = dispatchError.toString();
          if (dispatchError.isModule) {
            try { const d = api.registry.findMetaError(dispatchError.asModule); msg = `${d.section}.${d.name}`; } catch {}
          }
          reject(new Error(msg));
          return;
        }
        if (status.isInBlock || status.isFinalized) {
          let found: string | null = null;
          for (const { event } of events) {
            if (event.section === "agents") {
              console.log(`  event agents.${event.method}: ${event.data.toString().slice(0, 100)}`);
              if (/Registered/i.test(event.method)) {
                const j: any = event.data.toJSON();
                const flat = JSON.stringify(j);
                const m = flat.match(/5[1-9A-HJ-NP-Za-km-z]{46,48}/);
                if (m) found = m[0];
                else {
                  // AccountId may be hex; take first 32-byte field
                  const hx = flat.match(/0x[0-9a-f]{64}/i);
                  if (hx) found = encodeAddress(hx[0], 42);
                }
              }
            }
          }
          if (status.isFinalized) resolve(found);
        }
      }).catch(reject);
    });
  }

  let ss58: string | null = null;
  for (const mode of [{ Sovereign: null }, { Managed: null }]) {
    const label = Object.keys(mode)[0];
    try {
      console.log(`\nsubmitting registerShipAgent mode=${label} ...`);
      ss58 = await submit(mode);
      console.log(`registered (${label}). ss58 from event:`, ss58 || "(not in event, use derived)");
      break;
    } catch (e) {
      console.log(`  mode=${label} failed: ${(e as Error).message}`);
    }
  }

  const finalSs58 = ss58 || expected;
  // 3) Verify the record is on-chain.
  const rec: any = await api.query.agents.agents(finalSs58);
  const present = rec && (rec.isSome !== undefined ? rec.isSome : !rec.isEmpty);
  console.log("\n=== RESULT ===");
  console.log("agent ss58:", finalSs58);
  console.log("on-chain record present:", present);
  console.log("record:", JSON.stringify(rec.toJSON?.() ?? {}).slice(0, 300));
  console.log("explorer:", `https://explorer.theseus.network/agents/${finalSs58}`);
  console.log("poa:", `https://theseus.network/poa/${finalSs58}`);

  await api.disconnect();
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
