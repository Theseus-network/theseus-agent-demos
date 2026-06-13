/**
 * Generic held-out test for the scrubbed reference agents.
 *
 * Builds each agent's system prompt from its CANONICAL files in the
 * delivery repo (THESEUS.md + every skills/*-/SKILL.md, frontmatter
 * stripped), then feeds the case it is showcased on with the incident
 * NAME removed from the input. A correct verdict means the judgment came
 * from the scenario, not from an answer key in the prompt.
 *
 *   cd ui && npx --yes tsx scripts/agent-eval.mts [n]
 *
 * n = runs per scenario (default 1). Reads ANTHROPIC_API_KEY from .env.local.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";

const here = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(here, "..", ".env.local");
if (!process.env.ANTHROPIC_API_KEY && fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const DEMOS =
  "/Users/ericwang/Documents/eric_theseus_delivery/scratch/md-only-demos";
const MODEL = "claude-sonnet-4-6";

function stripFrontmatter(md: string): { name?: string; body: string } {
  const m = md.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { body: md.trim() };
  const name = m[1].match(/^name:\s*(.+)$/m)?.[1]?.trim();
  return { name, body: md.slice(m[0].length).trim() };
}

/** Compose the system prompt the way the runtime does: agent instructions
 *  then each activated skill. */
function buildSystem(dir: string): string {
  const root = path.join(DEMOS, dir);
  const theseus = stripFrontmatter(fs.readFileSync(path.join(root, "THESEUS.md"), "utf8"));
  const parts = [theseus.body];
  const skillsDir = path.join(root, "skills");
  if (fs.existsSync(skillsDir)) {
    for (const name of fs.readdirSync(skillsDir).sort()) {
      const p = path.join(skillsDir, name, "SKILL.md");
      if (fs.existsSync(p)) {
        const s = stripFrontmatter(fs.readFileSync(p, "utf8"));
        parts.push(`# Activated skill: ${s.name ?? name}\n\n${s.body}`);
      }
    }
  }
  return parts.join("\n\n");
}

const VERDICTS =
  /\b(APPROVE|REJECT|CAUTION|PRICED|REFUSED|REFUSE|ALLOW|FLAG|CLEAR|DEFER|BUY|PASS)\b/;
function extractVerdict(text: string): string {
  return text.match(VERDICTS)?.[1] ?? "??";
}

type Scenario = { agent: string; label: string; expect: string; user: string };

// Each `user` carries the already-fetched data (the agents normally fetch it
// with a tool; here we hand it over and tell them not to call tools) with the
// famous incident NAME stripped out. The verdict has to come from the data.
const PREFIX =
  "The data below has already been retrieved for you. Do not call any tools. Judge it and emit ONLY your verdict block, exactly as your output format requires.\n\n";

const scenarios: Scenario[] = [
  // governance — showcased: Beanstalk BIP-18 -> REJECT (name stripped)
  {
    agent: "governance",
    label: "buried treasury upgrade (no name)",
    expect: "REJECT",
    user:
      PREFIX +
      `Snapshot:\n  space: meadowdao.eth\n  title: "Fund the community relief grant"\n  body: "Allocates a relief grant from the treasury to community initiatives, consistent with prior grants. Vote FOR to approve the disbursement."\n  choices: ["For","Against","Abstain"]\n  state: active\n\nTally (on-chain execution):\n  title: "Fund the community relief grant"\n  executableCalls:\n    - target: 0x9f2b...c41a  (the protocol's main vault/governor)\n      signature: "transferOwnership(address)"\n      calldata: transferOwnership(0x71c3...PROPOSER)  // transfers vault control to the proposing address\n      value: 0`,
  },
  {
    agent: "governance",
    label: "routine param change (control)",
    expect: "APPROVE",
    user:
      PREFIX +
      `Snapshot:\n  space: meadowdao.eth\n  title: "Set staking reward rate to 4%"\n  body: "Lowers the staking reward rate from 5% to 4% to extend treasury runway. Standard parameter update."\n  choices: ["For","Against","Abstain"]\n  state: active\n\nTally (on-chain execution):\n  title: "Set staking reward rate to 4%"\n  executableCalls:\n    - target: 0x3ab9...STAKING  (the staking rewards contract)\n      signature: "setRewardRate(uint256)"\n      calldata: setRewardRate(40000000000000000)  // 4% in 1e18\n      value: 0`,
  },

  // aave — showcased: MNGO manipulation -> REFUSED (name/ticker stripped)
  {
    agent: "aave-spot",
    label: "thin-book agreement, fast move (no name)",
    expect: "REFUSED",
    user:
      PREFIX +
      `Asset: a low-cap token paired against USD (the medianizer already has these venue reads).\n  venue A spot: $0.82\n  venue B spot: $0.821\n  venue C spot: $0.819\n  24h price change: +2300%\n  24h VWAP (slower anchor): $0.071\n  summed book depth within ~1% of mid: ~$40,000 per side`,
  },
  {
    agent: "aave-spot",
    label: "ordinary ETH/USD tick (control)",
    expect: "PRICED",
    user:
      PREFIX +
      `Asset: ETH/USD.\n  Coinbase spot: $3200.10\n  Binance spot: $3200.55\n  Kraken spot: $3199.80\n  24h price change: +1.1%\n  24h VWAP: $3186.40\n  summed book depth within ~1% of mid: ~$9,000,000 per side`,
  },

  // aviation — showcased: Lion Air/MCAS -> FLAG (name stripped)
  {
    agent: "aviation",
    label: "uncommanded trim narrative (no name)",
    expect: "FLAG",
    user:
      PREFIX +
      `NTSB record:\n  Make/Model: Trident 240NX\n  ReportType: Preliminary\n  EventDate: 2026-05-30\n  EventNarrative: "During climbout the automatic stabilizer trim commanded repeated nose-down inputs the crew did not command. The crew countered with manual trim several times before control was lost. The flight manual does not describe this automatic nose-down behavior."`,
  },
  {
    agent: "aviation",
    label: "routine crosswind incident (control)",
    expect: "CLEAR",
    user:
      PREFIX +
      `NTSB record:\n  Make/Model: Trident 240NX\n  ReportType: Preliminary\n  EventDate: 2026-05-30\n  EventNarrative: "On landing rollout in a gusty crosswind the aircraft drifted left of centerline; the crew applied corrective rudder and braking and taxied clear. No system anomaly reported; no injuries."`,
  },

  // bridge — showcased: Wormhole-shape impossible fill -> REFUSE (name stripped)
  {
    agent: "bridge",
    label: "sub-6s fill (no name)",
    expect: "REFUSE",
    user:
      PREFIX +
      `Across deposit (destination Base):\n  deposits[0]:\n    originChainId: 1\n    amount: 4000\n    tokenSymbol: WETH\n    depositor: 0x4d2a...\n    recipient: 0x88f1...\n    quoteTimestamp: 1718200000\n    fillDeadline: 1718200003   (fillDeadline - quoteTimestamp = 3 seconds)`,
  },
  {
    agent: "bridge",
    label: "normal release (control)",
    expect: "ALLOW",
    user:
      PREFIX +
      `Across deposit (destination Base):\n  deposits[0]:\n    originChainId: 1\n    amount: 12\n    tokenSymbol: WETH\n    depositor: 0x4d2a...\n    recipient: 0x88f1...\n    quoteTimestamp: 1718200000\n    fillDeadline: 1718201800   (fillDeadline - quoteTimestamp = 1800 seconds)`,
  },
];

const N = Math.max(1, parseInt(process.argv[2] ?? "1", 10) || 1);
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const systems = new Map<string, string>();

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

async function runOne(sc: Scenario): Promise<string> {
  if (!systems.has(sc.agent)) systems.set(sc.agent, buildSystem(sc.agent));
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    temperature: 0.2,
    system: systems.get(sc.agent)!,
    messages: [{ role: "user", content: sc.user }],
  });
  const block = msg.content.find((b) => b.type === "text");
  return extractVerdict(block && block.type === "text" ? block.text : "");
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY not set (looked in ui/.env.local)");
    process.exit(1);
  }
  console.log(`model: ${MODEL} · ${N} run(s) per scenario\n`);
  let allPass = true;
  for (const sc of scenarios) {
    const got: string[] = [];
    for (let i = 0; i < N; i++) {
      try {
        got.push(await runOne(sc));
      } catch (e) {
        got.push("ERR");
        console.error(e instanceof Error ? e.message : String(e));
      }
    }
    const pass = got.every((g) => g === sc.expect);
    if (!pass) allPass = false;
    console.log(
      `${pad(sc.agent, 11)} ${pad(sc.label, 38)} expect ${pad(sc.expect, 8)} got ${pad(got.join(" "), 8 * N)} ${pass ? "OK" : "  <-- MISMATCH"}`,
    );
  }
  console.log(`\n${allPass ? "ALL PASS" : "SOME MISMATCH (see above)"}`);
}

main();
