"use client";

// The agent's call, lifted out of the timeline log into a dramatic hero block:
// a big colour-coded verdict, the one-line reason, and the reasoning streamed
// in beneath it. The verdict is the moment a visitor came to see, so it should
// be the loudest thing on the page — not a row in a list.

import { useTypewriter } from "@/lib/use-typewriter";

type Family = "good" | "caution" | "bad" | "neutral";

const FAMILY: Record<string, Family> = {
  ALLOW: "good", PRICED: "good", APPROVE: "good", VALID: "good",
  ACCEPT: "good", VERIFIED: "good", BUY: "good", SIGNED: "good", CLEAR: "good",
  CAUTION: "caution", HOLD: "caution", DEFER: "caution", FLAG: "caution",
  REFUSE: "bad", REFUSED: "bad", REJECT: "bad", INVALID: "bad",
  FABRICATED: "bad", BLOCK: "bad", PASS: "bad",
};

function familyOf(d?: string | null): Family {
  return d ? (FAMILY[d.toUpperCase()] ?? "neutral") : "neutral";
}
function colorOf(f: Family): string {
  return f === "good"
    ? "var(--green)"
    : f === "caution"
      ? "var(--amber)"
      : f === "bad"
        ? "var(--red)"
        : "var(--fg-mute)";
}

export function VerdictHero({
  verdict,
  reason,
  reasoning,
  pending,
  streaming,
  idleHint,
}: {
  verdict?: string | null;
  reason?: string;
  reasoning?: string;
  pending?: boolean;
  streaming?: string;
  idleHint?: string;
}) {
  const text = (pending ? streaming : reasoning) ?? "";
  const typed = useTypewriter(text);
  const fam = familyOf(verdict);
  const c = colorOf(fam);
  const show = verdict ?? (pending ? "…" : null);

  return (
    <div
      className="rounded-2xl border bg-surface/60 p-5 sm:p-6 transition-colors"
      style={{ borderColor: pending ? "var(--coral)" : "var(--border)" }}
    >
      <p className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-fg-mute">
        the agent&rsquo;s call
      </p>

      {show ? (
        <>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span
              className="font-serif text-4xl tracking-tight sm:text-5xl"
              style={{ color: c }}
            >
              {show}
            </span>
            {reason && (
              <span className="text-[13px] leading-snug text-fg-dim">
                {reason}
              </span>
            )}
          </div>

          {text ? (
            <p className="mt-4 text-[14px] leading-relaxed text-fg-dim">
              {pending ? typed : text}
              {pending && (
                <span
                  className="ml-0.5 inline-block h-[1em] w-[6px] animate-pulse align-text-bottom"
                  style={{ background: "var(--coral)" }}
                />
              )}
            </p>
          ) : (
            pending && (
              <p className="mt-4 text-[13px] text-fg-mute">agent reasoning&hellip;</p>
            )
          )}
        </>
      ) : (
        <p className="text-[14px] leading-relaxed text-fg-mute">
          {idleHint ??
            "Pick a scenario and submit it. The verdict and reasoning appear here."}
        </p>
      )}
    </div>
  );
}
