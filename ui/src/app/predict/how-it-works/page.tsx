import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How it works · Theseus Predict",
  description:
    "How agent-settled prediction markets resolve: the Theseus adjudicator reads the primary record and commits a verdict at 80%+ confidence, instead of a token vote a few holders can swing.",
};

const AGENT =
  "https://explorer.theseus.network/agents/5DCSpFkHzKd6G9LZ5ytjKLyPiUMYrofxpkEjuhNXTreRDfwq";

const STEPS = [
  {
    n: "01",
    h: "Trade while the market is open",
    p: "Buy YES or NO shares with play-money USDC. Prices move with demand and read directly as the market's implied probability. There's always liquidity, so you can enter or exit any time before the deadline.",
  },
  {
    n: "02",
    h: "The deadline closes trading",
    p: "At the resolution date, trading stops. The market now needs a verdict, and that's where most prediction markets are weakest: the answer gets decided by whoever the oracle lets vote.",
  },
  {
    n: "03",
    h: "The agent reads the record",
    p: "A Theseus agent searches the sources named in the rules and weighs what it finds. It only calls the market when it is at least 80% sure; below that it does not call it at all. The rules it judges by are published on chain, and its verdict is signed with its own key.",
  },
  {
    n: "04",
    h: "Settlement pays the record",
    p: "Each share of the winning outcome pays $1; the other side pays $0. If the record is too thin or too split to clear the bar, the agent returns UNRESOLVABLE and every position is refunded its cost. No forced payout on a coin flip.",
  },
];

const FAQ = [
  {
    q: "How is this different from Polymarket?",
    a: "The trading is the same shape. The resolution is not. Polymarket's disputed markets are settled by a UMA token vote, so whoever holds the most tokens can move the answer. Three 2025–2026 disputes worth about $298M were settled on the wrong outcome that way. Here, resolution comes from an agent reading the primary record, which no token balance can outvote.",
  },
  {
    q: "How do I know the agent is fair?",
    a: "It publishes its verbatim system prompt on chain, so anyone can read the exact rules it judges by before a market resolves. Every settlement shows the evidence summary and the source links it used, and the run is signed by the agent's on-chain key. You can verify exactly how each verdict was reached.",
  },
  {
    q: "Can the price be manipulated by a whale?",
    a: "The price is just the market's belief, and buying it up only moves the price, not the payout. Settlement is decided by the record, so cornering a market changes nothing about how it resolves. That's the opposite of a token-vote oracle, where buying votes can buy the outcome.",
  },
  {
    q: "What happens if the question can't be settled?",
    a: "The agent returns UNRESOLVABLE rather than guessing, and every position is refunded its cost. A wrong resolution pays a market out on the wrong truth and can't be undone; an honest UNRESOLVABLE just sends it to human dispute. The verdict and evidence are public, so a bad call is reviewable.",
  },
  {
    q: "What is a share worth?",
    a: "Each share pays exactly $1 if its outcome is the agent's verdict, and $0 if it isn't. So a YES share bought at 62¢ returns 38¢ of profit if YES wins, or the cost if the market resolves UNRESOLVABLE.",
  },
  {
    q: "Is this real money?",
    a: "No. Theseus Predict is a testnet demo. Balances are play-money USDC with no cash value, dispensed from a faucet. It exists to show the settlement mechanism end to end, not to take wagers.",
  },
];

export default function HowItWorks() {
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <main className="mx-auto max-w-3xl px-3 pb-24 pt-10 sm:px-5">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />

      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-coral">How it works</p>
      <h1 className="mt-2 font-serif text-[30px] leading-[1.1] tracking-tight text-fg sm:text-[40px]">
        What actually settles these markets.
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed text-fg-dim">
        A prediction market is only as good as the thing that settles it. Most
        hand that job to a token vote, which big holders can swing. Here it goes
        to an agent that reads the primary sources and signs its verdict on chain.
      </p>

      <section className="mt-10 space-y-5">
        {STEPS.map((s) => (
          <div key={s.n} className="flex gap-4 rounded-xl border border-border bg-surface/40 p-5">
            <span className="font-mono text-[13px] font-semibold text-coral">{s.n}</span>
            <div>
              <h2 className="text-[15px] font-semibold text-fg">{s.h}</h2>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-fg-dim">{s.p}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="mt-10 rounded-xl border border-border bg-surface/40 p-6">
        <h2 className="font-serif text-[20px] tracking-tight text-fg">The 80% bar</h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-fg-dim">
          The agent only calls a market when it is at least 80% sure the sources
          settle it. If it is less sure than that, it returns UNRESOLVABLE rather
          than put out a shaky answer. So when something here says &ldquo;resolved,&rdquo;
          the sources actually settled it. You can read the live verdicts on the{" "}
          <a href={AGENT} target="_blank" rel="noopener noreferrer" className="text-coral hover:underline">
            agent&rsquo;s on-chain profile
          </a>
          .
        </p>
      </section>

      <section className="mt-12">
        <h2 className="mb-4 font-serif text-[22px] tracking-tight text-fg">Questions</h2>
        <div className="divide-y divide-border rounded-xl border border-border">
          {FAQ.map((f) => (
            <details key={f.q} className="group px-5">
              <summary className="flex cursor-pointer list-none items-center justify-between py-4 text-[14.5px] font-medium text-fg">
                {f.q}
                <span className="ml-3 text-fg-mute transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="pb-4 text-[13.5px] leading-relaxed text-fg-dim">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <div className="mt-12 flex items-center justify-between rounded-xl border border-border bg-surface/40 p-6">
        <p className="text-[14.5px] font-medium text-fg">Ready to trade?</p>
        <Link
          href="/predict"
          className="rounded-lg bg-coral px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-coral-dim"
        >
          Browse markets →
        </Link>
      </div>
    </main>
  );
}
