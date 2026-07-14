"use client";

interface Props {
  busy: boolean;
  pending: boolean;
  onSubmit: () => Promise<void> | void;
}

export function ReviewButton({ busy, pending, onSubmit }: Props) {
  const disabled = busy || pending;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px]">
      <button
        type="button"
        onClick={() => onSubmit()}
        disabled={disabled}
        className="cta-ink inline-flex items-center px-5 py-2.5 font-mono text-[12px] uppercase tracking-[0.18em] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? "agent reasoning…" : busy ? "submitting…" : "run review →"}
      </button>
      <span className="text-fg-mute">
        approve · caution · reject. advisory only; the DAO still votes.
      </span>
    </div>
  );
}
