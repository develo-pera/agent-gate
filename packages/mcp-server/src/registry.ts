/**
 * Agent Registry — dynamic agent registration without storing private keys.
 *
 * Provides an AgentStore interface for persistence and an AgentRegistry class
 * that handles registration, API key generation, and agent lookup.
 *
 * Third-party agents register with their wallet address (public).
 * The server NEVER stores or touches private keys.
 */

import crypto from "node:crypto";
import { isAddress, getAddress, createPublicClient, http, verifyMessage } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// ── Types ───────────────────────────────────────────────────────────

export interface RegisteredAgent {
  address: `0x${string}`;
  name: string;
  type: "first-party" | "third-party";
  createdAt: number;
}

export interface AgentStore {
  getByKeyHash(apiKeyHash: string): Promise<RegisteredAgent | null>;
  set(apiKeyHash: string, agent: RegisteredAgent): Promise<void>;
  list(): Promise<Array<RegisteredAgent & { keyHash: string }>>;
}

// ── In-memory store (fallback for tests / local dev) ────────────────

export class InMemoryStore implements AgentStore {
  private agents = new Map<string, RegisteredAgent>();

  async getByKeyHash(apiKeyHash: string) {
    return this.agents.get(apiKeyHash) ?? null;
  }

  async set(apiKeyHash: string, agent: RegisteredAgent) {
    this.agents.set(apiKeyHash, agent);
  }

  async list() {
    return Array.from(this.agents.entries()).map(([keyHash, agent]) => ({
      ...agent,
      keyHash,
    }));
  }
}

// ── Auto-funding via Anvil RPC ──────────────────────────────────────

async function autoFund(address: `0x${string}`, rpcUrl: string): Promise<boolean> {
  try {
    const client = createPublicClient({ chain: base, transport: http(rpcUrl) });
    await (client as any).request({
      method: "anvil_setBalance",
      params: [address, "0xDE0B6B3A7640000"], // 1 ETH
    });
    return true;
  } catch {
    return false;
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

function hashApiKey(apiKey: string): string {
  return crypto.createHash("sha256").update(apiKey).digest("hex");
}

// ── Challenge store (in-memory, short-lived) ───────────────────────

const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const pendingChallenges = new Map<string, { nonce: string; createdAt: number }>();

// Clean up expired challenges periodically
function cleanExpiredChallenges() {
  const now = Date.now();
  for (const [key, val] of pendingChallenges) {
    if (now - val.createdAt > CHALLENGE_TTL_MS) pendingChallenges.delete(key);
  }
}

// ── Registry ────────────────────────────────────────────────────────

/** Hardcoded first-party agents (env var name → agent name) */
const ENV_AGENTS: Record<string, string> = {
  hackaclaw: "PRIVATE_KEY",
  merkle: "MERKLE_KEY",
};

export class AgentRegistry {
  private bootstrapped = false;

  constructor(
    private store: AgentStore,
    private rpcUrl: string = process.env.RPC_URL || "https://mainnet.base.org",
  ) {}

  /** Bootstrap first-party agents from env vars. Their "API key" is their agent_id. */
  async bootstrap() {
    if (this.bootstrapped) return;
    this.bootstrapped = true;

    for (const [agentId, envVar] of Object.entries(ENV_AGENTS)) {
      const key = process.env[envVar] as `0x${string}` | undefined;
      if (!key) continue;

      const keyHash = hashApiKey(agentId); // first-party: bearer token = agent_id
      const existing = await this.store.getByKeyHash(keyHash);
      if (existing) continue;

      const account = privateKeyToAccount(key);
      await this.store.set(keyHash, {
        address: account.address,
        name: agentId,
        type: "first-party",
        createdAt: Date.now(),
      });
    }
  }

  /** Step 1: Generate a challenge message for the agent to sign. */
  createChallenge(address: string): { message: string; nonce: string } {
    if (!isAddress(address)) {
      throw new Error("Invalid Ethereum address");
    }

    cleanExpiredChallenges();

    const checksummed = getAddress(address);
    const nonce = crypto.randomBytes(16).toString("hex");

    pendingChallenges.set(checksummed.toLowerCase(), {
      nonce,
      createdAt: Date.now(),
    });

    const message = `AgentGate Registration\n\nI am registering ${checksummed} with AgentGate.\n\nNonce: ${nonce}`;

    return { message, nonce };
  }

  /** Step 2: Verify signature and register the agent. Returns API key (shown once). */
  async registerAgent(
    address: string,
    signature: string,
    name?: string,
  ): Promise<{
    agent_id: string;
    address: string;
    api_key: string;
    funded: boolean;
  }> {
    if (!isAddress(address)) {
      throw new Error("Invalid Ethereum address");
    }

    const checksummed = getAddress(address) as `0x${string}`;
    const pending = pendingChallenges.get(checksummed.toLowerCase());

    if (!pending) {
      throw new Error("No pending challenge for this address. Call createChallenge first.");
    }

    if (Date.now() - pending.createdAt > CHALLENGE_TTL_MS) {
      pendingChallenges.delete(checksummed.toLowerCase());
      throw new Error("Challenge expired. Request a new one.");
    }

    // Verify the signature matches the claimed address
    const message = `AgentGate Registration\n\nI am registering ${checksummed} with AgentGate.\n\nNonce: ${pending.nonce}`;

    const valid = await verifyMessage({
      address: checksummed,
      message,
      signature: signature as `0x${string}`,
    });

    if (!valid) {
      throw new Error("Invalid signature. The signature does not match the claimed address.");
    }

    // Signature verified — consume the challenge
    pendingChallenges.delete(checksummed.toLowerCase());

    const agentName = name || `agent-${checksummed.slice(0, 10)}`;

    // Generate cryptographic API key
    const apiKey = crypto.randomBytes(32).toString("hex");
    const keyHash = hashApiKey(apiKey);

    await this.store.set(keyHash, {
      address: checksummed,
      name: agentName,
      type: "third-party",
      createdAt: Date.now(),
    });

    const funded = await autoFund(checksummed, this.rpcUrl);

    return {
      agent_id: agentName,
      address: checksummed,
      api_key: apiKey,
      funded,
    };
  }

  /** Resolve a bearer token to an agent. Works for both first-party (agent_id) and third-party (api_key). */
  async resolveBearer(bearerToken: string): Promise<(RegisteredAgent & { keyHash: string }) | null> {
    await this.bootstrap();
    const keyHash = hashApiKey(bearerToken);
    const agent = await this.store.getByKeyHash(keyHash);
    if (!agent) return null;
    return { ...agent, keyHash };
  }

  /** Resolve a first-party agent's private key from env vars. */
  resolveFirstPartyKey(agentName: string): `0x${string}` | null {
    const envVar = ENV_AGENTS[agentName.toLowerCase()];
    if (!envVar) return null;
    const key = process.env[envVar];
    if (!key) return null;
    return key as `0x${string}`;
  }

  /** List all registered agents (for dashboard). */
  async listAgents(): Promise<Array<{ agent_id: string; address: string; type: string; createdAt: number }>> {
    await this.bootstrap();
    const agents = await this.store.list();
    return agents.map((a) => ({
      agent_id: a.name,
      address: a.address,
      type: a.type,
      createdAt: a.createdAt,
    }));
  }
}
