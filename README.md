# Bridge USDC Base → Arc (Circle CCTP V2)

> **Important Disclaimer**  
> This is **unofficial** documentation.  
> Not affiliated with Circle or Arc.  
> Not financial advice.  
> Bridging is **not guaranteed**. The burn on Base is final and irreversible.  
> A wrong domain, wrong recipient, or re-burn can cause permanent loss of funds.  
> Always start with a tiny test amount (0.1 – 0.5 USDC).  
> Use at your own risk.

---

## One-sentence method

On **Base**, approve USDC → call Circle **TokenMessenger V2**  
`depositForBurnWithHook` with **destinationDomain = 26** (Arc), **mintRecipient = you**, and hook **`cctp-forward`**.  
Then wait for Arc USDC balance to rise. **Never re-burn** the same transfer.

---

## Choose your path

### Path A — Manual (MetaMask / Rabby / normal wallet)
Best for most people. You sign two transactions yourself on BaseScan.

→ Full walkthrough: [docs/HOW_TO_BRIDGE.md](docs/HOW_TO_BRIDGE.md)  
→ Copy-paste fields: [docs/CONTRACT_CALLS.md](docs/CONTRACT_CALLS.md)

### Path B — AI Agent / Script
Use a **fresh burner wallet** + local `.env` file.  
Do **not** paste your private key into chat. Keep it only in `scripts/.env` on your machine.

```bash
npm install
cp scripts/.env.example scripts/.env   # then edit PRIVATE_KEY
node scripts/bridge-base-to-arc.mjs --preflight
node scripts/bridge-base-to-arc.mjs --amount 0.1
```

→ Read [AGENTS.md](AGENTS.md) first (mandatory)  
→ Script: [scripts/bridge-base-to-arc.mjs](scripts/bridge-base-to-arc.mjs)

---

## Quick start (humans)

| Step | Action |
|------|--------|
| 1 | Base wallet with **USDC** + a little **ETH** for gas |
| 2 | Approve Base USDC → TokenMessenger V2 |
| 3 | Call `depositForBurnWithHook` (domain **26**, hook **cctp-forward**) |
| 4 | Confirm success on BaseScan — **save the tx hash** |
| 5 | Watch **Arc** balance of the same address — **do not re-burn** if Iris says pending |

---

## Why this path?

| Approach | Verdict |
|----------|---------|
| **CCTP V2 + `cctp-forward` hook** | **Recommended** — official Circle burn + auto-mint intent |
| Plain `depositForBurn` (no hook) | Works, but weaker auto-completion |
| Random third-party “Arc bridge” UI | Avoid unless it clearly calls the contracts below |

Official references:
- [Circle supported chains & domains](https://developers.circle.com/cctp/concepts/supported-chains-and-domains) (Arc = domain **26**)
- [Circle Forwarding Service](https://developers.circle.com/cctp/concepts/forwarding-service)
- [Circle transfer with forwarding](https://developers.circle.com/cctp/howtos/transfer-usdc-with-forwarding-service)
- [Arc docs](https://docs.arc.io/)

---

## Canonical addresses (mainnet)

| Role | Value |
|------|--------|
| Base chainId | `8453` |
| Base CCTP domain | `6` |
| Arc chainId | `5042` |
| Arc CCTP domain | `26` |
| TokenMessenger V2 | `0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d` |
| MessageTransmitter V2 | `0x81D40F21F12A8F0E3252Bccb954D722d4c464B64` |
| Base USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Arc USDC (ERC-20) | `0x3600000000000000000000000000000000000000` |
| Forward hook (32 bytes) | `0x636374702d666f72776172640000000000000000000000000000000000000000` |

Always re-check against [references/addresses.json](references/addresses.json).

---

## Mental model

```
Base: approve USDC → depositForBurnWithHook (+ cctp-forward)
        ↓
   Burn is FINAL on Base
        ↓
Circle attestation + forwarder
        ↓
Arc: USDC minted to mintRecipient
```

| Signal | Meaning |
|--------|---------|
| Base tx **Success** + DepositForBurn | You are in the queue |
| Arc USDC balance **up** | Mint completed |
| Iris UI “pending” a long time | **Normal for Base→Arc** — do **not** re-burn |

**Truth of completion = Arc on-chain balance, not Iris UI.**

---

## Example correct burn

[BaseScan tx](https://basescan.org/tx/0x929e29c1ecc715456a90c43bbfb0a0b10d295d8d19b6766e6517cc13408ab037)

- To: TokenMessenger V2  
- Method: `depositForBurnWithHook` (`0x779b432d`)  
- Destination domain: **26**

---

## Repo map

```
README.md                 ← you are here
AGENTS.md                 ← hard rules for AI agents
package.json
scripts/
  bridge-base-to-arc.mjs  ← ready agent script
  .env.example
docs/
  HOW_TO_BRIDGE.md
  CONTRACT_CALLS.md
  SAFETY.md
  FAQ.md
references/
  addresses.json          ← single source of truth
examples/
  mintRecipient-bytes32.md
```

---

## License

MIT
