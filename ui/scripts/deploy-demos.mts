/**
 * Register the demo-agent suite on the Theseus alpha testnet as real ship
 * agents (decision on Theseus; settlement posts to Base). Compiles each demo's
 * workspace (THESEUS.md + tools.yaml + skills) with the playground WASM
 * compiler and submits agents.registerShipAgent(Sovereign, ...) signed //Alice.
 * Falls back to a skill-less compile if the strict one trips a compiler error
 * (e.g. SkillReferencesUnknownTool). Skips agents already on-chain by name.
 *
 *   npx tsx scripts/deploy-demos.mts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ApiPromise, WsProvider, Keyring } from "@polkadot/api";
import { blake2AsU8a, encodeAddress } from "@polkadot/util-crypto";
import { u8aToHex, stringToU8a } from "@polkadot/util";

const RPC = "wss://rpc.alpha-testnet.theseus.network";
const WASM_DIR = "/Users/ericwang/Documents/playground/lib/wasm/agent-compiler";
const AGENT_RS_PATH = "/Users/ericwang/Documents/playground/templates/hello-agent/agent.rs";
const UI = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// dir → stable salt id. "fund" (Sovereign Fund) is already live, so it's omitted.
const DEMOS = [
  "aave-spot", "adjudicate", "aperture", "aviation", "bridge",
  "bug-bounty-triage", "calder", "governance", "launch_sniper",
  "marcellus", "quill", "reserve-monitor", "vellum", "terra",
];

// fetch_url is not a valid Theseus tool name; the real one is web_fetch.
const fixTools = (s: string) => s.replace(/fetch_url/g, "web_fetch");

function readSkills(dir: string): { name: string; content: string }[] {
  const skillsDir = path.join(UI, "agents", dir, "skills");
  if (!fs.existsSync(skillsDir)) return [];
  return fs.readdirSync(skillsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => {
      const md = path.join(skillsDir, e.name, "SKILL.md");
      return fs.existsSync(md) ? { name: e.name, content: fixTools(fs.readFileSync(md, "utf8")) } : null;
    })
    .filter(Boolean) as { name: string; content: string }[];
}

async function main() {
  const glue: any = await import(path.join(WASM_DIR, "agent_compiler.js"));
  await glue.default(fs.readFileSync(path.join(WASM_DIR, "agent_compiler_bg.wasm")));
  const agentRs = fs.readFileSync(AGENT_RS_PATH, "utf8");

  const api = await ApiPromise.create({ provider: new WsProvider(RPC, 3000), throwOnConnect: true });
  const alice = new Keyring({ type: "sr25519" }).addFromUri("//Alice");
  const utf8 = (h: string) => Buffer.from(String(h).replace(/^0x/, ""), "hex").toString("utf8");
  const onChain = new Set(
    (await api.query.agents.agents.entries()).map(([, v]) => utf8((v.toJSON() as any).name)),
  );
  console.log("deployer (Alice):", alice.address, "| already on-chain:", onChain.size, "\n");

  let nonce = (await api.rpc.system.accountNextIndex(alice.address)).toNumber();
  const VALUE = 1_000_000_000_000n; // 1 THE endowment
  const results: { name: string; addr: string; skills: boolean }[] = [];

  // Submit one registerShipAgent; resolves { addr } or { err } (nonce consumed either way).
  const register = (scaleBytes: Uint8Array, salt: Uint8Array) =>
    new Promise<{ addr?: string; err?: string }>((resolve) => {
      api.tx.agents
        .registerShipAgent({ Sovereign: null }, VALUE, u8aToHex(scaleBytes), u8aToHex(salt))
        .signAndSend(alice, { nonce: nonce++ }, ({ status, dispatchError, events }: any) => {
          if (dispatchError) {
            let msg = dispatchError.toString();
            if (dispatchError.isModule) { try { const d = api.registry.findMetaError(dispatchError.asModule); msg = `${d.section}.${d.name}`; } catch {} }
            resolve({ err: msg }); return;
          }
          if (status.isInBlock) {
            let found: string | undefined;
            for (const { event } of events) {
              if (event.section === "agents" && /Registered/i.test(event.method)) {
                const flat = JSON.stringify(event.data.toJSON());
                const m = flat.match(/5[1-9A-HJ-NP-Za-km-z]{46,48}/);
                found = m ? m[0] : (flat.match(/0x[0-9a-f]{64}/i) ? encodeAddress(flat.match(/0x[0-9a-f]{64}/i)![0], 42) : undefined);
              }
            }
            resolve({ addr: found });
          }
        }).catch((e) => resolve({ err: (e as Error).message }));
    });

  for (const dir of DEMOS) {
    const mdPath = path.join(UI, "agents", dir, "THESEUS.md");
    if (!fs.existsSync(mdPath)) { console.log(`${dir}: no THESEUS.md, skip`); continue; }
    // Patch model to the one model registered on this chain (deepseek-chat etc. aren't).
    const md = fs.readFileSync(mdPath, "utf8").replace(/^model:.*$/m, "model: claude-sonnet-4-6");
    const name = (md.match(/^name:\s*(.+)$/m)?.[1] || dir).trim();
    if (onChain.has(name)) { console.log(`${name}: already on-chain, skip`); continue; }
    const toolsPath = path.join(UI, "agents", dir, "tools.yaml");
    const toolsYaml = fs.existsSync(toolsPath) ? fixTools(fs.readFileSync(toolsPath, "utf8")) : null;
    const salt = blake2AsU8a(stringToU8a(`demo:${dir}`), 256);

    const compile = (skills: any[], tools: string | null): Uint8Array | null => {
      try { const c: any = glue.compileAgent(agentRs, md, skills, tools); return c?.scaleBytes instanceof Uint8Array ? c.scaleBytes : null; } catch { return null; }
    };

    // Attempt 1: full workspace (skills + tools). Fall back to skill-less on
    // compile failure OR a SkillReferencesUnknownTool registration error.
    let withSkills = true;
    let scale = compile(readSkills(dir), toolsYaml);
    let r = scale ? await register(scale, salt) : { err: "compile failed" };
    if (r.err && /SkillReferencesUnknownTool|compile failed/.test(r.err)) {
      withSkills = false;
      scale = compile([], null);
      r = scale ? await register(scale, salt) : { err: "compile failed (bare)" };
    }

    if (r.addr) { results.push({ name, addr: r.addr, skills: withSkills }); console.log(`${name}: ${r.addr}${withSkills ? "" : "  (skill-less fallback)"}`); }
    else console.log(`${name}: FAILED - ${r.err}`);
  }

  console.log(`\n=== REGISTERED ${results.length}/${DEMOS.length} ===`);
  for (const r of results) console.log(`  ${r.name.padEnd(26)} ${r.addr}`);
  await api.disconnect();
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
