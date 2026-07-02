"use client";

import { useState } from "react";

// Triggers a real on-chain run of the Sovereign agent and shows its decision.
// The agent runs in the Theseus runtime (inference + tool dispatch); the result
// is read from the RunCompleted event and linked to the explorer.

interface Props {
  price: number;
  vol: number;
  momentum: number;
  share: number;
}

type State =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; decision: string; runSeq: number; explorer: string }
  | { kind: "error"; message: string };

export function LiveDecision({ price, vol, momentum, share }: Props) {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function ask() {
    setState({ kind: "running" });
    try {
      const r = await fetch("/api/vault/decision", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ price, vol, momentum, share }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "run failed");
      setState({ kind: "done", decision: j.decision, runSeq: j.runSeq, explorer: j.explorer });
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-border bg-bg/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-fg">Ask the agent, live</p>
          <p className="mt-0.5 text-[12px] text-fg-mute">Runs the Sovereign agent on Theseus and signs its call on-chain.</p>
        </div>
        <button
          onClick={ask}
          disabled={state.kind === "running"}
          className="shrink-0 rounded-lg px-4 py-2 text-[13px] font-semibold text-white transition-[filter] hover:brightness-110 disabled:opacity-50"
          style={{ background: "linear-gradient(180deg, #6366f1, #4f46e5)" }}
        >
          {state.kind === "running" ? "Running on-chain…" : "Get its call ↗"}
        </button>
      </div>

      {state.kind === "running" && (
        <div className="mt-3 flex items-center gap-2 text-[12.5px] text-fg-dim">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full" style={{ background: "var(--coral)" }} />
          The agent is running in the Theseus runtime. This takes a minute.
        </div>
      )}

      {state.kind === "done" && (
        <div className="mt-3">
          <p className="text-[14px] leading-relaxed text-fg">{state.decision}</p>
          <a
            href={state.explorer}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block font-mono text-[11px] text-coral hover:underline"
          >
            run #{state.runSeq} · verify on Theseus ↗
          </a>
        </div>
      )}

      {state.kind === "error" && (
        <p className="mt-3 text-[12.5px] text-red">Run failed: {state.message}</p>
      )}
    </div>
  );
}
