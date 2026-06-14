"use client";

import { useCallback, useEffect, useState } from "react";
import { TopBar } from "@/components/TopBar";
import DemoCTA from "@/components/DemoCTA";
import { BridgePanel } from "@/components/bridge/BridgePanel";
import { WithdrawForm } from "@/components/bridge/WithdrawForm";
import { BridgeScenarioControls } from "@/components/bridge/BridgeScenarioControls";
import { BridgeTimeline } from "@/components/bridge/BridgeTimeline";
import { BridgeGuardianJsonLd } from "@/components/JsonLd";
import {
  BridgeAgentVerdict,
  BridgeScenarioState,
  BRIDGE_PRESETS,
  applyBridgeAgentVerdict,
  applyBridgeLiveFill,
  applyBridgeOnChainCommit,
  applyBridgeCommitError,
  applyBridgePendingAction,
  applyBridgePreset,
  initialBridgeScenario,
  setBridgePending,
  setBridgePendingReasoning,
} from "@/lib/bridge-scenario";
import type { LiveBridgeFill } from "@/lib/across";
import {
  BridgePreset,
  readBridgeUrl,
  replaceUrl,
  writeBridgeUrl,
} from "@/lib/url-state";

export default function BridgePage() {
  const [scenario, setScenario] = useState<BridgeScenarioState>(
    initialBridgeScenario,
  );
  const [busy, setBusy] = useState(false);
  const [presetKey, setPresetKey] = useState<BridgePreset | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = readBridgeUrl(window.location.search);
    const preset = url.preset ?? "wormhole";
    // Lead with the money scenario: a fill faster than physics allows, the
    // Wormhole-shape release the guardian exists to hold.
    setPresetKey(preset);
    setScenario((s) => applyBridgePreset(s, preset));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    replaceUrl(writeBridgeUrl({ preset: presetKey ?? undefined }));
  }, [presetKey]);

  const handleAction = useCallback(
    async (amountUsd: number) => {
      setBusy(true);

      const optimistic = applyBridgePendingAction(scenario, amountUsd);
      setScenario(optimistic);

      try {
        const recentVerdicts = scenario.events
          .filter((e) => !e.pending && e.verdict)
          .slice(0, 3)
          .map((e) => ({
            action: e.action,
            decision: e.verdict!.decision,
            reason: e.verdict!.reason,
          }));
        const res = await fetch("/api/agent/bridge/decide", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            state: scenario.state,
            action: "WITHDRAW",
            amountUsd,
            recentVerdicts,
            liveFill: scenario.liveFill,
          }),
        });
        if (!res.ok || !res.body) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `http ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let finalVerdict: BridgeAgentVerdict | null = null;

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const events = buf.split("\n\n");
          buf = events.pop() ?? "";
          for (const evt of events) {
            for (const line of evt.split("\n")) {
              if (!line.startsWith("data:")) continue;
              const data = line.slice(5).trim();
              if (!data) continue;
              try {
                const parsed = JSON.parse(data);
                if (
                  parsed.type === "reasoning" &&
                  typeof parsed.text === "string"
                ) {
                  setScenario((s) =>
                    setBridgePendingReasoning(s, parsed.text),
                  );
                } else if (parsed.type === "final" && parsed.output) {
                  finalVerdict = parsed.output as BridgeAgentVerdict;
                  setScenario((s) => applyBridgeAgentVerdict(s, finalVerdict!));
                } else if (parsed.type === "committed") {
                  setScenario((s) =>
                    applyBridgeOnChainCommit(s, {
                      txHash: parsed.txHash,
                      txUrl: parsed.txUrl,
                      reasonHash: parsed.reasonHash,
                      blobUrl: parsed.blobUrl ?? null,
                    }),
                  );
                } else if (parsed.type === "commit_error") {
                  setScenario((s) =>
                    applyBridgeCommitError(s, parsed.error ?? "commit failed"),
                  );
                } else if (parsed.type === "error") {
                  throw new Error(parsed.error ?? "stream error");
                }
              } catch {
                /* ignore parse errors on non-event lines */
              }
            }
          }
        }

        if (!finalVerdict) throw new Error("stream ended without verdict");
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        const fallback: BridgeAgentVerdict = {
          decision: "REFUSE",
          reason: "agent unreachable",
          reasoning: `Agent call failed: ${msg}`,
        };
        setScenario((s) => applyBridgeAgentVerdict(s, fallback));
      } finally {
        setBusy(false);
        setScenario((s) => setBridgePending(s, false));
      }
    },
    [scenario],
  );

  const handlePreset = useCallback(
    async (key: keyof typeof BRIDGE_PRESETS) => {
      setPresetKey(key as BridgePreset);
      setScenario((s) => applyBridgePreset(s, key));
    },
    [],
  );

  const handleReset = useCallback(async () => {
    setPresetKey(null);
    setScenario(initialBridgeScenario());
  }, []);

  // Live Across fills landing on Base. Lazy-loaded on first expansion
  // so the page render stays fast and we don't burn the upstream API
  // for visitors who never open the section.
  const [liveOpen, setLiveOpen] = useState(false);
  const [liveFills, setLiveFills] = useState<LiveBridgeFill[] | null>(null);
  const [liveErr, setLiveErr] = useState<string | null>(null);

  const fetchLive = useCallback(async () => {
    if (liveFills || liveErr) return;
    try {
      const res = await fetch("/api/bridge/recent-fills");
      if (!res.ok) throw new Error(`http ${res.status}`);
      const j = (await res.json()) as { fills: LiveBridgeFill[] };
      setLiveFills(j.fills);
    } catch (e) {
      setLiveErr((e as Error).message);
    }
  }, [liveFills, liveErr]);

  const handleLivePick = useCallback((fill: LiveBridgeFill) => {
    setPresetKey(null);
    setScenario((s) => applyBridgeLiveFill(s, fill));
  }, []);

  return (
    <>
      <BridgeGuardianJsonLd />
      <TopBar mode="mock" />
      <main className="min-h-screen px-3 sm:px-4 md:px-8 pb-12">
        <div className="mx-auto max-w-[760px] pt-12">
          <div className="mb-10 flex items-baseline justify-between gap-4">
            <a
              href="/"
              className="text-[11px] uppercase tracking-[0.18em] text-fg-mute transition-colors hover:text-fg"
            >
              ← directory
            </a>
            <a
              href="https://theseus.network/poa/5KbR9w3jH8mTcQ2nL5pY7eB1xK4dV6sN8aZ3fW5tH9pM1vXc"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] uppercase tracking-[0.18em] text-fg-mute transition-colors hover:text-fg"
            >
              on chain ↗
            </a>
          </div>

          <p className="mb-12 text-[13.5px] leading-[1.7] text-fg-mute">
            The Bridge Guardian gates withdrawals on a cross-chain bridge.
            Load any of the three preset attack shapes (Ronin, Wormhole,
            Nomad), try to release, and read the verdict. A naive bridge
            would have paid out on each one.
          </p>

          <div id="bridge-scenarios">
            <BridgeScenarioControls
              agentPending={scenario.pending}
              presetLabel={scenario.presetLabel}
              onPreset={handlePreset}
              onReset={handleReset}
            />
          </div>

          <details
            className="mt-6 border-t pt-4"
            style={{ borderColor: "var(--border)" }}
            onToggle={(e) => {
              const open = (e.currentTarget as HTMLDetailsElement).open;
              setLiveOpen(open);
              if (open) fetchLive();
            }}
          >
            <summary className="cursor-pointer text-[10.5px] uppercase tracking-[0.18em] text-fg-mute transition-colors hover:text-fg">
              or review a live Across fill ↓
            </summary>
            <p className="mt-3 text-[12px] leading-relaxed text-fg-mute">
              Pulled from{" "}
              <a
                href="https://across.to"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-border underline-offset-[3px] hover:text-fg hover:decoration-fg"
              >
                Across Protocol
              </a>
              , the intent-based bridge that fills cross-chain transfers on
              Base. Each row is a real fill that already landed. Click one to
              load it into the review pipeline above; the agent will read the
              fill (origin chain, amount, recipient) and decide whether it
              looks suspicious. Same flow as the synthetic presets.
            </p>
            <div className="mt-4">
              {liveOpen && !liveFills && !liveErr && (
                <p className="text-[12px] text-fg-mute">Loading…</p>
              )}
              {liveErr && (
                <p
                  className="text-[12px]"
                  style={{ color: "var(--red)" }}
                >
                  Couldn&apos;t reach Across: {liveErr}
                </p>
              )}
              {liveFills && liveFills.length === 0 && (
                <p className="text-[12px] text-fg-mute">
                  No recent fills returned.
                </p>
              )}
              {liveFills && liveFills.length > 0 && (
                <ul className="border-t border-border">
                  {liveFills.map((f) => {
                    const active = scenario.liveFill?.fillId === f.fillId;
                    const ageMin = Math.max(
                      1,
                      Math.round(
                        (Date.now() - Date.parse(f.fillTimeIso)) / 60_000,
                      ),
                    );
                    return (
                      <li
                        key={f.fillId}
                        className="border-b border-border py-3 last:border-b-0"
                      >
                        <button
                          type="button"
                          onClick={() => handleLivePick(f)}
                          className="block w-full text-left transition-colors hover:text-fg"
                          style={active ? { color: "var(--coral)" } : undefined}
                        >
                          <p className="font-serif text-[15px] text-fg leading-snug">
                            {f.originChain} → Base ·{" "}
                            {f.amountToken < 1
                              ? f.amountToken.toFixed(4)
                              : f.amountToken < 1000
                                ? f.amountToken.toFixed(2)
                                : f.amountToken.toFixed(0)}{" "}
                            {f.tokenSymbol}
                          </p>
                          <p className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-fg-mute">
                            ~${Math.round(f.amountUsd).toLocaleString()}
                            {" · "}
                            {ageMin}m ago
                            {" · "}
                            recipient {f.recipient.slice(0, 6)}…
                            {f.recipient.slice(-4)}
                            {f.recipientDiffersFromDepositor && (
                              <>
                                {" "}
                                <span style={{ color: "var(--coral)" }}>
                                  ≠ depositor
                                </span>
                              </>
                            )}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </details>

          <div className="mt-10">
            <BridgePanel
              state={scenario.state}
              presetLabel={scenario.presetLabel}
            />
          </div>

          <div className="mt-10 border-t pt-6" style={{ borderColor: "var(--border)" }}>
            <WithdrawForm
              busy={busy}
              pending={scenario.pending}
              onSubmit={handleAction}
            />
          </div>

          <div className="mt-10 border-t pt-6" style={{ borderColor: "var(--border)" }}>
            <p className="mb-3 text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
              guardian verdicts
            </p>
            <BridgeTimeline entries={scenario.events} />
          </div>

          <DemoCTA />
        </div>
      </main>
    </>
  );
}
