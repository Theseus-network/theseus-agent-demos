// ABIs for the AgentEscrow custody contract and its mock USDC. Shared by the
// server settlement path (viem) and the browser (wagmi). Kept hand-written and
// minimal so there's no codegen step.

export const ESCROW_ABI = [
  // views
  { type: "function", name: "agent", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "token", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "dealCount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function",
    name: "getDeal",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "buyer", type: "address" },
          { name: "seller", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "deadline", type: "uint64" },
          { name: "status", type: "uint8" },
          { name: "spec", type: "string" },
          { name: "delivery", type: "string" },
          { name: "confidencePct", type: "uint8" },
          { name: "reasonHash", type: "bytes32" },
        ],
      },
    ],
  },
  // writes
  {
    type: "function",
    name: "createDeal",
    stateMutability: "nonpayable",
    inputs: [
      { name: "seller", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "deadline", type: "uint64" },
      { name: "spec", type: "string" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "function",
    name: "submitDelivery",
    stateMutability: "nonpayable",
    inputs: [
      { name: "id", type: "uint256" },
      { name: "delivery", type: "string" },
    ],
    outputs: [],
  },
  { type: "function", name: "approveRelease", stateMutability: "nonpayable", inputs: [{ name: "id", type: "uint256" }], outputs: [] },
  { type: "function", name: "refundBuyer", stateMutability: "nonpayable", inputs: [{ name: "id", type: "uint256" }], outputs: [] },
  { type: "function", name: "dispute", stateMutability: "nonpayable", inputs: [{ name: "id", type: "uint256" }], outputs: [] },
  { type: "function", name: "claimDelivered", stateMutability: "nonpayable", inputs: [{ name: "id", type: "uint256" }], outputs: [] },
  { type: "function", name: "reclaimUndelivered", stateMutability: "nonpayable", inputs: [{ name: "id", type: "uint256" }], outputs: [] },
  {
    type: "function",
    name: "resolve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "id", type: "uint256" },
      { name: "outcome", type: "uint8" },
      { name: "confidencePct", type: "uint8" },
      { name: "reasonHash", type: "bytes32" },
    ],
    outputs: [],
  },
  // events
  {
    type: "event",
    name: "DealCreated",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "buyer", type: "address", indexed: true },
      { name: "seller", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "deadline", type: "uint64", indexed: false },
    ],
  },
  {
    type: "event",
    name: "AgentSettled",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "outcome", type: "uint8", indexed: false },
      { name: "confidencePct", type: "uint8", indexed: false },
      { name: "reasonHash", type: "bytes32", indexed: false },
    ],
  },
] as const;

export const ERC20_ABI = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "o", type: "address" }, { name: "s", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "s", type: "address" }, { name: "a", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "a", type: "uint256" }], outputs: [] },
] as const;

// Deal.status values (mirror AgentEscrow.Status)
export const STATUS = {
  NONE: 0,
  FUNDED: 1,
  DELIVERED: 2,
  DISPUTED: 3,
  RELEASED: 4,
  REFUNDED: 5,
  UNRESOLVABLE: 6,
} as const;

export const STATUS_LABEL: Record<number, string> = {
  0: "None",
  1: "Funded",
  2: "Delivered",
  3: "Disputed",
  4: "Released",
  5: "Refunded",
  6: "Unresolvable",
};

// AgentEscrow.Outcome
export const OUTCOME = { RELEASE: 0, REFUND: 1, UNRESOLVABLE: 2 } as const;
