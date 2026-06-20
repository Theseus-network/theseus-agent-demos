"use client";

import { useState } from "react";
import { VenueReading } from "@/lib/types";

type Venue = VenueReading["venue"];

interface Props {
  haltedVenues: Venue[];
  anyOverride: boolean;
  agentPending: boolean;
  onPumpAll: (priceUsd: number) => Promise<void> | void;
  onHaltToggle: (venue: Venue) => Promise<void> | void;
  onResetAll: () => Promise<void> | void;
  onBlackSwan: (
    kind: "depth-collapse" | "subtle-pump" | "flash-crash",
  ) => Promise<void> | void;
}

const VENUES: Venue[] = ["coinbase", "binance", "uniswap"];

export function ScenarioControls({
  haltedVenues,
  anyOverride,
  agentPending,
  onPumpAll,
  onHaltToggle,
  onResetAll,
  onBlackSwan,
}: Props) {
  const [busy, setBusy] = useState(false);
  const haltedSet = new Set(haltedVenues);
  const dirty = anyOverride || haltedSet.size > 0;
  const disabled = busy || agentPending;

  const wrap = (fn: () => Promise<void> | void) => async () => {
    if (disabled) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const links: { label: string; onClick: () => void | Promise<void> }[] = [
    { label: "pump all to $100k", onClick: wrap(() => onPumpAll(100_000)) },
    ...VENUES.map((v) => ({
      label: (haltedSet.has(v) ? "unhalt " : "halt ") + v,
      onClick: wrap(() => onHaltToggle(v)),
    })),
    { label: "drain one exchange", onClick: wrap(() => onBlackSwan("depth-collapse")) },
    { label: "49% pump", onClick: wrap(() => onBlackSwan("subtle-pump")) },
    { label: "flash crash", onClick: wrap(() => onBlackSwan("flash-crash")) },
  ];

  return (
    <div className="mt-7 rounded-xl border border-border bg-surface/60 p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="rounded-md bg-coral px-2 py-1 font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-white">
          Try it
        </span>
        <span className="text-[13.5px] text-fg-dim">
          Pick a scenario to break the feed, then submit a price.
        </span>
        {agentPending && (
          <span
            className="font-mono text-[10.5px] uppercase tracking-[0.16em]"
            style={{ color: "var(--coral)" }}
          >
            agent reasoning&hellip;
          </span>
        )}
        {dirty && (
          <button
            type="button"
            onClick={wrap(onResetAll)}
            disabled={disabled}
            className="ml-auto text-[12px] text-fg-mute transition-colors hover:text-fg hover:underline disabled:opacity-30"
          >
            reset &rarr;
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {links.map((l) => (
          <button
            key={l.label}
            type="button"
            onClick={l.onClick}
            disabled={disabled}
            className="btn !text-[12px] disabled:cursor-not-allowed disabled:opacity-30"
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}
