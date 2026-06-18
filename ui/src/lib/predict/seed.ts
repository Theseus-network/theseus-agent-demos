import type { PricePoint, SeedMarket } from "./types";

// Deterministic PRNG so seeded price history is stable across renders/reloads.
function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (x: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, x));

/** Mean-reverting random walk that ends exactly at p0 (the seed price). */
export function genHistory(
  id: number,
  p0: number,
  days = 45,
  points = 48,
): PricePoint[] {
  const rnd = mulberry32(id * 100003 + 7);
  const now = Date.now();
  const start = now - days * 86_400_000;
  const out: PricePoint[] = [];
  let p = clamp(p0 + (rnd() - 0.5) * 0.25, 0.06, 0.94);
  for (let i = 0; i < points; i++) {
    const frac = i / (points - 1);
    const t = Math.round(start + frac * (now - start));
    const drift = (p0 - p) * 0.07;
    const shock = (rnd() - 0.5) * 0.07;
    p = clamp(p + drift + shock, 0.02, 0.98);
    out.push({ t, pYes: i === points - 1 ? p0 : p });
  }
  return out;
}

// Today is mid-June 2026. Every market below is LIVE (undecided): the ones with
// future deadlines are open for trading and settle at close; the two "resolving"
// markets just closed and can be settled by the agent now from current data.
export const SEED_MARKETS: SeedMarket[] = [
  {
    id: 4101,
    slug: "bitcoin-above-150k-2026",
    question: "Will Bitcoin trade above $150,000 at any point in 2026?",
    shortTitle: "Bitcoin above $150k in 2026?",
    description:
      "A liquid macro market on whether bitcoin prints a new range high this year. Resolves on the daily close against a consensus of major exchanges.",
    category: "Crypto",
    icon: "₿",
    resolutionCriteria:
      "Resolves YES if the BTC/USD daily close is at or above $150,000.00 on any day on or before December 31, 2026, 11:59 PM ET, per a consensus of major exchange spot prices (Coinbase, Binance, Kraken). Resolves NO otherwise.",
    resolutionSource: "Consensus of major exchange spot prices",
    deadlineISO: "2026-12-31",
    initialYes: 0.58,
    liquidityB: 9000,
    volumeUsd: 41_800_000,
    resolvable: false,
  },
  {
    id: 4102,
    slug: "fed-cuts-september-2026",
    question: "Will the Fed cut interest rates at its September 2026 meeting?",
    shortTitle: "Fed cuts rates in September 2026?",
    description:
      "Resolves on the FOMC's September 2026 decision. Any reduction to the federal funds target range counts.",
    category: "Economy",
    icon: "🏛️",
    resolutionCriteria:
      "Resolves YES if the Federal Open Market Committee lowers the federal funds target range at its September 2026 meeting, as stated in the official FOMC statement. Any reduction qualifies. Resolves NO if the range is held or raised.",
    resolutionSource: "The official FOMC statement",
    deadlineISO: "2026-09-18",
    initialYes: 0.52,
    liquidityB: 8000,
    volumeUsd: 22_600_000,
    resolvable: false,
  },
  {
    id: 4103,
    slug: "gta-6-releases-2026",
    question: "Will Grand Theft Auto VI release in 2026?",
    shortTitle: "GTA VI releases in 2026?",
    description:
      "Resolves YES on a full commercial release to the public during the year, not a delay announcement, beta, or pre-order.",
    category: "Culture",
    icon: "🎮",
    resolutionCriteria:
      "Resolves YES if Grand Theft Auto VI is released for purchase and play by the general public on at least one platform between January 1 and December 31, 2026, 11:59 PM ET, per Rockstar Games' official announcement. Pre-orders, betas, and delays do not count. Resolves NO otherwise.",
    resolutionSource: "Rockstar Games' official announcements",
    deadlineISO: "2026-12-31",
    initialYes: 0.44,
    liquidityB: 6000,
    volumeUsd: 13_900_000,
    resolvable: false,
  },
  {
    id: 4104,
    slug: "openai-gpt6-by-end-2026",
    question: "Will OpenAI release a model named GPT-6 by end of 2026?",
    shortTitle: "OpenAI releases GPT-6 in 2026?",
    description:
      "A publicly available model under the exact name GPT-6, available to API or ChatGPT users by the deadline.",
    category: "Tech",
    icon: "🧠",
    resolutionCriteria:
      "Resolves YES if a model with the official public name 'GPT-6' is publicly available to API or ChatGPT users by December 31, 2026, 11:59 PM ET. Internal codenames and announcements without release do not count. The resolution source is OpenAI announcements and the OpenAI API model registry.",
    resolutionSource: "OpenAI announcements and the OpenAI API model registry",
    deadlineISO: "2026-12-31",
    initialYes: 0.29,
    liquidityB: 6000,
    volumeUsd: 9_300_000,
    resolvable: false,
  },
  {
    id: 4105,
    slug: "spacex-starship-orbital-payload-2026",
    question: "Will SpaceX complete a Starship orbital flight with a payload in 2026?",
    shortTitle: "Starship reaches orbit with payload in 2026?",
    description:
      "Resolves YES on a Starship flight that reaches orbit and deploys a payload, confirmed by SpaceX and independent tracking.",
    category: "Science",
    icon: "🚀",
    resolutionCriteria:
      "Resolves YES if a SpaceX Starship vehicle reaches orbit and deploys at least one payload during a flight between January 1 and December 31, 2026, confirmed by SpaceX and independent spaceflight tracking. A suborbital test or a flight without a deployed payload does not count. Resolves NO otherwise.",
    resolutionSource: "SpaceX announcements and independent spaceflight tracking",
    deadlineISO: "2026-12-31",
    initialYes: 0.66,
    liquidityB: 6500,
    volumeUsd: 7_400_000,
    resolvable: false,
  },
  {
    id: 4106,
    slug: "republicans-keep-house-2026",
    question: "Will Republicans keep control of the US House in the 2026 midterms?",
    shortTitle: "Republicans keep the House in 2026?",
    description:
      "Resolves on the makeup of the US House of Representatives after the November 2026 midterm elections are called.",
    category: "Politics",
    icon: "🇺🇸",
    resolutionCriteria:
      "Resolves YES if the Republican Party holds at least 218 seats in the US House of Representatives following the November 3, 2026 midterm elections, per the consensus call of major news networks (AP, NBC, Fox, CNN). Resolves NO if Democrats reach 218 or more. The market resolves once control is called.",
    resolutionSource: "Consensus of major news network calls",
    deadlineISO: "2026-11-15",
    initialYes: 0.47,
    liquidityB: 11000,
    volumeUsd: 58_300_000,
    resolvable: false,
  },
  {
    id: 4107,
    slug: "ai-gold-medal-imo-2026",
    question: "Will an AI system earn a gold medal at the 2026 IMO?",
    shortTitle: "AI gold medal at the 2026 IMO?",
    description:
      "The International Mathematical Olympiad is held in July 2026. Resolves on whether an AI system reaches the gold-medal score threshold under official or credibly-reported conditions.",
    category: "Tech",
    icon: "🧮",
    resolutionCriteria:
      "Resolves YES if an AI system achieves a score at or above the gold-medal cutoff at the 2026 International Mathematical Olympiad, as confirmed by the IMO organizers or by the developing lab with credible third-party verification, on or before August 15, 2026. Resolves NO otherwise.",
    resolutionSource: "IMO organizers or credibly-verified lab results",
    deadlineISO: "2026-08-15",
    initialYes: 0.71,
    liquidityB: 5000,
    volumeUsd: 6_100_000,
    resolvable: false,
  },
  {
    id: 4108,
    slug: "ethereum-flips-bitcoin-2027",
    question: "Will Ethereum's market cap flip Bitcoin's by end of 2027?",
    shortTitle: "ETH flips BTC by end of 2027?",
    description:
      "The flippening, on a hard deadline. Resolves on total market capitalization at the daily close.",
    category: "Crypto",
    icon: "Ξ",
    resolutionCriteria:
      "Resolves YES if Ethereum's total market capitalization exceeds Bitcoin's at any daily close on or before December 31, 2027, 11:59 PM ET, per a consensus of major data providers (CoinGecko, CoinMarketCap). Resolves NO otherwise.",
    resolutionSource: "Consensus of major market-cap data providers",
    deadlineISO: "2027-12-31",
    initialYes: 0.19,
    liquidityB: 7000,
    volumeUsd: 14_900_000,
    resolvable: false,
  },
  {
    id: 4109,
    slug: "foldable-iphone-2026",
    question: "Will Apple ship a foldable iPhone in 2026?",
    shortTitle: "Apple ships a foldable iPhone in 2026?",
    description:
      "Resolves YES on a foldable iPhone available for purchase during the year, not a rumor, leak, or announcement without release.",
    category: "Tech",
    icon: "📱",
    resolutionCriteria:
      "Resolves YES if Apple makes a foldable iPhone available for purchase by the general public in at least one market between January 1 and December 31, 2026, 11:59 PM ET, per Apple's official announcement. Rumors, leaks, and announcements without availability do not count. Resolves NO otherwise.",
    resolutionSource: "Apple's official announcements",
    deadlineISO: "2026-12-31",
    initialYes: 0.16,
    liquidityB: 5000,
    volumeUsd: 5_200_000,
    resolvable: false,
  },
  {
    id: 4110,
    slug: "solana-above-400-2026",
    question: "Will Solana trade above $400 at any point in 2026?",
    shortTitle: "Solana above $400 in 2026?",
    description:
      "Resolves on the daily close of SOL/USD against a consensus of major exchanges.",
    category: "Crypto",
    icon: "◎",
    resolutionCriteria:
      "Resolves YES if the SOL/USD daily close is at or above $400.00 on any day on or before December 31, 2026, 11:59 PM ET, per a consensus of major exchange spot prices (Coinbase, Binance, Kraken). Resolves NO otherwise.",
    resolutionSource: "Consensus of major exchange spot prices",
    deadlineISO: "2026-12-31",
    initialYes: 0.38,
    liquidityB: 6500,
    volumeUsd: 16_300_000,
    resolvable: false,
  },
  // --- Just closed: the agent can settle these now from current data ---
  {
    id: 4201,
    slug: "bitcoin-above-100k-june-15-2026",
    question: "Did Bitcoin close above $100,000 on June 15, 2026?",
    shortTitle: "Bitcoin above $100k on June 15?",
    description:
      "A single-day price snapshot that just closed. The agent can settle it now by reading the daily close from the public record.",
    category: "Crypto",
    icon: "📊",
    resolutionCriteria:
      "Resolves YES if the BTC/USD daily close on June 15, 2026 was at or above $100,000.00, per a consensus of major exchange spot prices (Coinbase, Binance, Kraken). Resolves NO otherwise.",
    resolutionSource: "Consensus of major exchange spot prices",
    deadlineISO: "2026-06-15",
    initialYes: 0.23,
    liquidityB: 7000,
    volumeUsd: 12_800_000,
    resolvable: true,
  },
  {
    id: 4202,
    slug: "ethereum-above-2500-june-15-2026",
    question: "Did Ethereum close above $2,500 on June 15, 2026?",
    shortTitle: "Ethereum above $2,500 on June 15?",
    description:
      "Another just-closed single-day snapshot. Run the agent to settle it from the daily close.",
    category: "Crypto",
    icon: "Ξ",
    resolutionCriteria:
      "Resolves YES if the ETH/USD daily close on June 15, 2026 was at or above $2,500.00, per a consensus of major exchange spot prices (Coinbase, Binance, Kraken). Resolves NO otherwise.",
    resolutionSource: "Consensus of major exchange spot prices",
    deadlineISO: "2026-06-15",
    initialYes: 0.48,
    liquidityB: 6000,
    volumeUsd: 8_900_000,
    resolvable: true,
  },
];

/** The just-closed markets, kept around so the agent settlement is demoable now. */
export const DEMO_MARKETS: SeedMarket[] = SEED_MARKETS.filter((m) => m.resolvable);

export function findSeed(slug: string): SeedMarket | undefined {
  return SEED_MARKETS.find((m) => m.slug === slug);
}
