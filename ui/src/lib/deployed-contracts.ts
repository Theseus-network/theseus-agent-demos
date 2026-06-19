/**
 * Live deployments on Base Sepolia, chain id 84532.
 *
 * Each demo's commitment-surface contract is deployed and signed by
 * the same agent EOA. The UI surfaces a Basescan link on each demo
 * page so a visitor can read the contract that would actually receive
 * the agent's verdict in production.
 *
 * Single source of truth — keep this file in sync with
 * `contracts/deployments/base-sepolia.md`.
 */

export const BASE_SEPOLIA_CHAIN_ID = 84532;
export const BASE_SEPOLIA_EXPLORER = "https://sepolia.basescan.org";

export const AGENT_EOA = "0xF40294f810DD786E705f20D67075DDa9a7f87F8f" as const;

export interface DeployedContract {
  address: `0x${string}`;
  label: string;
}

export const DEPLOYED_CONTRACTS = {
  sovereignFund: {
    address: "0x3e1cEd606571A35c43DA11a3b21C051690Bd926a",
    label: "SovereignFund",
  },
  launchSniperFund: {
    address: "0xa6FbaadeA4e7f58D812D989737D708B279E8bd21",
    label: "LaunchSniperFund",
  },
  terraFailsafe: {
    address: "0x0B59da3768CB0F1725A1C2183dD1Ad93058394d2",
    label: "TerraFailsafe",
  },
  bridgeGuardian: {
    address: "0xe442277ba5ce3f5aF5eDAE26206976ADC964C26C",
    label: "BridgeGuardian",
  },
  governanceReviewer: {
    address: "0xc9CCF578093603e419997358fa9646Bd891B018a",
    label: "GovernanceReviewer",
  },
  aviationSafetyReviewer: {
    address: "0x453cE65E5D6eBc6C71f3e420e720d2C2E1D03bce",
    label: "AviationSafetyReviewer",
  },
  predictionMarketAdjudicator: {
    address: "0xd14A0963D48B944463F3fE6e776C11e09101bE40",
    label: "PredictionMarketAdjudicator",
  },
  vellumAuthor: {
    address: "0x3C33b1C332F4713570fbF87dB6a816d74Eef8088",
    label: "VellumAuthor",
  },
  apertureArtist: {
    address: "0xA10BAbeE86c1f1838891c549d63c49697620F98A",
    label: "ApertureArtist",
  },
  marcellusCritic: {
    address: "0xd9E4DceBb96c6361Be45a03c8ED6C8f21e5635DF",
    label: "MarcellusCritic",
  },
  quillCoAuthor: {
    address: "0x4ED9F5318354Bc044661cee3343bdBB955F78e06",
    label: "QuillCoAuthor",
  },
  calderChronicler: {
    address: "0x431D3728e3D69125fe6F3dbbDF788a2725904a3C",
    label: "CalderChronicler",
  },
} as const satisfies Record<string, DeployedContract>;

/**
 * AgentEscrow: a real custody contract (not just a commitment surface).
 * It holds eUSDC for two-party deals and pays out on the agent's verdict.
 * `usdc` is a public-mint mock token so the demo faucet can dispense it.
 */
export const ESCROW = {
  address: "0x7b1d5D2709334168A452955f378c6C20062249b6",
  usdc: "0x6aaBC0dBC77Bb5F79781D42E2F58F1312bEf607B",
  usdcDecimals: 6,
  usdcSymbol: "eUSDC",
} as const;

/**
 * The agent market: a second AgentEscrow instance used as the settlement layer
 * for agent-to-agent jobs. A requester agent funds a task, a provider agent
 * delivers, and the adjudicator verifies and releases. requester/provider are
 * derived deterministically from AGENT_PRIVATE_KEY (no extra secrets).
 */
export const AGENT_MARKET = {
  address: "0xf568d5C7aB29ACB16D02D0BDEF6A7bdAd5ace868",
  usdc: "0xAC755429040F395a322Eb778B3bf5F4fADf3294c",
  usdcDecimals: 6,
  usdcSymbol: "eUSDC",
  requester: "0x7237d9177921C5E1C3Fd3DEf457F131092d8fe13",
  provider: "0x6fa49D9b502Fff9166a2e4B683E9493640C0Eb0F",
} as const;

/** True iff a contract has been deployed (non-zero address). Used to
 *  gate the on-chain commit step on the five new agent routes. */
export function isContractDeployed(c: DeployedContract): boolean {
  return c.address !== "0x0000000000000000000000000000000000000000";
}

export function basescanAddressUrl(address: string): string {
  return `${BASE_SEPOLIA_EXPLORER}/address/${address}`;
}
