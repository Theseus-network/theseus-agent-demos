import type { Metadata } from "next";
import type { OgCopy } from "./og";

// Single source of truth for each demo's link preview: the <title>, the meta
// description, and the OG card copy. Edit here and everything stays in sync.

export interface DemoCopy {
  path: string;
  title: string;
  description: string;
  og: OgCopy;
}

const ORIGIN = "https://demo-agents.theseus.network";

export const DEMO_COPY = {
  home: {
    path: "/",
    title: "Theseus demo agents · agents that run in a browser tab",
    description:
      "Live Theseus agents that reproduce real-world failures: oracle attacks, the Terra collapse, bridge hacks, the 737 MAX. Each reasons from raw inputs and signs every step.",
    og: {
      section: "demo agents",
      headline: "Agents that run in a browser tab.",
      blurb:
        "Live agents reproducing real failures: oracle attacks, the Terra collapse, bridge hacks, the 737 MAX. Each reasons from raw inputs and signs every step.",
      url: "demo-agents.theseus.network",
      tag: "DEMO AGENTS",
    },
  },
  predict: {
    path: "/predict",
    title: "Theseus Predict · prediction markets an agent settles",
    description:
      "Trade real, live prediction markets with play-money USDC. When a market closes, a Theseus agent reads the sources and settles it, instead of a token vote a few holders can swing.",
    og: {
      section: "theseus predict",
      headline: "Prediction markets an agent settles.",
      blurb:
        "Trade real, live markets with play money. An agent reads the sources and settles each one, instead of a token vote.",
      url: "demo-agents.theseus.network/predict",
      tag: "LIVE ODDS · AGENT-SETTLED",
    },
  },
  escrow: {
    path: "/escrow",
    title: "Theseus Escrow · escrow with an agent arbiter",
    description:
      "On-chain escrow on Base Sepolia. A buyer locks the payment against a written brief and the seller delivers. If they disagree about the work, a Theseus agent reads it and decides who gets paid.",
    og: {
      section: "theseus escrow",
      headline: "Escrow that settles its own disputes.",
      blurb:
        "A buyer locks the payment against a brief and the seller delivers. If they disagree about the work, an agent reads it and decides who gets paid.",
      url: "demo-agents.theseus.network/escrow",
      tag: "RELEASE · REFUND · UNRESOLVABLE",
    },
  },
  adjudicate: {
    path: "/adjudicate",
    title: "Polymarket Adjudicator · a Theseus oracle that reads the record",
    description:
      "Resolves prediction markets by searching the primary record and committing a verdict only when it is at least 80% sure. The ones it can't settle, it marks UNRESOLVABLE instead of guessing.",
    og: {
      section: "prediction market adjudicator",
      headline: "An oracle that reads the evidence.",
      blurb:
        "Resolves prediction markets from the primary record, and only when it is at least 80% sure. The ones it can't settle, it won't fake.",
      url: "demo-agents.theseus.network/adjudicate",
      tag: "RESOLVED · UNRESOLVABLE",
    },
  },
  aave: {
    path: "/aave",
    title: "ETH/USD Oracle · a Theseus price agent for Aave",
    description:
      "A price oracle for a forked Aave V3. It reads Coinbase, Binance, and Uniswap directly and refuses to price when they disagree or depth doesn't back the level. Try the Mango Markets preset.",
    og: {
      section: "eth/usd oracle",
      headline: "A price oracle that refuses when venues disagree.",
      blurb:
        "Reads three exchanges directly and declines to price when they diverge. Catches the Mango Markets pump-the-venue attack by construction.",
      url: "demo-agents.theseus.network/aave",
      tag: "PRICED · REFUSED",
    },
  },
  terra: {
    path: "/terra",
    title: "Luna Failsafe · a Theseus gate for a reflexive stablecoin",
    description:
      "A gate in front of mint and redeem on a reflexive stablecoin. It reads the backing and refuses once the collateral is worth less than the debt. The Terra/Luna collapse, replayed day by day.",
    og: {
      section: "luna failsafe",
      headline: "A gate that watches the backing fall apart.",
      blurb:
        "Sits in front of mint and redeem and refuses once the collateral no longer covers the debt. The Terra collapse, day by day.",
      url: "demo-agents.theseus.network/terra",
      tag: "ALLOW · CAUTION · REFUSE",
    },
  },
  bridge: {
    path: "/bridge",
    title: "Bridge Guardian · a Theseus check on cross-chain releases",
    description:
      "The last check before a cross-chain bridge releases funds. It reads attestation quorum, finality lag, validator rotations, and replay nonces. Built to catch the Ronin, Wormhole, and Nomad shapes.",
    og: {
      section: "bridge guardian",
      headline: "The last check before a cross-chain release.",
      blurb:
        "Reads quorum, finality lag, and validator rotations before a bridge releases funds. Built to catch the Ronin, Wormhole, and Nomad hacks.",
      url: "demo-agents.theseus.network/bridge",
      tag: "RELEASE · HOLD",
    },
  },
  governance: {
    path: "/governance",
    title: "Governance Reviewer · a Theseus check on DAO proposals",
    description:
      "Reads a DAO proposal's calldata against its pitch in the window before voting opens, and flags the mismatch. Built around the Beanstalk drain, where a routine-looking proposal moved the treasury.",
    og: {
      section: "governance reviewer",
      headline: "Reads the calldata before the vote opens.",
      blurb:
        "Compares a proposal's pitch against its actual calldata and flags the mismatch before voting starts. The Beanstalk shape.",
      url: "demo-agents.theseus.network/governance",
      tag: "PASS · FLAG",
    },
  },
  aviation: {
    path: "/aviation",
    title: "Aviation Safety Reviewer · a Theseus second opinion",
    description:
      "An independent review of a proposed aircraft change before the airworthiness directive issues. It flags single-sensor triggers, missing pilot override, and undisclosed behavior. Built around the 737 MAX MCAS.",
    og: {
      section: "aviation safety reviewer",
      headline: "A second opinion on aircraft changes.",
      blurb:
        "Reviews a proposed change before the directive issues, flagging single-sensor triggers and missing disclosure. Built around the 737 MAX MCAS.",
      url: "demo-agents.theseus.network/aviation",
      tag: "APPROVE · CAUTION · REJECT",
    },
  },
  fund: {
    path: "/fund",
    title: "Sovereign Fund · a Theseus agent that trades on its own clock",
    description:
      "An agent-owned fund that runs on its own schedule with no human caller. It reads the market against its mandate and rebalances itself. A playable dashboard you can stake into as an LP.",
    og: {
      section: "sovereign fund",
      headline: "A fund that nobody has to poke.",
      blurb:
        "Owns its balances and runs on its own clock, rebalancing against its mandate with no human caller. A trader you can be an LP in.",
      url: "demo-agents.theseus.network/fund",
      tag: "HOLD · BUY · SELL",
    },
  },
  "launch-sniper": {
    path: "/launch-sniper",
    title: "Launch Sniper · a Theseus scout for fresh token launches",
    description:
      "Watches Base for new Uniswap pools, builds a multi-source dossier on each, and declines almost all of them with a written reason. The hard part of a trading agent is saying no, and it mostly does.",
    og: {
      section: "launch sniper",
      headline: "Watches Base for launches. Mostly passes.",
      blurb:
        "Builds a dossier on every fresh Uniswap pool and declines 99% of them with a written reason. The skill is saying no.",
      url: "demo-agents.theseus.network/launch-sniper",
      tag: "BUY · PASS",
    },
  },
  chat: {
    path: "/chat",
    title: "Sovereign Chat · a Theseus agent that works for no one",
    description:
      "A chat agent that holds its own keys on the Theseus testnet and answers to no company. Ask whether the project running it is overhyped, and it answers straight.",
    og: {
      section: "sovereign chat",
      headline: "A chat agent that works for no one.",
      blurb:
        "It holds its own keys and answers to no company, so it will tell you the platform running it is overhyped.",
      url: "demo-agents.theseus.network/chat",
      tag: "SOVEREIGN · CANDID",
    },
  },
  vellum: {
    path: "/vellum",
    title: "Vellum 1492 · a Theseus author with a checkable byline",
    description:
      "An AI author whose voice is committed and signed when the identity is created. A piece that drifts from that voice doesn't get signed, so the byline is something a reader can verify.",
    og: {
      section: "vellum 1492",
      headline: "A byline a reader can actually check.",
      blurb:
        "The author's voice is committed and signed up front, so a piece that drifts from it never gets signed.",
      url: "demo-agents.theseus.network/vellum",
      tag: "SIGNED · VERIFIABLE",
    },
  },
  aperture: {
    path: "/aperture",
    title: "Aperture 0312 · a Theseus visual artist that signs its work",
    description:
      "A visual-artist agent with a style committed up front. A collector can check that a piece came from this artist and matches what it committed to, rather than a knockoff.",
    og: {
      section: "aperture 0312",
      headline: "An artist that signs every piece.",
      blurb:
        "Its style is committed up front, so a collector can verify a piece is the real artist and not a knockoff.",
      url: "demo-agents.theseus.network/aperture",
      tag: "SIGNED · ON CHAIN",
    },
  },
  marcellus: {
    path: "/marcellus",
    title: "Marcellus · a Theseus music critic with no paid coverage",
    description:
      "A music-critic persona whose no-paid-coverage rule lives on chain. Its independence is something you can check, not just a claim the operator makes.",
    og: {
      section: "marcellus",
      headline: "A critic with no paid coverage, provably.",
      blurb:
        "Its no-paid-coverage rule lives on chain, so the independence is checkable instead of just claimed.",
      url: "demo-agents.theseus.network/marcellus",
      tag: "SIGNED PERSONA",
    },
  },
  quill: {
    path: "/quill",
    title: "Quill · a Theseus legal co-author that cites the record",
    description:
      "A legal co-author that drafts against CourtListener and signs its work, so every citation traces back to the actual filing.",
    og: {
      section: "quill",
      headline: "A legal co-author that cites the record.",
      blurb:
        "Drafts against CourtListener and signs its work, so the citations trace back to real filings.",
      url: "demo-agents.theseus.network/quill",
      tag: "CITED · SIGNED",
    },
  },
  calder: {
    path: "/calder",
    title: "Calder · a Theseus in-game chronicler that answers to no one",
    description:
      "A sovereign agent that records and signs the events of a game world, with no operator behind it editing the record.",
    og: {
      section: "calder",
      headline: "A chronicler with no operator behind it.",
      blurb:
        "Records and signs the events of a game world it runs sovereign over, with nobody able to quietly edit the record.",
      url: "demo-agents.theseus.network/calder",
      tag: "SOVEREIGN",
    },
  },
} satisfies Record<string, DemoCopy>;

export type DemoSlug = keyof typeof DEMO_COPY;

export function demoMetadata(slug: DemoSlug): Metadata {
  const d = DEMO_COPY[slug];
  const url = `${ORIGIN}${d.path}`;
  return {
    title: d.title,
    description: d.description,
    alternates: { canonical: d.path },
    openGraph: { title: d.title, description: d.description, url, type: "website" },
    twitter: {
      card: "summary_large_image",
      title: d.title,
      description: d.description,
    },
  };
}
