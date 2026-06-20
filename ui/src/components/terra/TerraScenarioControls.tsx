"use client";

import { useState } from "react";
import { PRESETS } from "@/lib/terra-scenario";

interface Props {
  agentPending: boolean;
  presetLabel: string;
  onPreset: (key: keyof typeof PRESETS) => Promise<void> | void;
  onReset: () => Promise<void> | void;
}

const ORDER: (keyof typeof PRESETS)[] = [
  "healthy",
  "wobble",
  "cracking",
  "bankRun",
  "spiral",
];

export function TerraScenarioControls({
  agentPending,
  presetLabel,
  onPreset,
  onReset,
}: Props) {
  const [busy, setBusy] = useState(false);
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

  return (
    <div className="mt-6 rounded-xl border border-border bg-surface/60 p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="rounded-md bg-coral px-2 py-1 font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-white">
          Try it
        </span>
        <span className="text-[13.5px] text-fg-dim">
          Load a vault state, then submit a mint or redeem.
        </span>
        {agentPending && (
          <span
            className="font-mono text-[10.5px] uppercase tracking-[0.16em]"
            style={{ color: "var(--coral)" }}
          >
            agent reasoning&hellip;
          </span>
        )}
        <button
          type="button"
          onClick={wrap(onReset)}
          disabled={disabled}
          className="ml-auto text-[12px] text-fg-mute transition-colors hover:text-fg hover:underline disabled:opacity-30"
        >
          reset &rarr;
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {ORDER.map((key) => {
          const p = PRESETS[key];
          const active = presetLabel === p.label;
          return (
            <button
              key={key}
              type="button"
              onClick={wrap(() => onPreset(key))}
              disabled={disabled}
              className={`btn !text-[12px] disabled:cursor-not-allowed disabled:opacity-30 ${
                active ? "!border-coral !text-coral" : ""
              }`}
            >
              {p.label.toLowerCase()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
