"use client";

import { useRef, useState } from "react";
import { applySettlement, usePredict } from "@/lib/predict/store";
import { fmtDate, isPast } from "@/lib/predict/format";
import type { Outcome, SeedMarket, Settlement } from "@/lib/predict/types";

const AGENT_SS58 = "5DCSpFkHzKd6G9LZ5ytjKLyPiUMYrofxpkEjuhNXTreRDfwq";
const EXPLORER = `https://explorer.theseus.network/agents/${AGENT_SS58}`;

const REASON_LABEL: Record<string, string> = {
  "source-silent": "the record is silent on the deciding fact",
  "source-contradicts": "credible sources contradict each other",
  "not-yet-decided": "the deadline has not passed",
};

interface SearchStep {
  query: string;
  domains: string[];
}

export default function ResolvePanel({ seed }: { seed: SeedMarket }) {
  const state = usePredict();
  const settlement = state.settlements[seed.id];
  const [status, setStatus] = useState<"idle" | "running" | "error">("idle");
  const [reasoning, setReasoning] = useState("");
  const [steps, setSteps] = useState<SearchStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const settle = async () => {
    setStatus("running");
    setReasoning("");
    setSteps([]);
    setError(null);
    try {
      const payload = {
        id: seed.slug,
        marketId: seed.id,
        category: seed.category,
        question: seed.question,
        options: ["YES", "NO"],
        deadline: fmtDate(seed.deadlineISO),
        deadlineISO: seed.deadlineISO,
        resolutionCriteria: seed.resolutionCriteria,
        resolutionSource: seed.resolutionSource,
      };
      const res = await fetch("/api/agent/adjudicate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ market: payload }),
      });
      if (!res.ok || !res.body) throw new Error((await res.text()) || `http ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let text = "";
      let final: Settlement | null = null;

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
            let parsed: Record<string, unknown>;
            try {
              parsed = JSON.parse(data);
            } catch {
              continue;
            }
            if (parsed.type === "search_started" && typeof parsed.query === "string") {
              setSteps((p) => [...p, { query: parsed.query as string, domains: [] }]);
            } else if (parsed.type === "search_results" && Array.isArray(parsed.citations)) {
              const domains = (parsed.citations as { url: string }[]).map((c) => {
                try {
                  return new URL(c.url).hostname.replace(/^www\./, "");
                } catch {
                  return c.url;
                }
              });
              setSteps((p) => {
                if (!p.length) return p;
                const next = p.slice();
                next[next.length - 1] = { ...next[next.length - 1], domains: [...new Set(domains)].slice(0, 6) };
                return next;
              });
            } else if (parsed.type === "text_delta" && typeof parsed.text === "string") {
              text += parsed.text;
              // hide the trailing JSON verdict line from the live view
              const cut = text.lastIndexOf("\n{");
              setReasoning(cut > 0 && text.trimEnd().endsWith("}") ? text.slice(0, cut) : text);
              requestAnimationFrame(() => {
                if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
              });
            } else if (parsed.type === "final" && parsed.output) {
              const o = parsed.output as {
                verdict: "RESOLVED" | "UNRESOLVABLE";
                winningOption: number;
                confidencePct: number;
                reason?: Settlement["reason"];
                evidenceSummary?: string;
                citations?: { url: string; title?: string }[];
              };
              const winningOutcome: Outcome | null =
                o.verdict === "RESOLVED" ? (o.winningOption === 0 ? "YES" : "NO") : null;
              final = {
                marketId: seed.id,
                verdict: o.verdict,
                winningOutcome,
                confidencePct: o.confidencePct ?? 0,
                reason: o.reason ?? null,
                evidenceSummary: o.evidenceSummary ?? "",
                citations: o.citations ?? [],
                settledAt: Date.now(),
              };
            } else if (parsed.type === "error") {
              throw new Error((parsed.error as string) ?? "stream error");
            }
          }
        }
      }
      if (!final) throw new Error("the agent did not return a verdict");
      applySettlement(final);
      setStatus("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  };

  // ---- already settled: show the verdict + evidence ----
  if (settlement) {
    const resolved = settlement.verdict === "RESOLVED";
    const color = !resolved
      ? "var(--amber)"
      : settlement.winningOutcome === "YES"
        ? "var(--green)"
        : "var(--red)";
    return (
      <div className="rounded-xl border border-border bg-surface/40 p-5">
        <Header />
        <div
          className="mt-3 rounded-lg border p-4"
          style={{
            borderColor: `color-mix(in srgb, ${color} 50%, var(--border))`,
            background: `color-mix(in srgb, ${color} 6%, transparent)`,
          }}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color }}>
              {resolved ? `Resolved ${settlement.winningOutcome}` : "Unresolvable"}
            </span>
            {resolved && (
              <span className="font-mono text-[12px] tabular-nums" style={{ color }}>
                {settlement.confidencePct}% confidence
              </span>
            )}
          </div>
          {!resolved && settlement.reason && (
            <p className="mt-2 text-[13px] leading-relaxed text-fg-dim">
              The agent declined to commit because {REASON_LABEL[settlement.reason] ?? settlement.reason}. Positions were refunded.
            </p>
          )}
          {settlement.evidenceSummary && (
            <p className="mt-3 text-[13px] leading-relaxed text-fg-dim">
              &ldquo;{settlement.evidenceSummary}&rdquo;
            </p>
          )}
          {settlement.citations.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {settlement.citations.slice(0, 6).map((c, i) => (
                <a
                  key={i}
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md border border-border px-2 py-0.5 font-mono text-[10.5px] text-fg-mute hover:text-coral"
                >
                  {hostname(c.url)}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---- not yet at the deadline ----
  if (!isPast(seed.deadlineISO)) {
    return (
      <div className="rounded-xl border border-border bg-surface/40 p-5">
        <Header />
        <p className="mt-3 text-[13px] leading-relaxed text-fg-dim">
          This market is live. When it closes on{" "}
          <span className="text-fg">{fmtDate(seed.deadlineISO)}</span>, a Theseus
          agent looks up what happened and settles it from the sources. If they
          don&rsquo;t clearly answer, it refuses to guess and refunds everyone
          instead. There&rsquo;s no token vote here for a big holder to swing.
        </p>
        <a
          href="/adjudicate"
          className="mt-3 inline-block font-mono text-[11px] text-coral hover:underline"
        >
          See the agent settle real markets →
        </a>
      </div>
    );
  }

  // ---- past deadline, awaiting settlement ----
  return (
    <div className="rounded-xl border border-border bg-surface/40 p-5">
      <Header />
      {status === "idle" && (
        <>
          <p className="mt-3 text-[13px] leading-relaxed text-fg-dim">
            The deadline has passed. Run the Theseus adjudicator to settle this
            market from the public record.
          </p>
          <button
            onClick={settle}
            className="mt-4 w-full rounded-lg bg-coral py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-coral-dim"
          >
            Settle with the agent →
          </button>
        </>
      )}

      {status === "running" && (
        <div className="mt-3">
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-coral">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-coral" />
            Agent reading the record…
          </p>
          {steps.length > 0 && (
            <ul className="mt-3 space-y-2">
              {steps.map((s, i) => (
                <li key={i} className="text-[12.5px]">
                  <p className="text-fg">{s.query}</p>
                  {s.domains.length > 0 && (
                    <p className="mt-0.5 font-mono text-[10.5px] text-fg-mute">{s.domains.join(" · ")}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
          {reasoning && (
            <div
              ref={scroller}
              className="mt-3 max-h-40 overflow-y-auto rounded-lg border border-border bg-bg p-3 text-[12.5px] leading-relaxed text-fg-dim whitespace-pre-wrap"
            >
              {reasoning}
              <span className="ml-0.5 inline-block h-[1em] w-[6px] animate-pulse bg-coral align-text-bottom" />
            </div>
          )}
        </div>
      )}

      {status === "error" && (
        <div className="mt-3">
          <p className="text-[13px] text-red">Settlement failed: {error}</p>
          <button
            onClick={settle}
            className="mt-3 rounded-lg border border-border px-4 py-2 text-[13px] text-fg hover:border-fg/30"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-center justify-between">
      <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
        Resolution
      </p>
      <a
        href={EXPLORER}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-[10.5px] text-fg-mute hover:text-coral"
      >
        agent on chain ↗
      </a>
    </div>
  );
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
