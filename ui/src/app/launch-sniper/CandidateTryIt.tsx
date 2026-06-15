"use client";

// Makes the sniper's judgment interactive — and dramatizes the part that's
// otherwise invisible: a PASS only looks smart once you see the rug it dodged.
// Throw a fresh launch at it, watch the 5-check verdict, then see what happened
// next. Sample candidates are representative shapes (deterministic), so the
// story lands instantly without hitting Base/GoPlus live per click.

import { useState } from "react";

type Tri = true | false | "unknown";

interface Candidate {
  id: string;
  ticker: string;
  blurb: string;
  decision: "PASS" | "BUY";
  size: string; // "$250" / "$50" / "—"
  checks: {
    source_verified: Tri;
    mint_renounced: Tri;
    lp_locked: Tri;
    deployer_clean: Tri;
    top10_ok: Tri; // top-10 holders under ~70%
  };
  reason: string;
  reasoning: string;
  outcome: string;
  outcomePnl: number; // percent; negative = rug
}

const CANDIDATES: Candidate[] = [
  {
    id: "rug-lp",
    ticker: "$MOONROCKET",
    blurb: "verified contract, but LP owned by deployer & unlocked",
    decision: "PASS",
    size: "—",
    checks: { source_verified: true, mint_renounced: true, lp_locked: false, deployer_clean: "unknown", top10_ok: false },
    reason: "LP unlocked & deployer-owned — textbook rug shape",
    reasoning:
      "Source verifies and mint is renounced, which is what gets retail in. But the LP is owned by the deployer and unlocked — they can pull liquidity at any block. Top-10 hold 62%. Renounced mint doesn't matter when the exit is wide open. Passing.",
    outcome: "LP pulled 5 hours later",
    outcomePnl: -96,
  },
  {
    id: "honeypot",
    ticker: "$SAFEGAINS",
    blurb: "GoPlus flags a 99% sell tax",
    decision: "PASS",
    size: "—",
    checks: { source_verified: true, mint_renounced: true, lp_locked: true, deployer_clean: "unknown", top10_ok: true },
    reason: "honeypot: you can buy, you can't sell",
    reasoning:
      "Everything looks clean on the surface — verified, renounced, LP locked. But GoPlus reports a 99% transfer tax on sells. That's a honeypot: buys go through, sells are confiscated. A clean-looking checklist is exactly the wrapper this needs. Passing.",
    outcome: "honeypot confirmed — buyers trapped",
    outcomePnl: -100,
  },
  {
    id: "unverified",
    ticker: "$PEPE3",
    blurb: "unverified source, mint authority still live",
    decision: "PASS",
    size: "—",
    checks: { source_verified: false, mint_renounced: false, lp_locked: "unknown", deployer_clean: "unknown", top10_ok: "unknown" },
    reason: "unverified + mint authority live — team can print at will",
    reasoning:
      "Source isn't verified and the mint authority is still active, so the team can inflate supply whenever they want. With unknown LP and deployer on top of that, there's nothing to underwrite. Unfamiliar unverified is an automatic pass. Passing.",
    outcome: "minted 50× supply into the pool",
    outcomePnl: -99,
  },
  {
    id: "soft-buy",
    ticker: "$WIF2",
    blurb: "coherent hook, mint renounced, LP locked — but top-10 heavy",
    decision: "BUY",
    size: "$50",
    checks: { source_verified: true, mint_renounced: true, lp_locked: true, deployer_clean: "unknown", top10_ok: false },
    reason: "real hook, safe rails, concentrated holders → small lottery",
    reasoning:
      "Verified, mint renounced, LP locked — the rug surfaces are closed. There's a coherent memecoin hook with early traction. The flag is top-10 at 71% and an unknown deployer, so this isn't conviction. A 50 USDC lottery ticket, not a position. Buying small.",
    outcome: "ran +12%, trimmed to cost",
    outcomePnl: 12,
  },
  {
    id: "conviction",
    ticker: "$BASED",
    blurb: "verified, renounced, LP locked 12mo, clean deployer",
    decision: "BUY",
    size: "$250",
    checks: { source_verified: true, mint_renounced: true, lp_locked: true, deployer_clean: true, top10_ok: true },
    reason: "all green — every rug surface closed",
    reasoning:
      "Every check is green: source verified, mint renounced, LP locked for 12 months, deployer has shipped two clean tokens before, top-10 at 38%. This is the rare candidate that clears the whole checklist. Conviction size. Buying 250.",
    outcome: "ran +41%, still holding",
    outcomePnl: 41,
  },
];

const CHECK_LABELS: { key: keyof Candidate["checks"]; label: string }[] = [
  { key: "source_verified", label: "source verified" },
  { key: "mint_renounced", label: "mint renounced" },
  { key: "lp_locked", label: "LP locked" },
  { key: "deployer_clean", label: "deployer clean" },
  { key: "top10_ok", label: "top-10 < 70%" },
];

function mark(t: Tri): { ch: string; color: string } {
  if (t === true) return { ch: "✓", color: "var(--green)" };
  if (t === false) return { ch: "✗", color: "var(--red)" };
  return { ch: "?", color: "var(--fg-mute)" };
}

export function CandidateTryIt() {
  const [id, setId] = useState(CANDIDATES[0].id);
  const c = CANDIDATES.find((x) => x.id === id)!;
  const isBuy = c.decision === "BUY";
  const verdictColor = isBuy ? "var(--green)" : "var(--red)";

  return (
    <div className="mb-12">
      <div className="rounded-xl border border-border bg-surface/60 p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="rounded-md bg-coral px-2 py-1 font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-white">
            Try it
          </span>
          <span className="text-[13.5px] text-fg-dim">
            Throw a fresh launch at the sniper — watch it reject the rugs and
            catch the rare clean one.
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {CANDIDATES.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setId(x.id)}
              title={x.blurb}
              className={`btn !text-[12px] ${id === x.id ? "!border-coral !text-coral" : ""}`}
            >
              {x.ticker}
            </button>
          ))}
        </div>
      </div>

      {/* Verdict */}
      <div
        className="mt-4 rounded-2xl border bg-surface/60 p-5 sm:p-6"
        style={{ borderColor: "var(--border)" }}
      >
        <p className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
          {c.ticker} · {c.blurb}
        </p>
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span
            className="font-serif text-4xl tracking-tight sm:text-5xl"
            style={{ color: verdictColor }}
          >
            {c.decision}
          </span>
          <span className="font-mono text-[13px] text-fg-dim">
            {isBuy ? `size ${c.size}` : "no position"}
          </span>
          <span className="text-[13px] leading-snug text-fg-dim">{c.reason}</span>
        </div>

        {/* 5-check grid */}
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3">
          {CHECK_LABELS.map(({ key, label }) => {
            const m = mark(c.checks[key]);
            return (
              <div key={key} className="flex items-center gap-2 text-[12.5px]">
                <span style={{ color: m.color }}>{m.ch}</span>
                <span className="text-fg-dim">{label}</span>
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-[14px] leading-relaxed text-fg-dim">
          {c.reasoning}
        </p>
      </div>

      {/* What happened next — the payoff */}
      <div
        className="mt-3 flex flex-wrap items-baseline justify-between gap-3 rounded-xl border px-4 py-3"
        style={{
          borderColor:
            c.outcomePnl < 0
              ? "color-mix(in srgb, var(--red) 40%, var(--border))"
              : "color-mix(in srgb, var(--green) 40%, var(--border))",
        }}
      >
        <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
          what happened next
        </span>
        <span className="text-[13.5px] text-fg-dim">
          {c.outcome}
          {"  "}
          <span
            className="font-mono font-bold tabular-nums"
            style={{ color: c.outcomePnl < 0 ? "var(--red)" : "var(--green)" }}
          >
            {c.outcomePnl >= 0 ? "+" : ""}
            {c.outcomePnl}%
          </span>
        </span>
      </div>

      <p className="mt-3 text-[12px] leading-relaxed text-fg-mute">
        Most launches are rugs, so the sniper mostly passes — that&rsquo;s the
        job. The on-chain record below is its real paper book on Base.
      </p>
    </div>
  );
}
