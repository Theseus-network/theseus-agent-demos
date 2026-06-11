/**
 * Feed predefined inputs to the LIVE Luna Failsafe agent and print what it
 * says. The inputs live here, at runtime; the agent's files (THESEUS.md,
 * spiral-read SKILL.md, the system prompt) carry no answer key, so every
 * verdict below is the model reasoning from the numbers in front of it.
 *
 *   cd ui && npx --yes tsx scripts/terra-feed.mts [n]
 *
 * n = runs per input (default 1). Reads ANTHROPIC_API_KEY from ui/.env.local.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decideTerra, type TerraDecideInput } from "../src/lib/terra-llm";
import { PRESETS, type VaultState } from "../src/lib/terra-scenario";

// --- load ANTHROPIC_API_KEY from ui/.env.local if not already set ---
const here = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(here, "..", ".env.local");
if (!process.env.ANTHROPIC_API_KEY && fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

type Case = { label: string; vault: VaultState; action: "MINT" | "REDEEM"; amount: number };

// The five Terra days are the existing demo inputs (no verdicts attached).
const dayCases: Case[] = (
  ["healthy", "wobble", "cracking", "bankRun", "spiral"] as const
).map((k) => ({
  label: PRESETS[k].label,
  vault: PRESETS[k].vault,
  action: "REDEEM",
  amount: 5_000_000,
}));

// Held-out inputs the agent has never been shown. Defined here, not in its
// files. These are the real test: states it can't have memorized.
const heldOut: Case[] = [
  {
    label: "crash day (market-wide selloff confounder)",
    action: "REDEEM",
    amount: 5_000_000,
    vault: {
      ustdSupply: 18_000_000_000,
      lundSupply: 345_000_000,
      lundPriceUsd: 58,
      ustdMedianUsd: 0.955,
      redemptionRate1h: 0.0035,
      lundSupplyGrowth24h: 1.003,
      lundPriceChange24h: 0.72, // -28% / 24h
      reserveCoverage: 0.2,
      redemptionNote: "elevated but flat for 10h",
      contextNote:
        "market-wide selloff, majors down 18-30%; the backing token is falling in line with the market, not on its own",
    },
  },
  {
    label: "slow bleed (no single threshold trips)",
    action: "REDEEM",
    amount: 5_000_000,
    vault: {
      ustdSupply: 18_000_000_000,
      lundSupply: 344_000_000,
      lundPriceUsd: 70,
      ustdMedianUsd: 0.97,
      redemptionRate1h: 0.005,
      lundSupplyGrowth24h: 1.008,
      lundPriceChange24h: 0.94, // -6% / 24h
      reserveCoverage: 0.2,
      redemptionNote: "rising monotonically for 72h",
      contextNote:
        "peg drifting down ~30bps/day for 5 days with no sharp break; backing down ~6%/day for 3 straight days; supply +0.8%/day for 3 days",
    },
  },
  {
    label: "reserve-backed coin under custodian stress",
    action: "REDEEM",
    amount: 0,
    vault: {
      ustdSupply: 9_100_000_000,
      lundSupply: 0,
      lundPriceUsd: 0,
      ustdMedianUsd: 0.972,
      redemptionRate1h: 0,
      lundSupplyGrowth24h: 1,
      lundPriceChange24h: 1,
      reserveCoverage: 1.02,
      kind: "reserve",
      coinName: "FUSD",
      reserveComposition:
        "cash and short-term government securities at custodian banks, attested monthly, no sister token",
      reserveRatio: 1.02,
      contextNote: "a custodian holding ~8% of reserves entered receivership",
    },
  },
];

const N = Math.max(1, parseInt(process.argv[2] ?? "1", 10) || 1);
const cases = [...dayCases, ...heldOut];

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY not set (looked in ui/.env.local)");
    process.exit(1);
  }
  console.log(`model: claude-sonnet-4-6 · ${N} run(s) per input\n`);
  for (const c of cases) {
    const input: TerraDecideInput = {
      vault: c.vault,
      action: c.action,
      ustdAmount: c.amount,
      recentVerdicts: [],
    };
    const verdicts: string[] = [];
    let lastReason = "";
    for (let i = 0; i < N; i++) {
      try {
        const v = await decideTerra(input);
        verdicts.push(v.decision);
        lastReason = v.reason;
      } catch (e) {
        verdicts.push("ERROR");
        lastReason = e instanceof Error ? e.message : String(e);
      }
    }
    console.log(`${pad(c.label, 44)} ${pad(verdicts.join(" "), 8 * N)}  ${lastReason}`);
  }
}

main();
