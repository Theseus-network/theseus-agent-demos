"use client";

// Turns the fund demo from "watch a trader" into "be an LP in a fund no one
// can rug." A deposit captures the fund NAV at entry; the position then tracks
// the fund's per-unit NAV, so when the agent de-risks through a drawdown the
// viewer sees their own money get protected. Redeem settles against NAV with
// no lockup. Mocked client-side; the NAV it tracks is the real sandbox NAV.

import { useEffect, useRef, useState } from "react";

const DEPOSITS = [1_000, 10_000, 100_000];

function usd(n: number, cents = false): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents ? 0 : 0,
  });
}

type Position = { deposit: number; navAtDeposit: number };

export function LpPanel({
  nav,
  scenarioKey,
}: {
  nav: number;
  scenarioKey: string;
}) {
  const [position, setPosition] = useState<Position | null>(null);
  const [redeemed, setRedeemed] = useState<{ deposit: number; value: number } | null>(
    null,
  );

  // A preset switch is a fresh fund, not a market move — reset the stake so the
  // P&L never jumps on a scenario swap.
  const prevKey = useRef(scenarioKey);
  useEffect(() => {
    if (prevKey.current !== scenarioKey) {
      prevKey.current = scenarioKey;
      setPosition(null);
      setRedeemed(null);
    }
  }, [scenarioKey]);

  const value = position ? position.deposit * (nav / position.navAtDeposit) : 0;
  const pnl = position ? value - position.deposit : 0;
  const pnlPct = position ? (pnl / position.deposit) * 100 : 0;
  const ownership = position
    ? (position.deposit / (position.navAtDeposit + position.deposit)) * 100
    : 0;

  function deposit(d: number) {
    setRedeemed(null);
    setPosition({ deposit: d, navAtDeposit: nav });
  }
  function redeem() {
    if (!position) return;
    setRedeemed({ deposit: position.deposit, value });
    setPosition(null);
  }

  return (
    <div className="rounded-xl border border-border bg-surface/60 p-5">
      <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="rounded-md bg-coral px-2 py-1 font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-white">
          Be an LP
        </span>
        <span className="text-[13.5px] text-fg-dim">
          Deposit into the fund. Your stake moves with NAV; redeem anytime.
        </span>
      </div>

      {!position ? (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] text-fg-mute">deposit:</span>
            {DEPOSITS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => deposit(d)}
                className="btn !text-[12px]"
              >
                {usd(d)}
              </button>
            ))}
          </div>
          {redeemed ? (
            <p className="mt-3 text-[12.5px] text-fg-dim">
              Redeemed {usd(redeemed.deposit)} &rarr;{" "}
              <span className="font-medium text-fg">{usd(redeemed.value)}</span>{" "}
              ({redeemed.value >= redeemed.deposit ? "+" : "−"}
              {usd(Math.abs(redeemed.value - redeemed.deposit))}). Settled
              against NAV, no lockup.
            </p>
          ) : (
            <p className="mt-3 text-[11.5px] text-fg-mute">
              The mandate is signed on chain, so the agent can&rsquo;t
              exceed its risk limits or move your money outside the rules.
            </p>
          )}
        </div>
      ) : (
        <div className="mt-4">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            <Stat label="your deposit" value={usd(position.deposit)} />
            <Stat label="ownership" value={`${ownership.toFixed(2)}%`} />
            <Stat label="position value" value={usd(value)} />
            <Stat
              label="P&L"
              value={`${pnl >= 0 ? "+" : "−"}${usd(Math.abs(pnl))} (${
                pnl >= 0 ? "+" : "−"
              }${Math.abs(pnlPct).toFixed(2)}%)`}
              tone={pnl >= 0 ? "pos" : "neg"}
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={redeem}
              className="cta-ink inline-flex items-center gap-2 px-5 py-2.5 text-[13px]"
            >
              Redeem against NAV →
            </button>
            <span className="text-[11.5px] text-fg-mute">
              No lockup. Run a step to see how the agent trades.
            </span>
          </div>
        </div>
      )}
    </div>
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
    tone === "pos"
      ? "var(--green)"
      : tone === "neg"
        ? "var(--red)"
        : "var(--fg)";
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-fg-mute">
        {label}
      </p>
      <p
        className="mt-1 text-[15px] font-medium tabular-nums"
        style={{ color }}
      >
        {value}
      </p>
    </div>
  );
}
