"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TopBar } from "@/components/TopBar";
import DemoCTA from "@/components/DemoCTA";
import { AdjudicatorJsonLd } from "@/components/JsonLd";
import { useTypewriter } from "@/lib/use-typewriter";
import {
  MARKETS,
  type Citation,
  type PredictionMarket,
} from "@/lib/adjudicator-markets";
import type { PolymarketLiveMarket } from "@/lib/polymarket";
import { TryItHeader } from "@/components/TryItPanel";

function daysUntil(deadlineISO: string): number {
  const todayMs = Date.parse(
    new Date().toISOString().slice(0, 10) + "T00:00:00Z",
  );
  const deadlineMs = Date.parse(deadlineISO + "T23:59:59Z");
  return Math.ceil((deadlineMs - todayMs) / 86_400_000);
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// The agent's confidence calibration is its real discipline: >=80 only when the
// criteria are clearly met or clearly not; 60-79 when one side is favoured but a
// reader could disagree; under 60 when the evidence is thin. Surface the tier.
function confidenceTier(pct: number): { color: string; label: string } {
  if (pct >= 80)
    return { color: "var(--green)", label: "criteria clearly met or clearly not" };
  if (pct >= 60)
    return { color: "var(--amber)", label: "favoured, but a reader could disagree" };
  return { color: "var(--red)", label: "evidence thin or contested" };
}

interface SearchStep {
  query: string;
  citations: Citation[];
}

type FinalOutput = {
  marketId: number;
  verdict: "RESOLVED" | "UNRESOLVABLE";
  winningOption: number;
  confidencePct: number;
  reason?: "source-silent" | "source-contradicts" | "not-yet-decided" | null;
  evidenceSummary: string;
  citations: Citation[];
  latencyMs?: number;
  model?: string;
};

const REASON_LABEL: Record<string, string> = {
  "source-silent": "the record is silent on the deciding fact",
  "source-contradicts": "authoritative sources contradict each other",
  "not-yet-decided": "the deadline has not passed",
};

type RunState =
  | { kind: "idle" }
  | { kind: "streaming"; reasoning: string }
  | { kind: "done"; output: FinalOutput }
  | { kind: "error"; message: string };

const AGENT_SS58 = "5DCSpFkHzKd6G9LZ5ytjKLyPiUMYrofxpkEjuhNXTreRDfwq";
const ADJUDICATOR_PROFILE = `https://explorer.theseus.network/agents/${AGENT_SS58}`;

export default function AdjudicatePage() {
  // Lead with the headline UMA dispute: a $7M market a whale forced to the
  // wrong answer, where the agent reads the record and isn't moved.
  const [selectedId, setSelectedId] = useState<string>(
    MARKETS.find((m) => m.id === "ukraine-minerals-2025")?.id ?? MARKETS[0].id,
  );
  // When set, this Polymarket market supersedes the synthetic selection.
  // Cleared whenever the user clicks one of the static presets.
  const [liveMarket, setLiveMarket] = useState<PredictionMarket | null>(null);
  const [run, setRun] = useState<RunState>({ kind: "idle" });
  const [searchSteps, setSearchSteps] = useState<SearchStep[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get("market");
    if (id && MARKETS.some((m) => m.id === id)) setSelectedId(id);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    if (selectedId !== MARKETS[0].id) params.set("market", selectedId);
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      qs ? `?${qs}` : window.location.pathname,
    );
  }, [selectedId]);

  const market: PredictionMarket =
    liveMarket ?? MARKETS.find((m) => m.id === selectedId) ?? MARKETS[0];
  const isLive = liveMarket !== null;

  const adjudicate = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setRun({ kind: "streaming", reasoning: "" });
    setSearchSteps([]);

    try {
      // Live Polymarket picks aren't in the server's static MARKETS
      // registry; pass the full market payload inline so the agent
      // gets the same shape it expects.
      const requestBody = isLive
        ? { market }
        : { marketId: market.id };
      const res = await fetch("/api/agent/adjudicate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `http ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let final: FinalOutput | null = null;
      let reasoning = "";

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
              if (parsed.type === "search_started" && typeof parsed.query === "string") {
                setSearchSteps((prev) => [
                  ...prev,
                  { query: parsed.query, citations: [] },
                ]);
              } else if (parsed.type === "search_results" && Array.isArray(parsed.citations)) {
                setSearchSteps((prev) => {
                  if (prev.length === 0) return prev;
                  const next = prev.slice();
                  const lastIdx = next.length - 1;
                  next[lastIdx] = {
                    ...next[lastIdx],
                    citations: parsed.citations as Citation[],
                  };
                  return next;
                });
              } else if (parsed.type === "text_delta" && typeof parsed.text === "string") {
                reasoning += parsed.text;
                setRun({ kind: "streaming", reasoning });
              } else if (parsed.type === "final" && parsed.output) {
                final = parsed.output as FinalOutput;
                setRun({ kind: "done", output: final });
              } else if (parsed.type === "error") {
                throw new Error(parsed.error ?? "stream error");
              }
            } catch {
              /* ignore parse errors on non-event lines */
            }
          }
        }
      }

      if (!final) throw new Error("stream ended without verdict");
    } catch (e: unknown) {
      if (ctrl.signal.aborted) return;
      const msg = e instanceof Error ? e.message : String(e);
      setRun({ kind: "error", message: msg });
    }
  }, [market, isLive]);

  useEffect(() => {
    abortRef.current?.abort();
    setRun({ kind: "idle" });
    setSearchSteps([]);
  }, [selectedId, liveMarket?.id]);

  // Live Polymarket markets, lazy-loaded on first <details> expansion
  // so the initial render stays fast and we don't spend an upstream
  // request on visitors who never open the section.
  const [liveOpen, setLiveOpen] = useState(false);
  const [liveList, setLiveList] = useState<PolymarketLiveMarket[] | null>(
    null,
  );
  const [liveErr, setLiveErr] = useState<string | null>(null);

  const fetchLive = useCallback(async () => {
    if (liveList || liveErr) return;
    try {
      const res = await fetch("/api/adjudicate/polymarket");
      if (!res.ok) throw new Error(`http ${res.status}`);
      const j = (await res.json()) as { markets: PolymarketLiveMarket[] };
      setLiveList(j.markets);
    } catch (e) {
      setLiveErr((e as Error).message);
    }
  }, [liveList, liveErr]);

  const handleLivePick = useCallback((pm: PolymarketLiveMarket) => {
    setLiveMarket(pm.market);
  }, []);

  const summaryTarget =
    run.kind === "done" ? run.output.evidenceSummary : "";
  const typedSummary = useTypewriter(summaryTarget);
  const typewriterCaughtUp =
    !!summaryTarget && typedSummary.length >= summaryTarget.length;
  const stillTyping = !!summaryTarget && !typewriterCaughtUp;

  const isStreaming = run.kind === "streaming";
  const isDone = run.kind === "done";
  const daysAway = daysUntil(market.deadlineISO);
  const deadlineFuture = daysAway > 0;
  const trimmedReasoning =
    run.kind === "streaming" ? run.reasoning.trim() : "";
  // The model appends the verdict JSON as the last line; hide it from
  // the streaming view so users don't see a half-rendered payload.
  const displayedReasoning = (() => {
    const lastBrace = trimmedReasoning.lastIndexOf("\n{");
    if (lastBrace > 0 && trimmedReasoning.trimEnd().endsWith("}")) {
      return trimmedReasoning.slice(0, lastBrace).trim();
    }
    return trimmedReasoning;
  })();

  return (
    <>
      <AdjudicatorJsonLd />
      <TopBar mode="mock" />
      <main className="min-h-screen px-3 sm:px-4 md:px-8 pb-12">
        <div className="mx-auto max-w-[640px] pt-12">
          <div className="mb-10 flex items-baseline justify-between gap-4">
            <a
              href="/"
              className="text-[11px] uppercase tracking-[0.18em] text-fg-mute transition-colors hover:text-fg"
            >
              ← directory
            </a>
            <a
              href={ADJUDICATOR_PROFILE}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] uppercase tracking-[0.18em] text-fg-mute transition-colors hover:text-fg"
            >
              on chain ↗
            </a>
          </div>

          <p className="mb-12 text-[13.5px] leading-[1.7] text-fg-mute">
            This agent resolves prediction markets by searching the web and
            reading the primary sources. It only commits a result when the
            evidence clears an 80% confidence bar. When the record is too thin or
            too split to call, it returns UNRESOLVABLE. It runs on its own on the
            Theseus testnet, and the exact instructions it follows are posted
            publicly.
          </p>

          <div className="mb-3">
            <TryItHeader>
              Pick a market. The agent searches the web for evidence and returns
              a verdict.
            </TryItHeader>
          </div>
          <div className="border-t border-border">
            {MARKETS.map((m) => {
              const active = !isLive && m.id === market.id;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    setLiveMarket(null);
                    setSelectedId(m.id);
                  }}
                  className="block w-full border-b border-border py-3 text-left transition-colors hover:bg-fg/[0.02]"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span
                      className={`text-[13.5px] leading-snug ${active ? "text-fg" : "text-fg-mute"}`}
                    >
                      {m.question}
                    </span>
                    <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-fg-mute shrink-0">
                      {active ? "selected" : m.category}
                    </span>
                  </div>
                </button>
              );
            })}
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
              or load a live Polymarket market ↓
            </summary>
            <p className="mt-3 text-[12px] leading-relaxed text-fg-mute">
              Pulled from{" "}
              <a
                href="https://polymarket.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-border underline-offset-[3px] hover:text-fg hover:decoration-fg"
              >
                Polymarket
              </a>
              &rsquo;s public Gamma API. Top binary markets by 24h volume,
              with at least two weeks until resolution. Pick one; the same
              search → evidence → verdict pipeline runs against it.
            </p>
            <div className="mt-4">
              {liveOpen && !liveList && !liveErr && (
                <p className="text-[12px] text-fg-mute">Loading…</p>
              )}
              {liveErr && (
                <p
                  className="text-[12px]"
                  style={{ color: "var(--coral)" }}
                >
                  Couldn&rsquo;t reach Polymarket: {liveErr}
                </p>
              )}
              {liveList && liveList.length === 0 && (
                <p className="text-[12px] text-fg-mute">
                  No qualifying markets returned. Try again later.
                </p>
              )}
              {liveList && liveList.length > 0 && (
                <ul className="border-t border-border">
                  {liveList.map((pm) => {
                    const active =
                      isLive && liveMarket?.id === pm.market.id;
                    const yesPct =
                      pm.yesPrice !== null
                        ? Math.round(pm.yesPrice * 100)
                        : null;
                    return (
                      <li
                        key={pm.conditionId}
                        className="border-b border-border last:border-b-0"
                      >
                        <button
                          type="button"
                          onClick={() => handleLivePick(pm)}
                          className="block w-full py-3 text-left transition-colors hover:bg-fg/[0.02]"
                        >
                          <div className="flex items-baseline justify-between gap-3">
                            <span
                              className={`text-[13.5px] leading-snug ${active ? "text-fg" : "text-fg-mute"}`}
                            >
                              {pm.market.question}
                            </span>
                            <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-fg-mute shrink-0">
                              {active ? "selected" : `${(pm.volume24hUsd / 1000).toFixed(0)}k vol`}
                            </span>
                          </div>
                          <p className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-fg-mute">
                            {yesPct !== null && (
                              <>
                                YES {yesPct}%
                                {" · "}
                              </>
                            )}
                            ends {pm.market.deadline}
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
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
                question
              </p>
              <span className="font-mono text-[10.5px] text-fg-mute">
                deadline · {market.deadline}
              </span>
            </div>
            <h2 className="serif mt-2 text-[20px] leading-snug tracking-tight">
              {market.question}
            </h2>

            <ol className="mt-5 space-y-1.5">
              {market.options.map((opt, i) => (
                <li key={i} className="flex items-baseline gap-3">
                  <span className="font-mono text-[11px] text-fg-mute w-5 shrink-0">
                    [{i}]
                  </span>
                  <span className="text-[13.5px] text-fg">{opt}</span>
                </li>
              ))}
            </ol>

            <p className="mt-5 text-[13px] leading-relaxed text-fg-mute">
              {market.resolutionCriteria}
            </p>
            <p className="mt-3 font-mono text-[10.5px] uppercase tracking-[0.16em] text-fg-mute">
              verification source · <span className="text-fg-dim">{market.resolutionSource}</span>
            </p>
          </div>

          {run.kind === "idle" && deadlineFuture && (
            <div className="mt-10 border-t border-border pt-6">
              <p className="text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
                not yet resolvable
              </p>
              <p className="mt-3 text-[13.5px] leading-[1.7] text-fg-mute">
                The deadline ({market.deadline}) is{" "}
                <span className="text-fg">
                  {daysAway} {daysAway === 1 ? "day" : "days"}
                </span>{" "}
                away. Any verdict before then would just be a forecast, so
                the agent doesn&rsquo;t run.
              </p>
            </div>
          )}

          {run.kind === "idle" && !deadlineFuture && (
            <button
              onClick={adjudicate}
              className="cta-ink mt-10 inline-flex items-center gap-2 px-6 py-3 text-[13px]"
            >
              Adjudicate this market →
            </button>
          )}

          {isStreaming && (
            <p className="mt-10 font-mono text-[11px] uppercase tracking-[0.18em] text-coral">
              agent searching and reasoning…
            </p>
          )}

          {/* The decision, up top and impossible to miss. The search trace
              and reasoning sit below it as the supporting record. */}
          {isDone &&
            (() => {
              const out = run.output;
              const resolved = out.verdict === "RESOLVED";
              const vColor = resolved ? "var(--coral)" : "var(--amber)";
              const tier = resolved ? confidenceTier(out.confidencePct) : null;
              return (
                <div className="mt-10">
                  <div
                    className="rounded-xl border p-5 sm:p-6"
                    style={{
                      borderColor: `color-mix(in srgb, ${vColor} 55%, var(--border))`,
                      background: `color-mix(in srgb, ${vColor} 6%, transparent)`,
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em]"
                        style={{ color: vColor }}
                      >
                        {resolved ? "Resolved" : "Unresolvable"}
                      </span>
                      <span className="font-mono text-[10px] text-fg-mute">
                        {out.model} · {out.latencyMs ?? "?"}ms
                      </span>
                    </div>

                    {resolved ? (
                      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="font-mono text-[13px] text-fg-dim">
                          [{out.winningOption}]
                        </span>
                        <span className="serif text-[34px] leading-[1.1] tracking-tight text-fg sm:text-[42px]">
                          {market.options[out.winningOption] ?? "?"}
                        </span>
                      </div>
                    ) : (
                      <p className="serif mt-2 text-[30px] leading-[1.1] tracking-tight text-fg sm:text-[38px]">
                        The record doesn&rsquo;t settle it
                      </p>
                    )}

                    {!resolved && out.reason && (
                      <p className="mt-3 text-[13px] leading-relaxed text-fg-dim">
                        {REASON_LABEL[out.reason] ?? out.reason}. A wrong
                        resolution pays the market out on the wrong truth and
                        can&rsquo;t be undone, so this goes to human dispute
                        instead.
                      </p>
                    )}

                    <p className="mt-3 text-[14px] leading-[1.75] text-fg-dim">
                      &ldquo;{typedSummary}&rdquo;
                      {!typewriterCaughtUp && (
                        <span className="ml-0.5 inline-block h-[1em] w-[6px] animate-pulse bg-coral align-text-bottom" />
                      )}
                    </p>

                    {resolved && tier && (
                      <div className="mt-4">
                        <div className="mb-1 flex items-baseline justify-between">
                          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-fg-mute">
                            confidence · calibrated
                          </span>
                          <span
                            className="font-mono text-[12px] tabular-nums"
                            style={{ color: tier.color }}
                          >
                            {out.confidencePct}%
                          </span>
                        </div>
                        <div
                          className="h-2 w-full overflow-hidden rounded-full"
                          style={{ background: "var(--border)" }}
                        >
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${out.confidencePct}%`,
                              background: tier.color,
                            }}
                          />
                        </div>
                        <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-mute">
                          {tier.label}
                        </p>
                      </div>
                    )}
                  </div>

                  {out.citations.length > 0 && (
                    <div className="mt-5">
                      <p className="mb-2 text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
                        sources cited
                      </p>
                      <ul className="space-y-1">
                        {out.citations.slice(0, 6).map((c, i) => (
                          <li key={i}>
                            <a
                              href={c.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[12.5px] leading-snug text-fg-dim hover:text-coral hover:underline"
                            >
                              <span className="font-mono text-[10.5px] mr-2">
                                {hostname(c.url)}
                              </span>
                              {c.title || c.url}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {resolved && market.actualResolution && (
                    <div className="mt-5">
                      <p className="text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
                        polymarket&rsquo;s actual resolution
                      </p>
                      <div className="mt-2 flex items-baseline gap-3">
                        <span className="font-mono text-[11px] text-fg">
                          [{market.actualResolution.winningOption}]{" "}
                          {market.options[market.actualResolution.winningOption]}
                        </span>
                        <span
                          className="font-mono text-[10.5px] uppercase tracking-[0.16em]"
                          style={{
                            color:
                              market.actualResolution.winningOption ===
                              out.winningOption
                                ? "var(--fg)"
                                : "var(--coral)",
                          }}
                        >
                          {market.actualResolution.winningOption ===
                          out.winningOption
                            ? "agreed"
                            : "disagreed"}
                        </span>
                      </div>
                      <p className="mt-2 text-[12.5px] leading-relaxed text-fg-dim">
                        {market.actualResolution.note}
                      </p>
                    </div>
                  )}

                  {!resolved && market.outcomeNote && (
                    <div className="mt-5">
                      <p className="text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
                        what happened
                      </p>
                      <p className="mt-2 text-[12.5px] leading-relaxed text-fg-dim">
                        {market.outcomeNote}
                      </p>
                    </div>
                  )}

                  {!stillTyping && (
                    <button
                      onClick={adjudicate}
                      className="mt-6 font-mono text-[11px] uppercase tracking-[0.18em] text-fg-mute hover:text-fg hover:underline"
                    >
                      re-run →
                    </button>
                  )}
                </div>
              );
            })()}

          {(isStreaming || isDone || searchSteps.length > 0) && (
            <div className="mt-10">
              <p className="mb-3 text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
                search trace
              </p>
              {searchSteps.length > 0 ? (
                <ol className="border-t border-border">
                  {searchSteps.map((step, i) => {
                    const isLast = i === searchSteps.length - 1;
                    const pending =
                      isStreaming && isLast && step.citations.length === 0;
                    return (
                      <li key={i} className="border-b border-border py-3">
                        <p className="text-[13.5px] text-fg leading-snug">
                          {step.query}
                        </p>
                        {pending ? (
                          <p className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-fg-mute">
                            waiting for results…
                          </p>
                        ) : step.citations.length > 0 ? (
                          <ul className="mt-2 space-y-1">
                            {step.citations.map((c, j) => (
                              <li key={j}>
                                <a
                                  href={c.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[12.5px] leading-snug text-fg-mute hover:text-coral hover:underline"
                                >
                                  <span className="font-mono text-[10.5px] mr-2">
                                    {hostname(c.url)}
                                  </span>
                                  {c.title || c.url}
                                </a>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-fg-mute">
                            no citations returned
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="text-[13px] leading-relaxed text-fg-mute">
                  The agent will issue web searches for evidence and pull
                  citations from authoritative sources. Each query and the
                  domains it found will appear here.
                </p>
              )}

              {displayedReasoning && (
                <div className="mt-4">
                  <p className="mb-2 text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
                    agent reasoning
                  </p>
                  <p className="text-[12.5px] leading-relaxed text-fg-mute whitespace-pre-wrap">
                    {displayedReasoning}
                    {isStreaming && (
                      <span className="ml-0.5 inline-block w-[6px] h-[1em] bg-coral align-text-bottom animate-pulse" />
                    )}
                  </p>
                </div>
              )}
            </div>
          )}

          {run.kind === "error" && (
            <div className="mt-10 border-t border-border pt-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-coral">
                agent unreachable
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-fg-mute">
                {run.message}
              </p>
              <button
                onClick={adjudicate}
                className="mt-3 font-mono text-[11px] uppercase tracking-[0.18em] text-fg-mute hover:text-fg hover:underline"
              >
                try again →
              </button>
            </div>
          )}

          <DemoCTA />
        </div>
      </main>
    </>
  );
}
