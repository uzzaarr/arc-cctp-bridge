# How to bridge USDC: Base → Arc

**Audience:** Humans with a normal wallet (MetaMask, Rabby, etc.)  
**Method:** Circle CCTP V2 + `cctp-forward`

See the disclaimer at the top of [README.md](../README.md).

---

## What you need

| Item | Why |
|------|-----|
| Wallet on **Base** | Signs approve + burn |
| **USDC** on Base | Bridged asset |
| A little **ETH** on Base | Gas for 2 txs |
| Same address on Arc (recommended) | Receives minted USDC |

Start with a **small** amount (0.1 – 2 USDC).

---

## Step 1 — Add networks (if needed)

### Base
- Network name: Base
- Chain ID: `8453`
- RPC: `https://mainnet.base.org`
- Explorer: `https://basescan.org`

### Arc (so you can watch the mint)
- Network name: Arc
- Chain ID: `5042`
- RPC: `https://rpc.blockdaemon.mainnet.arc.io`
- Explorer: `https://explorer.arc.io` or `https://arc-mainnet.cloud.blockscout.com`

Note: Arc gas is **native USDC (18 decimals)**. You only need it later if you want to swap/send after mint.

---

## Step 2 — Choose how you call the contract

| Option | Who it’s for |
|--------|----------------|
| **A. BaseScan Write Contract** | Most reliable manual path |
| **B. Official SDK** (`@circle-fin/bridge-kit`) | Developers |
| **C. Third-party UI** | Only if it clearly uses domain 26 + cctp-forward |

When in doubt → use BaseScan.

---

## Step 3 — Approve USDC

1. Go to: https://basescan.org/address/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913#writeContract
2. Connect wallet (network must be Base)
3. Function `approve`:

| Field | Value |
|-------|--------|
| spender | `0x28b5A0e9C621a5BadaA536219b3a228C8168cf5d` |
| amount | raw 6 decimals (e.g. `100000` = 0.1 USDC) |

Confirm and wait for Success.

---

## Step 4 — Burn with hook

1. Go to: https://basescan.org/address/0x28b5A0e9C621a5BadaA536219b3a228C8168cf5d#writeContract
2. Connect wallet (still Base)
3. Function **`depositForBurnWithHook`** (not plain depositForBurn)

See [CONTRACT_CALLS.md](CONTRACT_CALLS.md) for exact pre-filled tables.

---

## Step 5 — Verify on Base

- [ ] Status = Success
- [ ] To = TokenMessenger V2
- [ ] Method = `depositForBurnWithHook` (selector `0x779b432d`)
- [ ] **Tx hash saved**

---

## Step 6 — Wait for Arc (do not re-burn)

1. Watch Arc (chainId 5042) USDC balance of your address.
2. Iris may stay “pending” for a long time — this is **normal** for Base→Arc.
3. When Arc USDC goes up → mint done.

| Do | Don’t |
|----|--------|
| Wait and check Arc | Burn again because “pending” |
| Save the burn tx | Clear history and “retry” |

---

## Next

- Detailed fields: [CONTRACT_CALLS.md](CONTRACT_CALLS.md)
- Safety: [SAFETY.md](SAFETY.md)
- FAQ: [FAQ.md](FAQ.md)
