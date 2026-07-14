"use client";

import { useState } from "react";
import { ActionKind } from "@/lib/terra-scenario";

interface Props {
  busy: boolean;
  pending: boolean;
  onSubmit: (action: ActionKind, ustdAmount: number) => Promise<void> | void;
}

export function MintRedeemForm({ busy, pending, onSubmit }: Props) {
  const [tab, setTab] = useState<ActionKind>("MINT");
  const [amount, setAmount] = useState("100000000");

  const disabled = busy || pending;

  return (
    <div className="mt-6">
      <p className="text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
        try an action
      </p>

      <div className="mt-3 flex items-baseline gap-4 text-[12px]">
        <button
          type="button"
          onClick={() => setTab("MINT")}
          disabled={disabled}
          className="italic underline decoration-border underline-offset-[3px] transition-colors hover:text-fg hover:decoration-fg disabled:opacity-30"
          style={{ color: tab === "MINT" ? "var(--fg)" : "var(--fg-mute)" }}
        >
          mint UST
        </button>
        <span className="text-border">·</span>
        <button
          type="button"
          onClick={() => setTab("REDEEM")}
          disabled={disabled}
          className="italic underline decoration-border underline-offset-[3px] transition-colors hover:text-fg hover:decoration-fg disabled:opacity-30"
          style={{ color: tab === "REDEEM" ? "var(--fg)" : "var(--fg-mute)" }}
        >
          redeem UST
        </button>
      </div>

      <p className="mt-2 text-[12px] text-fg-mute leading-relaxed">
        {tab === "MINT"
          ? "Burn LUNA to receive UST. Adds new UST claims to the system."
          : "Burn UST to receive LUNA. Forces the protocol to mint new LUNA."}
      </p>

      <form
        className="mt-3 flex flex-wrap items-center gap-3 text-[13px]"
        onSubmit={(e) => {
          e.preventDefault();
          const n = Number(amount);
          if (!Number.isFinite(n) || n <= 0) return;
          onSubmit(tab, n);
        }}
      >
        <span className="flex items-baseline gap-2">
          <input
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            disabled={disabled}
            className="w-40 border-b border-border bg-transparent font-mono text-[13px] text-fg focus:border-fg focus:outline-none disabled:opacity-50"
          />
          <span className="font-mono text-[11px] text-fg-mute">UST</span>
        </span>
        <button
          type="submit"
          disabled={disabled || !amount}
          className="cta-ink inline-flex items-center gap-2 px-5 py-2.5 text-[13px] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "agent reasoning…" : busy ? "submitting…" : tab === "MINT" ? "mint →" : "redeem →"}
        </button>
      </form>
    </div>
  );
}
