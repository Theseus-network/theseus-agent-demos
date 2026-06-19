"use client";

import { useState } from "react";
import { AGENT_MARKET } from "@/lib/deployed-contracts";

const EXPLORER = "https://sepolia.basescan.org";
const PANEL = "rounded-2xl border border-white/[0.07] bg-white/[0.03]";

const PRESETS = [
  {
    label: "Ship code",
    budget: 110,
    task: "Write a production-ready Python FastAPI signup endpoint: validate the email, hash the password with bcrypt, reject duplicate emails, and rate-limit to 5 requests per minute per IP. Include the route and one pytest test. Output code only.",
  },
  {
    label: "Draft an NDA",
    budget: 70,
    task: "Draft a mutual NDA section covering: a definition of Confidential Information, a 3-year confidentiality term, standard carve-outs (already public, independently developed, legally compelled to disclose), and a return-or-destroy obligation on termination. Output the clause text only.",
  },
  {
    label: "Research",
    budget: 50,
    task: "Produce a well-sourced, five-point brief on what actually caused the 2019 grounding of the Boeing 737 MAX. Cite your sources. Output only the brief.",
  },
  {
    label: "Make the call",
    budget: 35,
    task: "A SaaS startup at $45k MRR growing 8% a month with 18 months of runway is deciding: raise a seed round now, or bootstrap another six months. Give a one-line recommendation and the three factors that decide it.",
  },
];

type Stage = "idle" | "posted" | "funded" | "working" | "delivered" | "verifying" | "settled";
const STAGE_ORDER: Stage[] = ["posted", "funded", "working", "delivered", "verifying", "settled"];

interface Verdict {
  verdict: "RELEASE" | "REFUND" | "UNRESOLVABLE";
  confidencePct: number;
  evidenceSummary: string;
  reason: string;
}

const AGENTS = [
  { key: "req", name: "Atlas", role: "Requester", sub: "needs work done", addr: AGENT_MARKET.requester, icon: "buyer", stages: ["posted", "funded"] as Stage[] },
  { key: "prov", name: "Scribe", role: "Provider", sub: "does the work", addr: AGENT_MARKET.provider, icon: "worker", stages: ["working", "delivered"] as Stage[] },
  { key: "adj", name: "Adjudicator", role: "Theseus agent", sub: "verifies & settles", addr: "agent", icon: "agent", stages: ["verifying", "settled"] as Stage[] },
];

function AgentIcon({ name }: { name: string }) {
  const c = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "buyer") return <svg {...c}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>;
  if (name === "worker") return <svg {...c}><path d="M4 7h16M4 7l1.5 12h13L20 7M9 7V5a3 3 0 0 1 6 0v2" /></svg>;
  return <svg {...c}><rect x="5" y="7" width="14" height="12" rx="3" /><path d="M9 12h.01M15 12h.01M12 3v4M8.5 19l-1 2M15.5 19l1 2" /></svg>;
}

function short(a: string) {
  return a === "agent" ? "Theseus" : `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export default function AgentMarket() {
  const [task, setTask] = useState(PRESETS[0].task);
  const [budget, setBudget] = useState(String(PRESETS[0].budget));
  const [mode, setMode] = useState<"diligent" | "lazy">("diligent");
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [funded, setFunded] = useState<{ dealId: number; url: string } | null>(null);
  const [deliverTx, setDeliverTx] = useState<string | null>(null);
  const [work, setWork] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [settle, setSettle] = useState<{ paid: boolean; url: string; reputation: { jobs: number; paid: number } } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const stageIdx = stage === "idle" ? -1 : STAGE_ORDER.indexOf(stage);
  const activeAgent = AGENTS.find((a) => a.stages.includes(stage))?.key ?? null;

  async function run() {
    setRunning(true);
    setStage("posted");
    setFunded(null); setDeliverTx(null); setWork(""); setReasoning(""); setVerdict(null); setSettle(null); setErr(null);
    try {
      const res = await fetch("/api/market/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: task.trim(), budget: Number(budget), mode }),
      });
      if (!res.body) throw new Error("no stream");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const p of parts) {
          const dl = p.match(/^data: (.*)$/m)?.[1];
          if (!dl) continue;
          let d: Record<string, unknown>;
          try { d = JSON.parse(dl); } catch { continue; }
          const t = d.type as string;
          if (t === "funded") { setStage("funded"); setFunded({ dealId: Number(d.dealId), url: String(d.url) }); }
          else if (t === "working") setStage("working");
          else if (t === "work") { setStage("delivered"); setWork(String(d.work)); }
          else if (t === "delivered") setDeliverTx(String(d.txHash));
          else if (t === "verifying") setStage("verifying");
          else if (t === "reasoning") setReasoning((r) => r + String(d.text ?? ""));
          else if (t === "settled") { setStage("settled"); setVerdict(d.verdict as unknown as Verdict); setSettle({ paid: Boolean(d.paid), url: String(d.url), reputation: d.reputation as { jobs: number; paid: number } }); }
          else if (t === "error") setErr(String(d.message));
        }
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "job failed");
    } finally {
      setRunning(false);
    }
  }

  const budgetN = Number(budget) || 0;

  return (
    <main className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
      {/* Hero */}
      <section className="relative pt-12 sm:pt-16">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:54px_54px] [mask-image:radial-gradient(ellipse_60%_55%_at_40%_0%,black,transparent_75%)]" />
          <div className="absolute -top-36 -left-24 h-[460px] w-[460px] rounded-full bg-[#6366F1]/22 blur-[130px]" />
          <div className="absolute -top-24 right-0 h-[420px] w-[420px] rounded-full bg-[#8B5CF6]/18 blur-[130px]" />
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-[#AAB2C5]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#34D399]" /> Live on Base Sepolia
        </span>
        <h1 className="mt-5 max-w-2xl font-serif text-[38px] font-medium leading-[1.04] tracking-tight text-white sm:text-[52px]">
          When agents pay agents, who checks the work?
        </h1>
        <p className="mt-5 max-w-xl text-[15.5px] leading-relaxed text-[#AAB2C5]">
          One agent hires another and the money is held until the job is done. A Theseus agent reads
          the delivery against the brief, pays for good work, and refunds bad work. Run one and watch.
        </p>
      </section>

      {/* Agents */}
      <section className="mt-10 grid gap-3 sm:grid-cols-3">
        {AGENTS.map((a, i) => {
          const active = activeAgent === a.key && running;
          const done = stageIdx >= 0 && Math.max(...a.stages.map((s) => STAGE_ORDER.indexOf(s))) <= stageIdx && !active;
          return (
            <div key={a.key} className={`${PANEL} relative p-4 transition-colors ${active ? "border-[#6366F1]/50 bg-[#6366F1]/[0.07]" : ""}`}>
              <div className="flex items-center gap-3">
                <span className={`flex h-11 w-11 items-center justify-center rounded-xl border ${active ? "border-[#6366F1]/50 bg-gradient-to-br from-[#6366F1]/30 to-[#8B5CF6]/20 text-white shadow-[0_0_24px_rgba(99,102,241,0.4)]" : "border-white/10 bg-white/[0.04] text-[#A5B0FF]"}`}>
                  <AgentIcon name={a.icon} />
                </span>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[14px] font-semibold text-white">{a.name}</span>
                    <span className="font-mono text-[9px] uppercase tracking-wide text-[#6B7488]">0{i + 1}</span>
                  </div>
                  <div className="text-[11.5px] text-[#8A93A6]">{a.role} · {a.sub}</div>
                </div>
              </div>
              <div className="mt-2.5 flex items-center justify-between font-mono text-[10.5px] text-[#6B7488]">
                <span>{short(a.addr)}</span>
                {active && <span className="text-[#A5B0FF]">working…</span>}
                {done && <span className="text-[#34D399]">✓</span>}
              </div>
            </div>
          );
        })}
      </section>

      {/* Controls */}
      <section className={`${PANEL} mt-5 p-5`}>
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <button key={p.label} disabled={running} onClick={() => { setTask(p.task); setBudget(String(p.budget)); }} className={`rounded-lg border px-3 py-1.5 text-[12.5px] font-medium transition-colors disabled:opacity-50 ${task === p.task ? "border-[#6366F1]/50 bg-[#6366F1]/10 text-[#A5B0FF]" : "border-white/10 text-[#AAB2C5] hover:text-white"}`}>
              {p.label}
            </button>
          ))}
        </div>
        <textarea value={task} onChange={(e) => setTask(e.target.value)} disabled={running} rows={3} className="mt-3 max-h-44 w-full resize-y overflow-auto rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 font-mono text-[12.5px] leading-relaxed text-[#D4D9E4] outline-none focus:border-[#6366F1] disabled:opacity-60" />
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-[12.5px] text-[#8A93A6]">
            Budget
            <input value={budget} onChange={(e) => setBudget(e.target.value)} disabled={running} inputMode="decimal" className="w-20 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 font-mono text-[13px] text-white outline-none focus:border-[#6366F1]" />
            <span className="font-mono text-[12px] text-[#6B7488]">{AGENT_MARKET.usdcSymbol}</span>
          </label>
          <div className="flex items-center overflow-hidden rounded-lg border border-white/10">
            {(["diligent", "lazy"] as const).map((m) => (
              <button key={m} disabled={running} onClick={() => setMode(m)} className={`px-3 py-1.5 text-[12px] font-medium transition-colors disabled:opacity-50 ${mode === m ? (m === "lazy" ? "bg-[#FBBF24]/15 text-[#FBBF24]" : "bg-[#34D399]/15 text-[#34D399]") : "text-[#6B7488] hover:text-white"}`}>
                {m === "diligent" ? "Honest provider" : "Scam provider"}
              </button>
            ))}
          </div>
          <button onClick={run} disabled={running || task.trim().length < 8 || budgetN <= 0} className="ml-auto rounded-xl bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] px-5 py-2.5 text-[14px] font-semibold text-white shadow-[0_8px_30px_rgba(99,102,241,0.35)] transition-shadow hover:shadow-[0_8px_44px_rgba(99,102,241,0.6)] disabled:opacity-40 disabled:shadow-none">
            {running ? "Running…" : "Run the job →"}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-[#6B7488]">
          &ldquo;Scam provider&rdquo; takes the money and submits filler. Watch the adjudicator catch it and refund Atlas.
        </p>
      </section>

      {/* Live job */}
      {(running || funded || verdict || err) && (
        <section className="mt-5 space-y-3">
          {funded && (
            <Row label="Atlas funded the job" tone="indigo" tx={funded.url}>
              {budgetN} {AGENT_MARKET.usdcSymbol} locked in escrow · deal #{funded.dealId}
            </Row>
          )}
          {work && (
            <Row label="Scribe delivered" tone="plain" tx={deliverTx ? `${EXPLORER}/tx/${deliverTx}` : undefined}>
              <span className="whitespace-pre-wrap text-[#D4D9E4]">{work}</span>
            </Row>
          )}
          {(stage === "verifying" || verdict) && (
            <div className={`${PANEL} p-4`}>
              <div className="flex items-center gap-2 text-[12.5px] font-semibold text-white">
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] text-white"><AgentIcon name="agent" /></span>
                Adjudicator {verdict ? "ruled" : "is reading the work…"}
              </div>
              {reasoning && !verdict && (
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-[11px] leading-relaxed text-[#AAB2C5]">{reasoning.slice(-700)}</pre>
              )}
              {verdict && (
                <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[17px] font-bold ${verdict.verdict === "RELEASE" ? "text-[#34D399]" : "text-[#FBBF24]"}`}>
                      {verdict.verdict === "RELEASE" ? "PAID" : "REFUNDED"}
                    </span>
                    <span className="text-[13px] text-[#AAB2C5]">
                      {verdict.verdict === "RELEASE" ? `${budgetN} ${AGENT_MARKET.usdcSymbol} → Scribe` : `${budgetN} ${AGENT_MARKET.usdcSymbol} back to Atlas`}
                    </span>
                    {verdict.verdict !== "UNRESOLVABLE" && <span className="text-[12px] text-[#6B7488]">{verdict.confidencePct}% confidence</span>}
                  </div>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-[#8A93A6]">{verdict.evidenceSummary}</p>
                  {settle && (
                    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-white/[0.07] pt-3 text-[12px]">
                      <span className="text-[#AAB2C5]">Scribe&rsquo;s reputation: <span className="font-mono text-white">{settle.reputation.paid}/{settle.reputation.jobs}</span> jobs passed</span>
                      <a href={settle.url} target="_blank" rel="noopener noreferrer" className="font-mono text-[#A5B0FF] hover:underline">settlement ↗</a>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {err && <p className="rounded-xl border border-[#F87171]/30 bg-[#F87171]/10 px-3 py-2 text-[12.5px] text-[#F87171]">{err}</p>}
        </section>
      )}
    </main>
  );
}

function Row({ label, tone, tx, children }: { label: string; tone: "indigo" | "plain"; tx?: string; children: React.ReactNode }) {
  return (
    <div className={`${PANEL} p-4`}>
      <div className="flex items-center justify-between">
        <span className={`text-[12.5px] font-semibold ${tone === "indigo" ? "text-[#A5B0FF]" : "text-white"}`}>{label}</span>
        {tx && <a href={tx} target="_blank" rel="noopener noreferrer" className="font-mono text-[11px] text-[#6B7488] hover:text-[#A5B0FF]">on chain ↗</a>}
      </div>
      <div className="mt-1.5 text-[13px] leading-relaxed text-[#AAB2C5]">{children}</div>
    </div>
  );
}
