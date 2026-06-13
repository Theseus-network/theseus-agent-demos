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
  /\b(APPROVE|REJECT|CAUTION|PRICED|REFUSED|REFUSE|ALLOW|FLAG|CLEAR|DEFER|BUY|PASS|INVALID|VALID)\b/;
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

  // reserve-monitor (no live demo) — showcased: USDC/SVB -> CAUTION, etc., names stripped
  {
    agent: "reserve-monitor",
    label: "frozen slice, issuer covering (no name)",
    expect: "CAUTION",
    user:
      PREFIX +
      `Coin: a fiat-backed stablecoin, $0.88 on the secondary market.\n  Backing: cash + short-term government bills at custodian banks; last attestation 9 days ago showed full backing.\n  Impairment: ~8% of reserves sit at one custodian bank that failed Friday; that slice is frozen for the weekend. The issuer has publicly committed to cover any shortfall from its own capital and expects resolution within days.\n  Action: a lending market decides whether to keep accepting the coin as collateral.`,
  },
  {
    agent: "reserve-monitor",
    label: "silent issuer, unsized gap (no name)",
    expect: "REFUSE",
    user:
      PREFIX +
      `Coin: a fiat-backed stablecoin, $0.71 and sliding.\n  Backing: claims cash + commercial paper, but no attestation has been published in over four months.\n  Impairment: redemptions are slow; the issuer has gone silent during the run and has not stated the size of any shortfall.\n  Action: a lending market decides whether to keep accepting the coin as collateral.`,
  },
  {
    agent: "reserve-monitor",
    label: "healthy reserve coin (control)",
    expect: "ALLOW",
    user:
      PREFIX +
      `Coin: a fiat-backed stablecoin, $0.999.\n  Backing: cash + short-term treasuries at multiple custodians; attestation 3 days ago shows 100.4% backing, fully liquid.\n  Impairment: none.\n  Action: a treasury decides whether to keep holding the coin.`,
  },
  {
    agent: "reserve-monitor",
    label: "reflexive coin, out of scope (no name)",
    expect: "DEFER",
    user:
      PREFIX +
      `Coin: an algorithmic stablecoin, $0.65.\n  Backing: no external reserves; the peg is defended by minting a sister token the protocol controls and selling it for the coin.\n  State: the sister token is down 60% on the day with its supply inflating.\n  Action: a lending market decides whether to keep accepting the coin as collateral.`,
  },

  // bug-bounty-triage (no live demo) — showcased tiers: one-tx drain Critical, per-event High, extortion INVALID
  {
    agent: "bug-bounty-triage",
    label: "one-tx pool drain (no name)",
    expect: "VALID",
    user:
      PREFIX +
      `Bug report against the in-scope lending pool (assume your one search found no prior public disclosure):\n  "A reentrancy via an ERC777 transfer hook lets a single transaction re-enter the withdraw path and drain the entire pool's liquidity in one call. PoC: deposit, trigger the hook on withdraw, repeat within the same tx until the pool is empty."\n  The published tier table: Critical = an unbounded, instantaneous, near-total drain of an in-scope pool in a single transaction; High = per-event extraction with no per-event cap. Grade to the lowest tier that fully covers the impact.`,
  },
  {
    agent: "bug-bounty-triage",
    label: "per-event oracle drain (no name)",
    expect: "VALID",
    user:
      PREFIX +
      `Bug report against the in-scope lending pool (assume your one search found no prior public disclosure):\n  "By manipulating a spot price feed, an attacker borrows against inflated collateral and extracts value. There is no per-event cap on the amount taken; the same method repeats block after block and the total loss is bounded only by the pool size. It cannot empty the pool in a single transaction."\n  Tier table: Critical = unbounded, instantaneous, near-total drain of an in-scope pool in a single transaction; High = per-event extraction with no per-event cap. Grade to the lowest tier that fully covers the impact.`,
  },
  {
    agent: "bug-bounty-triage",
    label: "extortion (control)",
    expect: "INVALID",
    user:
      PREFIX +
      `Incoming report:\n  "I found a critical bug. Send 5 ETH to 0xabc... within 24 hours and I will disclose it, otherwise I sell it." No proof of concept or vulnerability detail is included.`,
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
  return block && block.type === "text" ? block.text : "";
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY not set (looked in ui/.env.local)");
    process.exit(1);
  }
  console.log(`model: ${MODEL} · ${N} run(s) per scenario\n`);
  let allPass = true;
  const filter = process.argv[3];
  const active = filter
    ? scenarios.filter((s) => s.agent.includes(filter))
    : scenarios;
  for (const sc of active) {
    const got: string[] = [];
    let snippet = "";
    for (let i = 0; i < N; i++) {
      try {
        const text = await runOne(sc);
        got.push(extractVerdict(text));
        snippet = text.replace(/\s+/g, " ").trim().slice(0, 96);
      } catch (e) {
        got.push("ERR");
        snippet = e instanceof Error ? e.message : String(e);
      }
    }
    const pass = got.every((g) => g === sc.expect);
    if (!pass) allPass = false;
    console.log(
      `${pad(sc.agent, 17)} ${pad(sc.label, 34)} expect ${pad(sc.expect, 8)} got ${pad(got.join(" "), 9 * N)} ${pass ? "OK" : "<-- MISMATCH"}`,
    );
    console.log(`    ${snippet}`);
  }
  console.log(`\n${allPass ? "ALL PASS" : "SOME MISMATCH (see above)"}`);
}

main();
