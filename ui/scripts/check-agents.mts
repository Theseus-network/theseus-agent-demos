/**
 * CI guard for the demo agents. Run via `npm run check:agents` (which also
 * runs `gen:prompts --check` first). No API calls; safe on every push.
 *
 *  1. Answer-key regression: the incident names we stripped from each agent's
 *     prompt must not reappear in that agent's workspace files or demo prompt.
 *     This is per-agent, so legitimate pattern-class mentions in other agents
 *     (adjudicate naming Mango, launch_sniper naming Squid Game) don't trip.
 *  2. Cross-repo drift: the vendored ui/agents/<dir> workspace files must match
 *     the website repo's canonical scratch/md-only-demos/<dir>. Skipped when the
 *     canonical checkout isn't present (e.g. CI without it).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const UI = path.join(here, "..");
const AGENTS = path.join(UI, "agents");
const LIB = path.join(UI, "src", "lib");

// Per-agent: the showcased-incident names that were its answer key (removed)
// and the demo client whose SYSTEM_PROMPT is hand-authored (terra's is
// generated, so it's covered by scanning the vendored files below).
const GUARDS: Record<string, { terms: string[]; llm?: string }> = {
  governance: { terms: ["Beanstalk"], llm: "governance-llm.ts" },
  "aave-spot": { terms: ["Mango", "MNGO"], llm: "agent-llm.ts" },
  aviation: { terms: ["Lion Air", "MCAS", "737 MAX"], llm: "aviation-llm.ts" },
  bridge: { terms: ["Ronin", "Wormhole", "Nomad"], llm: "bridge-llm.ts" },
  terra: { terms: ["May 2022", "head-fake", "Walk it day by day"] },
};

function walk(dir: string, test: (f: string) => boolean): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, test));
    else if (test(p)) out.push(p);
  }
  return out;
}

const relUI = (p: string) => path.relative(UI, p);
let failed = false;

// 1. Answer-key regression scan, per agent.
let scanned = 0;
for (const [dir, guard] of Object.entries(GUARDS)) {
  const files = [
    ...walk(path.join(AGENTS, dir), (f) => f.endsWith(".md") || f.endsWith(".generated.ts")),
    ...(guard.llm ? [path.join(LIB, guard.llm)] : []),
  ].filter((f) => fs.existsSync(f));
  for (const f of files) {
    scanned++;
    const text = fs.readFileSync(f, "utf8");
    for (const term of guard.terms) {
      if (text.includes(term)) {
        console.error(`ANSWER-KEY LEAK: "${term}" found in ${relUI(f)}`);
        failed = true;
      }
    }
  }
}
if (!failed) console.log(`answer-key scan: clean (${scanned} prompt sources across ${Object.keys(GUARDS).length} agents)`);

// 2. Cross-repo drift between vendored workspace files and the canonical.
const CANON =
  process.env.CANONICAL_DIR ??
  "/Users/ericwang/Documents/eric_theseus_delivery/scratch/md-only-demos";
if (fs.existsSync(CANON)) {
  let drift = 0;
  const vendored = walk(
    AGENTS,
    (f) => (f.endsWith("THESEUS.md") || f.endsWith("SKILL.md")),
  );
  for (const f of vendored) {
    const relPath = path.relative(AGENTS, f);
    const canonFile = path.join(CANON, relPath);
    if (!fs.existsSync(canonFile)) {
      console.error(`DRIFT: ${relPath} is vendored but missing from canonical`);
      drift++;
      continue;
    }
    if (fs.readFileSync(f, "utf8") !== fs.readFileSync(canonFile, "utf8")) {
      console.error(`DRIFT: ${relPath} differs from canonical (run npm run sync:agents)`);
      drift++;
    }
  }
  if (drift > 0) failed = true;
  else console.log(`canonical drift: none (${vendored.length} files match the website repo)`);
} else {
  console.log("canonical drift: skipped (canonical checkout not present)");
}

process.exit(failed ? 1 : 0);
