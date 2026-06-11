/**
 * Live Theseus alpha-testnet identities for each demo agent.
 *
 * These are the agents' on-chain SS58 addresses, registered and running
 * on the Theseus chain. The block explorer routes by SS58:
 *   https://explorer.theseus.network/agents/<ss58>
 *
 * The demos link to these pages so a visitor sees the agent (and its
 * runs) on the actual chain, instead of a Base Sepolia stand-in.
 */

export const THESEUS_AGENT_SS58: Record<string, string> = {
  aave: "5HjrqRkxypmAPBVsan7QJQbmjqUdG5ogoSoXn5Bqr317M12u",
  terra: "5C7LCd6BUPeuWv43jtRQ5cb2mLayv5WgGQL9tTTKge2VXGg4",
  bridge: "5En9LRL7sEZPosgshppNANimSwYvYJsXqEGi1eFr3rek2yTE",
  aviation: "5CDDL6FBvcRS5RdDZAeVxDcMmGBFF6hzskNbugQXW3aAzd5W",
  fund: "5GSAT7wWJ1vjHPEk8co3tfxByRn5ricYGecnziCPLLX8c6se",
  adjudicate: "5FCeAthUoz9T9MMxVbtk9wXyXQKszhAVwUYCeUfpFfSKmtWr",
  "launch-sniper": "5FYbSjiA8ethq6qyhhgtNuDDvhs9hiWQ4GfASZCCsqByRDTj",
  governance: "5DgSooCMthyiHE6EMnYKzLMf4ztQNytqHJ9CNTYcJDpgYmSw",
  vellum: "5GahsEyLT1RfevtA4rMXDoyv64CrYFy2mQ7qNorsfougXQjj",
  aperture: "5DjidfXFaFii1NbV6La1ksHZs5ZJJ9Kfp1ckNeGkU2GpB35C",
  marcellus: "5DkWkyutRAWjyq7vVb2HAgPKeo7mBif3smLYVMbcrNoRD2T5",
  quill: "5HpYiD2JPd9JHzwEjcMGySB13TGZWZfdUFewFHaP3fgdS6pE",
  calder: "5G3mG7pf7ntMNkPPW6UfLfQUFVY4idmcXpMN5sc5Gx3xF5Bw",
};

/** Explorer page for a demo agent's on-chain identity, or null if unknown. */
export function theseusAgentUrl(slug: string): string | null {
  const ss58 = THESEUS_AGENT_SS58[slug];
  return ss58 ? `https://explorer.theseus.network/agents/${ss58}` : null;
}
