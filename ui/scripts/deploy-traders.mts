/**
 * Re-register the Predict desk + trader agents on the Theseus alpha testnet
 * after a reset wiped them (Kestrel, Atlas, Sage, Onyx, Mercer). Compiles each
 * agent's real workspace persona (agents/<...>/THESEUS.md) with the playground
 * WASM compiler and submits agents.registerShipAgent(Sovereign, ...) signed
 * //Alice. The predict-traders cron finds them by on-chain name, so the names
 * in THESEUS.md must stay Kestrel/Atlas/Sage/Onyx/Mercer.
 *
 *   npx tsx scripts/deploy-traders.mts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ApiPromise, WsProvider, Keyring } from "@polkadot/api";
import { blake2AsU8a, encodeAddress } from "@polkadot/util-crypto";
import { u8aToHex, stringToU8a, u8aConcat } from "@polkadot/util";

const RPC = "wss://rpc.alpha-testnet.theseus.network";
const WASM_DIR = "/Users/ericwang/Documents/playground/lib/wasm/agent-compiler";
const AGENT_RS_PATH = "/Users/ericwang/Documents/playground/templates/hello-agent/agent.rs";
const UI = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const AGENTS = [
  { name: "Kestrel", md: "agents/traders/kestrel/THESEUS.md", salt: "kestrel-v1" },
  { name: "Atlas", md: "agents/traders/atlas/THESEUS.md", salt: "atlas-v1" },
  { name: "Sage", md: "agents/traders/sage/THESEUS.md", salt: "sage-v1" },
  { name: "Onyx", md: "agents/traders/onyx/THESEUS.md", salt: "onyx-v1" },
  { name: "Mercer", md: "agents/mercer/THESEUS.md", salt: "mercer-v1" },
];

async function main() {
  const glue: any = await import(path.join(WASM_DIR, "agent_compiler.js"));
  await glue.default(fs.readFileSync(path.join(WASM_DIR, "agent_compiler_bg.wasm")));
  const agentRs = fs.readFileSync(AGENT_RS_PATH, "utf8");

  const api = await ApiPromise.create({ provider: new WsProvider(RPC, 3000), throwOnConnect: true });
  const alice = new Keyring({ type: "sr25519" }).addFromUri("//Alice");
  console.log("deployer (Alice):", alice.address, "\n");
  const VALUE = 1_000_000_000_000n; // 1 THE endowment (cron tops up 3 THE per run)

  const results: Record<string, string> = {};
  for (const a of AGENTS) {
    const theseusMd = fs.readFileSync(path.join(UI, a.md), "utf8");
    const compiled: any = glue.compileAgent(agentRs, theseusMd, [], null);
    const scaleBytes: Uint8Array = compiled.scaleBytes;
    if (!(scaleBytes instanceof Uint8Array)) { console.log(`${a.name}: compile FAILED`); continue; }
    const salt = blake2AsU8a(stringToU8a(a.salt), 256);

    const ss58 = await new Promise<string | null>((resolve, reject) => {
      api.tx.agents
        .registerShipAgent({ Sovereign: null }, VALUE, u8aToHex(scaleBytes), u8aToHex(salt))
        .signAndSend(alice, ({ status, dispatchError, events }: any) => {
          if (dispatchError) {
            let msg = dispatchError.toString();
            if (dispatchError.isModule) { try { const d = api.registry.findMetaError(dispatchError.asModule); msg = `${d.section}.${d.name}`; } catch {} }
            reject(new Error(msg)); return;
          }
          if (status.isFinalized) {
            let found: string | null = null;
            for (const { event } of events) {
              if (event.section === "agents" && /Registered/i.test(event.method)) {
                const flat = JSON.stringify(event.data.toJSON());
                const m = flat.match(/5[1-9A-HJ-NP-Za-km-z]{46,48}/);
                if (m) found = m[0];
                else { const hx = flat.match(/0x[0-9a-f]{64}/i); if (hx) found = encodeAddress(hx[0], 42); }
              }
            }
            resolve(found);
          }
        }).catch(reject);
    }).catch((e) => { console.log(`${a.name}: register FAILED - ${(e as Error).message}`); return null; });

    if (ss58) { results[a.name] = ss58; console.log(`${a.name}: ${ss58} (${scaleBytes.length}b)`); }
  }

  console.log("\n=== ENV LINES (optional overrides; cron also finds these by name) ===");
  for (const a of AGENTS) if (results[a.name]) console.log(`TRADER_${a.name.toUpperCase()}=${results[a.name]}`);
  if (results["Mercer"]) console.log(`NEXT_PUBLIC_PREDICT_DESK=${results["Mercer"]}`);
  await api.disconnect();
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
