/**
 * Deterministic price-path + mandate simulator for the fund dashboard.
 *
 * The live agent reasons one tick at a time via the LLM; that's slow and
 * non-deterministic, which is right for "watch it think" but wrong for a
 * smooth, replayable equity curve. This module simulates the SAME written
 * mandate deterministically across a whole price path, so the dashboard can
 * animate NAV over time and show the agent's value-add against buy-and-hold.
 *
 * Mandate (mirrors fund-llm.ts): 50/50 USDC/WETH baseline; tilt toward WETH
 * (up to 60%) when trending with low vol, toward USDC (WETH down to 30%) when
 * vol spikes; only rebalance past a 5% band; SKIP a tick whose feed can't be
 * trusted. Preserve capital first, capture upside second.
 */

export type Scenario = "calm" | "bull" | "crash" | "drawdown" | "chop";

export interface SimStep {
  t: number;
  price: number;
  /** step-over-step return, percent */
  retPct: number;
  /** annualized realized vol, percent */
  volPct: number;
  /** set when the feed for this step can't be trusted -> agent SKIPs */
  dataIssue?: boolean;
}

export type SimAction = "HOLD" | "BUY" | "SELL" | "SKIP";

export interface SimResult {
  scenario: Scenario;
  steps: SimStep[];
  /** agent-managed NAV at each step */
  managedNav: number[];
  /** buy-and-hold NAV at each step (the do-nothing benchmark) */
  holdNav: number[];
  /** agent's WETH weight (0..1) at each step */
  wethWeight: number[];
  /** the agent's decision at each step */
  decisions: SimAction[];
  stats: {
    ret: number;
    holdRet: number;
    maxDD: number;
    holdMaxDD: number;
    sharpe: number;
    /** fraction of steps where managed NAV >= hold NAV */
    beatHold: number;
  };
}

export const SIM_START_NAV = 100_000;
const START_PRICE = 2500;
const STEPS = 28;
const BAND = 0.05; // rebalance only past a 5% drift
const FRICTION = 0.001; // 0.1% of traded notional, gas + slippage

export const SCENARIOS: { key: Scenario; label: string; blurb: string }[] = [
  { key: "calm", label: "Calm", blurb: "Range-bound and quiet. The baseline case." },
  { key: "bull", label: "Bull run", blurb: "Sustained uptrend, vol contracting." },
  { key: "crash", label: "Black swan", blurb: "A violent crash mid-path. Watch it de-risk." },
  { key: "drawdown", label: "Slow bleed", blurb: "A grinding decline with elevated vol." },
  { key: "chop", label: "Chop + bad feed", blurb: "Whipsaw, and one untrustworthy tick." },
];

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/** Deterministic price path per scenario — no randomness, so the curve is
 *  identical every run (replayable, shareable). */
function buildPath(scenario: Scenario): SimStep[] {
  const steps: SimStep[] = [];
  let prev = START_PRICE;
  for (let t = 0; t < STEPS; t++) {
    const f = t / (STEPS - 1); // 0..1 progress
    let price = START_PRICE;
    let vol = 18;
    let dataIssue = false;

    switch (scenario) {
      case "calm":
        price = START_PRICE * (1 + 0.02 * Math.sin(t / 2.4));
        vol = 16 + 4 * Math.abs(Math.sin(t / 3));
        break;
      case "bull":
        price = START_PRICE * (1 + 0.34 * f + 0.012 * Math.sin(t / 1.8));
        vol = 30 - 12 * f;
        break;
      case "crash": {
        // calm, then a sharp crash through the middle, then a weak bounce.
        const crash =
          f < 0.35
            ? 1 + 0.01 * Math.sin(t / 2)
            : f < 0.62
              ? 1 - 0.42 * ((f - 0.35) / 0.27)
              : 0.58 + 0.06 * ((f - 0.62) / 0.38);
        price = START_PRICE * crash;
        vol = f < 0.35 ? 22 : f < 0.62 ? 60 + 70 * ((f - 0.35) / 0.27) : 70 - 20 * ((f - 0.62) / 0.38);
        break;
      }
      case "drawdown":
        price = START_PRICE * (1 - 0.18 * f + 0.015 * Math.sin(t / 1.6));
        vol = 34 + 14 * f;
        break;
      case "chop":
        price = START_PRICE * (1 + 0.07 * Math.sin(t / 1.3) + 0.03 * Math.cos(t / 0.7));
        vol = 48 + 12 * Math.abs(Math.sin(t / 2));
        dataIssue = t === Math.floor(STEPS * 0.55); // one untrustworthy tick
        break;
    }

    const retPct = t === 0 ? 0 : ((price - prev) / prev) * 100;
    prev = price;
    steps.push({ t, price, retPct, volPct: vol, dataIssue });
  }
  return steps;
}

/** The mandate's target WETH weight given current conditions. */
function targetWeight(step: SimStep): number {
  const mom = clamp(step.retPct / 5, -1, 1); // normalize a ~5% step move
  const volStress = clamp((step.volPct - 25) / 95, 0, 1); // 25%..120% -> 0..1
  const w = 0.5 + 0.1 * mom - 0.2 * volStress;
  return clamp(w, 0.3, 0.6);
}

export function simulate(scenario: Scenario): SimResult {
  const steps = buildPath(scenario);

  // managed book
  let usdc = SIM_START_NAV / 2;
  let weth = SIM_START_NAV / 2 / START_PRICE;
  // hold book (frozen at inception allocation)
  const holdWeth = SIM_START_NAV / 2 / START_PRICE;
  const holdUsdc = SIM_START_NAV / 2;

  const managedNav: number[] = [];
  const holdNav: number[] = [];
  const wethWeight: number[] = [];
  const decisions: SimAction[] = [];

  for (const step of steps) {
    const navBefore = usdc + weth * step.price;
    let action: SimAction = "HOLD";

    if (step.dataIssue) {
      action = "SKIP"; // never trade on a feed you can't trust
    } else {
      const w = (weth * step.price) / navBefore;
      const target = targetWeight(step);
      if (Math.abs(w - target) > BAND) {
        const targetWethUsd = target * navBefore;
        const currentWethUsd = w * navBefore;
        const tradeUsd = targetWethUsd - currentWethUsd; // + buy, - sell
        action = tradeUsd > 0 ? "BUY" : "SELL";
        const fee = Math.abs(tradeUsd) * FRICTION;
        // apply: move tradeUsd from usdc into weth (minus fee)
        weth += (tradeUsd - fee) / step.price;
        usdc -= tradeUsd;
      }
    }

    const nav = usdc + weth * step.price;
    managedNav.push(nav);
    holdNav.push(holdUsdc + holdWeth * step.price);
    wethWeight.push((weth * step.price) / nav);
    decisions.push(action);
  }

  const stats = computeStats(managedNav, holdNav);
  return { scenario, steps, managedNav, holdNav, wethWeight, decisions, stats };
}

function maxDrawdown(series: number[]): number {
  let peak = series[0];
  let mdd = 0;
  for (const v of series) {
    if (v > peak) peak = v;
    mdd = Math.min(mdd, v / peak - 1);
  }
  return mdd; // negative
}

function computeStats(managed: number[], hold: number[]): SimResult["stats"] {
  const ret = managed[managed.length - 1] / managed[0] - 1;
  const holdRet = hold[hold.length - 1] / hold[0] - 1;
  const rets: number[] = [];
  for (let i = 1; i < managed.length; i++) rets.push(managed[i] / managed[i - 1] - 1);
  const mean = rets.reduce((a, b) => a + b, 0) / (rets.length || 1);
  const variance =
    rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length || 1);
  const std = Math.sqrt(variance);
  const sharpe = std > 0 ? (mean / std) * Math.sqrt(rets.length) : 0;
  let beats = 0;
  for (let i = 0; i < managed.length; i++) if (managed[i] >= hold[i]) beats++;
  return {
    ret,
    holdRet,
    maxDD: maxDrawdown(managed),
    holdMaxDD: maxDrawdown(hold),
    sharpe,
    beatHold: beats / managed.length,
  };
}
