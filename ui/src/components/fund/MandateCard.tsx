// The mandate as a visible contract. The whole trustless-fund pitch rests on
// bounded discretion: an LP can read exactly what the agent may and may not
// do, and the chain enforces it. This is the product, so it should be legible.

const CAN = [
  "Hold 30–60% WETH, rebalanced to a vol/momentum target",
  "Trade only past a 5% drift band (no churn)",
  "Runs on its own schedule",
  "Skip a tick whose price feed can't be trusted",
];

const CANNOT = [
  "Exceed 60% WETH or drop below 30% USDC",
  "Move funds off-mandate or to an external address",
  "Be ordered to dump, rug, or override the charter",
  "Touch an LP's redemption against NAV",
];

export function MandateCard() {
  return (
    <div className="rounded-xl border border-border bg-surface/60 p-5">
      <p className="mb-1 font-mono text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
        The mandate · signed on chain
      </p>
      <p className="mb-4 text-[13px] leading-relaxed text-fg-dim">
        Bounded discretion is the whole point: there&rsquo;s no GP who can wake
        up and change the rules. The chain enforces this.
      </p>
      <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        <ul className="space-y-1.5">
          {CAN.map((c) => (
            <li key={c} className="flex gap-2 text-[12.5px] leading-snug text-fg-dim">
              <span style={{ color: "var(--green)" }}>✓</span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
        <ul className="space-y-1.5">
          {CANNOT.map((c) => (
            <li key={c} className="flex gap-2 text-[12.5px] leading-snug text-fg-dim">
              <span style={{ color: "var(--red)" }}>✕</span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
