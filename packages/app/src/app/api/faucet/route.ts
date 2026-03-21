import { NextRequest, NextResponse } from "next/server";
import { isAddress, getAddress, createPublicClient, http, formatEther, parseEther, verifyMessage } from "viem";
import { base } from "viem/chains";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const FAUCET_PREFIX = "faucet:";
const FAUCET_AMOUNT = parseEther("1"); // 1 ETH
const FAUCET_MESSAGE = "I am requesting 1 test ETH from the AgentGate faucet";

const rpcUrl = process.env.RPC_URL || "https://mainnet.base.org";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, signature } = body;

    if (!address || !isAddress(address)) {
      return NextResponse.json(
        { error: "Invalid Ethereum address" },
        { status: 400 },
      );
    }

    if (!signature) {
      return NextResponse.json(
        { error: "Missing signature. Sign the faucet message with your wallet." },
        { status: 400 },
      );
    }

    const checksummed = getAddress(address) as `0x${string}`;

    // Verify the signature proves ownership of the address
    const valid = await verifyMessage({
      address: checksummed,
      message: FAUCET_MESSAGE,
      signature: signature as `0x${string}`,
    });

    if (!valid) {
      return NextResponse.json(
        { error: "Invalid signature. The signature does not match the claimed address." },
        { status: 403 },
      );
    }

    const key = `${FAUCET_PREFIX}${checksummed.toLowerCase()}`;

    // Check if already claimed
    const existing = await redis.get(key);
    if (existing) {
      return NextResponse.json(
        { error: "You have already claimed your test ETH." },
        { status: 429 },
      );
    }

    // Read current balance and add 1 ETH
    const client = createPublicClient({ chain: base, transport: http(rpcUrl) });
    const currentBalance = await client.getBalance({ address: checksummed });
    const newBalance = currentBalance + FAUCET_AMOUNT;

    // Set new balance via Anvil RPC
    await (client as any).request({
      method: "anvil_setBalance",
      params: [checksummed, `0x${newBalance.toString(16)}`],
    });

    // Mark as claimed
    await redis.set(key, JSON.stringify({ claimedAt: Date.now() }));

    return NextResponse.json({
      success: true,
      address: checksummed,
      amount: "1.0",
      previousBalance: formatEther(currentBalance),
      newBalance: formatEther(newBalance),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Faucet request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
