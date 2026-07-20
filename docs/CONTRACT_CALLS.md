# Contract calls on BaseScan (detailed)

Manual path for wallet users. **Network: Base.**

See the disclaimer at the top of [README.md](../README.md).

---

## Addresses

| Name | Address |
|------|---------|
| Base USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| TokenMessenger V2 | `0x28b5A0e9C621a5BadaA536219b3a228C8168cf5d` |

Links:
- USDC Write: https://basescan.org/address/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913#writeContract
- TokenMessenger Write: https://basescan.org/address/0x28b5A0e9C621a5BadaA536219b3a228C8168cf5d#writeContract

---

## Pre-filled amounts (6 decimals)

| Human USDC | Raw `amount` | Suggested `maxFee` |
|------------|--------------|--------------------|
| 0.1 | `100000` | `20000` (0.02) |
| 0.5 | `500000` | `20000` |
| 1.0 | `1000000` | `20000` |
| 2.0 | `2000000` | `30000` |

`maxFee` must be **strictly less than** `amount`.

`minFinalityThreshold`: `1000`

---

## mintRecipient as bytes32

Pattern: `0x` + **24 zeros** + **address without 0x**

Example if wallet is `0x331e7D9B1fF8798620FA35F7fAbca491b379c783`:

```
0x000000000000000000000000331e7d9b1ff8798620fa35f7fabca491b379c783
```

Use **your** address.

---

## destinationCaller (open)

```
0x0000000000000000000000000000000000000000000000000000000000000000
```

---

## hookData (cctp-forward)

```
0x636374702d666f72776172640000000000000000000000000000000000000000
```

---

## Call 1 — `approve`

On **USDC** contract:

| Field | Value |
|-------|--------|
| `spender` | `0x28b5A0e9C621a5BadaA536219b3a228C8168cf5d` |
| `amount` | raw USDC (see table above) |

---

## Call 2 — `depositForBurnWithHook`

On **TokenMessenger V2**:

| Parameter | Example for 0.1 USDC |
|-----------|----------------------|
| `amount` | `100000` |
| `destinationDomain` | `26` |
| `mintRecipient` | your bytes32 address |
| `burnToken` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| `destinationCaller` | `0x0000000000000000000000000000000000000000000000000000000000000000` |
| `maxFee` | `20000` |
| `minFinalityThreshold` | `1000` |
| `hookData` | `0x636374702d666f72776172640000000000000000000000000000000000000000` |

---

## Parameter order (exact)

```
amount
destinationDomain
mintRecipient
burnToken
destinationCaller
maxFee
minFinalityThreshold
hookData
```

---

## Post-tx checks

1. Status success
2. Selector `0x779b432d`
3. To = Token Messenger
4. Save hash
5. Monitor Arc balance — **no second burn**
