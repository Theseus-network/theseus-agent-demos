/**
 * Generate each demo agent's SYSTEM_PROMPT from the vendored canonical
 * workspace files (ui/agents/<dir>/THESEUS.md + the activated skill) plus a
 * per-agent deployment addendum (ui/agents/<dir>/deployment.md). The demo
 * prompt is therefore BUILT from the same files the guide page renders, so
 * the demo cannot silently drift from the tutorial.
 *
 *   npm run gen:prompts            write the generated files
 *   npm run gen:prompts -- --check fail if any generated file is stale (CI)
 *
 * After editing an agent's THESEUS.md, its skill, or its deployment.md, run
 * `npm run gen:prompts` and commit the regenerated *.generated.ts.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const AGENTS = path.join(here, "..", "agents");

// Agents whose demo prompt is generated from the canonical files. The demo's
// SYSTEM_PROMPT is a faithful mirror of the workspace for these; agents with a
// deliberately different demo framing are not listed (yet).
const REGISTRY: { dir: string; skillDir: string }[] = [
  { dir: "terra", skillDir: "spiral-read" },
];

function stripFrontmatter(md: string): { name?: string; body: string } {
  const m = md.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { body: md.trim() };
  const name = m[1].match(/^name:\s*(.+)$/m)?.[1]?.trim();
  return { name, body: md.slice(m[0].length).trim() };
}

/** The THESEUS body up to (not including) its terminal "## Output" section.
 *  The single-line output format in the workspace file is replaced by the
 *  streaming-JSON deployment addendum, so we drop it here. */
function instructions(dir: string): string {
  const { body } = stripFrontmatter(
    fs.readFileSync(path.join(AGENTS, dir, "THESEUS.md"), "utf8"),
  );
  const cut = body.search(/\n#+ Output\b/);
  return (cut === -1 ? body : body.slice(0, cut)).trim();
}

function buildPrompt(entry: { dir: string; skillDir: string }): string {
  const inst = instructions(entry.dir);
  const sk = stripFrontmatter(
    fs.readFileSync(
      path.join(AGENTS, entry.dir, "skills", entry.skillDir, "SKILL.md"),
      "utf8",
    ),
  );
  const addendum = fs
    .readFileSync(path.join(AGENTS, entry.dir, "deployment.md"), "utf8")
    .trim();
  return `${inst}\n\n# Activated skill: ${sk.name ?? entry.skillDir}\n\n${sk.body}\n\n${addendum}`;
}

function escapeTemplate(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

function generatedSource(dir: string, prompt: string): string {
  return (
    `// GENERATED from ui/agents/${dir}/ by scripts/gen-prompts.mts. Do not edit by hand.\n` +
    `// Run \`npm run gen:prompts\` after changing THESEUS.md, the skill, or deployment.md.\n` +
    `export const SYSTEM_PROMPT = \`${escapeTemplate(prompt)}\`;\n`
  );
}

function main() {
  const check = process.argv.includes("--check");
  let stale = 0;
  for (const entry of REGISTRY) {
    const out = generatedSource(entry.dir, buildPrompt(entry));
    const file = path.join(AGENTS, entry.dir, "system-prompt.generated.ts");
    const existing = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
    if (existing === out) {
      console.log(`up to date: agents/${entry.dir}`);
      continue;
    }
    stale++;
    if (check) {
      console.error(
        `STALE: agents/${entry.dir}/system-prompt.generated.ts is out of date. Run \`npm run gen:prompts\`.`,
      );
    } else {
      fs.writeFileSync(file, out);
      console.log(`wrote agents/${entry.dir}/system-prompt.generated.ts`);
    }
  }
  if (check && stale > 0) process.exit(1);
}

main();
