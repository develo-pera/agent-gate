import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockGetAll } = vi.hoisted(() => ({
  mockGetAll: vi.fn<() => any[]>().mockReturnValue([]),
}));

vi.mock("@agentgate/mcp-server/activity-log", () => ({
  getActivityLog: () => ({ getAll: mockGetAll }),
}));

import { GET } from "./route";

function makeEvent(overrides: Record<string, unknown>) {
  return {
    id: 1,
    agentId: "agent-1",
    agentAddress: "0xAAA",
    toolName: "stake",
    params: {},
    result: null,
    status: "pending",
    timestamp: 1000,
    durationMs: null,
    txHash: null,
    txStatus: null,
    blockNumber: null,
    ...overrides,
  };
}

describe("GET /api/activity", () => {
  beforeEach(() => {
    mockGetAll.mockReturnValue([]);
  });

  it("returns all events newest-first", async () => {
    mockGetAll.mockReturnValue([
      makeEvent({ id: 1, timestamp: 1000 }),
      makeEvent({ id: 2, timestamp: 2000 }),
      makeEvent({ id: 3, timestamp: 3000 }),
    ]);

    const req = new NextRequest("http://localhost/api/activity");
    const res = await GET(req);
    const data = await res.json();

    expect(data.events).toHaveLength(3);
    expect(data.events[0].id).toBe(3);
    expect(data.events[1].id).toBe(2);
    expect(data.events[2].id).toBe(1);
  });

  it("filters events by agent query param", async () => {
    mockGetAll.mockReturnValue([
      makeEvent({ id: 1, agentId: "agentA", timestamp: 1000 }),
      makeEvent({ id: 2, agentId: "agentB", timestamp: 2000 }),
      makeEvent({ id: 3, agentId: "agentA", timestamp: 3000 }),
    ]);

    const req = new NextRequest("http://localhost/api/activity?agent=agentA");
    const res = await GET(req);
    const data = await res.json();

    expect(data.events).toHaveLength(2);
    expect(data.events.every((e: any) => e.agentId === "agentA")).toBe(true);
  });

  it("returns empty array when buffer is empty", async () => {
    mockGetAll.mockReturnValue([]);

    const req = new NextRequest("http://localhost/api/activity");
    const res = await GET(req);
    const data = await res.json();

    expect(data.events).toEqual([]);
  });

  it("returns response envelope { events: [...] }", async () => {
    mockGetAll.mockReturnValue([makeEvent({ id: 1 })]);

    const req = new NextRequest("http://localhost/api/activity");
    const res = await GET(req);
    const data = await res.json();

    expect(data).toHaveProperty("events");
    expect(Array.isArray(data.events)).toBe(true);
  });
});
