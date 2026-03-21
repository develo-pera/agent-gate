/**
 * Upstash Redis-backed agent store for persistent agent registration.
 *
 * Stores ONLY public data: { address, name, type, createdAt }.
 * Private keys are NEVER stored — third-party agents sign externally.
 * API keys are stored as SHA-256 hashes — plaintext shown once at registration.
 *
 * Expects env vars: KV_REST_API_URL + KV_REST_API_TOKEN
 */

import crypto from "node:crypto";
import { Redis } from "@upstash/redis";
import type { AgentStore, RegisteredAgent } from "@agentgate/mcp-server/registry";
import { privateKeyToAccount } from "viem/accounts";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const KEY_PREFIX = "agent:";
const ID_SET = "agent:ids";

const ENV_AGENTS: Record<string, string> = {
  hackaclaw: "PRIVATE_KEY",
  merkle: "MERKLE_KEY",
};

let bootstrapped = false;

function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

async function ensureBootstrapped() {
  if (bootstrapped) return;
  bootstrapped = true;

  for (const [agentId, envVar] of Object.entries(ENV_AGENTS)) {
    const key = process.env[envVar] as `0x${string}` | undefined;
    if (!key) continue;

    // First-party agents use agent_id as bearer token
    const keyHash = hashKey(agentId);
    const existing = await redis.get<RegisteredAgent>(`${KEY_PREFIX}${keyHash}`);
    if (existing) continue;

    const account = privateKeyToAccount(key);
    const agent: RegisteredAgent = {
      address: account.address,
      name: agentId,
      type: "first-party",
      createdAt: Date.now(),
    };
    await redis.set(`${KEY_PREFIX}${keyHash}`, JSON.stringify(agent));
    await redis.sadd(ID_SET, keyHash);
  }
}

export class UpstashAgentStore implements AgentStore {
  async getByKeyHash(apiKeyHash: string): Promise<RegisteredAgent | null> {
    await ensureBootstrapped();
    return redis.get<RegisteredAgent>(`${KEY_PREFIX}${apiKeyHash}`);
  }

  async set(apiKeyHash: string, agent: RegisteredAgent): Promise<void> {
    await ensureBootstrapped();
    await redis.set(`${KEY_PREFIX}${apiKeyHash}`, JSON.stringify(agent));
    await redis.sadd(ID_SET, apiKeyHash);
  }

  async list(): Promise<Array<RegisteredAgent & { keyHash: string }>> {
    await ensureBootstrapped();
    const keyHashes = await redis.smembers(ID_SET);
    if (!keyHashes || keyHashes.length === 0) return [];

    const agents: Array<RegisteredAgent & { keyHash: string }> = [];
    for (const keyHash of keyHashes) {
      const agent = await redis.get<RegisteredAgent>(`${KEY_PREFIX}${keyHash}`);
      if (agent) agents.push({ ...agent, keyHash });
    }
    return agents;
  }
}
