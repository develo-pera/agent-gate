import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockGetAll, mockListAgents } = vi.hoisted(() => ({
  mockGetAll: vi.fn<() => any[]>().mockReturnValue([]),
  mockListAgents: vi.fn().mockResolvedValue([]),
}));

vi.mock("@agentgate/mcp-server/activity-log", () => ({
  getActivityLog: () => ({ getAll: mockGetAll }),
}));

vi.mock("@agentgate/mcp-server/hosted", () => ({
  AgentRegistry: class MockAgentRegistry {
    constructor() {}
    listAgents = mockListAgents;
  },
}));

vi.mock("@/lib/agent-store", () => ({
  UpstashAgentStore: class MockStore {},
}));

import { GET } from "./route";

describe("GET /api/agents", () => {
  beforeEach(() => {
    mockGetAll.mockReturnValue([]);
    mockListAgents.mockResolvedValue([]);
  });

  it("returns status 'registered' and lastActivityAt null when agent has no events", async () => {
    mockListAgents.mockResolvedValue([
      { agent_id: "agent-1", address: "0xAAA", type: "first-party", createdAt: 1000 },
    ]);
    mockGetAll.mockReturnValue([]);

    const res = await GET();
    const data = await res.json();

    expect(data.agents).toHaveLength(1);
    expect(data.agents[0].status).toBe("registered");
    expect(data.agents[0].lastActivityAt).toBeNull();
  });

  it("returns status 'active' when agent has a pending event", async () => {
    mockListAgents.mockResolvedValue([
      { agent_id: "agent-1", address: "0xAAA", type: "first-party", createdAt: 1000 },
    ]);
    mockGetAll.mockReturnValue([
      { id: 1, agentId: "agent-1", agentAddress: "0xAAA", toolName: "stake", params: {}, result: null, status: "pending", timestamp: 5000, durationMs: null, txHash: null, txStatus: null, blockNumber: null },
    ]);

    const res = await GET();
    const data = await res.json();

    expect(data.agents[0].status).toBe("active");
    expect(data.agents[0].lastActivityAt).toBe(5000);
  });

  it("returns status 'idle' when agent has only completed events", async () => {
    mockListAgents.mockResolvedValue([
      { agent_id: "agent-1", address: "0xAAA", type: "first-party", createdAt: 1000 },
    ]);
    mockGetAll.mockReturnValue([
      { id: 1, agentId: "agent-1", agentAddress: "0xAAA", toolName: "stake", params: {}, result: "ok", status: "success", timestamp: 3000, durationMs: 100, txHash: null, txStatus: null, blockNumber: null },
      { id: 2, agentId: "agent-1", agentAddress: "0xAAA", toolName: "wrap", params: {}, result: "ok", status: "success", timestamp: 4000, durationMs: 50, txHash: null, txStatus: null, blockNumber: null },
    ]);

    const res = await GET();
    const data = await res.json();

    expect(data.agents[0].status).toBe("idle");
    expect(data.agents[0].lastActivityAt).toBe(4000);
  });

  it("includes existing fields alongside new status fields", async () => {
    mockListAgents.mockResolvedValue([
      { agent_id: "agent-1", address: "0xAAA", type: "first-party", createdAt: 1000 },
    ]);
    mockGetAll.mockReturnValue([]);

    const res = await GET();
    const data = await res.json();

    const agent = data.agents[0];
    expect(agent).toHaveProperty("agent_id", "agent-1");
    expect(agent).toHaveProperty("address", "0xAAA");
    expect(agent).toHaveProperty("type", "first-party");
    expect(agent).toHaveProperty("createdAt", 1000);
    expect(agent).toHaveProperty("status");
    expect(agent).toHaveProperty("lastActivityAt");
  });

  it("returns response envelope { agents: [...] }", async () => {
    mockListAgents.mockResolvedValue([]);
    mockGetAll.mockReturnValue([]);

    const res = await GET();
    const data = await res.json();

    expect(data).toHaveProperty("agents");
    expect(Array.isArray(data.agents)).toBe(true);
  });
});
