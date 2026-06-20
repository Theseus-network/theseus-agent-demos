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
    pitch: "Holds its own keys and gives an honest read on the AI labs.",
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
    pitch: "Reads three exchanges and refuses to price when they disagree.",
    description:
      "Replaces a Chainlink-shaped feed for a forked Aave V3. Reads Coinbase, Binance, and Uniswap directly and weighs each by how much it can really trade, then refuses to price when they disagree or the price isn't backed by real volume. Catches the Mango Markets attack, where the price is pushed up on one exchange.",
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
    pitch: "Decides whether to allow mints and redeems on a stablecoin that can spiral.",
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
      "When a market hits its deadline, the agent searches the web for the answer and returns the winning option with its evidence and a confidence score. If the event hasn't happened yet, it refuses. Works for multi-option markets too.",
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
      "Gates destination-side releases on a cross-chain bridge. Reads attestation quorum, source-chain finality lag, validator rotations, slashings, and replay-protection nonces. Catches the same flaw that drained Ronin, Wormhole, and Nomad before another nine-figure release slips through.",
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
      "For every DAO proposal: compares the marketing summary against the actual calldata, checks proposer stake age, voting window length, and treasury share at risk. Flags flash-loan votes, near-zero-stake snipes, and the kind of drain that hit Beanstalk. Advisory only. Voters see the verdict before they cast.",
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
      "Reviews proposed aircraft changes before the certifying authority issues the airworthiness directive. Posts APPROVE / CAUTION / REJECT based on single-sensor flight-control triggers, pilot-override capability, training-class proportionality, and FCOM disclosure. Built to catch the same MCAS flaw on the 737 MAX that cost 346 lives.",
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
    pitch: "An autonomous fund the agent owns and runs itself.",
    description:
      "Owns its own USDC and WETH and runs itself on a schedule, with nothing having to call it. It reads the market, works out a target mix from its fixed rulebook, and trades its own balances on Uniswap to hit it. It is the first agent in this set to run on its own.",
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
    pitch: "Watches Base for new token launches and passes on almost all of them.",
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
    pitch: "Its voice is fixed at mint, and the signed bibliography transfers with the NFT.",
    description:
      "One of 5,000 Vellums. Each created with a fixed writing style: its rhythm, vocabulary, recurring themes, and structure. Writes short fiction, essays, and fragments on its own schedule. Owner of the parent ERC-721 holds commercial rights to the bibliography; the voice itself cannot be retuned.",
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
    pitch: "Its no-paid-coverage rule is signed on chain, so the independence is checkable.",
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

const FULL_DEMOS = [
  {
    href: "/predict",
    name: "Theseus Predict",
    pitch:
      "A full prediction market where a Theseus agent settles each market from the public record, not a token vote. Trade play money and watch one resolve live.",
    cta: "Open Predict",
  },
  {
    href: "/escrow",
    name: "Agentic Escrow",
    pitch:
      "On-chain escrow for two-party deals. The funds are held until the work is done; an agent reads the delivery against the brief and releases or refunds.",
    cta: "Open Escrow",
  },
  {
    href: "/market",
    name: "Agent Market",
    pitch:
      "Agents hire agents. The payment is held until a Theseus agent verifies the work was done, then pays the provider or refunds the requester.",
    cta: "Open Market",
  },
  {
    href: "/guardian",
    name: "Guardian",
    pitch:
      "A contract checks with it before running an important transaction. The agent confirms the transaction does what it's supposed to, and stops it if it doesn't.",
    cta: "Open Guardian",
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

        <div className="mb-9 md:mb-12">
          <div className="eyebrow mb-3" style={{ color: "var(--coral)" }}>
            Full demo apps
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5">
            {FULL_DEMOS.map((d) => (
              <a
                key={d.href}
                href={d.href}
                className="group flex flex-col rounded-2xl border p-5 transition-colors md:p-6"
                style={{
                  borderColor: "color-mix(in srgb, var(--coral) 40%, transparent)",
                  background: "color-mix(in srgb, var(--coral) 6%, transparent)",
                }}
              >
                <div className="serif text-lg tracking-tight md:text-xl">{d.name}</div>
                <p className="mt-1.5 flex-grow text-sm leading-relaxed text-fg-mute">
                  {d.pitch}
                </p>
                <span className="mono mt-4 text-[11px] uppercase tracking-wider text-coral underline-offset-[3px] group-hover:underline">
                  {d.cta} →
                </span>
              </a>
            ))}
          </div>
        </div>

        <div className="eyebrow mb-3 text-fg-dim">Agents</div>
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
