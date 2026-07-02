/**
 * Vault engine for the GP investor app.
 *
 * The agent is the GP of a pooled fund. LPs deposit into one vault and receive
 * shares; NAV per share moves with the book. The GP runs a fund-of-agents: four
 * decorrelated strategy agents, blended by a meta-allocator that weights them on
 * trailing risk-adjusted return with a per-sleeve cap and an inverse-vol tilt.
 * An independent risk agent throttles exposure as drawdown approaches the
 * mandate limit and vetoes into the defensive sleeve at the limit. Fees are a
 * management stream plus carry above a high-water mark; per-LP carry is charged
 * only on gains above each LP's own entry, so late entrants are not cross-charged.
 *
 * Deterministic per scenario (seeded noise), so the curve is identical each run.
 */

export type Scenario = "cycle" | "calm" | "bull" | "crash" | "drawdown" | "chop";

export const SCENARIOS: { key: Scenario; label: string; blurb: string }[] = [
  { key: "cycle", label: "Full cycle", blurb: "The track record: a rally, a crash, a recovery." },
  { key: "calm", label: "Calm", blurb: "Range-bound and quiet." },
  { key: "bull", label: "Bull run", blurb: "Sustained uptrend, vol contracting." },
  { key: "crash", label: "Black swan", blurb: "A violent crash mid-path." },
  { key: "drawdown", label: "Slow bleed", blurb: "A grinding decline, elevated vol." },
  { key: "chop", label: "Chop + bad feed", blurb: "Whipsaw, and one untrusted tick." },
];

export const STRATEGIES = [
  { key: "voltarget", name: "Vol-Target", tag: "steadies risk", color: "#6366f1" },
  { key: "momentum", name: "Momentum", tag: "follows trends", color: "#818cf8" },
  { key: "meanrev", name: "Mean-Reversion", tag: "buys dips", color: "#a5b4fc" },
  { key: "carry", name: "Carry", tag: "holds cash", color: "#64748b" },
] as const;
export type StratKey = (typeof STRATEGIES)[number]["key"];

export type Action = "HOLD" | "BUY" | "SELL" | "SKIP" | "DERISK";

export const START_NAV_PER_SHARE = 100;
export const SEED_AUM = 2_480_000;
export const INCEPTION_ISO = "2025-09-29"; // fixed so the age is deterministic
const START_PRICE = 2500;
const STEPS = 40;
const WEEKS_PER_STEP = 1;
const STEPS_PER_YEAR = 52;
const RF = 0.04; // risk-free, for Sharpe
const MGMT_FEE = 0.02;
const PERF_FEE = 0.2;
const FRICTION = 0.001;
const RISK_LIMIT = -0.12; // veto trigger; the throttle keeps realized DD inside the -14% hard stop
const RISK_HARD = -0.14; // stated hard stop shown to LPs
const RISK_ARM = -0.08; // begin throttling exposure here
const RISK_CLEAR = -0.06;
const REBAL = 4;
const LOOKBACK = 12; // trailing window the allocator scores on
const MAX_SLEEVE = 0.4; // no single agent runs more than 40% of capital
const EXPO_BAND = 0.04;
const CARRY_YIELD = 0.0007;

export interface StepMarket {
  t: number;
  price: number;
  retPct: number;
  volPct: number;
  dataIssue?: boolean;
}

export interface VetoEvent { t: number; drawdownPct: number; }

export interface VaultResult {
  scenario: Scenario;
  steps: StepMarket[];
  ethRet: number[];
  stratWeight: Record<StratKey, number[]>;
  stratEquity: Record<StratKey, number[]>;
  alloc: Record<StratKey, number[]>;
  fundExposure: number[];
  throttle: number[]; // risk-agent exposure multiplier 0..1
  grossIdx: number[];
  mgmtNavShare: number[]; // NAV/share after management fee, before carry
  netNavShare: number[]; // NAV/share after all fund-level fees
  hwm: number[];
  drawdown: number[];
  riskOff: boolean[];
  vetoes: VetoEvent[];
  holdIdx: number[];
  feesMgmtCum: number[];
  feesPerfCum: number[];
  actions: Action[];
  rationale: string[];
  sharesOutstanding: number;
  ageWeeks: number;
  stats: {
    netReturn: number;
    grossReturn: number;
    holdReturn: number;
    netAnnReturn: number;
    maxDD: number;
    holdMaxDD: number;
    sharpe: number;
    feeDrag: number;
    volPct: number;
  };
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

// deterministic value noise in [-1,1], seeded per scenario
function noise(t: number, seed: number): number {
  const x = Math.sin((t + 1) * 12.9898 + seed * 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

function buildPath(scenario: Scenario): StepMarket[] {
  const seed = { cycle: 5, calm: 3, bull: 7, crash: 13, drawdown: 19, chop: 29 }[scenario];
  const steps: StepMarket[] = [];
  let prev = START_PRICE;
  for (let t = 0; t < STEPS; t++) {
    const f = t / (STEPS - 1);
    let trend = START_PRICE;
    let vol = 18;
    let dataIssue = false;
    switch (scenario) {
      case "cycle": {
        // a full market cycle: rally, black swan, recovery — the agent captures
        // the upside, protects the drawdown, and re-risks into the recovery.
        const c = f < 0.28 ? 1 + 0.30 * (f / 0.28)
          : f < 0.34 ? 1.30
          : f < 0.54 ? 1.30 - 0.60 * ((f - 0.34) / 0.20)
          : 0.70 + 0.46 * ((f - 0.54) / 0.46);
        trend = START_PRICE * c;
        vol = f < 0.28 ? 26 : f < 0.34 ? 22 : f < 0.54 ? 52 + 46 * ((f - 0.34) / 0.20) : 60 - 30 * ((f - 0.54) / 0.46);
        break;
      }
      case "calm":
        trend = START_PRICE * (1 + 0.06 * Math.sin(t / 3));
        vol = 16;
        break;
      case "bull":
        trend = START_PRICE * (1 + 0.5 * f);
        vol = 30 - 6 * f;
        break;
      case "crash": {
        const c = f < 0.4 ? 1 + 0.05 * Math.sin(t / 2)
          : f < 0.63 ? 1 - 0.46 * ((f - 0.4) / 0.23)
          : 0.54 + 0.12 * ((f - 0.63) / 0.37);
        trend = START_PRICE * c;
        vol = f < 0.4 ? 24 : f < 0.63 ? 50 + 50 * ((f - 0.4) / 0.23) : 75 - 28 * ((f - 0.63) / 0.37);
        break;
      }
      case "drawdown":
        trend = START_PRICE * (1 - 0.22 * f);
        vol = 30 + 10 * f;
        break;
      case "chop":
        trend = START_PRICE * (1 + 0.08 * Math.sin(t / 2.2) + 0.03 * Math.cos(t / 1.1));
        vol = 18;
        dataIssue = t === Math.round(STEPS * 0.55);
        break;
    }
    // multiplicative noise scaled to the tick's vol (damped so the trend stays readable)
    const sd = (vol / 100) / Math.sqrt(STEPS_PER_YEAR) * 0.72;
    const price = t === 0 ? START_PRICE : trend * (1 + sd * noise(t, seed));
    const retPct = t === 0 ? 0 : ((price - prev) / prev) * 100;
    prev = price;
    steps.push({ t, price, retPct, volPct: vol, dataIssue });
  }
  return steps;
}

function stratWeights(steps: StepMarket[]): Record<StratKey, number[]> {
  const n = steps.length;
  const price = steps.map((s) => s.price);
  const w: Record<StratKey, number[]> = { voltarget: [], momentum: [], meanrev: [], carry: [] };
  for (let t = 0; t < n; t++) {
    const s = steps[t];
    const volStress = clamp((s.volPct - 25) / 80, 0, 1);
    w.voltarget.push(clamp(0.55 - 0.3 * volStress, 0.25, 0.6)); // inverse-vol core
    const look = Math.max(0, t - 8);
    const sma = price.slice(look, t + 1).reduce((a, b) => a + b, 0) / (t - look + 1);
    const dev = (price[t] - sma) / sma; // deviation from the trend line
    w.momentum.push(dev >= 0.005 ? 0.8 : dev <= -0.005 ? 0.2 : 0.5); // trend, with a hysteresis band
    w.meanrev.push(clamp(0.48 - 4.5 * dev, 0.25, 0.72)); // fade the deviation: buy below trend, sell above
    w.carry.push(0.15);
  }
  return w;
}

function stratReturns(steps: StepMarket[], w: Record<StratKey, number[]>): Record<StratKey, number[]> {
  const n = steps.length;
  const out: Record<StratKey, number[]> = { voltarget: [], momentum: [], meanrev: [], carry: [] };
  for (let t = 0; t < n; t++) {
    const ethRet = t === 0 ? 0 : steps[t].price / steps[t - 1].price - 1;
    for (const k of Object.keys(out) as StratKey[]) {
      if (t === 0) { out[k].push(0); continue; }
      const held = w[k][t - 1];
      const turn = Math.abs(w[k][t] - w[k][t - 1]);
      let r = held * ethRet - FRICTION * turn;
      if (k === "carry") r += CARRY_YIELD;
      out[k].push(r);
    }
  }
  return out;
}

function equityFromReturns(r: number[]): number[] {
  const e = [1];
  for (let t = 1; t < r.length; t++) e.push(e[t - 1] * (1 + r[t]));
  return e;
}

function trailingReturn(r: number[], end: number, win: number): number {
  return r.slice(Math.max(1, end - win + 1), end + 1).reduce((x, y) => x + y, 0);
}
function trailingVol(r: number[], end: number, win: number): number {
  const a = r.slice(Math.max(1, end - win + 1), end + 1);
  if (a.length < 2) return 0.02;
  const m = a.reduce((x, y) => x + y, 0) / a.length;
  return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length) || 0.02;
}

export function simulate(scenario: Scenario): VaultResult {
  const steps = buildPath(scenario);
  const n = steps.length;
  const keys = STRATEGIES.map((s) => s.key);

  const stratWeight = stratWeights(steps);
  const stratRet = stratReturns(steps, stratWeight);
  const stratEquity: Record<StratKey, number[]> = {
    voltarget: equityFromReturns(stratRet.voltarget),
    momentum: equityFromReturns(stratRet.momentum),
    meanrev: equityFromReturns(stratRet.meanrev),
    carry: equityFromReturns(stratRet.carry),
  };

  const ethRet: number[] = [];
  const alloc: Record<StratKey, number[]> = { voltarget: [], momentum: [], meanrev: [], carry: [] };
  const fundExposure: number[] = [];
  const throttle: number[] = [];
  const grossIdx: number[] = [];
  const mgmtNavShare: number[] = [];
  const netNavShare: number[] = [];
  const hwm: number[] = [];
  const drawdown: number[] = [];
  const riskOff: boolean[] = [];
  const vetoes: VetoEvent[] = [];
  const holdIdx: number[] = [];
  const feesMgmtCum: number[] = [];
  const feesPerfCum: number[] = [];
  const actions: Action[] = [];
  const rationale: string[] = [];

  const shares = SEED_AUM / START_NAV_PER_SHARE;
  let curAlloc: Record<StratKey, number> = { voltarget: 0.3, momentum: 0.25, meanrev: 0.2, carry: 0.25 };
  let gross = 1;
  let net = START_NAV_PER_SHARE;
  let xShare = START_NAV_PER_SHARE;
  const hwmLocked = START_NAV_PER_SHARE;
  let peak = START_NAV_PER_SHARE;
  let mgmtCum = 0;
  let perfCum = 0;
  let off = false;
  let cooldown = 0;
  const holdBook = { usdc: 0.5, weth: 0.5 / START_PRICE };

  for (let t = 0; t < n; t++) {
    const s = steps[t];
    ethRet.push(t === 0 ? 0 : s.price / steps[t - 1].price - 1);

    if (t > 0 && t % REBAL === 0) {
      // score on trailing return, penalized by trailing vol, capped per sleeve
      const score = keys.map((k) => trailingReturn(stratRet[k], t, LOOKBACK) / (0.5 + 4 * trailingVol(stratRet[k], t, LOOKBACK)));
      const T = 0.6;
      const ex = score.map((x) => Math.exp(x / T));
      const sum = ex.reduce((a, b) => a + b, 0) || 1;
      const base: Record<StratKey, number> = {} as Record<StratKey, number>;
      keys.forEach((k, i) => (base[k] = Math.max(0.06, Math.min(MAX_SLEEVE, ex[i] / sum))));
      const bsum = keys.reduce((a, k) => a + base[k], 0);
      keys.forEach((k) => (base[k] /= bsum));
      curAlloc = base;
    }

    // risk agent: throttle exposure as drawdown approaches the limit; veto at it.
    // One sticky veto per drawdown episode (clears when the fund recovers), but
    // the throttle re-opens exposure as the market rebounds, so the book re-risks
    // into a recovery instead of sitting in cash and missing it.
    const prevOff = off;
    const dd = net / peak - 1;
    const recentUp = t >= 2 ? ethRet[t] + ethRet[t - 1] + ethRet[t - 2] : 0;
    if (cooldown > 0) cooldown--;
    if (!off && cooldown === 0 && dd <= RISK_LIMIT) off = true;
    else if (off && (dd >= RISK_CLEAR || recentUp > 0.05)) { off = false; cooldown = 6; }
    // continuous throttle between arm (-8%) and veto (-12%); a strong market
    // rebound overrides the drawdown floor so the book re-risks into the recovery
    let thr = 1;
    if (dd <= RISK_ARM) thr = clamp((dd - RISK_LIMIT) / (RISK_ARM - RISK_LIMIT), 0.25, 1);
    if (off) thr = Math.min(thr, 0.35);
    const recovery = clamp(12 * Math.max(0, recentUp) - 0.15, 0, 1);
    thr = Math.max(thr, recovery);
    throttle.push(thr);

    let a = { ...curAlloc };
    if (off) {
      const blend: Record<StratKey, number> = { voltarget: 0, momentum: 0, meanrev: 0, carry: 0 };
      keys.forEach((k) => (blend[k] = 0.5 * curAlloc[k] + (k === "carry" ? 0.5 : 0)));
      const bs = keys.reduce((x, k) => x + blend[k], 0);
      keys.forEach((k) => (blend[k] /= bs));
      a = blend;
    }
    keys.forEach((k) => alloc[k].push(a[k]));

    const rawExpo = keys.reduce((x, k) => x + a[k] * stratWeight[k][t], 0);
    const expo = rawExpo * thr; // risk agent scales the whole book
    fundExposure.push(expo);

    const gRet = t === 0 ? 0 : thr * keys.reduce((x, k) => x + a[k] * stratRet[k][t], 0);
    gross *= 1 + gRet;
    grossIdx.push(gross);

    const afterRet = xShare * (1 + gRet);
    const mgmt = afterRet * (MGMT_FEE / STEPS_PER_YEAR);
    xShare = afterRet - mgmt;
    const carryShare = Math.max(0, PERF_FEE * (xShare - hwmLocked));
    net = xShare - carryShare;
    mgmtCum += mgmt * shares;
    perfCum = carryShare * shares;
    if (net > peak) peak = net;
    hwm.push(peak);
    mgmtNavShare.push(xShare);
    netNavShare.push(net);
    drawdown.push(net / peak - 1);
    riskOff.push(off);
    feesMgmtCum.push(mgmtCum);
    feesPerfCum.push(perfCum);
    if (!prevOff && off) vetoes.push({ t, drawdownPct: dd });

    holdIdx.push(holdBook.usdc + holdBook.weth * s.price);

    let action: Action = "HOLD";
    if (s.dataIssue) action = "SKIP";
    else if (!prevOff && off) action = "DERISK";
    else if (t > 0) {
      const de = expo - fundExposure[t - 1];
      action = de > EXPO_BAND ? "BUY" : de < -EXPO_BAND ? "SELL" : "HOLD";
    }
    actions.push(action);
    rationale.push(makeRationale(action, s, a, t, dd, thr));
  }

  const ageWeeks = STEPS * WEEKS_PER_STEP;
  return {
    scenario, steps, ethRet, stratWeight, stratEquity, alloc, fundExposure, throttle,
    grossIdx, mgmtNavShare, netNavShare, hwm, drawdown, riskOff, vetoes, holdIdx,
    feesMgmtCum, feesPerfCum, actions, rationale, sharesOutstanding: shares, ageWeeks,
    stats: computeStats(netNavShare, grossIdx, holdIdx, ageWeeks),
  };
}

function leadStrategy(a: Record<StratKey, number>): (typeof STRATEGIES)[number] {
  let best: (typeof STRATEGIES)[number] = STRATEGIES[0];
  let bv = -1;
  for (const s of STRATEGIES) if (a[s.key] > bv) ((bv = a[s.key]), (best = s));
  return best;
}

function makeRationale(action: Action, s: StepMarket, a: Record<StratKey, number>, t: number, dd: number, thr: number): string {
  const vol = s.volPct.toFixed(0);
  const lead = leadStrategy(a);
  const leadPct = (a[lead.key] * 100).toFixed(0);
  switch (action) {
    case "SKIP":
      return `The price feed for this tick disagrees across venues. Standing down and holding rather than trade on a number I cannot verify.`;
    case "DERISK":
      return `Drawdown hit ${(dd * 100).toFixed(1)}% and tripped the mandate limit. The risk agent vetoed the book and cut gross exposure to ${(thr * 100).toFixed(0)}% until it recovers.`;
    case "BUY":
      return `Vol at ${vol}% and the trend is holding. The allocator is leaning into ${lead.name} at ${leadPct}% and lifting ETH exposure within the mandate.`;
    case "SELL":
      return `Vol at ${vol}%. Trimming ETH exposure toward defense; the risk agent is throttling gross to ${(thr * 100).toFixed(0)}%, with ${lead.name} carrying ${leadPct}%.`;
    default:
      return `Exposure is inside the rebalance band. ${lead.name} leads at ${leadPct}% of capital. Nothing here beats the cost of trading, so the book holds.`;
  }
}

function maxDrawdown(series: number[]): number {
  let peak = series[0], m = 0;
  for (const v of series) { if (v > peak) peak = v; m = Math.min(m, v / peak - 1); }
  return m;
}

function computeStats(net: number[], gross: number[], hold: number[], ageWeeks: number): VaultResult["stats"] {
  const netReturn = net[net.length - 1] / net[0] - 1;
  const grossReturn = gross[gross.length - 1] / gross[0] - 1;
  const holdReturn = hold[hold.length - 1] / hold[0] - 1;
  const rets: number[] = [];
  for (let i = 1; i < net.length; i++) rets.push(net[i] / net[i - 1] - 1);
  const mean = rets.reduce((a, b) => a + b, 0) / (rets.length || 1);
  const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length || 1));
  const annVol = sd * Math.sqrt(STEPS_PER_YEAR);
  const yrs = ageWeeks / 52;
  const netAnnReturn = yrs > 0 ? (1 + netReturn) ** (1 / yrs) - 1 : netReturn;
  const sharpe = annVol > 1e-6 ? (netAnnReturn - RF) / annVol : 0;
  return {
    netReturn, grossReturn, holdReturn, netAnnReturn,
    maxDD: maxDrawdown(net), holdMaxDD: maxDrawdown(hold),
    sharpe, feeDrag: grossReturn - netReturn, volPct: annVol * 100,
  };
}
