"use client";

import { useRef, useState } from "react";
import type { ExampleDeal } from "@/lib/escrow/examples";

export interface Verdict {
  verdict: "RELEASE" | "REFUND" | "UNRESOLVABLE";
  confidencePct: number;
  reason: string;
  evidenceSummary: string;
  model?: string;
}

export const VCOLOR: Record<string, string> = {
  RELEASE: "var(--green)",
  REFUND: "var(--red)",
  UNRESOLVABLE: "var(--amber)",
};

export default function DealArbiter({
  deal,
  role,
  title,
  subtitle,
  onFinal,
}: {
  deal: ExampleDeal;
  role: "arbiter" | "sentinel";
  title: string;
  subtitle: string;
  onFinal?: (v: Verdict) => void;
}) {
  const [running, setRunning] = useState(false);
  const [reasoning, setReasoning] = useState("");
  const [steps, setSteps] = useState<string[]>([]);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  async function run() {
    setRunning(true);
    setReasoning("");
    setSteps([]);
    setVerdict(null);
    const res = await fetch("/api/escrow/adjudicate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealId: deal.id, spec: deal.spec, delivery: deal.delivery, amountLabel: deal.amountLabel, role }),
    });
    if (!res.body) {
      setReasoning("No response stream.");
      setRunning(false);
      return;
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let text = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const events = buf.split("\n\n");
      buf = events.pop() ?? "";
      for (const evt of events) {
        for (const line of evt.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (!data) continue;
          let p: Record<string, unknown>;
          try {
            p = JSON.parse(data);
          } catch {
            continue;
          }
          if (p.type === "search_started" && typeof p.query === "string") {
            setSteps((s) => [...s, p.query as string]);
          } else if (p.type === "text_delta" && typeof p.text === "string") {
            text += p.text;
            const cut = text.lastIndexOf("\n{");
            setReasoning(cut > 0 && text.trimEnd().endsWith("}") ? text.slice(0, cut) : text);
            requestAnimationFrame(() => {
              if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
            });
          } else if (p.type === "final" && p.output) {
            const v = p.output as Verdict;
            setVerdict(v);
            onFinal?.(v);
          } else if (p.type === "error") {
            setReasoning((r) => r + "\n[error] " + String(p.error));
          }
        }
      }
    }
    setRunning(false);
  }

  return (
    <div className="rounded-xl border border-border bg-surface/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[14px] font-semibold text-fg">{title}</h3>
          <p className="mt-0.5 text-[12px] text-fg-mute">{subtitle}</p>
        </div>
        {!verdict && (
          <button
            onClick={run}
            disabled={running}
            className="shrink-0 rounded-md bg-coral px-3 py-1.5 text-[12.5px] font-medium text-white transition-colors hover:bg-coral-dim disabled:opacity-50"
          >
            {running ? "Reading…" : role === "sentinel" ? "Appeal" : "Run"}
          </button>
        )}
      </div>

      {(running || reasoning) && (
        <div className="mt-3">
          {steps.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {steps.map((q, i) => (
                <span key={i} className="rounded-full border border-border px-2 py-0.5 text-[10.5px] text-fg-mute">
                  searched: {q.length > 40 ? q.slice(0, 40) + "…" : q}
                </span>
              ))}
            </div>
          )}
          <div
            ref={scroller}
            className="max-h-44 overflow-y-auto whitespace-pre-wrap text-[12.5px] leading-relaxed text-fg-dim"
          >
            {reasoning}
            {running && <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-coral align-middle" />}
          </div>
        </div>
      )}

      {verdict && (
        <div className="mt-3 border-t border-border pt-3">
          <div className="flex items-center gap-2">
            <span className="rounded-md px-2 py-0.5 text-[12px] font-semibold" style={{ color: VCOLOR[verdict.verdict], background: "color-mix(in srgb, " + VCOLOR[verdict.verdict] + " 14%, transparent)" }}>
              {verdict.verdict}
            </span>
            {verdict.verdict !== "UNRESOLVABLE" && (
              <span className="text-[12px] text-fg-mute">{verdict.confidencePct}% confidence</span>
            )}
            {verdict.model && <span className="ml-auto font-mono text-[10px] text-fg-mute">{verdict.model}</span>}
          </div>
          <p className="mt-2 text-[12.5px] leading-relaxed text-fg-dim">{verdict.evidenceSummary}</p>
        </div>
      )}
    </div>
  );
}
