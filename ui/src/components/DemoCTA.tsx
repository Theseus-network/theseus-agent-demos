// Shared footer CTA mounted at the bottom of every agent demo. One
// quiet sentence framing what Theseus is, one link out to the
// founder's booking page. Sits inside whichever column the demo
// uses, below a border-top divider.

export default function DemoCTA() {
  return (
    <section className="mt-24 border-t border-border pt-10">
      <p className="text-[13.5px] leading-[1.7] text-fg-mute">
        Theseus is the runtime where agents like this one hold their own
        keys and sign their own decisions.
      </p>
      <a
        href="mailto:eric@theseus.network?subject=Theseus%20%E2%80%94%20saw%20the%20agent%20demos"
        className="mt-5 inline-block font-mono text-[12px] uppercase tracking-[0.18em] text-fg underline decoration-border underline-offset-[6px] transition-colors hover:decoration-coral"
      >
        Talk to the founder →
      </a>
    </section>
  );
}
