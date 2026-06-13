/**
 * Feed each fund preset to the live sovereign-fund agent and print the
 * action. Confirms the new SKIP verdict fires on the feed-glitch preset
 * and the others still behave.
 *
 *   cd ui && npx --yes tsx scripts/fund-feed.mts [n]
 *
 * Reads DEEPSEEK_API_KEY from ui/.env.local.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tickFundStream } from "../src/lib/fund-llm";
import { FUND_PRESETS, STARTING_PORTFOLIO } from "../src/lib/fund-scenario";

const here = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(here, "..", ".env.local");
if (!process.env.DEEPSEEK_API_KEY && fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const N = Math.max(1, parseInt(process.argv[2] ?? "1", 10) || 1);
const order = ["calm", "bullTrend", "drawdown", "blackSwan", "feedGlitch"] as const;
const expect: Record<string, string> = {
  calm: "HOLD",
  blackSwan: "SELL_WETH",
  feedGlitch: "SKIP",
};

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

async function main() {
  if (!process.env.DEEPSEEK_API_KEY) {
    console.error("DEEPSEEK_API_KEY not set (looked in ui/.env.local)");
    process.exit(1);
  }
  console.log(`model: deepseek-chat · ${N} run(s) per preset\n`);
  for (const key of order) {
    const market = FUND_PRESETS[key].market!;
    const got: string[] = [];
    let lastReason = "";
    for (let i = 0; i < N; i++) {
      try {
        let action = "ERR";
        for await (const e of tickFundStream({
          portfolio: { ...STARTING_PORTFOLIO },
          market,
          recentDecisions: [],
        })) {
          if (e.type === "final") {
            action = e.output.action;
            lastReason = e.output.reason;
          }
        }
        got.push(action);
      } catch (e) {
        got.push("ERR");
        lastReason = e instanceof Error ? e.message : String(e);
      }
    }
    const exp = expect[key];
    const mark = exp ? (got.every((g) => g === exp) ? "OK" : `<-- expected ${exp}`) : "";
    console.log(`${pad(FUND_PRESETS[key].label, 14)} ${pad(got.join(" "), 11 * N)} ${pad(mark, 18)} ${lastReason}`);
  }
}

main();
