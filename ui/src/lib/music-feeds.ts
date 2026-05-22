/**
 * Pitchfork RSS client. Public feed, no auth.
 *
 * The feed at https://pitchfork.com/feed/rss is a mixed stream of
 * news, album reviews, and track reviews. We filter to items with
 * `<category>Reviews / Albums</category>`. Pitchfork's RSS titles for
 * album reviews are now just the album name (not "Artist: Album");
 * the artist lives in the URL slug, so we extract it from there.
 *
 * Cache via `next.revalidate` for 3h — Pitchfork posts a few albums
 * a day, never retroactively, so an hour of staleness is fine.
 */

const PITCHFORK_FEED = "https://pitchfork.com/feed/rss";
const ALBUM_REVIEW_CATEGORY = "Reviews / Albums";

export interface LiveRelease {
  /** Artist as extracted from the URL slug (best-effort title case). */
  artist: string;
  /** Album / EP title as printed in the feed. */
  album: string;
  /** ISO date string of pubDate. Falls back to "" if unparseable. */
  pubDate: string;
  /** Permalink to the Pitchfork review. */
  link: string;
  /** One-paragraph Pitchfork blurb, HTML stripped. */
  pitchforkBlurb: string;
}

function unwrapCdata(raw: string): string {
  const m = raw.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  return m ? m[1] : raw;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#8217;/g, "’")
    .replace(/&#8216;/g, "‘")
    .replace(/&#8220;/g, "“")
    .replace(/&#8221;/g, "”")
    .replace(/&#8230;/g, "…")
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—");
}

function firstTag(block: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = block.match(re);
  if (!m) return "";
  return decodeEntities(unwrapCdata(m[1])).trim();
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Slugify a string the same way Pitchfork's URLs do: lowercase, then
 *  swap any run of non-alphanumeric chars for a single hyphen. */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Pull the artist out of the URL by matching the album-slug at the
 *  end of the URL's last path segment, and title-casing what remains.
 *  Returns "" if we can't find a clean match. */
function artistFromLink(link: string, album: string): string {
  // Match: https://pitchfork.com/reviews/albums/<slug>/  →  capture <slug>
  const m = link.match(/\/reviews\/albums\/([^/]+)\/?$/);
  if (!m) return "";
  const slug = m[1];
  const albumSlug = slugify(album);
  if (!albumSlug) return "";
  // The album slug should be the suffix of the URL slug; the rest is
  // the artist. Allow a missing match (e.g. when the album title is
  // a single character or stripped of all alphanumerics).
  if (!slug.endsWith(albumSlug)) {
    // Try one more thing: maybe the URL has the album somewhere in the
    // middle of a longer slug. Fall back to the whole slug as the artist
    // guess; the LLM can still reason from the title + blurb.
    return titleCase(slug);
  }
  const artistSlug = slug.slice(0, slug.length - albumSlug.length).replace(/-+$/, "");
  return titleCase(artistSlug);
}

function titleCase(slug: string): string {
  if (!slug) return "";
  return slug
    .split("-")
    .filter((w) => w.length > 0)
    .map((w) =>
      // Preserve all-caps acronyms when slug already lowercased everything.
      // Just capitalize first letter; the LLM is robust to "Mj Lenderman"
      // style mistakes and the blurb usually disambiguates.
      w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join(" ");
}

function isAlbumReview(block: string): boolean {
  // Pitchfork's category field for album reviews:
  //   <category>Reviews / Albums</category>
  // It can also appear with attributes or as multiple <category> tags.
  // We match on the literal string anywhere in the block.
  return block.includes(`<category>${ALBUM_REVIEW_CATEGORY}</category>`);
}

function parseItems(xml: string): LiveRelease[] {
  const out: LiveRelease[] = [];
  const itemRe = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    if (!isAlbumReview(block)) continue;
    const titleRaw = firstTag(block, "title");
    const link = firstTag(block, "link");
    const pubDateRaw = firstTag(block, "pubDate");
    const description = firstTag(block, "description");
    if (!titleRaw || !link) continue;
    const album = titleRaw;
    const artist = artistFromLink(link, album);
    const iso = pubDateRaw ? safeIso(pubDateRaw) : "";
    out.push({
      artist,
      album,
      pubDate: iso,
      link,
      pitchforkBlurb: stripHtml(description),
    });
  }
  return out;
}

function safeIso(rfc822: string): string {
  const d = new Date(rfc822);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

export async function fetchRecentReleases(
  limit: number = 6,
): Promise<LiveRelease[]> {
  const res = await fetch(PITCHFORK_FEED, {
    headers: {
      "user-agent":
        "TheseusOraclePoC/1.0 (+https://theseus.network) Marcellus-live",
      accept: "application/rss+xml, application/xml, text/xml",
    },
    next: { revalidate: 60 * 60 * 3 },
  });
  if (!res.ok) {
    throw new Error(`pitchfork ${res.status}`);
  }
  const xml = await res.text();
  const items = parseItems(xml);
  return items.slice(0, limit);
}
