# FAQ — Bridging to Arc

### Is this official?

No. This is unofficial documentation. See the disclaimer in README.md.

### Is there a simple one-click website?

There is no single trusted one-click mainnet Base→Arc web app endorsed by this guide. Prefer BaseScan or the provided script.

### Why is Iris stuck on pending?

For Base → Arc, public Iris often stays pending even after successful mints. Treat Iris as optional. Truth = Arc USDC balance.

### When is my bridge done?

When Arc USDC balance of your mint recipient increases.

### Can I reverse a burn?

No. Successful burns are final.

### Do I need Arc gas to bridge?

No. You only need Base ETH for the burn. You need Arc native gas later only if you want to swap or send after mint.

### What is domain 26?

Circle CCTP domain ID for Arc. Destination domain in the burn must be 26.

### Can I bridge from Ethereum?

Yes, same idea (domain 26 + cctp-forward). This guide is Base-first.
