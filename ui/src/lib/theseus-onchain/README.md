# Theseus on-chain integration

A wired-up but not-yet-active layer between the demo site and a real
Theseus chain. Each of the 13 demo pages on this site has a
centralized off-chain implementation today (the `/api/demo/<slug>`
route calls DeepSeek directly and writes a verdict to a Base Sepolia
contract). Once the public Theseus chain is running and the demo
agents are deployed, this layer lets each demo dispatch its work to a
real on-chain Theseus agent and read the result back via chain
events.

## Status

**Currently unset for every demo.** The integration code is in place;
flipping each demo to the on-chain path is one env var per demo plus
the global RPC URL. Until that happens, the UI shows a
"Theseus on-chain · coming soon" pill on each demo page, and the
existing centralized flow runs unchanged.

## How to flip the switch

When the public Theseus chain is running and the 13 demo templates
have been deployed there (via the
[playground](https://github.com/Theseuschain/playground) or
[`deploy-all-13.sh`](https://github.com/Theseuschain/theseus-chain/tree/master/examples/deploy-all-13)):

1. Record each agent's SS58 from the deploy output / chain explorer.
2. Set the env vars in `ui/.env.local` (see `.env.example`):

   ```
   NEXT_PUBLIC_THESEUS_RPC=wss://testnet.theseus.network
   NEXT_PUBLIC_THESEUS_AGENT_VELLUM=5GWDguafNCTtyd2Ckttyu...
   NEXT_PUBLIC_THESEUS_AGENT_AAVE=5D9Cs5k4fbjnt...
   …one per demo slug…
   THESEUS_SIGNER_SEED=<funded account seed for server-side calls>
   ```

3. Restart the dev server.

The "coming soon" pills automatically become
"Theseus on-chain · <truncated-ss58>" links to the explorer.

## What's wired up today

- **[`config.ts`](./config.ts)** — typed registry of demo slugs and
  their corresponding SS58s, sourced from `NEXT_PUBLIC_*` env vars.
  `isOnChainConfigured(slug)` returns true only for demos with real
  SS58s set.
- **[`agent-call.ts`](./agent-call.ts)** — `callAgent({ slug, prompt })`
  shape ready to submit `pallet_agents.call` extrinsics via
  `@polkadot/api`. Currently throws `OnChainNotConfigured` because
  the implementation needs the SHIP type registrations
  (`StructuredValue::String` SCALE codec) which haven't been confirmed
  against a live chain. The body is a TODO list pointing at what to
  fill in.
- **[`index.ts`](./index.ts)** — public re-exports for consumers.
- **[`<TheseusOnChainPill />`](../../components/TheseusOnChainPill.tsx)** —
  client component that renders the status badge on each demo page.

## How to extend to the other demos

The pattern is identical for every demo. Pick one (say `aave`):

1. Open `ui/src/app/aave/page.tsx`.
2. Import the pill: `import { TheseusOnChainPill } from "@/components/TheseusOnChainPill";`
3. Render it once, near the demo's header or above the demo
   component: `<TheseusOnChainPill slug="aave" />`

That's it. The pill auto-detects whether the env var is set and
shows the right state. No per-demo wiring beyond that until you want
to replace the centralized `/api/demo/aave` route with an on-chain
call, at which point:

4. Import `callAgent` and `isOnChainConfigured` from `@/lib/theseus-onchain`.
5. Inside the route handler, branch on `isOnChainConfigured('aave')`:
   if true, await `callAgent({ slug: 'aave', prompt: userInput })`
   and return `finalMessage` to the client.
   If false, fall back to the existing centralized handler.

Both halves of the integration (UI surface + route swap) can be
landed independently.

## Why a server-side signer

The `/api/demo/<slug>` routes run server-side and currently hold the
demo's DeepSeek key. For symmetry, the on-chain path also signs
server-side with a funded account (`THESEUS_SIGNER_SEED`). Visitors
see the same "click button → answer appears" UX whether the demo is
centralized or on-chain. No wallet install required.

Future iteration: add a "connect wallet" path so visitors who have
Polkadot.js / Talisman can sign their own calls and own the agent
they invoked. That's a UX layer on top — the server-side path stays
as the default.

## See also

- [theseus-chain/examples/deploy-all-13/](https://github.com/Theseuschain/theseus-chain/tree/master/examples/deploy-all-13)
  — batch-deploy script that produces the 13 agents whose SS58s go
  into this config.
- [playground/templates/](https://github.com/Theseuschain/playground/tree/master/templates)
  — same 13 agents as in-browser editor templates, plus
  `byo-agent` / `byo-typed` for porting external agents.
