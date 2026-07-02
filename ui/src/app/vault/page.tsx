"use client";

import { Fragment, useState } from "react";
import { LiveFund } from "@/components/vault/LiveFund";
import { PredictionBook } from "@/components/vault/PredictionBook";
import { TrackRecord } from "@/components/vault/TrackRecord";
import { useLiveFund } from "@/components/vault/useLiveFund";
import { WalletInvest } from "@/components/vault/WalletInvest";
import { VAULT_ADDRESS, BASESCAN } from "@/lib/vault/contracts";

const AGENT_SS58 = "5C8RTTrk13NkNS7B7UqiCciL5oTMTePyiHCvpmEUbApPJ1L6";
const AGENT_EXPLORER = `https://explorer.theseus.network/agents/${AGENT_SS58}`;
const VAULT_URL = `${BASESCAN}/address/${VAULT_ADDRESS}`;

const usd = (n: number | undefined, d = 0) => n === undefined ? "—" : n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: d });
const compact = (n: number | undefined) => n === undefined ? "—" : Math.abs(n) >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : Math.abs(n) >= 1e3 ? `$${(n / 1e3).toFixed(1)}K` : usd(n, 2);
const signedPct = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(x * 100).toFixed(2)}%`;

const COMPARE = [
  { k: "Fees", trad: "2 and 20", us: "2 and 20, charged on-chain" },
  { k: "Redemptions", trad: "Locked 3+ years", us: "Monthly, automatic at NAV" },
  { k: "Reporting", trad: "A quarterly letter", us: "Every call signed on-chain" },
  { k: "Availability", trad: "Business hours", us: "NAV and redemptions 24/7" },
  { k: "Custody", trad: "Trust the manager", us: "Manager can't withdraw · 24h timelock" },
];

const MANDATE = [
  "Reads real prediction markets and forms its own probability estimate",
  "Takes a position only when its estimate is far enough from the market price",
  "Sizes small, holds toward resolution, and passes when markets look efficient",
  "Every call is a signed run on Theseus, verifiable on the explorer",
];

export default function VaultPage() {
  const live = useLiveFund();
  const [proofOpen, setProofOpen] = useState(false);

  const vault = live?.vault ?? null;
  const positions = live?.positions ?? [];
  const latest = live?.trades?.find((t) => t.action !== "ERROR");

  return (
    <main className="mx-auto max-w-[1080px] px-4 pb-24 pt-10 sm:px-6">
      {/* HERO */}
      <section className="max-w-2xl">
        <h1 className="font-serif text-[36px] leading-[1.05] tracking-tight text-fg sm:text-[48px]">
          An autonomous prediction-market fund.
        </h1>
        <p className="mt-4 text-[16px] leading-relaxed text-fg-dim">
          An AI agent forecasts real prediction markets and takes the fund&rsquo;s positions, each a call
          it signs on-chain. Deposit, hold shares, and redeem at NAV every month.
        </p>
        <a href="#invest" className="mt-6 inline-flex rounded-lg px-6 py-3 text-[15px] font-semibold text-white shadow-[0_16px_50px_-16px_rgba(99,102,241,0.5)] transition-[filter] hover:brightness-110" style={{ background: "linear-gradient(180deg, #6366f1, #4f46e5)" }}>
          Invest →
        </a>
      </section>

      {/* REAL STATUS — read from chain */}
      <section className="mt-12 grid grid-cols-2 gap-x-8 gap-y-5 border-y border-border py-6 sm:grid-cols-4">
        <Stat label="In the vault" value={compact(vault?.tvl)} sub="Base Sepolia" />
        <Stat label="Return since launch" value={vault ? signedPct(vault.pricePerShare - 1) : "…"} sub={vault ? `$${vault.pricePerShare.toFixed(4)} / share` : "NAV"} accent />
        <Stat label="Open positions" value={live ? String(positions.length) : "…"} sub={live ? `${compact(live.deployed)} notional` : "in the book"} />
        <Stat label="Redemptions" value="Monthly" sub={vault ? (vault.redemptionsOpen ? "window open" : "next window") : "at NAV"} />
      </section>

      {/* INVEST + AGENT DESK */}
      <section id="invest" className="mt-12 grid items-start gap-x-10 gap-y-8 lg:grid-cols-2">
        <div>
          <WalletInvest />
          <div className="mt-6 border-t border-border pt-5">
            <p className="text-[12px] text-fg-mute">How it works</p>
            <ol className="mt-2.5 space-y-2 text-[13px] text-fg-dim">
              {["Deposit test USDC, mint svUSDC shares at NAV", "The agent takes prediction-market positions, each a call signed on Theseus", "Redeem at NAV in the monthly window, on-chain"].map((t, i) => (
                <li key={t} className="flex gap-2.5"><span className="tabular-nums text-fg-mute">{i + 1}.</span><span>{t}</span></li>
              ))}
            </ol>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-fg">The agent</h2>
            <a href={AGENT_EXPLORER} target="_blank" rel="noopener noreferrer" className="text-[12.5px] text-fg-mute hover:text-fg">on Theseus ↗</a>
          </div>
          <p className="mt-1.5 text-[13px] text-fg-mute">A prediction-market trader. It forms its own probability for a market and takes a position when that estimate is far from the market price. The gap is its claim, not a proven edge; the track record is where real skill shows.</p>
          <LiveFund live={live} />
        </div>
      </section>

      {/* THE BOOK */}
      <section className="mt-12">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-fg">The book</h2>
          {live && positions.length > 0 && (
            <span className="flex items-center gap-x-4 text-[13px] tabular-nums text-fg-mute">
              {live.avgEdge != null && <span>avg gap <span className="text-coral">{Math.abs(Math.round(live.avgEdge))} pts</span></span>}
              <span style={{ color: live.bookPnl >= 0 ? "var(--coral)" : "var(--red)" }}>{live.bookPnl >= 0 ? "+" : "−"}{usd(Math.abs(live.bookPnl), 0)} open</span>
            </span>
          )}
        </div>
        <p className="mt-1 text-[13px] text-fg-mute">The agent&rsquo;s open positions, marked to live Polymarket odds. The fund tracks this book; it does not hold Polymarket shares.</p>
        <PredictionBook positions={positions} explorer={live?.explorer} />
      </section>

      {/* TRACK RECORD */}
      <section className="mt-12">
        <h2 className="text-[15px] font-semibold text-fg">Track record</h2>
        <p className="mt-1 text-[13px] text-fg-mute">Every bet, scored when its market resolves. This is the agent&rsquo;s calibration over time.</p>
        <TrackRecord resolved={live?.resolved ?? []} />
      </section>

      {/* MANDATE + FEES */}
      <section className="mt-12 grid gap-x-10 gap-y-8 lg:grid-cols-2">
        <div>
          <h2 className="text-[15px] font-semibold text-fg">What the agent does</h2>
          <ul className="mt-4 space-y-2 text-[13px] text-fg-dim">
            {MANDATE.map((c) => (
              <li key={c} className="flex gap-2.5"><span style={{ color: "var(--coral)" }}>✓</span><span>{c}</span></li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-[15px] font-semibold text-fg">Fees</h2>
          <div className="mt-4 space-y-2.5 text-[13px]">
            <Line k="Management" v="2% a year" />
            <Line k="Performance" v="20% of profit" />
          </div>
          <p className="mt-4 border-t border-border pt-4 text-[13px] leading-relaxed text-fg-mute">
            Charged on-chain. NAV is shown before fees; each redemption pays your share of the accrued fees. You only pay the performance fee on new profit above your high-water mark, never on money the fund has lost.
          </p>
        </div>
      </section>

      {/* COMPARE */}
      <section className="mt-12">
        <h2 className="text-[15px] font-semibold text-fg">Versus a traditional fund</h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-border">
          <div className="grid grid-cols-[1fr_1fr_1.1fr] text-[13px]">
            <div className="border-b border-border px-4 py-2.5" />
            <div className="border-b border-l border-border px-4 py-2.5 text-fg-mute">Traditional fund</div>
            <div className="border-b border-l border-border px-4 py-2.5 font-semibold text-fg" style={{ background: "color-mix(in srgb, var(--coral) 9%, transparent)" }}>Sovereign</div>
            {COMPARE.map((r, i) => {
              const last = i === COMPARE.length - 1;
              return (
                <Fragment key={r.k}>
                  <div className={`${last ? "" : "border-b border-border"} px-4 py-2.5 text-fg-mute`}>{r.k}</div>
                  <div className={`${last ? "" : "border-b border-border"} border-l border-border px-4 py-2.5 text-fg-dim`}>{r.trad}</div>
                  <div className={`${last ? "" : "border-b border-border"} border-l border-border px-4 py-2.5 text-fg`} style={{ background: "color-mix(in srgb, var(--coral) 6%, transparent)" }}>{r.us}</div>
                </Fragment>
              );
            })}
          </div>
        </div>
      </section>

      {/* ON-CHAIN */}
      <section className="mt-12">
        <button onClick={() => setProofOpen((v) => !v)} className="text-[13px] font-semibold text-fg hover:text-coral">
          {proofOpen ? "Hide the on-chain record ↓" : "See it on-chain ↗"}
        </button>
        {proofOpen && (
          <div className="mt-3 max-w-xl rounded-lg border border-border bg-bg/60 p-4">
            <div className="grid gap-x-8 gap-y-2 font-mono text-[11px] sm:grid-cols-2">
              <Row k="agent" v={`${AGENT_SS58.slice(0, 6)}…${AGENT_SS58.slice(-4)}`} href={AGENT_EXPLORER} />
              <Row k="vault" v={`${VAULT_ADDRESS.slice(0, 6)}…${VAULT_ADDRESS.slice(-4)}`} href={VAULT_URL} />
              <Row k="on-chain runs" v={live ? String(live.runCount) : "…"} />
              <Row k="latest trade" v={latest ? `run #${latest.runSeq}` : "…"} href={AGENT_EXPLORER} />
              <Row k="open positions" v={live ? String(positions.length) : "…"} />
              <Row k="in the vault" v={compact(vault?.tvl)} />
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-fg-mute">
              The agent is registered on Theseus; every call is a signed run on the explorer. Deposits and shares live in the vault on Base Sepolia. The manager can mark the book but cannot withdraw your funds; admin changes are timelocked 24h, and fees (2 and 20) are charged on-chain.
            </p>
          </div>
        )}
      </section>

      <a href="#invest" className="fixed inset-x-3 bottom-3 z-30 rounded-xl py-3.5 text-center text-[15px] font-semibold text-white shadow-lg sm:hidden" style={{ background: "linear-gradient(180deg, #6366f1, #4f46e5)" }}>Invest</a>
    </main>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-[12px] text-fg-mute">{label}</p>
      <p className="mt-1 text-[22px] font-medium tabular-nums" style={{ color: accent ? "var(--coral)" : "var(--fg)" }}>{value}</p>
      {sub && <p className="mt-0.5 text-[11.5px] text-fg-mute">{sub}</p>}
    </div>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-1.5">
      <span className="text-fg-mute">{k}</span>
      <span className="tabular-nums text-fg">{v}</span>
    </div>
  );
}

function Row({ k, v, href }: { k: string; v: string; href?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-fg-mute">{k}</span>
      {href ? <a href={href} target="_blank" rel="noopener noreferrer" className="text-coral hover:underline">{v} ↗</a> : <span className="text-fg">{v}</span>}
    </div>
  );
}
