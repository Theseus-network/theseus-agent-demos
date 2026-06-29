// Geometric agent sigils. Distinct shapes so Arbiter and Sentinel read as two
// different actors at a glance (the whole product is two agents checking each
// other). Stroke uses currentColor so each call sets the tone.
export function AgentMark({ name, className }: { name: "arbiter" | "sentinel"; className?: string }) {
  const common = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, className };
  if (name === "arbiter") {
    // A balance scale: the judge weighing the brief against the delivery.
    return (
      <svg {...common}>
        <path d="M12 4.5v14.5" />
        <path d="M6.5 19h11" />
        <circle cx="12" cy="3.3" r="1.1" />
        <path d="M6 8.2h12" />
        <path d="M6 8.2l-2.6 4.8a2.6 2.6 0 0 0 5.2 0z" />
        <path d="M18 8.2l-2.6 4.8a2.6 2.6 0 0 0 5.2 0z" />
      </svg>
    );
  }
  // Sentinel: an eye set in a shield, the independent guard that re-checks blind.
  return (
    <svg {...common}>
      <path d="M12 2.8l7 2.8v4.9c0 4.4-3 7.4-7 8.7-4-1.3-7-4.3-7-8.7V5.6z" />
      <circle cx="12" cy="10.6" r="2.4" />
      <circle cx="12" cy="10.6" r="0.5" fill="currentColor" />
    </svg>
  );
}
