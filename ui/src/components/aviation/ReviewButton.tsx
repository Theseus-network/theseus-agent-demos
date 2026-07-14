"use client";

interface Props {
  busy: boolean;
  pending: boolean;
  onSubmit: () => Promise<void> | void;
}

export function AviationReviewButton({ busy, pending, onSubmit }: Props) {
  const disabled = busy || pending;

  return (
    <div>
      <button
        type="button"
        onClick={() => onSubmit()}
        disabled={disabled}
        className="cta-ink inline-flex items-center px-5 py-2.5 font-mono text-[12px] uppercase tracking-[0.18em] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? "agent reasoning…" : busy ? "submitting…" : "run review →"}
      </button>
      <p className="mt-3 text-[11.5px] leading-relaxed text-fg-mute">
        The reviewer reads the change and posts an{" "}
        <span className="font-bold" style={{ color: "var(--green)" }}>APPROVE</span>,{" "}
        <span className="font-bold" style={{ color: "var(--coral)" }}>CAUTION</span>, or{" "}
        <span className="font-bold" style={{ color: "var(--coral)" }}>REJECT</span> verdict before
        the certification authority issues its airworthiness directive. The
        verdict is advisory.
      </p>
    </div>
  );
}
