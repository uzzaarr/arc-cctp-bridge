#!/usr/bin/env node
/**
 * Base → Arc USDC bridge via Circle CCTP V2 + cctp-forward
 *
 * Safety features:
 * - Loads private key ONLY from local .env
 * - Hard max amount limit
 * - Explicit confirmation required
 * - Never logs the private key
 * - Preflight mode available
 *
 * Usage:
 *   1. Copy scripts/.env.example → scripts/.env
 *   2. Fill PRIVATE_KEY (use a burner!)
 *   3. node scripts/bridge-base-to-arc.mjs --preflight
 *   4. node scripts/bridge-base-to-arc.mjs --amount 0.1
 */

import { createPublicClient, createWalletClient, http, parseUnits, formatUnits, pad, getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Config (correct EIP-55 checksums) ────────────────────────────────
// Note: modern viem strictly validates checksums. Wrong casing throws InvalidAddressError.
const TOKEN_MESSENGER = getAddress("0x28b5a0e9c621a5badaa536219b3a228c8168cf5d");
const BASE_USDC = getAddress("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913");
const DESTINATION_DOMAIN = 26;
const MIN_FINALITY = 1000;
const HOOK_DATA = "0x636374702d666f72776172640000000000000000000000000000000000000000";
const MAX_ALLOWED_USDC = 5; // hard safety limit

// ── Load .env manually (no external dependency) ────────────────────
function loadEnv() {
  const envPath = resolve(__dirname, ".env");
  if (!existsSync(envPath)) {
    console.error("\n❌ No scripts/.env found.");
    console.error("   Copy scripts/.env.example → scripts/.env and fill PRIVATE_KEY\n");
    process.exit(1);
  }
  const content = readFileSync(envPath, "utf8");
  const env = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [key, ...rest] = trimmed.split("=");
    env[key.trim()] = rest.join("=").trim().replace(/^['"]|['"]$/g, "");
  }
  return env;
}

const env = loadEnv();
const PRIVATE_KEY = env.PRIVATE_KEY;
const RECIPIENT = env.RECIPIENT_ADDRESS || null;

if (!PRIVATE_KEY || !PRIVATE_KEY.startsWith("0x")) {
  console.error("\n❌ PRIVATE_KEY missing or invalid in scripts/.env\n");
  process.exit(1);
}

// ── Clients ────────────────────────────────────────────────────
const account = privateKeyToAccount(PRIVATE_KEY);
const publicClient = createPublicClient({
  chain: base,
  transport: http("https://mainnet.base.org"),
});
const walletClient = createWalletClient({
  account,
  chain: base,
  transport: http("https://mainnet.base.org"),
});

const usdcAbi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
];

const tmAbi = [
  {
    name: "depositForBurnWithHook",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "destinationDomain", type: "uint32" },
      { name: "mintRecipient", type: "bytes32" },
      { name: "burnToken", type: "address" },
      { name: "destinationCaller", type: "bytes32" },
      { name: "maxFee", type: "uint256" },
      { name: "minFinalityThreshold", type: "uint32" },
      { name: "hookData", type: "bytes" },
    ],
    outputs: [{ type: "uint64" }],
  },
];

// ── Helpers ────────────────────────────────────────────────────
function toBytes32Address(addr) {
  return pad(getAddress(addr), { size: 32 });
}

async function preflight() {
  console.log("\n🔍 Preflight (read-only)\n");
  console.log("Burner address :", account.address);

  const ethBalance = await publicClient.getBalance({ address: account.address });
  const usdcBalance = await publicClient.readContract({
    address: BASE_USDC,
    abi: usdcAbi,
    functionName: "balanceOf",
    args: [account.address],
  });
  const allowance = await publicClient.readContract({
    address: BASE_USDC,
    abi: usdcAbi,
    functionName: "allowance",
    args: [account.address, TOKEN_MESSENGER],
  });

  console.log("ETH balance    :", formatUnits(ethBalance, 18), "ETH");
  console.log("USDC balance   :", formatUnits(usdcBalance, 6), "USDC");
  console.log("USDC allowance :", formatUnits(allowance, 6), "USDC");
  console.log("Recipient      :", RECIPIENT || account.address, "(same as burner if not set)");
  console.log("\n✅ Preflight complete. No transactions sent.\n");
}

async function bridge(amountUsdc) {
  if (amountUsdc > MAX_ALLOWED_USDC) {
    console.error(`\n❌ Amount ${amountUsdc} exceeds hard safety limit of ${MAX_ALLOWED_USDC} USDC\n`);
    process.exit(1);
  }

  const amount = parseUnits(String(amountUsdc), 6);
  const maxFee = parseUnits("0.02", 6); // 0.02 USDC
  const recipient = RECIPIENT || account.address;
  const mintRecipient = toBytes32Address(recipient);

  console.log("\n🚀 Bridge plan");
  console.log("-------------");
  console.log("From          :", account.address);
  console.log("To (Arc)      :", recipient);
  console.log("Amount        :", amountUsdc, "USDC");
  console.log("maxFee        :", "0.02 USDC");
  console.log("Domain        :", DESTINATION_DOMAIN);
  console.log("Hook          : cctp-forward");
  console.log("");

  // Safety confirmation
  console.log("⚠️  This will BURN USDC on Base. It is irreversible.");
  console.log("    Type 'YES' (exactly) to continue, anything else to abort.\n");

  // Simple confirmation via stdin
  process.stdout.write("> ");
  const answer = await new Promise((resolve) => {
    process.stdin.once("data", (data) => resolve(data.toString().trim()));
  });

  if (answer !== "YES") {
    console.log("\nAborted by user.\n");
    process.exit(0);
  }

  // 1. Approve if needed
  const currentAllowance = await publicClient.readContract({
    address: BASE_USDC,
    abi: usdcAbi,
    functionName: "allowance",
    args: [account.address, TOKEN_MESSENGER],
  });

  if (currentAllowance < amount) {
    console.log("\n1/2 Approving USDC...");
    const hash = await walletClient.writeContract({
      address: BASE_USDC,
      abi: usdcAbi,
      functionName: "approve",
      args: [TOKEN_MESSENGER, amount],
    });
    console.log("   Approve tx:", hash);
    await publicClient.waitForTransactionReceipt({ hash });
    console.log("   ✅ Approve confirmed");
  } else {
    console.log("\n1/2 Allowance already sufficient");
  }

  // 2. Burn
  console.log("\n2/2 Calling depositForBurnWithHook...");
  const burnHash = await walletClient.writeContract({
    address: TOKEN_MESSENGER,
    abi: tmAbi,
    functionName: "depositForBurnWithHook",
    args: [
      amount,
      DESTINATION_DOMAIN,
      mintRecipient,
      BASE_USDC,
      "0x0000000000000000000000000000000000000000000000000000000000000000",
      maxFee,
      MIN_FINALITY,
      HOOK_DATA,
    ],
  });

  console.log("   Burn tx:", burnHash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: burnHash });

  if (receipt.status === "success") {
    console.log("\n✅ Burn successful!");
    console.log("   Tx hash:", burnHash);
    console.log("\nNext steps:");
    console.log("1. Save this tx hash");
    console.log("2. Watch your Arc USDC balance (chainId 5042)");
    console.log("3. Do NOT re-burn even if Iris shows pending");
    console.log("4. Completion = Arc balance increases\n");
  } else {
    console.error("\n❌ Burn transaction failed / reverted\n");
    process.exit(1);
  }
}

// ── CLI ────────────────────────────────────────────────────────
const args = process.argv.slice(2);

if (args.includes("--preflight") || args.includes("-p")) {
  await preflight();
} else if (args.includes("--amount") || args.includes("-a")) {
  const idx = args.findIndex((a) => a === "--amount" || a === "-a");
  const amount = parseFloat(args[idx + 1]);
  if (isNaN(amount) || amount <= 0) {
    console.error("Invalid amount");
    process.exit(1);
  }
  await bridge(amount);
} else {
  console.log(`
Usage:
  node scripts/bridge-base-to-arc.mjs --preflight
  node scripts/bridge-base-to-arc.mjs --amount 0.1

Always use a burner wallet.
`);
  process.exit(0);
}
