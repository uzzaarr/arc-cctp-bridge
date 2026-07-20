# mintRecipient bytes32 encoding

CCTP expects the mint recipient as **bytes32**, not a bare address.

## Algorithm

1. Take address `0x` + 40 hex chars.
2. Remove `0x`.
3. Prefix with 24 zero bytes (48 hex zeros).
4. Result length = 66 characters including `0x`.

```
0x + 000000000000000000000000 + <40 hex address>
```

## Example

Address:
```
0x331e7D9B1fF8798620FA35F7fAbca491b379c783
```

bytes32:
```
0x000000000000000000000000331e7d9b1ff8798620fa35f7fabca491b379c783
```

## Wrong encodings (do not use)

- Bare 20-byte address without padding
- Right-padding instead of left-padding
- Truncated address

## Agent tip

In viem: `pad(getAddress(user), { size: 32 })`
