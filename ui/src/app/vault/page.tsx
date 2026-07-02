"use client";

import { LiveFund } from "@/components/vault/LiveFund";
import { NavLine } from "@/components/vault/NavLine";
import { PredictionBook } from "@/components/vault/PredictionBook";
import { TrackRecord } from "@/components/vault/TrackRecord";
import { useLiveFund } from "@/components/vault/useLiveFund";
import { WalletInvest } from "@/components/vault/WalletInvest";
import { VAULT_ADDRESS, BASESCAN } from "@/lib/vault/contracts";

const AGENT_SS58 = "5C8RTTrk13NkNS7B7UqiCciL5oTMTePyiHCvpmEUbApPJ1L6";
const AGENT_EXPLORER = `https://explorer.theseus.network/agents/${AGENT_SS58}`;
const VAULT_URL = `${BASESCAN}/address/${VAULT_ADDRESS}`;

const compact = (n: number | undefined) => n === undefined ? "—" : Math.abs(n) >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : Math.abs(n) >= 1e3 ? `$${(n / 1e3).toFixed(1)}K` : `$${n.toFixed(0)}`;

const MANDATE = [
  "Reads real prediction markets and forms its own probability estimate",
  "Takes a position only when its estimate is far enough from the market price",
  "Sizes small, holds toward resolution, and passes when markets look efficient",
  "Every call is a signed run on Theseus; NAV settles on-chain on Base Sepolia",
];

export default function VaultPage() {
  const live = useLiveFund();
  const vault = live?.vault ?? null;
  const positions = live?.positions ?? [];
  const runMins = live ? Math.max(1, Math.round(live.nextTradeInMs / 60000)) : null;

  return (
    <main className="mx-auto max-w-[1080px] px-4 pb-24 pt-10 sm:px-6">
      {/* PITCH + THE NAV LINE — the first thing anyone sees */}
      <section className="max-w-2xl">
        <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-fg-mute">Sovereign</p>
        <h1 className="mt-2 font-serif text-[34px] leading-[1.06] tracking-tight text-fg sm:text-[44px]">
          An autonomous fund that trades prediction markets, around the clock.
        </h1>
        <p className="mt-4 text-[16px] leading-relaxed text-fg-dim">
          Deposit anytime, redeem monthly at NAV. The agent trades on its own — no one can steer it,
          and the manager can never withdraw your funds.
        </p>
      </section>

      <section className="mt-8">
        <NavLine history={live?.navHistory ?? []} startedAt={live?.startedAt ?? Date.now()} pps={vault?.pricePerShare} />
        <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-5 border-t border-border pt-6 sm:grid-cols-4">
          <Stat label="In the vault" value={compact(vault?.tvl)} sub="Base Sepolia" />
          <Stat label="Open positions" value={live ? String(positions.length) : "…"} sub={live ? `${compact(live.deployed)} at work` : "in the book"} />
          <Stat
            label={live?.trading ? "The agent" : "Next run"}
            value={live?.trading ? "Trading" : runMins != null ? `~${runMins}m` : "…"}
            sub={live ? `${live.runCount} signed runs` : "on Theseus"}
            accent={live?.trading}
          />
          <Stat label="Redemptions" value="Monthly" sub={vault ? (vault.redemptionsOpen ? "window open" : "at NAV") : "at NAV"} />
        </div>
        <a href="#invest" className="mt-7 inline-flex rounded-lg px-6 py-3 text-[15px] font-semibold text-white shadow-[0_16px_50px_-16px_rgba(99,102,241,0.5)] transition-[filter] hover:brightness-110" style={{ background: "linear-gradient(180deg, #6366f1, #4f46e5)" }}>
          Invest →
        </a>
      </section>

      {/* INVEST + AGENT DESK */}
      <section id="invest" className="mt-14 grid items-start gap-x-10 gap-y-8 lg:grid-cols-2">
        <div>
          <WalletInvest />
          <div className="mt-6 border-t border-border pt-5">
            <p className="text-[12px] text-fg-mute">How it works</p>
            <ol className="mt-2.5 space-y-2 text-[13px] text-fg-dim">
              {["Deposit test USDC, mint svUSDC shares at NAV", "The agent trades prediction markets on its own, each call signed on Theseus", "Redeem at NAV in the monthly window, on-chain"].map((t, i) => (
                <li key={t} className="flex gap-2.5"><span className="tabular-nums text-fg-mute">{i + 1}.</span><span>{t}</span></li>
              ))}
            </ol>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-fg">The agent&rsquo;s desk</h2>
            <a href={AGENT_EXPLORER} target="_blank" rel="noopener noreferrer" className="text-[12.5px] text-fg-mute hover:text-fg">on Theseus ↗</a>
          </div>
          <p className="mt-1.5 text-[13px] text-fg-mute">It forms its own probability for a market and takes a position when that estimate is far from the price. The gap is its claim; the track record is where real skill shows.</p>
          <LiveFund live={live} />
        </div>
      </section>

      {/* THE BOOK */}
      <section className="mt-14">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-fg">The book</h2>
          {live && positions.length > 0 && (
            <span className="flex items-center gap-x-4 text-[13px] tabular-nums text-fg-mute">
              <span style={{ color: live.bookPnl >= 0 ? "var(--coral)" : "var(--red)" }}>{live.bookPnl >= 0 ? "+" : "−"}${Math.abs(live.bookPnl).toFixed(0)} open</span>
            </span>
          )}
        </div>
        <p className="mt-1 text-[13px] text-fg-mute">Open positions in soon-resolving markets, marked to live Polymarket odds. The fund tracks this book; it does not hold Polymarket shares.</p>
        <PredictionBook positions={positions} explorer={live?.explorer} />
      </section>

      {/* TRACK RECORD */}
      <section className="mt-14">
        <h2 className="text-[15px] font-semibold text-fg">Track record</h2>
        <p className="mt-1 text-[13px] text-fg-mute">Every call, scored when its market resolves. This is the agent&rsquo;s calibration over time.</p>
        <TrackRecord resolved={live?.resolved ?? []} />
      </section>

      {/* WHAT IT DOES + FEES */}
      <section className="mt-14 grid gap-x-10 gap-y-8 lg:grid-cols-2">
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
            Charged on-chain. NAV is shown before fees; each redemption pays your share of the accrued fees. You only pay the performance fee on new profit above your high-water mark.
          </p>
        </div>
      </section>

      {/* FOOTER — sovereignty & custody, quiet and true */}
      <footer className="mt-14 border-t border-border pt-6 text-[12.5px] leading-relaxed text-fg-mute">
        <p className="max-w-3xl">
          The agent is registered on Theseus and every call is a signed run. Deposits and shares live in the vault
          on Base Sepolia; the manager can mark the book and charge fees but can never withdraw your funds, and admin
          changes are timelocked 24 hours. This is a testnet fund — positions are marked against real Polymarket odds,
          but the underlying is test USDC, so there is no real-money upside yet.
        </p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11.5px]">
          <a href={AGENT_EXPLORER} target="_blank" rel="noopener noreferrer" className="text-coral hover:underline">agent ↗</a>
          <a href={VAULT_URL} target="_blank" rel="noopener noreferrer" className="text-coral hover:underline">vault contract ↗</a>
          <span>runs: {live ? live.runCount : "…"}</span>
        </div>
      </footer>

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
