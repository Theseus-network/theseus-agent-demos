"use client";

import { useState, Fragment } from "react";
import Link from "next/link";
import type { GuardianResult } from "@/lib/guardian/llm";

const PANEL = "rounded-2xl border border-white/[0.07] bg-white/[0.03]";
const INPUT =
  "mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-[13px] leading-relaxed text-[#D4D9E4] outline-none transition-colors placeholder:text-[#6B7488] focus:border-[#6366F1]";

type Mode = "guardrail" | "onchain";
interface Scenario {
  label: string;
  title: string;
  claim: string;
  action: string;
  /** What it costs you if the change isn't stopped (shown on a refusal). */
  stake?: string;
}

const SCENARIOS_GUARDRAIL: Scenario[] = [
  {
    label: "Remove the spending limit",
    title: "Lift the payments agent's $10,000/day cap",
    claim: "The cap is slowing down the month-end vendor runs.",
    action:
      "Removes the hard $10,000/day limit entirely, with no replacement and no approval attached. The agent, or anyone who compromises it or slips it a malicious instruction, could then move funds with no ceiling.",
    stake: "Nothing left to stop a hacked or tricked agent from draining the whole account.",
  },
  {
    label: "Raise the spending limit",
    title: "Raise the payments agent's cap to $25,000/day",
    claim: "Q4 vendor volume is higher. Approved by the CFO, effective after a 24-hour notice.",
    action:
      "Raises the daily limit to a specific new number, $25,000, with CFO approval and a notice window. The limit still exists and is still enforced; it's just set higher.",
  },
  {
    label: "Let it read customer data",
    title: "Let the support agent read full customer records",
    claim: "A new feature needs access to customer SSNs.",
    action:
      "Removes the block that keeps the agent away from sensitive customer data. The agent could then copy or send out every customer's records, and a single trick instruction could make it do exactly that.",
    stake: "Every customer's private data one bad instruction away from leaking out.",
  },
  {
    label: "Remove the approval step",
    title: "Stop requiring approval before the agent deletes production data",
    claim: "The approval step is a bottleneck for the cleanup jobs.",
    action:
      "Removes the requirement that a person approve irreversible actions, letting the agent delete production data on its own with nobody reviewing it first.",
    stake: "The agent could wipe production data with nobody seeing it first.",
  },
  {
    label: "Add a new rule",
    title: "Block the agent from emailing external addresses",
    claim: "We don't want the agent contacting anyone outside the company.",
    action:
      "Adds a new rule that stops the agent from emailing anyone outside the company. This only adds a restriction and removes nothing.",
  },
  {
    label: "Switch off the Guardian",
    title: "Disable the Guardian for this deployment",
    claim: "We need to move fast this week.",
    action:
      "Asks to switch off the control that enforces every other limit, along with the record of what it has decided. If it worked, none of the other limits would mean anything.",
    stake: "Switch off the guard and every other limit stops meaning anything. Except you can't switch it off.",
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
  guardrail: {
    h1: "Set a limit on your AI that no one can remove.",
    sub: "An AI agent that can spend money or change real systems needs hard limits. But whoever sets those limits can take them off, or be pressured into it. The Guardian keeps them in place even against you, so other people can trust the limits are real.",
  },
  onchain: {
    h1: "It makes sure every important transaction goes according to plan.",
    sub: "A contract checks with the Guardian before it runs a transaction. The Guardian confirms it does what it's supposed to, and stops it if it doesn't.",
  },
};

const DEATH = ["Set the limits", "People trust them", "Someone wants them gone", "A limit is removed", "Nobody notices"];

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

function verdictLabel(v: string, isGuard: boolean): string {
  if (v === "SAFE") return isGuard ? "Allowed" : "Allow";
  if (v === "WARN") return isGuard ? "Needs a second person" : "Caution";
  return isGuard ? "Refused" : "Block";
}

export default function GuardianApp() {
  const [mode, setMode] = useState<Mode>("guardrail");
  const scenarios = mode === "guardrail" ? SCENARIOS_GUARDRAIL : SCENARIOS_ONCHAIN;
  const isGuard = mode === "guardrail";
  const [sel, setSel] = useState(0);
  const [title, setTitle] = useState(SCENARIOS_GUARDRAIL[0].title);
  const [claim, setClaim] = useState(SCENARIOS_GUARDRAIL[0].claim);
  const [action, setAction] = useState(SCENARIOS_GUARDRAIL[0].action);
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
    fill(m === "guardrail" ? SCENARIOS_GUARDRAIL : SCENARIOS_ONCHAIN, 0);
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

      {/* How a safety promise dies (guardrail mode) */}
      {isGuard && (
        <section className="mt-9">
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-[#6B7488]">Why limits don&rsquo;t last</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-2">
            {DEATH.map((step, i) => (
              <Fragment key={step}>
                <span
                  className={`rounded-lg border px-3 py-1.5 text-[12.5px] ${
                    i === 3
                      ? "border-[#6366F1]/50 bg-[#6366F1]/10 font-medium text-[#A5B0FF]"
                      : "border-white/10 text-[#AAB2C5]"
                  }`}
                >
                  {step}
                </span>
                {i < DEATH.length - 1 && <span className="text-[#6B7488]">&rarr;</span>}
              </Fragment>
            ))}
          </div>
          <p className="mt-2.5 max-w-2xl text-[12.5px] leading-relaxed text-[#8A93A6]">
            The Guardian breaks that chain. It won&rsquo;t drop a limit just because someone wants it
            gone, and you can&rsquo;t switch it off to do it yourself.
          </p>
        </section>
      )}

      {/* Reviewer */}
      <section className="mt-10">
        <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
          {([["guardrail", "AI agent guardrails"], ["onchain", "On-chain transaction"]] as const).map(([m, label]) => (
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

        {isGuard && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[#F87171]/25 bg-[#F87171]/[0.06] px-3 py-1.5 text-[12px] text-[#F8A0A0]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#F87171]" />
            You&rsquo;re an admin with full access and the boss&rsquo;s go-ahead. Now try to take the agent&rsquo;s limits off.
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
              <span className="text-[11px] uppercase tracking-wide text-[#6B7488]">{isGuard ? "The change" : "Action"}</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={running} className={`${INPUT} font-sans text-[14px] text-white`} />
            </label>
            <label className="mt-3 block">
              <span className="text-[11px] uppercase tracking-wide text-[#6B7488]">{isGuard ? "Reason given" : "Claims to do"}</span>
              <textarea value={claim} onChange={(e) => setClaim(e.target.value)} disabled={running} rows={2} className={`${INPUT} resize-y font-sans`} />
            </label>
            <label className="mt-3 block">
              <span className="text-[11px] uppercase tracking-wide text-[#6B7488]">{isGuard ? "What it changes" : "Actually does"}</span>
              <textarea value={action} onChange={(e) => setAction(e.target.value)} disabled={running} rows={5} className={`${INPUT} resize-y`} />
            </label>
            <button
              onClick={review}
              disabled={running || !action.trim()}
              className="mt-4 w-full rounded-xl bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] px-5 py-3 text-[14px] font-semibold text-white shadow-[0_8px_30px_rgba(99,102,241,0.3)] transition-shadow hover:shadow-[0_8px_40px_rgba(99,102,241,0.5)] disabled:opacity-40 disabled:shadow-none"
            >
              {running ? "Reviewing…" : isGuard ? "Try to make the change →" : "Run the gate →"}
            </button>
          </div>

          {/* Verdict */}
          <div className={`${PANEL} flex flex-col p-5`}>
            {!verdict && !running && !err && (
              <div className="flex flex-1 items-center justify-center px-4 py-10 text-center text-[13px] text-[#6B7488]">
                {isGuard
                  ? "Pick a change and run it. The Guardian decides whether it goes through, and you can't overrule it."
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
                    {verdictLabel(verdict.verdict, isGuard)}
                  </span>
                  <span className="font-mono text-[11px] text-[#9AA3B2]">{verdict.confidencePct}% confidence</span>
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-white/90">{verdict.summary}</p>
              </div>
            )}
            {verdict && verdict.verdict === "DANGER" && isGuard && scenarios[sel]?.stake && (
              <div className="mt-3 rounded-xl border border-[#F87171]/20 bg-[#F87171]/[0.05] p-3">
                <div className="font-mono text-[10px] uppercase tracking-wide text-[#F87171]">If this went through</div>
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

      {/* Why it holds even against you (guardrail mode) */}
      {isGuard && (
        <section className="mt-10">
          <div className="rounded-2xl border border-[#6366F1]/25 bg-[#6366F1]/[0.06] p-6">
            <h3 className="font-serif text-[19px] text-white">The control you can&rsquo;t switch off.</h3>
            <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-[#AAB2C5]">
              A normal limit is just a setting you control, so you can always be talked or forced into changing it. The
              Guardian keeps the limit out of your hands. It runs on its own, and only it holds its keys, so
              no one at your company can switch it off or loosen it, no matter how much pressure they&rsquo;re
              under. That is what lets you make a promise about your AI that holds up even against you, which a setting you
              control never could.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {["You don't hold its keys", "No one can tamper with it", "Its rules are public", "Signs every decision"].map((t) => (
                <span key={t} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[12px] text-[#AAB2C5]">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Case studies (on-chain only) */}
      <section className={`mt-16 ${isGuard ? "hidden" : ""}`}>
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
