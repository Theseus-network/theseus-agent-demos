/**
 * CourtListener REST v4 client. Free, no-auth read-only client used by
 * the Quill demo to ground citation verification in a real reporter
 * database (Free Law Project / CourtListener) instead of relying on the
 * LLM's possibly-hallucinated recall.
 *
 * Endpoint chosen: GET /api/rest/v4/search/?type=o&citation=<vol>%20<reporter>%20<page>
 *
 * Why /search/ over /citation-lookup/:
 *   - /citation-lookup/ requires authentication (HTTP 401 anonymous).
 *   - /search/?type=o&citation= is the open, no-auth endpoint; it
 *     accepts a normalized "VOL REPORTER PAGE" string and returns the
 *     opinion clusters that contain that reporter cite.
 *
 * We parse the user's pasted Bluebook string client-side, extract the
 * volume/reporter/page triple, and submit just that. Anything we can't
 * parse is reported as "unrecognized citation" so the LLM can still
 * fall back to its own recall.
 *
 * If the call fails (network, 5xx, parse error) we return verified=false
 * with a reason string and `unavailable: true` so the caller can decide
 * whether to fall back.
 */

const COURTLISTENER_BASE = "https://www.courtlistener.com";
const SEARCH_PATH = "/api/rest/v4/search/";
/** Hard cap; CourtListener will hang on very long bodies. */
const MAX_CITATION_LEN = 500;
/** Server-side fetch timeout. The demo flow already has a deepseek call
 *  immediately after, so we don't want CourtListener to dominate the
 *  end-to-end latency on a slow day. */
const FETCH_TIMEOUT_MS = 6000;

export interface CitationVerification {
  /** True iff CourtListener returned at least one canonical match. */
  verified: boolean;
  /** "<Party A> v. <Party B>" as CourtListener resolved it, if any. */
  caseName?: string;
  /** Issuing court name, e.g. "Supreme Court of the United States". */
  court?: string;
  /** Decision year. */
  year?: number;
  /** Permalink to the opinion on courtlistener.com. */
  opinionUrl?: string;
  /** Human-readable note (why it failed, or extra context). Always set
   *  on verified=false; usually omitted on verified=true. */
  notes?: string;
  /** Set when CourtListener was unreachable or returned an unexpected
   *  shape, so the caller knows to fall through to the LLM-only path
   *  without flagging the cite as fabricated. */
  unavailable?: boolean;
}

/** Raw shape returned by /search/?type=o for each result. Documented at
 *  https://www.courtlistener.com/help/api/rest/search/ — we read the
 *  fields we need; the endpoint returns many more we ignore. */
interface SearchResultRaw {
  caseName?: string;
  caseNameFull?: string;
  /** Array of citations that resolve to this case (e.g. ["504 U.S. 555", "112 S. Ct. 2130", ...]) */
  citation?: string[];
  /** "YYYY-MM-DD" */
  dateFiled?: string;
  /** Court name, e.g. "Supreme Court of the United States". */
  court?: string;
  court_id?: string;
  /** Path component on courtlistener.com, prepend host. */
  absolute_url?: string;
  citeCount?: number;
  /** Search relevance score, used to rank when multiple results return. */
  meta?: { score?: { bm25?: number } };
}

interface SearchResponseRaw {
  count?: number;
  results?: SearchResultRaw[];
}

/** Parse a raw Bluebook-ish citation like "Lujan v. Defenders of Wildlife,
 *  504 U.S. 555 (1992)" into the reporter triple "504 U.S. 555". Returns
 *  null if we can't find a recognizable triple. */
function extractReporterTriple(citation: string): string | null {
  // Match: <vol> <reporter w/ optional periods + 1-2 word suffix> <page>
  // Examples we want to catch:
  //   "504 U.S. 555"
  //   "550 U.S. 544"
  //   "482 F. Supp. 3d 117"
  //   "578 U.S. 330"
  //   "355 U.S. 41"
  const re = /(\d{1,4})\s+([A-Z][A-Za-z\.]*(?:\s+[A-Z][A-Za-z\.]*){0,3}(?:\s+\d+[a-z]+)?)\s+(\d{1,5})/;
  const m = citation.match(re);
  if (!m) return null;
  const [, vol, reporter, page] = m;
  return `${vol} ${reporter.trim()} ${page}`;
}

/** Verify a single citation against CourtListener. Resolves to a
 *  CitationVerification — never throws to callers, so the demo flow
 *  doesn't need a try/catch around it. */
export async function verifyCitation(
  citation: string,
): Promise<CitationVerification> {
  const text = citation.trim();
  if (!text) {
    return { verified: false, notes: "empty citation" };
  }
  if (text.length > MAX_CITATION_LEN) {
    return { verified: false, notes: "citation exceeded length cap" };
  }

  const triple = extractReporterTriple(text);
  if (!triple) {
    return {
      verified: false,
      notes:
        "Could not parse a reporter triple (vol + reporter + page) from this citation. " +
        "CourtListener's open search endpoint needs a normalized cite like '504 U.S. 555'.",
    };
  }

  const url = new URL(SEARCH_PATH, COURTLISTENER_BASE);
  url.searchParams.set("type", "o");
  url.searchParams.set("citation", triple);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: {
        accept: "application/json",
        // CourtListener asks anonymous clients to identify themselves so
        // they can contact us if we burn their rate budget.
        "user-agent":
          "TheseusOracle-Quill-Demo/1.0 (https://theseus.network)",
      },
      signal: controller.signal,
      // Next.js fetch cache; CourtListener's reporter database changes
      // slowly, so an hour of staleness on a verification result is fine.
      next: { revalidate: 3600 },
    });
  } catch (err) {
    clearTimeout(timer);
    return {
      verified: false,
      unavailable: true,
      notes:
        "CourtListener unreachable: " +
        (err instanceof Error ? err.message : String(err)),
    };
  }
  clearTimeout(timer);

  if (res.status === 429) {
    return {
      verified: false,
      unavailable: true,
      notes: "CourtListener rate limit hit",
    };
  }
  if (!res.ok) {
    return {
      verified: false,
      unavailable: true,
      notes: "CourtListener http " + res.status,
    };
  }

  let json: SearchResponseRaw;
  try {
    json = (await res.json()) as SearchResponseRaw;
  } catch {
    return {
      verified: false,
      unavailable: true,
      notes: "CourtListener returned non-JSON",
    };
  }

  const results = Array.isArray(json.results) ? json.results : [];
  if (results.length === 0) {
    return {
      verified: false,
      notes:
        `CourtListener returned no opinions matching reporter cite "${triple}". ` +
        "The volume/reporter/page triple does not resolve to a known case in their database.",
    };
  }

  // Find the result whose citation list contains an exact match for our
  // reporter triple. Falls back to the highest-bm25 hit if no exact
  // match — preserves the "found something close" signal without
  // claiming verification of a non-matching cite.
  const matchExact = results.find((r) =>
    (r.citation ?? []).some((c) => c === triple),
  );
  if (!matchExact) {
    const top = results[0];
    return {
      verified: false,
      notes:
        `CourtListener found opinions citing the reporter "${triple}" but none whose canonical citation list contains it. ` +
        (top.caseName
          ? `Closest hit was "${top.caseName}", which cites a different reporter slot.`
          : "No close match."),
    };
  }

  return {
    verified: true,
    caseName: matchExact.caseName || matchExact.caseNameFull,
    court: matchExact.court || prettyCourtId(matchExact.court_id),
    year: parseYear(matchExact.dateFiled),
    opinionUrl: matchExact.absolute_url
      ? COURTLISTENER_BASE + matchExact.absolute_url
      : undefined,
  };
}

function parseYear(dateFiled: string | undefined): number | undefined {
  if (!dateFiled) return undefined;
  const m = dateFiled.match(/^(\d{4})/);
  return m ? Number(m[1]) : undefined;
}

function prettyCourtId(id: string | undefined): string | undefined {
  if (!id) return undefined;
  const map: Record<string, string> = {
    scotus: "Supreme Court of the United States",
    ca1: "U.S. Court of Appeals for the First Circuit",
    ca2: "U.S. Court of Appeals for the Second Circuit",
    ca3: "U.S. Court of Appeals for the Third Circuit",
    ca4: "U.S. Court of Appeals for the Fourth Circuit",
    ca5: "U.S. Court of Appeals for the Fifth Circuit",
    ca6: "U.S. Court of Appeals for the Sixth Circuit",
    ca7: "U.S. Court of Appeals for the Seventh Circuit",
    ca8: "U.S. Court of Appeals for the Eighth Circuit",
    ca9: "U.S. Court of Appeals for the Ninth Circuit",
    ca10: "U.S. Court of Appeals for the Tenth Circuit",
    ca11: "U.S. Court of Appeals for the Eleventh Circuit",
    cadc: "U.S. Court of Appeals for the D.C. Circuit",
    cafc: "U.S. Court of Appeals for the Federal Circuit",
  };
  return map[id] ?? id;
}
