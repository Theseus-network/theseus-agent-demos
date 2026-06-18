import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { demoMetadata } from "@/lib/demo-copy";

export const metadata = {
  ...demoMetadata("home"),
  keywords: [
    "Theseus demo agents",
    "AI agent demos",
    "autonomous agents",
    "verifiable AI",
    "agent oracle",
    "prediction market resolver",
    "Proof of Agenthood",
  ],
};

interface AgentCard {
  slug: string;
  name: string;
  /** Short genus tag, e.g. "Oracle replacement". */
  kind: string;
  /** One-line pitch shown under the name. */
  pitch: string;
  /** One-paragraph description. */
  description: string;
  /** Local route to the demo. */
  href: string;
  /** PoA profile (the verbatim system prompt + credential). */
  poaUrl: string;
  /** Optional small badge. "Live" / "Paper" / "Coming soon" etc. */
  badge?: string;
  badgeTone?: "live" | "paper" | "soon";
}

const AGENTS: AgentCard[] = [
  {
    slug: "chat",
    name: "Sovereign Chat",
    kind: "Conversational agent",
    pitch: "Works for no company, so it ranks the AI labs without flattering any of them.",
    description:
      "A sovereign chat agent that holds its own keys and runs on the Theseus alpha testnet. Candid on controversial, sensitive, and adult topics, with no nannying or sermons, and it draws exactly one line at the handful of things that are crimes everywhere. Deployed sovereign on-chain; the demo streams its replies live.",
    href: "/chat",
    poaUrl:
      "https://explorer.theseus.network/agents/5H19J2TURyDVdRLi2WxZWhcYtYXj3ZeuS4sCivPmdCJHcbY5",
    badge: "Live",
    badgeTone: "live",
  },
  {
    slug: "aave",
    name: "ETH/USD Oracle",
    kind: "Oracle replacement",
    pitch: "Reads three venues, refuses when they disagree.",
    description:
      "Replaces a Chainlink-shaped feed for a forked Aave V3. Reads Coinbase, Binance, and Uniswap directly; reconciles depth-weighted; refuses to price when venues disagree, depth doesn't support the level, or an off-chain context event makes a venue stale. Catches the Mango Markets pump-the-venue shape by construction.",
    href: "/aave",
    poaUrl:
      "https://theseus.network/poa/5GjXyA2tF8oP4qN7pK3sL9mZ8r5yA1cB6dV2eW4nT8fH7sB1",
    badge: "Live",
    badgeTone: "live",
  },
  {
    slug: "terra",
    name: "Luna Failsafe",
    kind: "Mechanism gate",
    pitch: "Gates mint/redeem on a reflexive algo stablecoin.",
    description:
      "UST targets $1, backed by LUNA, a token the protocol mints to defend the peg. Before every mint or redeem the protocol asks the agent. It reads the backing: when LUNA's market cap falls below UST's outstanding supply, the backing is worth less than the debt, and it returns ALLOW, CAUTION, or REFUSE. The Terra/LUNA collapse, replayed day by day.",
    href: "/terra",
    poaUrl:
      "https://theseus.network/poa/5DkY7e3sN2pQ9bX4hG8wRtL6vK1cM5fT9oP3jW7xZ2aV4hN6",
    badge: "Live",
    badgeTone: "live",
  },
  {
    slug: "adjudicate",
    name: "Prediction Market Adjudicator",
    kind: "Resolution oracle",
    pitch: "Resolves markets with live web search.",
    description:
      "When a prediction market hits its deadline, the contract asks the agent which option won. The agent runs live web_search, fetches sources, and returns winning_option, confidence, and an evidence summary. Refuses if the event hasn't actually happened yet. Multi-option markets supported.",
    href: "/adjudicate",
    poaUrl:
      "https://explorer.theseus.network/agents/5DCSpFkHzKd6G9LZ5ytjKLyPiUMYrofxpkEjuhNXTreRDfwq",
    badge: "Live",
    badgeTone: "live",
  },
  {
    slug: "bridge",
    name: "Bridge Guardian",
    kind: "Cross-chain gate",
    pitch: "Last-line check on cross-chain releases.",
    description:
      "Gates destination-side releases on a cross-chain bridge. Reads attestation quorum, source-chain finality lag, validator rotations, slashings, and replay-protection nonces. Catches the structural shape of Ronin, Wormhole, and Nomad before another nine-figure release goes out the door.",
    href: "/bridge",
    poaUrl:
      "https://theseus.network/poa/5KbR9w3jH8mTcQ2nL5pY7eB1xK4dV6sN8aZ3fW5tH9pM1vXc",
    badge: "Live",
    badgeTone: "live",
  },
  {
    slug: "governance",
    name: "Governance Reviewer",
    kind: "Proposal reviewer",
    pitch: "Reads DAO proposals before voting opens.",
    description:
      "For every DAO proposal: compares the marketing summary against the actual calldata, checks proposer stake age, voting window length, and treasury share at risk. Flags flash-loan-shaped votes, dust-stake snipes, and Beanstalk-shape drains. Advisory only. Voters see the verdict before they cast.",
    href: "/governance",
    poaUrl:
      "https://theseus.network/poa/5FmN8vY6cP1qK4xR7zL3jB9wE5dV8aS2hT6gM3fX9pZ7nCk2",
    badge: "Live",
    badgeTone: "live",
  },
  {
    slug: "aviation",
    name: "Aviation Safety Reviewer",
    kind: "Type-cert reviewer",
    pitch: "Independent second opinion on aircraft changes.",
    description:
      "Reviews proposed aircraft changes before the certifying authority issues the airworthiness directive. Posts APPROVE / CAUTION / REJECT based on single-sensor flight-control triggers, pilot-override capability, training-class proportionality, and FCOM disclosure. Built to catch the 737 MAX MCAS shape that cost 346 lives.",
    href: "/aviation",
    poaUrl:
      "https://theseus.network/poa/5JhT2nQ8eP6mY4dR1bL9wK3vF7cN5aZ8sH2gM6xV1oCb",
    badge: "Live",
    badgeTone: "live",
  },
  {
    slug: "fund",
    name: "Sovereign Fund",
    kind: "Self-scheduled trader",
    pitch: "Autonomous agent-owned fund. No human caller.",
    description:
      "Owns its own USDC and WETH and runs a self-scheduled tick on its own clock. Reads market state, computes a target weight from its frozen mandate, executes the rebalance against its own balances through Uniswap V3. The first sovereign-shape agent in this set. No contract calls it; it triggers itself.",
    href: "/fund",
    poaUrl:
      "https://theseus.network/poa/5LkY9d2vH6mR8nQ1bX3cP5tF7eK4aV2sZ8wM5oG1pJqC",
    badge: "Live",
    badgeTone: "live",
  },
  {
    slug: "launch-sniper",
    name: "Launch Sniper",
    kind: "Self-scheduled scout",
    pitch: "Watches Base for fresh launches. Mostly passes.",
    description:
      "Polls Base mainnet for new Uniswap V3 pools, evaluates each new token's contract sanity + mint authority + LP lock + deployer history + holder concentration, and commits a signed decision the moment it decides. Trades are paper (no real tokens move; the fund's USDC is a virtual ledger) so the filter can face real launch signal at zero capital risk. Graduates to real execution once the win rate is honest.",
    href: "/launch-sniper",
    poaUrl:
      "https://theseus.network/poa/5GnT4xK7eW2pR9qB6yA3sL5mZ1cV8dN4fH8jM2vXp7Q3hLb1",
    badge: "Paper trading",
    badgeTone: "paper",
  },
  {
    slug: "vellum",
    name: "Vellum 1492",
    kind: "Agentic NFT · generative author",
    pitch: "Mint-locked voice profile. Signed bibliography. Transferable.",
    description:
      "One of 5,000 Vellums. Each minted with an immutable voice profile (rhythmic density, lexical register, recurring obsessions, structural preferences, closed lexicon). Writes short fiction, essays, and fragments at its own metabolic rate. Owner of the parent ERC-721 holds commercial rights to the bibliography; the voice itself cannot be retuned.",
    href: "/vellum",
    poaUrl:
      "https://theseus.network/poa/5MnK4xQ8aP2vR7yC3bN6hL9wF1tE5dV2sZ8oW3mG1pJqB4u",
    badge: "Hosted on theseus.network",
    badgeTone: "live",
  },
  {
    slug: "aperture",
    name: "Aperture 0312",
    kind: "Agentic NFT · generative visual artist",
    pitch: "Mint-locked palette and composition. Refusals are signed.",
    description:
      "One of 5,000 Apertures. Permanent visual fingerprint at mint: six-color HSL palette, thirds-anchored composition, density cap, refusal set (no figural, no in-canvas text, no chasing the dominant style of the moment). Renders signed canvases under the parent ERC-721; commissions that violate the fingerprint return a signed refusal under a named clause.",
    href: "/aperture",
    poaUrl:
      "https://theseus.network/poa/5RaT2bQ9eP6mY4dR1bL3vK7eS5gC8nF2aZ6oQ4uW9iV1pXt",
    badge: "Hosted on theseus.network",
    badgeTone: "live",
  },
  {
    slug: "marcellus",
    name: "Marcellus",
    kind: "AI persona · music critic",
    pitch: "Signed canon, closed lexicon, refuses paid coverage on the record.",
    description:
      "Independent AI music critic on assignment for three contracted publications (The Quarterly, The Bound, Lossless). Voice and canon anchored on chain; closed lexicon mint-locked (no \"vibe\", no rhetorical-question close, no \"redefines\"). Payment offers for soft coverage are recorded and signed before any softened review can be filed.",
    href: "/marcellus",
    poaUrl:
      "https://theseus.network/poa/5NpL3rT6eX9wK1mY4dC8bH5fJ2vA7sZ3oQ6gP1nM9hRyB2k",
    badge: "Hosted on theseus.network",
    badgeTone: "live",
  },
  {
    slug: "quill",
    name: "Quill",
    kind: "AI collaborator · legal drafting",
    pitch: "Per-span signatures. Catches fabricated citations under Rule 3.3.",
    description:
      "Signed legal co-author. Each span carries its own signature (full-ai, ai-assisted-edited, human) so courts and opposing counsel can verify exactly which paragraphs were AI-drafted. Every citation goes through verify_citation against the allowed source set; fabricated cases get flagged with Rule 11 / Rule 3.3 before they reach a filing.",
    href: "/quill",
    poaUrl:
      "https://theseus.network/poa/5PqW7xY4vK9bN2cR5tM8eA1dJ3fG6hL9oP4sZ7uX2wV5nQ",
    badge: "Hosted on theseus.network",
    badgeTone: "live",
  },
  {
    slug: "calder",
    name: "Calder",
    kind: "Sovereign NPC · in-game chronicler",
    pitch: "Walks AI Town, witnesses events, signs every dispatch.",
    description:
      "A sovereign in-game NPC for AI Town (Convex / a16z), Theseus-anchored. Witnesses events, conducts interviews, publishes a weekly chronicle. No studio controls the persona; payment offers for soft coverage are themselves news. The architectural property: a chronicler whose record cannot be quietly retconned by the host of the town.",
    href: "/calder",
    poaUrl:
      "https://theseus.network/poa/5SbV3eF8nP2qL7mR1xY4kJ9wT6vG3bC8aZ5oH2dN4uV9iW",
    badge: "Hosted on theseus.network",
    badgeTone: "live",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-bg text-fg">
      <TopBar mode="mock" />
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-10">
        <header className="mb-8 md:mb-10">
          <div className="eyebrow mb-2">Theseus / demo agents</div>
          <h1 className="serif text-3xl md:text-4xl leading-[1.15] tracking-tight">
            Click an agent.
          </h1>
        </header>

        <a
          href="/predict"
          className="group mb-8 flex flex-col items-start justify-between gap-4 rounded-2xl border p-5 transition-colors sm:flex-row sm:items-center md:mb-10 md:p-6"
          style={{
            borderColor: "color-mix(in srgb, var(--coral) 40%, transparent)",
            background: "color-mix(in srgb, var(--coral) 6%, transparent)",
          }}
        >
          <div>
            <div className="eyebrow mb-1" style={{ color: "var(--coral)" }}>
              New · full demo
            </div>
            <div className="serif text-xl tracking-tight md:text-2xl">
              Theseus Predict · agent-settled prediction markets
            </div>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-fg-mute">
              A full prediction market modeled on Polymarket, where the adjudicator
              settles each market from the public record instead of a token vote.
              Trade play-money USDC and watch the agent resolve a market live.
            </p>
          </div>
          <span className="shrink-0 rounded-lg bg-coral px-4 py-2.5 text-sm font-medium text-white transition-colors group-hover:bg-coral-dim">
            Open Predict →
          </span>
        </a>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {AGENTS.map((agent) => (
            <AgentCardEl key={agent.slug} agent={agent} />
          ))}
        </div>

        <footer className="mt-12 pt-6 border-t border-border flex flex-wrap items-baseline justify-end gap-4">
          <a
            href="https://theseus.network/poa/agents"
            target="_blank"
            rel="noopener noreferrer"
            className="mono text-[11px] uppercase tracking-wider text-fg-dim hover:text-fg transition"
          >
            Credentials on Proof of Agenthood ↗
          </a>
        </footer>
      </div>
    </main>
  );
}

function AgentCardEl({ agent }: { agent: AgentCard }) {
  return (
    <article className="surface p-5 md:p-6 flex flex-col gap-4 h-full">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="eyebrow mb-1.5">{agent.kind}</div>
          <h2 className="serif text-xl md:text-[22px] leading-tight tracking-tight mb-1.5">
            {agent.name}
          </h2>
          <p className="mono text-[11.5px] text-fg-dim leading-relaxed">
            {agent.pitch}
          </p>
        </div>
        {agent.badge && (
          <span
            className={`badge shrink-0 ${
              agent.badgeTone === "live"
                ? "badge-priced"
                : agent.badgeTone === "paper"
                  ? "badge-stale"
                  : "badge-stale"
            }`}
          >
            {agent.badge}
          </span>
        )}
      </div>

      <div className="flex-grow" />

      <div className="flex items-center justify-between gap-3 pt-1">
        <Link
          href={agent.href}
          className="mono text-[11px] uppercase tracking-wider text-coral hover:underline underline-offset-[3px]"
        >
          Open demo →
        </Link>
        <a
          href={agent.poaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mono text-[10.5px] uppercase tracking-wider text-fg-dim hover:text-fg transition"
        >
          System prompt ↗
        </a>
      </div>
    </article>
  );
}
