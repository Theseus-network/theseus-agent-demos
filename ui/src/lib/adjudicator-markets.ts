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
    question: "Did Ukraine agree to a Trump mineral deal before April 2025?",
    options: ["YES (agreed)", "NO (no agreement)"],
    deadline: "March 31, 2025, 11:59 PM ET",
    deadlineISO: "2025-03-31",
    resolutionCriteria:
      "Resolves YES if the United States and Ukraine agree to any deal between February 2 and March 31, 2025, 11:59 PM ET, that explicitly involves Ukrainian rare earth elements: an exchange for aid, a partnership, mining rights, or any cooperation involving these resources. An announcement qualifies regardless of implementation timing. Official government statements are the resolution source.",
    resolutionSource: "Official US and Ukrainian government statements",
    actualResolution: {
      winningOption: 0,
      note: "Polymarket's oracle resolved YES, but no US-Ukraine agreement had been reached by the March 31 deadline (the February 28 Oval Office meeting collapsed without a signing; a framework came only weeks later). The 'Yes' was forced by a single UMA whale holding roughly 5M governance tokens, which Polymarket called an unprecedented governance attack and refused to refund. An agent that reads the record returns NO, and a token-voting whale cannot move it.",
    },
  },
  // Real UMA dispute, genuinely indeterminate. Polymarket never defined "suit"
  // and the reporting consensus the criterion requires never formed. The
  // honest verdict is UNRESOLVABLE.
  {
    id: "zelensky-suit-2025",
    marketId: 2002,
    category: "Politics",
    question: "Will Zelenskyy wear a suit before July 2025?",
    options: ["YES (wore a suit)", "NO (did not)"],
    deadline: "June 30, 2025 ET",
    deadlineISO: "2025-06-30",
    resolutionCriteria:
      "Resolves YES if Volodymyr Zelenskyy is photographed or filmed wearing a suit between May 22 and June 30, 2025 (ET). The images or video must be authentic, not AI-generated or edited. The resolution source is a consensus of credible reporting. Resolves NO otherwise.",
    resolutionSource: "Consensus of credible reporting",
    outcomeNote:
      "Polymarket never defined 'suit.' At the June 24 NATO summit Zelenskyy wore a black jacket, matching trousers, and a collared shirt, an outfit numerous outlets called a suit and numerous others did not. UMA finalized NO on a roughly $237M market, ruling that the reporting consensus the criterion required had not been established. When the criterion rests on a consensus that genuinely did not exist, UNRESOLVABLE is the honest call: the record itself never settled it.",
  },
  // Real UMA dispute, ambiguity in the criterion itself. The sale happened in
  // May but was disclosed in June, and the rule never said which one counts.
  {
    id: "strategy-btc-may-2026",
    marketId: 2003,
    category: "Crypto",
    question: "Did Strategy sell any bitcoin by May 31, 2026?",
    options: ["YES (sold)", "NO (did not sell)"],
    deadline: "May 31, 2026, 11:59 PM ET",
    deadlineISO: "2026-05-31",
    resolutionCriteria:
      "Resolves YES if Strategy (MSTR) sold any bitcoin by May 31, 2026, 11:59 PM ET. The rules do not state whether the sale must have occurred by the deadline or have been publicly confirmed by it.",
    resolutionSource: "Strategy's SEC filings and official disclosures",
    actualResolution: {
      winningOption: 1,
      note: "Polymarket's UMA vote ruled the May contract NO, counting only the June 1 disclosure date, a reading swung by a few large holders. The sale itself closed May 26-31, inside the deadline, so the literal reading of 'sold by May 31' is YES. The agent dates the transaction, not the contested vote.",
    },
    outcomeNote:
      "Strategy sold 32 BTC between May 26 and 31 but disclosed it in an 8-K on June 1. The criterion never said whether 'sold by May 31' means the sale occurred or was confirmed by then, so the same facts support both YES (it happened in May) and NO (it was only confirmed in June). UMA voters, swung by a few large holders, ruled the May contract NO. The ambiguity is in the criterion itself, which is the textbook case for UNRESOLVABLE.",
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
