import { ImageResponse } from "next/og";

// One shared 1200x630 link-preview card for every demo. Each route's
// opengraph-image.tsx just hands this its copy from demo-copy.ts, so the
// image, the <title>, and the description always come from one source.

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png";

export interface OgCopy {
  /** Shown after "Theseus /" in the kicker. */
  section: string;
  /** Big headline. Keep it short. */
  headline: string;
  /** One-sentence description under the headline. */
  blurb: string;
  /** Footer-left, e.g. the URL. */
  url: string;
  /** Footer-right tag, e.g. the verdict labels. */
  tag?: string;
}

const BG = "#070C18";
const FG = "#F4F7FC";
const MUTE = "#8A93A6";
const SUB = "#9AA3B2";
const ACCENT = "#818CF8";
const DOT = "#34D399";
const LINE = "#1E293B";

export function ogCard(c: OgCopy) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: BG,
          color: FG,
          padding: "72px 80px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontFamily: "monospace",
            fontSize: 18,
            letterSpacing: 4,
            textTransform: "uppercase",
          }}
        >
          <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
            <span style={{ fontSize: 22, color: FG }}>Theseus</span>
            <span style={{ color: ACCENT }}>/ {c.section}</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", color: MUTE }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: DOT }} />
            <span>live</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          <div
            style={{
              fontSize: 74,
              lineHeight: 1.05,
              letterSpacing: -1.5,
              color: FG,
              maxWidth: 1000,
              display: "flex",
            }}
          >
            {c.headline}
          </div>
          <div
            style={{
              fontSize: 26,
              lineHeight: 1.4,
              color: SUB,
              maxWidth: 980,
              display: "flex",
            }}
          >
            {c.blurb}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: "monospace",
            fontSize: 18,
            color: MUTE,
            paddingTop: 20,
            borderTop: `1px solid ${LINE}`,
          }}
        >
          <div style={{ display: "flex" }}>{c.url}</div>
          {c.tag ? <div style={{ display: "flex" }}>{c.tag}</div> : <div />}
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
