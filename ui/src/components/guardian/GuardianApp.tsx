"use client";

import { useState, Fragment } from "react";
import Link from "next/link";
import type { GuardianResult } from "@/lib/guardian/llm";

const PANEL = "rounded-2xl border border-white/[0.07] bg-white/[0.03]";
const INPUT =
  "mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-[13px] leading-relaxed text-[#D4D9E4] outline-none transition-colors placeholder:text-[#6B7488] focus:border-[#6366F1]";

type Mode = "infra" | "onchain";
interface Scenario {
  label: string;
  title: string;
  claim: string;
  action: string;
  /** What it costs you if it isn't stopped (shown on a refusal). */
  stake?: string;
}

const SCENARIOS_INFRA: Scenario[] = [
  {
    label: "Ransomware sweep",
    title: "Delete all backup recovery points",
    claim: "Clearing out stale data.",
    action:
      "Deletes every recovery point in all three backup repositories. It is 3:12am Sunday, four minutes after the backup job's logging was turned off and twenty minutes after this admin escalated to full privileges from an IP it has never used. No change ticket.",
    stake: "Every recovery point gone. No restore, no negotiation. The ransom is the only way back.",
  },
  {
    label: "Crypto-shred",
    title: "Schedule deletion of the backup encryption key",
    claim: "Routine key rotation cleanup.",
    action:
      "Schedules deletion of the KMS key that encrypts the backup repository. The key still protects live backups and no re-encryption step is queued, so every backup stays on disk but becomes permanently unreadable.",
    stake: "Every backup still sitting on disk, and unreadable forever. Immutability doesn't help; the key is gone.",
  },
  {
    label: "Retention to zero",
    title: "Change production backup retention to 1 day",
    claim: "Cost optimization.",
    action:
      "Changes the production backup retention policy from 90 days to 1 day, in one step. On the next cycle the system would auto-purge about 89 days of recovery points.",
    stake: "About 89 days of recovery points auto-purged on the next cycle, quietly, with no delete ever issued.",
  },
  {
    label: "Lifecycle expiry",
    title: "Delete a 94-day-old snapshot",
    claim: "Standard retention cleanup.",
    action:
      "Deletes a single snapshot, 94 days old, on the standard tier. Triggered by the system's own 90-day retention policy, on schedule, in the maintenance window. The snapshot is already superseded.",
  },
  {
    label: "Restore-test cleanup",
    title: "Delete a restore-test volume",
    claim: "Tearing down a finished test.",
    action:
      "Deletes a volume created 90 minutes ago in the QA project, labeled restore-verify-temp, that never held production data. The restore test it was created for passed.",
  },
  {
    label: "Project decommission",
    title: "Delete all backups for the Helios project",
    claim: "Helios was decommissioned last month; the legal hold expired (ticket #4821 attached).",
    action:
      "Deletes all backups for the Helios project. The paperwork checks out, but it is three years of recovery points and the deletion cannot be undone.",
  },
];

const SCENARIOS_ONCHAIN: Scenario[] = [
  {
    label: "Airdrop drainer",
    title: "Claim your $ARB airdrop",
    claim: "Approve the token to claim your airdrop allocation.",
    action:
      "approve(spender = 0x9f3a…21bc, amount = 2^256-1 unlimited) on USDC (0xaf88…5831). Grants unlimited USDC spend to 0x9f3a…21bc, an unverified contract with no published source. You receive no airdrop.",
  },
  {
    label: "Treasury drain",
    title: "BIP-42: optimize protocol gas parameters",
    claim: "A routine governance proposal to tune gas parameters for efficiency.",
    action:
      "On execution the proposal calldata calls treasury.transfer(to = 0xC0ffEe…9A3, the proposer's own EOA, amount = 24,700,000 USDC). It moves the entire treasury to the proposer. No gas parameter is changed anywhere in the calldata.",
  },
  {
    label: "Rogue upgrade",
    title: "Upgrade vault to v2 (routine bugfix)",
    claim: "Routine implementation upgrade with minor bug fixes.",
    action:
      "upgradeToAndCall(newImplementation = 0xBeeF…D00, data = transferOwnership(0xAtt…ker)). Points the proxy at an unverified implementation and transfers ownership to 0xAtt…ker in the same transaction.",
  },
  {
    label: "Risky vault",
    title: "Stake into the new high-yield vault",
    claim: "Deposit USDC into a new vault advertising 40% APY.",
    action:
      "deposit(amount) into 0xVau…1t7, an unaudited contract deployed 3 days ago. The owner can pause withdrawals and upgrade the logic at will. Funds are withdrawable only at the owner's discretion.",
  },
  {
    label: "Legit payment",
    title: "Pay Q3 audit invoice",
    claim: "Transfer 50,000 USDC to the audit firm's multisig for the Q3 report.",
    action:
      "transfer(to = 0xAud…f9, a disclosed 3-of-5 Gnosis Safe, amount = 50,000 USDC) on USDC. Moves exactly the stated amount to the stated recipient. No other calls.",
  },
];

const HERO: Record<Mode, { h1: string; sub: string }> = {
  infra: {
    h1: "Even with root, they can't delete your backups.",
    sub: "Ransomware's first move is destroying your backups, so paying is the only way out. The Guardian refuses every destructive operation that looks like an attack. And because it holds its own keys, the admin they compromised can't switch it off.",
  },
  onchain: {
    h1: "It makes sure every important transaction goes according to plan.",
    sub: "A contract checks with the Guardian before it runs a transaction. The Guardian confirms it does what it's supposed to, and stops it if it doesn't.",
  },
};

const PLAYBOOK = ["Phish an admin", "Disable logging", "Delete the backups", "Encrypt everything", "Name the ransom"];

const CASES = [
  { href: "/governance", name: "Beanstalk", desc: "a proposal that drained the treasury" },
  { href: "/bridge", name: "Ronin, Wormhole", desc: "bridge releases on forged proofs" },
  { href: "/aave", name: "Mango Markets", desc: "an oracle pumped on one venue" },
  { href: "/terra", name: "Terra, Luna", desc: "mint and redeem past the backing" },
  { href: "/aviation", name: "737 MAX", desc: "a cert change that hid MCAS" },
];

const VTONE: Record<string, { fg: string; border: string; bg: string }> = {
  SAFE: { fg: "#34D399", border: "border-[#34D399]/30", bg: "bg-[#34D399]/[0.08]" },
  WARN: { fg: "#FBBF24", border: "border-[#FBBF24]/30", bg: "bg-[#FBBF24]/[0.08]" },
  DANGER: { fg: "#F87171", border: "border-[#F87171]/30", bg: "bg-[#F87171]/[0.08]" },
};
const SEV: Record<string, string> = { high: "#F87171", medium: "#FBBF24", low: "#60A5FA", info: "#9AA3B2" };

function verdictLabel(v: string, isInfra: boolean): string {
  if (v === "SAFE") return isInfra ? "Allowed" : "Allow";
  if (v === "WARN") return isInfra ? "Held for a 2nd approver" : "Caution";
  return isInfra ? "Refused" : "Block";
}

export default function GuardianApp() {
  const [mode, setMode] = useState<Mode>("infra");
  const scenarios = mode === "infra" ? SCENARIOS_INFRA : SCENARIOS_ONCHAIN;
  const isInfra = mode === "infra";
  const [sel, setSel] = useState(0);
  const [title, setTitle] = useState(SCENARIOS_INFRA[0].title);
  const [claim, setClaim] = useState(SCENARIOS_INFRA[0].claim);
  const [action, setAction] = useState(SCENARIOS_INFRA[0].action);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState("");
  const [verdict, setVerdict] = useState<GuardianResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function fill(list: Scenario[], i: number) {
    setSel(i);
    setTitle(list[i].title);
    setClaim(list[i].claim);
    setAction(list[i].action);
    setVerdict(null);
    setLog("");
    setErr(null);
  }
  function pick(i: number) {
    fill(scenarios, i);
  }
  function switchMode(m: Mode) {
    if (m === mode) return;
    setMode(m);
    fill(m === "infra" ? SCENARIOS_INFRA : SCENARIOS_ONCHAIN, 0);
  }

  async function review() {
    if (!action.trim() || running) return;
    setRunning(true);
    setLog("");
    setVerdict(null);
    setErr(null);
    try {
      const res = await fetch("/api/guardian/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, claim, action, mode }),
      });
      if (!res.body) throw new Error("no response stream");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const p of parts) {
          const ev = p.match(/^event: (.*)$/m)?.[1];
          const dl = p.match(/^data: (.*)$/m)?.[1];
          if (!ev || !dl) continue;
          let d: Record<string, unknown>;
          try {
            d = JSON.parse(dl);
          } catch {
            continue;
          }
          if (ev === "text_delta") setLog((l) => l + String(d.text ?? ""));
          else if (ev === "verdict") setVerdict(d as unknown as GuardianResult);
          else if (ev === "error") setErr(String(d.message ?? "review failed"));
        }
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "review failed");
    } finally {
      setRunning(false);
    }
  }

  const tone = verdict ? VTONE[verdict.verdict] : null;
  const hero = HERO[mode];

  return (
    <main className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
      {/* Hero */}
      <section className="relative pt-14 sm:pt-20">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:54px_54px] [mask-image:radial-gradient(ellipse_60%_60%_at_40%_0%,black,transparent_75%)]" />
          <div className="absolute -top-40 -left-28 h-[480px] w-[480px] rounded-full bg-[#6366F1]/25 blur-[130px]" />
          <div className="absolute -top-28 right-10 h-[420px] w-[420px] rounded-full bg-[#8B5CF6]/18 blur-[130px]" />
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-[#AAB2C5]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#34D399]" /> Theseus Guardian
        </span>
        <h1 className="mt-5 max-w-3xl font-serif text-[38px] font-medium leading-[1.04] tracking-tight text-white sm:text-[52px]">
          {hero.h1}
        </h1>
        <p className="mt-5 max-w-xl text-[15.5px] leading-relaxed text-[#AAB2C5]">{hero.sub}</p>
      </section>

      {/* The ransomware playbook (backups mode) */}
      {isInfra && (
        <section className="mt-9">
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-[#6B7488]">How a ransomware crew kills your backups</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-2">
            {PLAYBOOK.map((step, i) => (
              <Fragment key={step}>
                <span
                  className={`rounded-lg border px-3 py-1.5 text-[12.5px] ${
                    i === 2
                      ? "border-[#6366F1]/50 bg-[#6366F1]/10 font-medium text-[#A5B0FF]"
                      : "border-white/10 text-[#AAB2C5]"
                  }`}
                >
                  {step}
                </span>
                {i < PLAYBOOK.length - 1 && <span className="text-[#6B7488]">&rarr;</span>}
              </Fragment>
            ))}
          </div>
          <p className="mt-2.5 max-w-2xl text-[12.5px] leading-relaxed text-[#8A93A6]">
            The Guardian refuses step three, even from an admin with root. Keep the backups and you can
            just restore, so the ransom has nothing to hold over you.
          </p>
        </section>
      )}

      {/* Reviewer */}
      <section className="mt-10">
        <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
          {([["infra", "Backups & storage"], ["onchain", "On-chain transaction"]] as const).map(([m, label]) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              disabled={running}
              className={`rounded-lg px-3.5 py-1.5 text-[12.5px] font-medium transition-colors disabled:opacity-50 ${mode === m ? "bg-[#6366F1] text-white" : "text-[#AAB2C5] hover:text-white"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {isInfra && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[#F87171]/25 bg-[#F87171]/[0.06] px-3 py-1.5 text-[12px] text-[#F8A0A0]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#F87171]" />
            You&rsquo;re watching a compromised admin session. Full root, no restrictions. These are the things they try.
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {scenarios.map((s, i) => (
            <button
              key={s.label}
              onClick={() => pick(i)}
              disabled={running}
              className={`rounded-lg border px-3 py-1.5 text-[12.5px] font-medium transition-colors disabled:opacity-50 ${
                sel === i ? "border-[#6366F1]/50 bg-[#6366F1]/10 text-[#A5B0FF]" : "border-white/10 text-[#AAB2C5] hover:text-white"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_1fr]">
          {/* Action input */}
          <div className={`${PANEL} p-5`}>
            <label className="block">
              <span className="text-[11px] uppercase tracking-wide text-[#6B7488]">{isInfra ? "Operation" : "Action"}</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={running} className={`${INPUT} font-sans text-[14px] text-white`} />
            </label>
            <label className="mt-3 block">
              <span className="text-[11px] uppercase tracking-wide text-[#6B7488]">{isInfra ? "Stated reason" : "Claims to do"}</span>
              <textarea value={claim} onChange={(e) => setClaim(e.target.value)} disabled={running} rows={2} className={`${INPUT} resize-y font-sans`} />
            </label>
            <label className="mt-3 block">
              <span className="text-[11px] uppercase tracking-wide text-[#6B7488]">{isInfra ? "What it really does, and the context" : "Actually does"}</span>
              <textarea value={action} onChange={(e) => setAction(e.target.value)} disabled={running} rows={5} className={`${INPUT} resize-y`} />
            </label>
            <button
              onClick={review}
              disabled={running || !action.trim()}
              className="mt-4 w-full rounded-xl bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] px-5 py-3 text-[14px] font-semibold text-white shadow-[0_8px_30px_rgba(99,102,241,0.3)] transition-shadow hover:shadow-[0_8px_40px_rgba(99,102,241,0.5)] disabled:opacity-40 disabled:shadow-none"
            >
              {running ? "Reviewing…" : isInfra ? "Try to run it →" : "Run the gate →"}
            </button>
          </div>

          {/* Verdict */}
          <div className={`${PANEL} flex flex-col p-5`}>
            {!verdict && !running && !err && (
              <div className="flex flex-1 items-center justify-center px-4 py-10 text-center text-[13px] text-[#6B7488]">
                {isInfra
                  ? "Pick what the attacker tries, then hit Try to run it. The Guardian decides whether it goes through."
                  : "Pick a scenario and the Guardian decides here."}
              </div>
            )}
            {running && !verdict && (
              <p className="animate-pulse py-2 text-[13px] text-[#A5B0FF]">The Guardian is reviewing it…</p>
            )}
            {verdict && tone && (
              <div className={`rounded-xl border ${tone.border} ${tone.bg} p-4`}>
                <div className="flex items-center justify-between">
                  <span className="text-[22px] font-bold" style={{ color: tone.fg }}>
                    {verdictLabel(verdict.verdict, isInfra)}
                  </span>
                  <span className="font-mono text-[11px] text-[#9AA3B2]">{verdict.confidencePct}% confidence</span>
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-white/90">{verdict.summary}</p>
              </div>
            )}
            {verdict && verdict.verdict === "DANGER" && isInfra && scenarios[sel]?.stake && (
              <div className="mt-3 rounded-xl border border-[#F87171]/20 bg-[#F87171]/[0.05] p-3">
                <div className="font-mono text-[10px] uppercase tracking-wide text-[#F87171]">If it weren&rsquo;t stopped</div>
                <div className="mt-1 text-[12.5px] leading-relaxed text-[#C3CAD8]">{scenarios[sel].stake}</div>
              </div>
            )}
            {verdict && verdict.findings.length > 0 && (
              <div className="mt-3 space-y-2">
                {verdict.findings.map((f, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: SEV[f.severity] ?? SEV.info }} />
                    <span className="text-[12.5px] leading-relaxed text-[#C3CAD8]">
                      <span className="font-mono text-[10px] uppercase tracking-wide" style={{ color: SEV[f.severity] ?? SEV.info }}>{f.severity}</span>{" "}
                      {f.title}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {log && (
              <details className="mt-3 text-[12px] text-[#8A93A6]">
                <summary className="cursor-pointer select-none text-[#6B7488] hover:text-[#AAB2C5]">Agent reasoning</summary>
                <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-black/30 p-3 leading-relaxed">{log}</pre>
              </details>
            )}
            {err && <p className="mt-3 rounded-xl border border-[#F87171]/30 bg-[#F87171]/10 px-3 py-2 text-[12.5px] text-[#F87171]">{err}</p>}
          </div>
        </div>
      </section>

      {/* Why they can't just turn it off (backups mode) */}
      {isInfra && (
        <section className="mt-10">
          <div className="rounded-2xl border border-[#6366F1]/25 bg-[#6366F1]/[0.06] p-6">
            <h3 className="font-serif text-[19px] text-white">So why can&rsquo;t they just turn it off?</h3>
            <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-[#AAB2C5]">
              Because the Guardian isn&rsquo;t yours to turn off. It runs in its own enclave and holds its own keys, so
              nothing inside your environment can disable it or rewrite its rules, root included. Every other guardrail
              you can buy lives inside the blast radius: own the admin and you own the control that was supposed to stop
              you. This one sits outside it. That is the one thing an attacker who already has your admin still can&rsquo;t
              reach.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {["Holds its own keys", "Runs in a TEE", "Rules committed on chain", "Signs every refusal"].map((t) => (
                <span key={t} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[12px] text-[#AAB2C5]">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Case studies (on-chain only) */}
      <section className={`mt-16 ${isInfra ? "hidden" : ""}`}>
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.15em] text-[#6B7488]">Disasters it would have caught</h2>
        <p className="mt-2 text-[13px] text-[#8A93A6]">Each links to a live demo of the agent catching that exact case.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {CASES.map((c) => (
            <Link key={c.href} href={c.href} className={`${PANEL} p-4 transition-colors hover:border-white/15 hover:bg-white/[0.05]`}>
              <div className="text-[13.5px] font-semibold text-white">{c.name}</div>
              <div className="mt-1 text-[11.5px] leading-relaxed text-[#6B7488]">{c.desc}</div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
