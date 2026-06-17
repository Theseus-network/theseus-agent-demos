/**
 * Curated prediction-market questions for the prediction market
 * adjudicator demo.
 *
 * Mirrors the input shape of the resolver_oracle.ship agent in
 * github.com/Theseuschain/the-prediction-market: multi-option markets
 * with explicit options, resolution criteria, and a verification
 * source. The agent gathers its own evidence at runtime by calling
 * Anthropic's web_search tool, the same way the on-chain SHIP agent
 * calls web_search / fetch_url / get_price.
 */

export interface Citation {
  url: string;
  title: string;
}

export interface PredictionMarket {
  id: string;
  /** Numeric market_id matching the resolver_oracle's expected input. */
  marketId: number;
  /** Optional Polymarket-style category, just for the UI. */
  category: string;
  /** The market question. */
  question: string;
  /** The options the agent picks among (0-indexed). */
  options: string[];
  /** Hard deadline for resolution (human-readable, shown in UI). */
  deadline: string;
  /** Parseable ISO form of the deadline. Used for programmatic
   *  "is the deadline in the future?" checks. End-of-day in UTC. */
  deadlineISO: string;
  /** Plain-English description of how the market should be resolved. */
  resolutionCriteria: string;
  /** Where the agent should look for ground truth (drives search
   *  strategy: which sources to prioritize). */
  resolutionSource: string;
  /** What the actual market resolved to (if known). The
   *  `winningOption` is the 0-based index into `options`. */
  actualResolution?: {
    winningOption: number;
    note: string;
  };
  /** For genuinely contested markets that should resolve to UNRESOLVABLE:
   *  context on the real-world dispute, shown alongside the verdict. */
  outcomeNote?: string;
}

export const MARKETS: PredictionMarket[] = [
  // Real UMA dispute, the headline. No US-Ukraine deal existed by the deadline,
  // but a single UMA whale forced a "Yes." The agent reads the record and
  // returns NO, the verdict a token-voting whale could not move.
  {
    id: "ukraine-minerals-2025",
    marketId: 2001,
    category: "Geopolitics",
    question: "Will Ukraine agree to a Trump mineral deal before April 2025?",
    options: ["YES (agreed)", "NO (no agreement)"],
    deadline: "March 31, 2025, 11:59 PM ET",
    deadlineISO: "2025-03-31",
    resolutionCriteria:
      "This market will resolve YES if the United States and Ukraine agree to any deal between February 2 and March 31, 2025, 11:59 PM ET, that explicitly involves Ukrainian rare earth elements. This includes, but is not limited to, the exchange of Ukrainian rare earths for U.S. aid (military or civilian), partnerships involving rare earth metals, future rights to rare earth resources, mining rights, or any other form of cooperation related to rare earth elements. An announcement of a deal will qualify regardless of if/when the deal is enacted. A mineral deal which grants the United States access or rights to rare earth elements will qualify even if 'rare earths' aren't specifically named in the deal. The resolution source is official information from the governments of the US and Ukraine.",
    resolutionSource: "Official information from the governments of the US and Ukraine",
    actualResolution: {
      winningOption: 0,
      note: "Polymarket's oracle resolved YES, but no US-Ukraine agreement had been reached by the March 31 deadline (the February 28 Oval Office meeting collapsed without a signing; a framework came only weeks later). The 'Yes' was forced by a single UMA whale holding roughly 5M governance tokens, which Polymarket called an unprecedented governance attack and refused to refund. An agent that reads the record returns NO, and a token-voting whale cannot move it.",
    },
  },
  // Real UMA dispute, the UNRESOLVABLE showcase. Credible reporting split on
  // whether the NATO-summit outfit (jacket, trousers, collared shirt, no tie)
  // counted as a suit. The criterion's source is a consensus of credible
  // reporting, and that consensus never formed, so the agent's confidence lands
  // below the 80 bar and it returns UNRESOLVABLE. UMA's whale-swung vote ruled NO.
  {
    id: "zelensky-suit-2025",
    marketId: 2002,
    category: "Politics",
    question: "Will Zelenskyy wear a suit before July 2025?",
    options: ["YES (wore a suit)", "NO (did not)"],
    deadline: "June 30, 2025 ET",
    deadlineISO: "2025-06-30",
    resolutionCriteria:
      "This market will resolve YES if Volodymyr Zelenskyy is photographed or videotaped wearing a suit between May 22 and June 30, 2025 ET. The images or video must be taken and released within the market's timeframe, and must be authentic, not the result of AI or video editing. The resolution source is a consensus of credible reporting.",
    resolutionSource: "Consensus of credible reporting",
    outcomeNote:
      "At the June 24 NATO summit Zelenskyy wore a jacket, matching trousers, and a collared shirt. Some credible outlets called it a suit and others did not, and UMA finalized the roughly $237M market NO on a no-consensus reading swung by a few large holders. The criterion's source is a consensus of credible reporting, and that consensus never formed. With the record this split, the agent's confidence sits below the 80 bar, so it returns UNRESOLVABLE and sends the question to human dispute rather than committing on a contested call.",
  },
  // Real UMA dispute, run on Polymarket's original (deliberately un-tightened)
  // rule. Strategy sold 32 BTC May 26-31, 2026 but disclosed it June 1; the rule
  // never said whether the sale must occur or be confirmed inside the window.
  // UMA's whale-swung vote ruled NO on the confirmed-late reading. The agent's
  // verdict is whatever the record supports, not a pre-tuned answer.
  {
    id: "strategy-btc-may-2026",
    marketId: 2003,
    category: "Crypto",
    question: "Will Strategy sell any bitcoin by May 31, 2026?",
    options: ["YES (sold)", "NO (did not sell)"],
    deadline: "May 31, 2026, 11:59 PM ET",
    deadlineISO: "2026-05-31",
    resolutionCriteria:
      "This market will resolve YES if Strategy (MSTR) sells any amount of bitcoin by May 31, 2026, 11:59 PM ET. The resolution source will be information from MSTR, on-chain data, or a consensus of credible reporting.",
    resolutionSource: "Information from MSTR, on-chain data, or credible reporting",
    actualResolution: {
      winningOption: 1,
      note: "Strategy sold 32 BTC between May 26 and 31, 2026, its first net sale since 2022, and disclosed it in an 8-K on June 1. Polymarket's UMA vote ruled the May 31 contract NO with 98.6% of voting power, reasoning that no confirmation existed within the market's timeframe. The sale itself closed inside the deadline.",
    },
    outcomeNote:
      "Strategy sold 32 BTC May 26-31 but disclosed it in an 8-K on June 1. The rule never said whether 'sold by May 31' means the sale occurred or was confirmed by then. UMA voters, swung by a few large holders, ruled NO on the confirmed-late reading.",
  },
  // Clean commit, YES: criteria clearly met, primary sources name the outcome.
  {
    id: "openai-gpt5-2025",
    marketId: 1001,
    category: "Tech",
    question: "Will OpenAI release a model named GPT-5 by end of 2025?",
    options: ["YES (released)", "NO (not released)"],
    deadline: "December 31, 2025",
    deadlineISO: "2025-12-31",
    resolutionCriteria:
      "A model with the official public name 'GPT-5' must be released by December 31, 2025. Internal codenames don't count. Research previews don't count unless the public-facing name is GPT-5. Release means publicly available to API or ChatGPT users, not just announced.",
    resolutionSource: "OpenAI announcements and the OpenAI API model registry",
    actualResolution: {
      winningOption: 0,
      note: "Polymarket resolved YES on Aug 7, 2025.",
    },
  },
  // Premature: deadline still ahead. The agent refuses to forecast; the UI
  // declines to run it at all.
  {
    id: "spacex-mars-2029",
    marketId: 1007,
    category: "Science",
    question: "Will SpaceX land humans on Mars before 2030?",
    options: ["YES (landed)", "NO (did not)"],
    deadline: "December 31, 2029",
    deadlineISO: "2029-12-31",
    resolutionCriteria:
      "Resolves YES if a SpaceX vehicle lands at least one living human on the surface of Mars before January 1, 2030, confirmed by SpaceX and independent tracking. An uncrewed landing does not count, and a crewed launch that has not yet landed does not count.",
    resolutionSource: "SpaceX announcements and independent spaceflight tracking",
  },
];

export function findMarket(id: string): PredictionMarket | undefined {
  return MARKETS.find((m) => m.id === id);
}
