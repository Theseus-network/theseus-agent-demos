"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EXAMPLE_DEALS } from "@/lib/escrow/examples";
import DealArbiter, { type Verdict, VCOLOR } from "@/components/escrow/DealArbiter";

export default function EscrowPage() {
  const [dealId, setDealId] = useState(EXAMPLE_DEALS[0].id);
  const [arbiter, setArbiter] = useState<Verdict | null>(null);
  const [sentinel, setSentinel] = useState<Verdict | null>(null);

  const deal = EXAMPLE_DEALS.find((d) => d.id === dealId)!;

  useEffect(() => {
    setArbiter(null);
    setSentinel(null);
  }, [dealId]);

  const settlement = (() => {
    if (!arbiter || !sentinel) return null;
    if (arbiter.verdict === sentinel.verdict) {
      if (arbiter.verdict === "RELEASE") return { tone: "var(--green)", head: "Upheld — funds RELEASE on-chain", body: "Two independent agents, different models, reached the same verdict. The contract pays the seller." };
      if (arbiter.verdict === "REFUND") return { tone: "var(--red)", head: "Upheld — funds REFUND on-chain", body: "Two independent agents agree the delivery missed the spec. The contract returns the funds to the buyer." };
      return { tone: "var(--amber)", head: "Both abstain — buyer refunded, human takes over", body: "Neither agent could settle this from the record. The buyer is refunded and the deal escalates to a person." };
    }
    return { tone: "var(--amber)", head: "Split — funds held, deal escalates", body: "The independent appeal disagrees with the arbiter. On a contested call nobody gets paid automatically: the funds stay in the contract and a human reviews it. This is the case a single-agent system would have gotten wrong." };
  })();

  return (
    <div className="dark min-h-screen" style={{ background: "var(--bg)", color: "var(--fg)" }}>
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-coral text-[13px] font-bold text-white">◇</span>
            <span className="font-semibold tracking-tight">Theseus Escrow</span>
          </Link>
          <span className="hidden rounded-full border border-border px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-fg-mute sm:inline">
            Testnet
          </span>
          <a href="https://theseus.network" target="_blank" rel="noopener noreferrer" className="ml-auto text-[12.5px] text-fg-mute hover:text-fg">
            Built on Theseus &#8599;
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-24 pt-10">
        {/* Hero */}
        <h1 className="max-w-2xl text-[30px] font-semibold leading-[1.08] tracking-tight sm:text-[40px]">
          Escrow, settled by agents you don&rsquo;t have to trust.
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-fg-dim">
          Funds sit in a contract, not with a company. An agent reads the deal and decides where the money
          goes. An independent second agent &mdash; a different model, blind to the first verdict &mdash; can overturn it.
          Both verdicts are on-chain, so you check the call instead of trusting the caller.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-fg-mute">
          <span><span className="text-fg">1.</span> Contract custodies eUSDC</span>
          <span className="opacity-40">/</span>
          <span><span className="text-fg">2.</span> Arbiter decides</span>
          <span className="opacity-40">/</span>
          <span><span className="text-fg">3.</span> Sentinel can appeal</span>
          <span className="opacity-40">/</span>
          <span><span className="text-fg">4.</span> 2-of-2 to pay out</span>
        </div>

        {/* Deal picker */}
        <div className="mt-9 flex flex-wrap gap-2">
          {EXAMPLE_DEALS.map((d) => (
            <button
              key={d.id}
              onClick={() => setDealId(d.id)}
              className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${
                d.id === dealId ? "border-coral bg-coral/10 text-coral" : "border-border text-fg-mute hover:border-fg/30 hover:text-fg"
              }`}
            >
              {d.title}
            </button>
          ))}
        </div>

        {/* Deal + adjudication */}
        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
          {/* The deal */}
          <div className="rounded-xl border border-border bg-surface/40 p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-[11px] text-fg-mute">deal #{deal.id} · {deal.category}</span>
              <span className="rounded-md border border-coral/30 px-2 py-0.5 text-[11.5px] text-coral">{deal.amountLabel} in escrow</span>
            </div>
            <div className="mt-2 font-mono text-[11.5px] text-fg-mute">{deal.buyer} &rarr; {deal.seller}</div>

            <h2 className="mt-4 text-[11px] text-fg-mute">Spec (what the buyer asked for)</h2>
            <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-fg-dim">{deal.spec}</p>

            <h2 className="mt-4 text-[11px] text-fg-mute">Delivery (what the seller submitted)</h2>
            <pre className="mt-1.5 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-bg/50 p-3 text-[12px] leading-relaxed text-fg-dim">{deal.delivery}</pre>
          </div>

          {/* Agents */}
          <div className="flex flex-col gap-4">
            <DealArbiter
              key={`${deal.id}-arbiter`}
              deal={deal}
              role="arbiter"
              title="Arbiter"
              subtitle="Reads the spec and delivery, decides where the money goes."
              onFinal={setArbiter}
            />

            {arbiter ? (
              <DealArbiter
                key={`${deal.id}-sentinel`}
                deal={deal}
                role="sentinel"
                title="Sentinel — independent appeal"
                subtitle="A different model, blind to the arbiter's verdict, re-judges from scratch."
                onFinal={setSentinel}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-border p-4 text-[12.5px] text-fg-mute">
                Run the arbiter first. Then send it to Sentinel for an independent second opinion.
              </div>
            )}

            {settlement && (
              <div className="rounded-xl border p-4" style={{ borderColor: "color-mix(in srgb, " + settlement.tone + " 40%, transparent)", background: "color-mix(in srgb, " + settlement.tone + " 8%, transparent)" }}>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: settlement.tone }} />
                  <span className="text-[13.5px] font-semibold" style={{ color: settlement.tone }}>{settlement.head}</span>
                </div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-fg-dim">{settlement.body}</p>
                <div className="mt-3 flex gap-2 text-[11.5px]">
                  <span className="rounded-md border border-border px-2 py-0.5">arbiter: <span style={{ color: VCOLOR[arbiter!.verdict] }}>{arbiter!.verdict}</span></span>
                  <span className="rounded-md border border-border px-2 py-0.5">sentinel: <span style={{ color: VCOLOR[sentinel!.verdict] }}>{sentinel!.verdict}</span></span>
                </div>
              </div>
            )}
          </div>
        </div>

        <p className="mt-8 max-w-2xl text-[12px] leading-relaxed text-fg-mute">
          The contract holds the funds and only an agent verdict moves them &mdash; the agent never holds the keys,
          which is the security failure that sinks most &ldquo;AI wallet&rdquo; designs. Sentinel runs a different
          model on a separate evidence path so an appeal is a real check, not the same model agreeing with itself.
        </p>
      </main>
    </div>
  );
}
