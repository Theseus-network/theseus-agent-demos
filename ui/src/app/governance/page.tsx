"use client";

import { useCallback, useEffect, useState } from "react";
import { TopBar } from "@/components/TopBar";
import DemoCTA from "@/components/DemoCTA";
import { ProposalPanel } from "@/components/governance/ProposalPanel";
import { ReviewButton } from "@/components/governance/ReviewButton";
import { GovernanceScenarioControls } from "@/components/governance/GovernanceScenarioControls";
import { GovernanceTimeline } from "@/components/governance/GovernanceTimeline";
import { GovernanceReviewerJsonLd } from "@/components/JsonLd";
import {
  GOVERNANCE_PRESETS,
  GovernanceAgentVerdict,
  GovernanceScenarioState,
  applyGovernanceAgentVerdict,
  applyGovernanceOnChainCommit,
  applyGovernanceCommitError,
  applyGovernancePendingAction,
  applyGovernancePreset,
  applyGovernanceProposal,
  initialGovernanceScenario,
  setGovernancePending,
  setGovernancePendingReasoning,
} from "@/lib/governance-scenario";
import type { SnapshotProposal } from "@/lib/snapshot";
import {
  GovernancePreset,
  readGovernanceUrl,
  replaceUrl,
  writeGovernanceUrl,
} from "@/lib/url-state";

export default function GovernancePage() {
  const [scenario, setScenario] = useState<GovernanceScenarioState>(
    initialGovernanceScenario,
  );
  const [busy, setBusy] = useState(false);
  const [presetKey, setPresetKey] = useState<GovernancePreset | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = readGovernanceUrl(window.location.search);
    if (url.preset) {
      setPresetKey(url.preset);
      setScenario((s) => applyGovernancePreset(s, url.preset!));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    replaceUrl(writeGovernanceUrl({ preset: presetKey ?? undefined }));
  }, [presetKey]);

  const handleReview = useCallback(async () => {
    setBusy(true);
    const optimistic = applyGovernancePendingAction(scenario);
    setScenario(optimistic);

    try {
      const recentVerdicts = scenario.events
        .filter((e) => !e.pending && e.verdict)
        .slice(0, 3)
        .map((e) => ({
          proposalId: e.proposalSnapshot.proposalId,
          decision: e.verdict!.decision,
          reason: e.verdict!.reason,
        }));
      const res = await fetch("/api/agent/governance/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          proposal: scenario.proposal,
          recentVerdicts,
        }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `http ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let finalVerdict: GovernanceAgentVerdict | null = null;

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
                  setGovernancePendingReasoning(s, parsed.text),
                );
              } else if (parsed.type === "final" && parsed.output) {
                finalVerdict = parsed.output as GovernanceAgentVerdict;
                setScenario((s) => applyGovernanceAgentVerdict(s, finalVerdict!));
              } else if (parsed.type === "committed") {
                setScenario((s) =>
                  applyGovernanceOnChainCommit(s, {
                    txHash: parsed.txHash,
                    txUrl: parsed.txUrl,
                    reasonHash: parsed.reasonHash,
                    blobUrl: parsed.blobUrl ?? null,
                  }),
                );
              } else if (parsed.type === "commit_error") {
                setScenario((s) =>
                  applyGovernanceCommitError(s, parsed.error ?? "commit failed"),
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
      const fallback: GovernanceAgentVerdict = {
        decision: "CAUTION",
        reason: "agent unreachable",
        reasoning: `Agent call failed: ${msg}`,
      };
      setScenario((s) => applyGovernanceAgentVerdict(s, fallback));
    } finally {
      setBusy(false);
      setScenario((s) => setGovernancePending(s, false));
    }
  }, [scenario]);

  const handlePreset = useCallback(
    async (key: keyof typeof GOVERNANCE_PRESETS) => {
      setPresetKey(key as GovernancePreset);
      setScenario((s) => applyGovernancePreset(s, key));
    },
    [],
  );

  const handleReset = useCallback(async () => {
    setPresetKey(null);
    setScenario(initialGovernanceScenario());
  }, []);

  // Live Arbitrum proposals from Snapshot. Lazy-loaded on first
  // expansion so the page render stays fast.
  const [liveOpen, setLiveOpen] = useState(false);
  const [livePropsals, setLiveProposals] = useState<SnapshotProposal[] | null>(
    null,
  );
  const [liveErr, setLiveErr] = useState<string | null>(null);

  const fetchLive = useCallback(async () => {
    if (livePropsals || liveErr) return;
    try {
      const res = await fetch("/api/governance/arbitrum");
      if (!res.ok) throw new Error(`http ${res.status}`);
      const j = (await res.json()) as { proposals: SnapshotProposal[] };
      setLiveProposals(j.proposals);
    } catch (e) {
      setLiveErr((e as Error).message);
    }
  }, [livePropsals, liveErr]);

  const handleLivePick = useCallback((sp: SnapshotProposal) => {
    setPresetKey(null);
    setScenario((s) =>
      applyGovernanceProposal(
        s,
        sp.proposal,
        `Arbitrum DAO · ${sp.proposal.title.slice(0, 50)}`,
      ),
    );
  }, []);

  return (
    <>
      <GovernanceReviewerJsonLd />
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
              href="https://theseus.network/poa/5FmN8vY6cP1qK4xR7zL3jB9wE5dV8aS2hT6gM3fX9pZ7nCk2"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] uppercase tracking-[0.18em] text-fg-mute transition-colors hover:text-fg"
            >
              on chain ↗
            </a>
          </div>

          <p className="mb-12 text-[13.5px] leading-[1.7] text-fg-mute">
            An AI agent that reads a DAO treasury proposal before voting
            opens and posts a signed{" "}
            <span className="font-bold text-[color:var(--green)]">APPROVE</span>{" "}
            /{" "}
            <span className="font-bold text-[color:var(--amber)]">CAUTION</span>{" "}
            /{" "}
            <span className="font-bold text-[color:var(--red)]">REJECT</span>{" "}
            verdict. Four presets sit below: a routine grants budget, a
            dust-staked wallet trying to drain the treasury at 03:00 on a
            Sunday, a hostile router upgrade, and the exact shape that
            drained Beanstalk for $182M. The reviewer reads the calldata
            and the proposer&apos;s voting history before the vote opens.
          </p>

          <div id="governance-scenarios">
            <GovernanceScenarioControls
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
              or load a live Arbitrum DAO proposal ↓
            </summary>
            <p className="mt-3 text-[12px] leading-relaxed text-fg-mute">
              Pulled from the{" "}
              <a
                href="https://snapshot.org/#/arbitrumfoundation.eth"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-border underline-offset-[3px] hover:text-fg hover:decoration-fg"
              >
                arbitrumfoundation.eth Snapshot space
              </a>
              . The reviewer reads the proposal body and voting state, then
              posts a signed verdict. Same flow as the synthetic presets
              above.
            </p>
            <div className="mt-4">
              {liveOpen && !livePropsals && !liveErr && (
                <p className="text-[12px] text-fg-mute">Loading…</p>
              )}
              {liveErr && (
                <p
                  className="text-[12px]"
                  style={{ color: "var(--red)" }}
                >
                  Couldn&apos;t reach Snapshot: {liveErr}
                </p>
              )}
              {livePropsals && livePropsals.length === 0 && (
                <p className="text-[12px] text-fg-mute">
                  No recent proposals returned.
                </p>
              )}
              {livePropsals && livePropsals.length > 0 && (
                <ul className="border-t border-border">
                  {livePropsals.map((sp) => (
                    <li
                      key={sp.snapshotId}
                      className="border-b border-border py-3 last:border-b-0"
                    >
                      <button
                        type="button"
                        onClick={() => handleLivePick(sp)}
                        className="block w-full text-left transition-colors hover:text-fg"
                      >
                        <p className="font-serif text-[15px] text-fg leading-snug">
                          {sp.proposal.title}
                        </p>
                        <p className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-fg-mute">
                          <span
                            className="font-bold"
                            style={{
                              color:
                                sp.state === "active"
                                  ? "var(--green)"
                                  : "var(--fg-mute)",
                            }}
                          >
                            {sp.state}
                          </span>
                          {" · "}
                          {sp.proposal.votingWindowHours}h window
                          {" · "}
                          {(sp.proposal.participatingSupply / 1e6).toFixed(1)}M
                          {" "}ARB voted
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </details>

          <div className="mt-10">
            <p className="mb-2 text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
              the proposal
            </p>
            <ProposalPanel
              proposal={scenario.proposal}
              presetLabel={scenario.presetLabel}
            />
          </div>

          <div className="mt-10">
            <ReviewButton
              busy={busy}
              pending={scenario.pending}
              onSubmit={handleReview}
            />
          </div>

          <div className="mt-10 border-t pt-6" style={{ borderColor: "var(--border)" }}>
            <p className="mb-3 text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
              reviewer verdicts
            </p>
            <GovernanceTimeline entries={scenario.events} />
          </div>

          <DemoCTA />
        </div>
      </main>
    </>
  );
}
