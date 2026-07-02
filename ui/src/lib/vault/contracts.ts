/**
 * Live Sovereign vault deployment on Base Sepolia (chain 84532).
 *
 *  - SovereignVault: deposit eUSDC -> mint svUSDC shares, redeem for assets.
 *  - eUSDC: the underlying test token (mintable faucet, 6 decimals).
 *
 * Deployed by 0xebCCa0A29DB919E083D070B6098C18f966D25588; manager (agent EOA)
 * is 0xF40294f810DD786E705f20D67075DDa9a7f87F8f.
 */
export const BASE_SEPOLIA_ID = 84532;
export const BASESCAN = "https://sepolia.basescan.org";

export const VAULT_ADDRESS = "0x11b13bb8bF710D9B4DfD63B77DC27dC93b69C69a" as const;
export const EUSDC_ADDRESS = "0x6aaBC0dBC77Bb5F79781D42E2F58F1312bEf607B" as const;
export const ASSET_DECIMALS = 6;

export const VAULT_ABI = [
  { type: "function", name: "deposit", stateMutability: "nonpayable", inputs: [{ name: "assets", type: "uint256" }, { name: "receiver", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "redeem", stateMutability: "nonpayable", inputs: [{ name: "shares", type: "uint256" }, { name: "receiver", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "previewDeposit", stateMutability: "view", inputs: [{ name: "assets", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "convertToAssets", stateMutability: "view", inputs: [{ name: "shares", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "pricePerShare", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalAssets", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "redemptionsOpen", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "nextRedemptionOpen", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "redemptionCloses", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "manager", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "feeRecipient", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "highWaterMark", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "netPricePerShare", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "feesOwed", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "sync", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "markLoss", stateMutability: "nonpayable", inputs: [{ type: "uint256" }], outputs: [] },
] as const;

export const ERC20_ABI = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
] as const;
