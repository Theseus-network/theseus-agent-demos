/**
 * Copy the canonical agent workspace files from the website repo into the
 * vendored ui/agents/<dir>/ tree, then regenerate the demo prompts.
 *
 *   npm run sync:agents
 *   CANONICAL_DIR=/path/to/scratch/md-only-demos npm run sync:agents
 *
 * Run this whenever the website repo's THESEUS.md / SKILL.md change, then
 * commit the updated ui/agents/** and the regenerated *.generated.ts.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const AGENTS = path.join(here, "..", "agents");
const CANON =
  process.env.CANONICAL_DIR ??
  "/Users/ericwang/Documents/eric_theseus_delivery/scratch/md-only-demos";

if (!fs.existsSync(CANON)) {
  console.error(`canonical not found: ${CANON} (set CANONICAL_DIR)`);
  process.exit(1);
}

let synced = 0;
for (const name of fs.readdirSync(AGENTS)) {
  const dest = path.join(AGENTS, name);
  if (!fs.statSync(dest).isDirectory()) continue;
  const src = path.join(CANON, name);
  if (!fs.existsSync(path.join(src, "THESEUS.md"))) continue;
  fs.copyFileSync(path.join(src, "THESEUS.md"), path.join(dest, "THESEUS.md"));
  const srcSkills = path.join(src, "skills");
  if (fs.existsSync(srcSkills)) {
    fs.rmSync(path.join(dest, "skills"), { recursive: true, force: true });
    fs.cpSync(srcSkills, path.join(dest, "skills"), { recursive: true });
  }
  synced++;
  console.log(`synced ${name}`);
}
console.log(`\n${synced} agents synced from ${CANON}. Now run: npm run gen:prompts`);
