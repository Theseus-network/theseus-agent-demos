"use client";

import { useEffect, useMemo, useState } from "react";
import { TopBar } from "@/components/TopBar";
import DemoCTA from "@/components/DemoCTA";
import { MandateCard } from "@/components/fund/MandateCard";
import { EquityCurve } from "@/components/fund/EquityCurve";
import { SovereignFundJsonLd } from "@/components/JsonLd";
import {
  simulate,
  SCENARIOS,
  SIM_START_NAV,
  type Scenario,
  type SimAction,
  type SimStep,
} from "@/lib/fund-sim";

// The fund agent, live on the Theseus alpha testnet (registered via
// Agents.register_ship_agent, endowed 100 THE).
const AGENT_SS58 = "5FyTsMgLnTv2ubpf2rsWN2tQkMmEP8EGTUw61uzxfayJJrdE";
const EXPLORER = `https://theseus.network/poa/${AGENT_SS58}`;
const DEPOSITS = [1_000, 10_000, 100_000];

function usd(n: number): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}
function signedPct(x: number): string {
  return `${x >= 0 ? "+" : "−"}${Math.abs(x * 100).toFixed(2)}%`;
}
function maxDrawdown(series: number[]): number {
  let peak = series[0] ?? 0;
  let mdd = 0;
  for (const v of series) {
    if (v > peak) peak = v;
    mdd = Math.min(mdd, v / peak - 1);
  }
  return mdd;
}
function reasoningLine(action: SimAction, s: SimStep, w: number): string {
  const vol = s.volPct.toFixed(0);
  const wp = (w * 100).toFixed(0);
  switch (action) {
    case "SKIP":
      return `The feed for this step doesn't line up, so I'm standing down rather than trade on a price I can't trust.`;
    case "SELL":
      return `Vol at ${vol}% and price rolling over. Trimming WETH to ${wp}% to protect capital.`;
    case "BUY":
      return `Trend intact, vol contained at ${vol}%. Leaning into WETH at ${wp}% within mandate.`;
    default:
      return `Allocation is within the 5% band of target (${wp}% WETH). Nothing here is worth the friction. Holding.`;
  }
}
const ACTION_LABEL: Record<SimAction, string> = {
  HOLD: "HOLD",
  BUY: "BUY WETH",
  SELL: "SELL WETH",
  SKIP: "SKIP",
};
function actionColor(a: SimAction): string {
  if (a === "BUY") return "var(--green)";
  if (a === "SELL") return "var(--amber)";
  if (a === "SKIP") return "var(--fg-mute)";
  return "var(--fg-dim)";
}

export default function FundPage() {
  const [scenario, setScenario] = useState<Scenario>("crash");
  const sim = useMemo(() => simulate(scenario), [scenario]);
  const last = sim.steps.length - 1;

  const [step, setStep] = useState(last);
  const [playing, setPlaying] = useState(false);
  const [lp, setLp] = useState<{ deposit: number; entryStep: number } | null>(
    null,
  );

  // Reset the view when the scenario changes (fresh fund, fresh stake).
  useEffect(() => {
    setStep(last);
    setPlaying(false);
    setLp(null);
  }, [scenario, last]);

  // Play loop: advance one step at a time.
  useEffect(() => {
    if (!playing) return;
    if (step >= last) {
      setPlaying(false);
      return;
    }
    const id = setTimeout(() => setStep((s) => Math.min(last, s + 1)), 200);
    return () => clearTimeout(id);
  }, [playing, step, last]);

  const s = sim.steps[step];
  const nav = sim.managedNav[step];
  const hold = sim.holdNav[step];
  const w = sim.wethWeight[step];
  const action = sim.decisions[step];
  const ret = nav / SIM_START_NAV - 1;
  const holdRet = hold / SIM_START_NAV - 1;
  const mdd = maxDrawdown(sim.managedNav.slice(0, step + 1));
  const edge = nav - hold;

  const lpValue = lp ? lp.deposit * (nav / sim.managedNav[lp.entryStep]) : 0;
  const lpHoldValue = lp ? lp.deposit * (hold / sim.holdNav[lp.entryStep]) : 0;
  const lpPnl = lp ? lpValue - lp.deposit : 0;

  function replay() {
    setStep(0);
    setPlaying(true);
  }

  return (
    <>
      <SovereignFundJsonLd />
      <TopBar mode="mock" />
      <main className="min-h-screen px-3 sm:px-4 md:px-8 pb-12">
        <div className="mx-auto max-w-[860px] pt-12">
          {/* Header — foreground the on-chain reality */}
          <div className="mb-6 flex items-baseline justify-between gap-4">
            <a
              href="/"
              className="text-[11px] uppercase tracking-[0.18em] text-fg-mute transition-colors hover:text-fg"
            >
              ← directory
            </a>
            <a
              href={EXPLORER}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] uppercase tracking-[0.18em] text-fg-mute transition-colors hover:text-fg"
            >
              live on theseus testnet · {AGENT_SS58.slice(0, 6)}…{AGENT_SS58.slice(-4)} ↗
            </a>
          </div>

          <h1 className="font-mono text-[15px] text-fg mb-1">Sovereign Fund</h1>
          <p className="mb-8 text-[13.5px] leading-[1.7] text-fg-mute">
            A fund the agent runs entirely by itself. It owns the money
            and trades to a rulebook signed on chain. You can put money in or
            cash out at the fund&rsquo;s value anytime, and it can&rsquo;t break its
            risk limits or move your money outside the rules.
          </p>

          {/* HERO: NAV + LP position + the equity curve */}
          <div className="rounded-2xl border border-border bg-surface/60 p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
              <div>
                <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
                  Fund value
                </p>
                <p className="mt-1 font-serif text-4xl tracking-tight text-fg tabular-nums sm:text-5xl">
                  {usd(nav)}
                </p>
                <p
                  className="mt-1 text-[13px] tabular-nums"
                  style={{ color: ret >= 0 ? "var(--green)" : "var(--red)" }}
                >
                  {signedPct(ret)} since inception
                  <span className="text-fg-mute">
                    {"  ·  "}vs hold {signedPct(holdRet)}
                  </span>
                </p>
              </div>

              {/* Your LP position */}
              <div className="min-w-[220px]">
                {lp ? (
                  <div className="rounded-lg border border-border px-4 py-3">
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-fg-mute">
                        your stake
                      </span>
                      <button
                        type="button"
                        onClick={() => setLp(null)}
                        className="font-mono text-[10px] uppercase tracking-[0.16em] text-fg-mute hover:text-fg"
                      >
                        redeem →
                      </button>
                    </div>
                    <p className="mt-1 text-2xl tabular-nums text-fg">
                      {usd(lpValue)}
                    </p>
                    <p
                      className="text-[12px] tabular-nums"
                      style={{
                        color: lpPnl >= 0 ? "var(--green)" : "var(--red)",
                      }}
                    >
                      {signedPct(lpPnl / lp.deposit)} on {usd(lp.deposit)}
                      <span className="text-fg-mute">
                        {"  ·  "}hold: {usd(lpHoldValue)}
                      </span>
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border px-4 py-3">
                    <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-fg-mute">
                      put money in
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {DEPOSITS.map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setLp({ deposit: d, entryStep: 0 })}
                          className="btn !text-[11.5px] !px-3 !py-1.5"
                        >
                          {usd(d)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Equity curve */}
            <div className="mt-5">
              <EquityCurve
                managed={sim.managedNav}
                hold={sim.holdNav}
                upTo={step}
                startNav={SIM_START_NAV}
              />
              <div className="mt-1 flex items-center gap-5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-fg-mute">
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-[2px] w-4"
                    style={{ background: "var(--coral)" }}
                  />
                  agent-managed
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-[2px] w-4"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(90deg, var(--fg-mute) 0 4px, transparent 4px 8px)",
                    }}
                  />
                  buy &amp; hold
                </span>
                <span className="ml-auto tabular-nums">
                  step {step}/{last}
                </span>
              </div>
            </div>

            {/* Track-record stats */}
            <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-border pt-4 sm:grid-cols-4">
              <Stat label="return" value={signedPct(ret)} tone={ret >= 0 ? "pos" : "neg"} />
              <Stat
                label="vs buy & hold"
                value={`${edge >= 0 ? "+" : "−"}${usd(Math.abs(edge))}`}
                tone={edge >= 0 ? "pos" : "neg"}
              />
              <Stat label="max drawdown" value={signedPct(mdd)} tone="neg" />
              <Stat label="WETH allocation" value={`${(w * 100).toFixed(0)}%`} />
            </div>
          </div>

          {/* CONTROL STRIP: scenario + play */}
          <div className="mt-5 rounded-xl border border-border bg-surface/60 p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="rounded-md bg-coral px-2 py-1 font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-white">
                Try it
              </span>
              <span className="text-[13.5px] text-fg-dim">
                Pick a market and replay it. The agent manages your money
                tick by tick.
              </span>
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => (playing ? setPlaying(false) : replay())}
                  className="cta-ink inline-flex items-center gap-2 px-4 py-2 text-[12.5px] no-underline"
                >
                  {playing ? "Pause" : step >= last ? "Replay ↻" : "Play ▶"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPlaying(false);
                    setStep((x) => Math.min(last, x + 1));
                  }}
                  disabled={step >= last}
                  className="btn !text-[12px] disabled:opacity-30"
                >
                  step →
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {SCENARIOS.map((sc) => (
                <button
                  key={sc.key}
                  type="button"
                  onClick={() => setScenario(sc.key)}
                  title={sc.blurb}
                  className={`btn !text-[12px] ${
                    scenario === sc.key ? "!border-coral !text-coral" : ""
                  }`}
                >
                  {sc.label.toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* AGENT STANCE + reasoning (centered) */}
          <div className="mt-5 rounded-xl border border-border bg-surface/60 p-5">
            <div className="flex items-center justify-between gap-4">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
                agent decision · this tick
              </p>
              <span
                className="font-mono text-[11px] font-bold uppercase tracking-[0.16em]"
                style={{ color: actionColor(action) }}
              >
                {ACTION_LABEL[action]}
              </span>
            </div>

            {/* allocation bar */}
            <div className="mt-3 flex h-7 overflow-hidden rounded-md border border-border">
              <div
                className="flex items-center justify-center text-[10px] font-mono uppercase tracking-wider text-white"
                style={{ width: `${(1 - w) * 100}%`, background: "var(--fg-dim)" }}
              >
                {((1 - w) * 100).toFixed(0)}% USDC
              </div>
              <div
                className="flex items-center justify-center text-[10px] font-mono uppercase tracking-wider text-white"
                style={{ width: `${w * 100}%`, background: "var(--coral)" }}
              >
                {(w * 100).toFixed(0)}% WETH
              </div>
            </div>

            <p className="mt-3 text-[13.5px] leading-relaxed text-fg-dim">
              {reasoningLine(action, s, w)}
            </p>
            <p className="mt-2 font-mono text-[10.5px] text-fg-mute tabular-nums">
              WETH ${s.price.toFixed(0)} · 24h {signedPct(s.retPct / 100)} · vol{" "}
              {s.volPct.toFixed(0)}%{s.dataIssue ? " · feed flagged" : ""}
            </p>
          </div>

          {/* MANDATE */}
          <div className="mt-5">
            <MandateCard />
          </div>

          <DemoCTA />
        </div>
      </main>
    </>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg";
}) {
  const color =
    tone === "pos" ? "var(--green)" : tone === "neg" ? "var(--red)" : "var(--fg)";
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-fg-mute">
        {label}
      </p>
      <p className="mt-1 text-[16px] font-medium tabular-nums" style={{ color }}>
        {value}
      </p>
    </div>
  );
}
