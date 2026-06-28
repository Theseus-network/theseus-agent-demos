// On-chain trading config for Theseus Predict. Decisions (which markets exist,
// what they resolve to) come from agents on Theseus; the money lives here on an
// EVM testnet. Collateral is the existing eUSDC faucet token on Base Sepolia.
// Set NEXT_PUBLIC_PREDICT_MARKET to the deployed TheseusPredictionMarket address
// to turn on-chain trading on; until then the app stays in play-money mode.
import { baseSepolia } from "viem/chains";

export const PREDICT_CHAIN_ID = baseSepolia.id; // 84532

/** eUSDC faucet token (6 decimals), already live on Base Sepolia. */
export const EUSDC_ADDRESS = "0x6aaBC0dBC77Bb5F79781D42E2F58F1312bEf607B" as const;
export const EUSDC_DECIMALS = 6;

// Live deployment on Base Sepolia (agent-opened markets 5200-5220). Override with
// NEXT_PUBLIC_PREDICT_MARKET to point at a different deployment.
export const PREDICT_MARKET_ADDRESS = (process.env.NEXT_PUBLIC_PREDICT_MARKET || "0xC7c57c7991eF070bAe55c2c5C9566c3C89E2a5F1") as `0x${string}` | "";
export const onChainEnabled = () => /^0x[0-9a-fA-F]{40}$/.test(PREDICT_MARKET_ADDRESS);

// Outcome enum: matches the contract (YES = 0, NO = 1).
export const OUTCOME = { YES: 0, NO: 1 } as const;

export const PREDICT_MARKET_ABI = [
  { type: "function", name: "buy", stateMutability: "nonpayable", inputs: [{ name: "id", type: "uint256" }, { name: "outcome", type: "uint8" }, { name: "amountIn", type: "uint256" }, { name: "minSharesOut", type: "uint256" }], outputs: [{ name: "sharesOut", type: "uint256" }] },
  { type: "function", name: "redeem", stateMutability: "nonpayable", inputs: [{ name: "id", type: "uint256" }], outputs: [{ name: "payout", type: "uint256" }] },
  { type: "function", name: "resolve", stateMutability: "nonpayable", inputs: [{ name: "id", type: "uint256" }, { name: "winner", type: "uint8" }], outputs: [] },
  { type: "function", name: "priceYes", stateMutability: "view", inputs: [{ name: "id", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "sharesOf", stateMutability: "view", inputs: [{ name: "id", type: "uint256" }, { name: "trader", type: "address" }], outputs: [{ name: "yes", type: "uint256" }, { name: "no", type: "uint256" }] },
  { type: "function", name: "markets", stateMutability: "view", inputs: [{ name: "", type: "uint256" }], outputs: [{ name: "reserveYes", type: "uint256" }, { name: "reserveNo", type: "uint256" }, { name: "collateral", type: "uint256" }, { name: "open", type: "bool" }, { name: "resolved", type: "bool" }, { name: "winner", type: "uint8" }] },
] as const;

export const ERC20_ABI = [
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
] as const;
