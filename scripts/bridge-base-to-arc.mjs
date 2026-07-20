#!/usr/bin/env node
/**
 * Base → Arc USDC bridge via Circle CCTP V2 + cctp-forward
 *
 * Safety features:
 * - Loads private key ONLY from local scripts/.env
 * - Enforces maxFee < amount
 * - Balance checks before any transaction
 * - Explicit YES confirmation required
 * - Never logs the private key
 * - Preflight mode available
 *
 * Usage:
 *   1. npm install
 *   2. cp scripts/.env.example scripts/.env
 *   3. Fill PRIVATE_KEY (use a burner wallet only)
 *   4. node scripts/bridge-base-to-arc.mjs --preflight
 *   5. node scripts/bridge-base-to-arc.mjs --amount 0.1
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
  pad,
  getAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Canonical addresses (keep in sync with references/addresses.json) ──
const TOKEN_MESSENGER = getAddress("0x28b5a0e9c621a5badaa536219b3a228c8168cf5d");
const BASE_USDC = getAddress("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913");
const DESTINATION_DOMAIN = 26;
const MIN_FINALITY = 1000;
const HOOK_DATA = "0x636374702d666f72776172640000000000000000000000000000000000000000";

// ── Load .env ───────────────────────────────────────────────────
function loadEnv() {
  const envPath = resolve(__dirname, ".env");
  if (!existsSync(envPath)) {
    console.error("\n❌ No scripts/.env found.");
    console.error("   Run: cp scripts/.env.example scripts/.env");
    console.error("   Then put your burner PRIVATE_KEY inside it.\n");
    process.exit(1);
  }
  const content = readFileSync(envPath, "utf8");
  const env = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

const env = loadEnv();
const PRIVATE_KEY = env.PRIVATE_KEY;
const RECIPIENT_RAW = env.RECIPIENT_ADDRESS || null;
const RPC_URL = env.BASE_RPC_URL || "https://mainnet.base.org";

if (!PRIVATE_KEY || !PRIVATE_KEY.startsWith("0x") || PRIVATE_KEY.length < 66) {
  console.error("\n❌ PRIVATE_KEY missing or invalid in scripts/.env");
  console.error("   It must start with 0x and be a full 32-byte key.\n");
  process.exit(1);
}

// ── Clients ────────────────────────────────────────────────────
const account = privateKeyToAccount(PRIVATE_KEY);
const publicClient = createPublicClient({
  chain: base,
  transport: http(RPC_URL),
});
const walletClient = createWalletClient({
  account,
  chain: base,
  transport: http(RPC_URL),
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

function toBytes32Address(addr) {
  return pad(getAddress(addr), { size: 32 });
}

/** Choose a safe maxFee that is always < amount */
function chooseMaxFee(amountRaw) {
  // Prefer ~0.03 USDC, but never ≥ amount, and never more than 10% of amount
  const preferred = parseUnits("0.03", 6);
  const tenPercent = amountRaw / 10n;
  let fee = preferred < tenPercent ? preferred : tenPercent;

  // Absolute floor for very small burns
  if (fee < 1n) fee = 1n;

  // Final hard rule: must be strictly less than amount
  if (fee >= amountRaw) {
    fee = amountRaw - 1n;
  }
  return fee;
}

async function getBalances() {
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
  return { ethBalance, usdcBalance, allowance };
}

async function preflight() {
  console.log("\n🔍 Preflight (read-only)\n");
  console.log("Burner address :", account.address);
  console.log("RPC            :", RPC_URL);

  const { ethBalance, usdcBalance, allowance } = await getBalances();

  console.log("ETH balance    :", formatUnits(ethBalance, 18), "ETH");
  console.log("USDC balance   :", formatUnits(usdcBalance, 6), "USDC");
  console.log("USDC allowance :", formatUnits(allowance, 6), "USDC");

  let recipientDisplay = account.address;
  if (RECIPIENT_RAW) {
    try {
      recipientDisplay = getAddress(RECIPIENT_RAW);
    } catch {
      recipientDisplay = RECIPIENT_RAW + " (INVALID)";
    }
  }
  console.log("Recipient      :", recipientDisplay);
  console.log("\n✅ Preflight complete. No transactions sent.\n");
}

async function bridge(amountStr) {
  // Keep amount as string to avoid float precision issues
  let amountUsdc;
  try {
    amountUsdc = parseFloat(amountStr);
    if (isNaN(amountUsdc) || amountUsdc <= 0) throw new Error("bad");
  } catch {
    console.error("\n❌ Invalid amount. Example: --amount 0.1\n");
    process.exit(1);
  }

  const amount = parseUnits(amountStr, 6);
  const maxFee = chooseMaxFee(amount);

  if (maxFee >= amount) {
    console.error("\n❌ maxFee would be ≥ amount. Choose a larger amount.\n");
    process.exit(1);
  }

  // Validate recipient early
  let recipient;
  try {
    recipient = RECIPIENT_RAW ? getAddress(RECIPIENT_RAW) : account.address;
  } catch {
    console.error("\n❌ RECIPIENT_ADDRESS is not a valid address\n");
    process.exit(1);
  }
  const mintRecipient = toBytes32Address(recipient);

  // Balance checks BEFORE asking for YES
  const { ethBalance, usdcBalance } = await getBalances();

  if (usdcBalance < amount) {
    console.error(`\n❌ Insufficient USDC. Have ${formatUnits(usdcBalance, 6)}, need ${amountStr}\n`);
    process.exit(1);
  }
  if (ethBalance < parseUnits("0.00005", 18)) {
    console.error("\n❌ Very low ETH for gas. Fund a little more ETH on Base.\n");
    process.exit(1);
  }

  console.log("\n🚀 Bridge plan");
  console.log("-------------");
  console.log("From          :", account.address);
  console.log("To (Arc)      :", recipient);
  console.log("Amount        :", amountStr, "USDC");
  console.log("maxFee        :", formatUnits(maxFee, 6), "USDC");
  console.log("Domain        :", DESTINATION_DOMAIN);
  console.log("Hook          : cctp-forward");
  console.log("RPC           :", RPC_URL);
  console.log("");
  console.log("⚠️  This will BURN USDC on Base. It is irreversible.");
  console.log("    Type YES (exactly) to continue, anything else to abort.\n");

  process.stdout.write("> ");
  const answer = await new Promise((resolve) => {
    process.stdin.once("data", (data) => resolve(data.toString().trim()));
  });

  if (answer !== "YES") {
    console.log("\nAborted by user.\n");
    process.exit(0);
  }

  // Re-check balances right before sending (in case something changed)
  const fresh = await getBalances();
  if (fresh.usdcBalance < amount) {
    console.error("\n❌ USDC balance changed / insufficient after confirmation.\n");
    process.exit(1);
  }

  // 1. Approve if needed
  if (fresh.allowance < amount) {
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
    console.log("   Explorer: https://arc-mainnet.cloud.blockscout.com/address/" + recipient);
    console.log("3. Do NOT re-burn even if Iris shows pending");
    console.log("4. Completion = Arc balance increases\n");
  } else {
    console.error("\n❌ Burn transaction failed / reverted");
    console.error("   Common cause: maxFee too low for current network conditions.");
    console.error("   Check https://iris-api.circle.com/v2/burn/USDC/fees/6/26?forward=true\n");
    process.exit(1);
  }
}

// ── CLI ────────────────────────────────────────────────────────
const args = process.argv.slice(2);

if (args.includes("--preflight") || args.includes("-p")) {
  await preflight();
} else if (args.includes("--amount") || args.includes("-a")) {
  const idx = args.findIndex((a) => a === "--amount" || a === "-a");
  const amountStr = args[idx + 1];
  if (!amountStr) {
    console.error("Missing amount. Example: --amount 0.1");
    process.exit(1);
  }
  await bridge(amountStr);
} else {
  console.log(`
Usage:
  npm install
  cp scripts/.env.example scripts/.env   # then edit PRIVATE_KEY

  node scripts/bridge-base-to-arc.mjs --preflight
  node scripts/bridge-base-to-arc.mjs --amount 0.1

Always use a fresh burner wallet.
`);
  process.exit(0);
}
