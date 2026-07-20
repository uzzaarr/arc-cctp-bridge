# Safety rules — Base → Arc CCTP

See the main disclaimer at the top of [README.md](../README.md).

---

## Absolute never-do

1. **Never re-burn** after a successful Base burn for the “same” transfer.
2. **Never** treat Iris “pending” as “try again.”
3. **Never** set `destinationDomain` to anything other than **26** for Arc mainnet.
4. **Never** set `mintRecipient` to an address you do not control.
5. **Never** paste private keys into chat, GitHub, or committed scripts.
6. **Never** trust a random bridge site without verifying it calls TokenMessenger V2 with your params.
7. **Never** burn more than you can afford to lock until mint completes.

---

## Always-do

1. Start **small**.
2. Confirm network = **Base** before signing.
3. Confirm contract = **TokenMessenger V2** `0x28b5A0e9…`.
4. Prefer **`depositForBurnWithHook` + cctp-forward**.
5. Save the **burn tx hash**.
6. Track completion on **Arc**, not only Base or Iris.
7. One logical transfer = **one successful burn**.

---

## Iris reality (Base → Arc)

Public Iris for Base domain 6 → Arc domain 26 often stays **`pending_confirmations`** even when mints have completed.

**Do not** use Iris alone to decide to burn again.

---

## After a stuck burn

1. Keep the Base tx hash.
2. Watch Arc `balanceOf(you)` on USDC ERC-20.
3. Do **not** burn a second time “to force it.”
4. A second burn is a **new** irreversible lock of **more** USDC.
