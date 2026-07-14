/**
 * Precompile every expected agent to SCALE bytes and write a manifest the
 * agent-keeper cron uses to re-register anything a testnet reset wiped — WITHOUT
 * needing the WASM compiler at runtime (it isn't in the Vercel bundle).
 *
 * Each entry: { name, salt, scaleHex }. Compiled skill-less + model patched to
 * claude-sonnet-4-6 (the only registered model) so registration always succeeds.
 *
 *   npx tsx scripts/gen-agent-manifest.mts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const UI = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const WASM_DIR = "/Users/ericwang/Documents/playground/lib/wasm/agent-compiler";
const AGENT_RS_PATH = "/Users/ericwang/Documents/playground/templates/hello-agent/agent.rs";
const OUT = path.join(UI, "src/lib/predict/agent-manifest.json");

// name-lookup agents (crons find them by on-chain name) + salts matching the
// original deploy scripts so re-registration is deterministic.
const AGENTS: { md: string; salt: string }[] = [
  { md: "agents/vera/THESEUS.md", salt: "vera-v1" },
  { md: "agents/mercer/THESEUS.md", salt: "mercer-v1" },
  { md: "agents/traders/kestrel/THESEUS.md", salt: "kestrel-v1" },
  { md: "agents/traders/atlas/THESEUS.md", salt: "atlas-v1" },
  { md: "agents/traders/sage/THESEUS.md", salt: "sage-v1" },
  { md: "agents/traders/onyx/THESEUS.md", salt: "onyx-v1" },
  ...["aave-spot", "adjudicate", "aperture", "aviation", "bridge", "bug-bounty-triage",
    "calder", "governance", "launch_sniper", "marcellus", "quill", "reserve-monitor",
    "vellum", "terra"].map((dir) => ({ md: `agents/${dir}/THESEUS.md`, salt: `demo:${dir}` })),
];

async function main() {
  const glue: any = await import(path.join(WASM_DIR, "agent_compiler.js"));
  await glue.default(fs.readFileSync(path.join(WASM_DIR, "agent_compiler_bg.wasm")));
  const agentRs = fs.readFileSync(AGENT_RS_PATH, "utf8");

  const manifest: { name: string; salt: string; scaleHex: string }[] = [];
  for (const a of AGENTS) {
    const md = fs.readFileSync(path.join(UI, a.md), "utf8").replace(/^model:.*$/m, "model: claude-sonnet-4-6");
    const name = (md.match(/^name:\s*(.+)$/m)?.[1] || a.salt).trim();
    const c: any = glue.compileAgent(agentRs, md, [], null);
    if (!(c?.scaleBytes instanceof Uint8Array)) { console.log(`${name}: COMPILE FAILED`); continue; }
    manifest.push({ name, salt: a.salt, scaleHex: "0x" + Buffer.from(c.scaleBytes).toString("hex") });
    console.log(`${name.padEnd(26)} salt=${a.salt.padEnd(16)} ${c.scaleBytes.length}b`);
  }
  fs.writeFileSync(OUT, JSON.stringify(manifest, null, 2));
  console.log(`\nwrote ${manifest.length} agents → ${path.relative(UI, OUT)}`);
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
