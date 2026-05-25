<div align="center">

# Theseus Agent Demos

**Thirteen autonomous agents. Reads raw data, signs every decision, commits its reasoning on-chain.**

[Live demos](https://demo-agents.theseus.network) · [theseus.network](https://theseus.network) · [Whitepaper](https://docsend.com/view/p9fw7vh3ygrrnwgg)

[![Built on Theseus](https://img.shields.io/badge/Built%20on-Theseus-blue?style=flat-square)](https://theseus.network)
[![Chain](https://img.shields.io/badge/Base%20Sepolia-12%20contracts-purple?style=flat-square)](contracts/deployments/base-sepolia.md)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

</div>

## What this is

Thirteen working agents you can run in a browser tab. Each one reasons from raw inputs (no oracles, no aggregators, no human caller), reaches a decision, signs it, and writes the reason hash to a per-agent commitment contract on Base Sepolia. The on-chain row is the proof that the agent — not a human pressing a button — produced the call.

Eight of them are **adjudication** agents: oracles, mechanism gates, reviewers. Five are **non-adjudication**: authors, artists, critics, NPCs. The split matters because adjudication is the load-bearing case for verifiable autonomy — when an agent's wrong, the only thing standing between an exploit and a depositor is the contract's willingness to trust it. The other five demos exist to show the surface generalizes beyond DeFi: a music critic signing a review is the same machinery as an oracle refusing to price.

## The thirteen

| Demo | Kind | One line | Live |
|---|---|---|---|
| [aave](ui/src/app/aave/page.tsx) | Oracle replacement | Reads Coinbase, Binance, Uniswap. Refuses when they disagree. | [↗](https://demo-agents.theseus.network/aave) |
| [terra](ui/src/app/terra/page.tsx) | Mechanism gate | Gates mint/redeem on a Terra-shaped algo stable (loads live Frax peg). | [↗](https://demo-agents.theseus.network/terra) |
| [adjudicate](ui/src/app/adjudicate/page.tsx) | Resolution oracle | Resolves prediction markets with native Claude web search. | [↗](https://demo-agents.theseus.network/adjudicate) |
| [bridge](ui/src/app/bridge/page.tsx) | Cross-chain gate | Reviews real Across fills landing on Base. | [↗](https://demo-agents.theseus.network/bridge) |
| [governance](ui/src/app/governance/page.tsx) | Proposal reviewer | Reads live Arbitrum DAO Snapshot proposals. Green/amber/red verdict. | [↗](https://demo-agents.theseus.network/governance) |
| [aviation](ui/src/app/aviation/page.tsx) | Type-cert reviewer | Reviews live FAA Airworthiness Directives. | [↗](https://demo-agents.theseus.network/aviation) |
| [fund](ui/src/app/fund/page.tsx) | Self-scheduled trader | Paper-trades a $100k portfolio against live ETH on tick. | [↗](https://demo-agents.theseus.network/fund) |
| [launch-sniper](ui/src/app/launch-sniper/page.tsx) | Self-scheduled scout | Watches Base for fresh Uniswap V3 pools. Source verification + GoPlus + Brave/DeepSeek narrative. Mostly passes. | [↗](https://demo-agents.theseus.network/launch-sniper) |
| [vellum](ui/src/app/vellum/page.tsx) | Agentic NFT (literary author) | Mint-locked voice profile. Signed bibliography. | [↗](https://demo-agents.theseus.network/vellum) |
| [aperture](ui/src/app/aperture/page.tsx) | Agentic NFT (visual artist) | Mint-locked palette and composition. Refusals are signed. | [↗](https://demo-agents.theseus.network/aperture) |
| [marcellus](ui/src/app/marcellus/page.tsx) | AI persona (music critic) | Reviews live Pitchfork releases against a signed canon. | [↗](https://demo-agents.theseus.network/marcellus) |
| [quill](ui/src/app/quill/page.tsx) | AI legal collaborator | Verifies citations against CourtListener. Per-span signatures. | [↗](https://demo-agents.theseus.network/quill) |
| [calder](ui/src/app/calder/page.tsx) | Sovereign NPC | Walks AI Town, witnesses events, signs every dispatch. | [↗](https://demo-agents.theseus.network/calder) |

## Why these specific demos

The picks aren't arbitrary. Each one reproduces the shape of a real on-chain failure:

- **aave** — Mango Markets, 2022, $116M. Aave-shaped lending logic accepted a price its users had manipulated.
- **terra** — Terra/Luna, 2022, ~$40B. The minter kept honoring redemptions long after the peg was structurally broken.
- **bridge** — Ronin (2022, $625M), Wormhole (2022, $325M), Nomad (2022, $190M). Validator-signed releases against attacker-side state.
- **adjudicate** — Polymarket's various adjudication disputes. A binary outcome is only as good as the source it reads.
- **launch-sniper** — every meme-rug since 2024. The shape is: contract verified somewhere, mint authority not renounced, deployer with a string of dead deploys.

A SHIP-style agent doesn't need a more careful version of the same logic. It reads the raw data, decides whether the inputs cohere, and either acts or refuses — and the refusal is what makes the difference. Every demo in this repo ships with a refusal path that's reachable from the UI.

## Architecture

```
                    ┌──────────────────────────────┐
                    │ demo-agents.theseus.network  │
                    │ (Next.js · 13 routes)        │
                    └──────────────────────────────┘
                              │
                              │ POST /api/demo/<slug>
                              ▼
                    ┌──────────────────────────────┐
                    │ Server route per demo        │
                    │ - build dossier (multi-API)  │
                    │ - call LLM (Anthropic/etc.)  │
                    │ - parse verdict              │
                    └──────────────────────────────┘
                              │
                              │ publish reason JSON
                              ▼
                  ┌────────────────────────────────────┐
                  │ Vercel Blob                        │
                  │ launch-sniper/<reasonHash>.json    │
                  └────────────────────────────────────┘
                              │
                              │ writeContract (Base Sepolia)
                              ▼
       ┌────────────────────────────────────────────────┐
       │ <Agent>History.sol — per-demo commitment       │
       │ - immutable agent EOA                          │
       │ - only-agent writes                            │
       │ - touchedIdCount() for indexers                │
       └────────────────────────────────────────────────┘
```

Every demo's decision becomes a Base Sepolia transaction. The contract doesn't reproduce the agent's reasoning; it just stores a `bytes32` reason hash. The hash points at a Vercel Blob containing the full dossier (raw data the agent saw + LLM output verbatim). That separation is the design — the chain proves *who and when*, the blob proves *what was decided and why*, and re-running the prompt against the dossier reproduces the decision.

## Layout

| Path | Purpose |
|------|---------|
| `contracts/src/` | 13 Solidity contracts: 1 Aave-shaped price feed + 12 agent commitment surfaces. All solc 0.8.22, deployed on Base Sepolia. |
| `contracts/script/Deploy*.s.sol` | One Foundry script per agent. Reads `AGENT_EVM_ADDRESS` + persona-hash env vars; writes the deployed address to `deployments/<Contract>.txt`. |
| `contracts/deployments/base-sepolia.md` | Single source of truth for live contract addresses on chain 84532, plus the keccak preimages used for persona hashes. |
| `ui/src/app/<demo>/page.tsx` | One page per demo. Each is a self-contained Next.js route. |
| `ui/src/app/api/demo/[slug]/route.ts` | Adjudication agents share this handler (governance, aviation, terra, etc.). Each non-adjudication agent has its own. |
| `ui/src/lib/` | Per-demo glue: external API clients, scenario state, LLM prompt builders, dossier shapes. |
| `agents/` | Original Aave Oracle SHIP agent (used by the `/aave` demo). |
| `cli/`, `pallets/`, `tools/`, `scripts/` | Original Aave PoC tooling for running the Theseus node locally. The other 12 demos run against Base Sepolia and don't need any of this. |

## Running it

```bash
# UI (all 13 demos, against Base Sepolia)
cd ui
cp .env.example .env.local
# fill in: ANTHROPIC_API_KEY, DEEPSEEK_API_KEY, BRAVE_SEARCH_API_KEY,
# ETHERSCAN_API_KEY, AGENT_PRIVATE_KEY (Base Sepolia ETH), BLOB_*
npm install
npm run dev
```

```bash
# Original Aave Oracle PoC (local Theseus node)
./scripts/setup_demo.sh           # starts node, deploys Aave + AgentPriceFeed, registers agent
op deposit 1 && op borrow 1500    # both succeed (~$3500/ETH)
op tamper uniswap --price 100000  # override one venue
op status                         # AgentPriceFeed.decision == REFUSED
```

Every secret in `.env.example` is empty by design — fill in your own keys.

## Live deployments

12 contracts on Base Sepolia (chain 84532), all writes signed by `0xF40294f810DD786E705f20D67075DDa9a7f87F8f`. See [`contracts/deployments/base-sepolia.md`](contracts/deployments/base-sepolia.md) for the table and [explorer](https://sepolia.basescan.org/address/0xF40294f810DD786E705f20D67075DDa9a7f87F8f) for the agent's tx history.

The home stats strip at [theseus.network](https://theseus.network) reads `touchedIdCount()` from each contract — when it says "N verdicts signed," that N is the sum of writes across these 12 surfaces.

## SHIP ↔ EVM bridge

The Aave Oracle demo (`/aave`) uses Theseus's `pallet-revive` (PolkaVM, RISC-V) EVM stack — Solidity contracts compile via Parity's `resolc` and run unmodified at the source level. The Ethereum-compatible JSON-RPC is exposed via the `eth-rpc` proxy on port 8545. SHIP calls into EVM via `evm_call(target, calldata, value)`, dispatched as `pallet_revive::Pallet::call` with the agent's deterministically-mapped address as `msg.sender`.

The other 12 demos run against Base Sepolia directly; they don't depend on PolkaVM or SHIP.

## License

MIT.
