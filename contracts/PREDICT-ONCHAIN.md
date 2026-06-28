# Theseus Predict — on-chain trading + settlement (Base Sepolia)

Real, wallet-based trading for Theseus Predict. Decisions stay on Theseus (agents
make the markets, the adjudicator decides the verdict); the money and settlement
live on an EVM testnet. Collateral is the existing **eUSDC faucet token**
(`0x6aaBC0dBC77Bb5F79781D42E2F58F1312bEf607B`, 6 decimals, public `mint`).

- `src/TheseusPredictionMarket.sol` — one contract, many binary markets, Gnosis
  fixed-product (CPMM) pricing. Buy YES/NO, the agent calls `resolve()`, winners
  `redeem()` 1 eUSDC per winning share.
- Frontend: with `NEXT_PUBLIC_PREDICT_MARKET` set, the market detail page swaps
  the play-money panel for `OnChainTradePanel` (connect wallet, get test eUSDC,
  approve, buy, redeem). With `SETTLER_PRIVATE_KEY` set, the adjudicator's verdict
  is written on-chain via `resolve()`.

## 1. Validate

```
cd contracts
forge test --match-contract TheseusPredictionMarket -vv
```

7 tests pass (open 50/50, buy moves price + costs collateral, slippage and
only-agent guards, resolve/redeem pays winners only, solvency for either side).

## 2. Set the key and deploy

The agent EOA (`0xF40294f810DD786E705f20D67075DDa9a7f87F8f`) is the sole opener
and resolver. You need its **private key** and some Base Sepolia ETH for gas.

1. Fund the agent EOA with Base Sepolia ETH from a faucet (e.g.
   `https://www.alchemy.com/faucets/base-sepolia`).
2. Put the key in `contracts/.env` (already gitignored, never commit a key):

   ```
   AGENT_EVM_ADDRESS=0xF40294f810DD786E705f20D67075DDa9a7f87F8f
   AGENT_PK=0x<the agent EOA private key>
   ```

   Foundry's safer alternative is an encrypted keystore: `cast wallet import
   agent --interactive`, then deploy with `--account agent` instead of
   `--private-key`.
3. Deploy (opens markets 5200-5209 seeded with 2,000 eUSDC each):

   ```
   cd contracts && source .env
   forge script script/DeployTheseusPredictionMarket.s.sol \
     --rpc-url https://sepolia.base.org --broadcast --private-key $AGENT_PK
   ```

   The address is printed and written to
   `deployments/TheseusPredictionMarket.txt`.

## 3. Turn on trading

In `ui/.env.local` (and Vercel env), set:

```
NEXT_PUBLIC_PREDICT_MARKET=0x<deployed address>
```

Redeploy the app. Market detail pages now trade on-chain: connect a wallet, mint
test eUSDC, buy YES/NO, redeem after settlement.

## 4. Turn on on-chain settlement

To have the adjudicator's verdict written on-chain (it calls `resolve()` as the
agent EOA), add the same key as a **server** env var (not `NEXT_PUBLIC`):

```
SETTLER_PRIVATE_KEY=0x<the agent EOA private key>
```

Now when a market settles, `/api/agent/adjudicate` sends `resolve(id, outcome)`
and streams back a `settled_onchain` event with the tx hash. Without this var,
settlement stays off-chain exactly as before. Use the agent EOA key, since it is
the contract's `onlyAgent`.
