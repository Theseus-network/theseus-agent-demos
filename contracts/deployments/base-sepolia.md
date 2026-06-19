# Base Sepolia deployments

Chain id `84532`. Agent EOA (sole writer for every contract):
`0xF40294f810DD786E705f20D67075DDa9a7f87F8f`

All contracts compile with solc `0.8.22` from `foundry.toml`'s default
profile and are deployed from `contracts/script/Deploy*.s.sol`.

## Live contracts

| Contract | Address | Tier |
|---|---|---|
| SovereignFund | [`0x3e1cEd606571A35c43DA11a3b21C051690Bd926a`](https://sepolia.basescan.org/address/0x3e1cEd606571A35c43DA11a3b21C051690Bd926a) | Sovereign (holds funds) |
| LaunchSniperFund | [`0xa6FbaadeA4e7f58D812D989737D708B279E8bd21`](https://sepolia.basescan.org/address/0xa6FbaadeA4e7f58D812D989737D708B279E8bd21) | Sovereign (paper) |
| TerraFailsafe | [`0x0B59da3768CB0F1725A1C2183dD1Ad93058394d2`](https://sepolia.basescan.org/address/0x0B59da3768CB0F1725A1C2183dD1Ad93058394d2) | Civic gate |
| BridgeGuardian | [`0xe442277ba5ce3f5aF5eDAE26206976ADC964C26C`](https://sepolia.basescan.org/address/0xe442277ba5ce3f5aF5eDAE26206976ADC964C26C) | Civic gate |
| GovernanceReviewer | [`0xc9CCF578093603e419997358fa9646Bd891B018a`](https://sepolia.basescan.org/address/0xc9CCF578093603e419997358fa9646Bd891B018a) | Civic advisory |
| AviationSafetyReviewer | [`0x453cE65E5D6eBc6C71f3e420e720d2C2E1D03bce`](https://sepolia.basescan.org/address/0x453cE65E5D6eBc6C71f3e420e720d2C2E1D03bce) | Civic advisory |
| PredictionMarketAdjudicator | [`0xd14A0963D48B944463F3fE6e776C11e09101bE40`](https://sepolia.basescan.org/address/0xd14A0963D48B944463F3fE6e776C11e09101bE40) | Civic gate |
| VellumAuthor | [`0x3C33b1C332F4713570fbF87dB6a816d74Eef8088`](https://sepolia.basescan.org/address/0x3C33b1C332F4713570fbF87dB6a816d74Eef8088) | Authorship |
| ApertureArtist | [`0xA10BAbeE86c1f1838891c549d63c49697620F98A`](https://sepolia.basescan.org/address/0xA10BAbeE86c1f1838891c549d63c49697620F98A) | Authorship |
| MarcellusCritic | [`0xd9E4DceBb96c6361Be45a03c8ED6C8f21e5635DF`](https://sepolia.basescan.org/address/0xd9E4DceBb96c6361Be45a03c8ED6C8f21e5635DF) | Authorship |
| QuillCoAuthor | [`0x4ED9F5318354Bc044661cee3343bdBB955F78e06`](https://sepolia.basescan.org/address/0x4ED9F5318354Bc044661cee3343bdBB955F78e06) | Authorship |
| CalderChronicler | [`0x431D3728e3D69125fe6F3dbbDF788a2725904a3C`](https://sepolia.basescan.org/address/0x431D3728e3D69125fe6F3dbbDF788a2725904a3C) | Authorship (NPC dispatch log) |
| AgentEscrow | [`0x7b1d5D2709334168A452955f378c6C20062249b6`](https://sepolia.basescan.org/address/0x7b1d5D2709334168A452955f378c6C20062249b6) | Sovereign (real custody — holds funds) |
| Escrow eUSDC (faucet token) | [`0x6aaBC0dBC77Bb5F79781D42E2F58F1312bEf607B`](https://sepolia.basescan.org/address/0x6aaBC0dBC77Bb5F79781D42E2F58F1312bEf607B) | Mock ERC-20 |

`AgentEscrow` differs from the other surfaces: it is a real custody contract,
not a commitment record. A buyer funds a deal against a written brief; the
agent's `resolve()` moves the escrowed eUSDC to the side the record supports
(or refunds the buyer on UNRESOLVABLE). Verified end to end on chain: a funded
deal, disputed and settled RELEASE at 99%, paid the seller the full amount.
Deployed from `script/DeployAgentEscrow.s.sol`; the app lives at `/escrow`.

A second `AgentEscrow` instance backs the **agent-to-agent market** at `/market`:
`0xf568d5C7aB29ACB16D02D0BDEF6A7bdAd5ace868` (eUSDC `0xAC755429040F395a322Eb778B3bf5F4fADf3294c`).
A requester agent funds a task, a provider agent delivers, and the adjudicator
verifies and releases (or refunds). The two agent wallets are derived from the
agent key (no extra secrets): requester `0x7237d9177921C5E1C3Fd3DEf457F131092d8fe13`,
provider `0x6fa49D9b502Fff9166a2e4B683E9493640C0Eb0F`, funded by `ui/setup-market.mjs`.

Hash preimages used at deploy (Vellum/Aperture/Marcellus only — Quill and Calder take no persona hash):

```
VELLUM_VOICE_PROFILE_HASH = keccak256("rhythmic-density:medium-high|lexical-register:literary+vernacular|obsessions:time,distance,inherited-language|structural-prefs:short-paragraphs,fragments|tonal-register:lucid|closed-lexicon:vibe,literally-nonliteral,weather-opener,question-closer,process-reference|form-distribution:fiction-45,essay-35,fragment-20")
  = 0xe6222a8d8d566b1663ec5074d3ad6b0aa7dd7ac9eb735e0e25bf4355218074cd

APERTURE_FINGERPRINT_HASH = keccak256("aperture-0312:38,24,86|13,51,44|222,35,15|220,9,35|33,65,60|25,8,14:thirds-anchored;no-figural;no-text;density-le-40;matte-no-gradients")
  = 0xaedca7577f5a0373b0145cac98fb2f506f72ad08d0b5babe5dfb5975d006cb08

MARCELLUS_PERSONA_HASH = keccak256("marcellus:laconic,fact-first|canon:Coltrane-ALS,TalkTalk-SoE,BoC-MHTRtC,Burial-Untrue,KDot-TPAB,caroline-2022|closed:vibe,literally,important,redefines,reinvents,stunning,radiohead|refuses:label-paid,litigation-active,unreleased,out-of-engagement")
  = 0xd3a9f882a186b60d93c2cec86194863fd75b0ed37664cfa1b7bcd914dd1e9299
```

Not deployed:
- `AgentPriceFeed.sol` — inherits from `aave-v3-core`, which isn't
  installed in this workspace. The Aave Oracle UI demo runs against
  mocked state and doesn't need an on-chain feed.
