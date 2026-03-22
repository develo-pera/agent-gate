import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockGetAll, mockOnEvent } = vi.hoisted(() => ({
  mockGetAll: vi.fn<() => any[]>().mockReturnValue([]),
  mockOnEvent: vi.fn<(cb: (event: any) => void) => () => void>(),
}));

vi.mock("@agentgate/mcp-server/activity-log", () => ({
  getActivityLog: () => ({
    getAll: mockGetAll,
    onEvent: mockOnEvent,
  }),
}));

import { GET, dynamic } from "./route";

function makeEvent(overrides: Record<string, unknown> = {}) {
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

describe("GET /api/activity/sse", () => {
  let unsubSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    unsubSpy = vi.fn();
    mockGetAll.mockReturnValue([]);
    mockOnEvent.mockImplementation(() => unsubSpy);
  });

  it("returns SSE response headers", async () => {
    const req = new NextRequest("http://localhost/api/activity/sse");
    const res = await GET(req);

    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(res.headers.get("Cache-Control")).toBe("no-cache, no-transform");
    expect(res.headers.get("X-Accel-Buffering")).toBe("no");
  });

  it("streams ActivityEvents in SSE format", async () => {
    let capturedCallback: ((event: any) => void) | null = null;
    mockOnEvent.mockImplementation((cb) => {
      capturedCallback = cb;
      return unsubSpy;
    });

    const req = new NextRequest("http://localhost/api/activity/sse");
    const res = await GET(req);

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();

    // Trigger a live event
    const event = makeEvent({ id: 42, toolName: "bridge" });
    capturedCallback!(event);

    const { value } = await reader.read();
    const text = decoder.decode(value);

    expect(text).toContain("id: 42");
    expect(text).toContain("event: activity");
    expect(text).toContain(`data: ${JSON.stringify(event)}`);
    expect(text).toEndWith("\n\n");

    reader.releaseLock();
  });

  it("cleans up on client disconnect", async () => {
    mockOnEvent.mockImplementation(() => unsubSpy);

    const abortController = new AbortController();
    const req = new NextRequest("http://localhost/api/activity/sse", {
      signal: abortController.signal,
    });
    const res = await GET(req);

    // Start reading so the stream starts
    const reader = res.body!.getReader();

    // Abort the request (simulate client disconnect)
    abortController.abort();

    // Give abort handler a tick to run
    await new Promise((r) => setTimeout(r, 10));

    expect(unsubSpy).toHaveBeenCalled();

    reader.releaseLock();
  });

  it("replays missed events when Last-Event-ID is set", async () => {
    mockGetAll.mockReturnValue([
      makeEvent({ id: 3 }),
      makeEvent({ id: 5 }),
      makeEvent({ id: 7, toolName: "missed1" }),
      makeEvent({ id: 9, toolName: "missed2" }),
    ]);

    mockOnEvent.mockImplementation(() => unsubSpy);

    const req = new NextRequest("http://localhost/api/activity/sse", {
      headers: { "Last-Event-ID": "5" },
    });
    const res = await GET(req);

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();

    const { value } = await reader.read();
    const text = decoder.decode(value);

    // Should contain events with id > 5
    expect(text).toContain("id: 7");
    expect(text).toContain("id: 9");
    // Should NOT contain events with id <= 5
    expect(text).not.toContain("id: 3\n");
    expect(text).not.toContain("id: 5\n");

    reader.releaseLock();
  });

  it("exports dynamic = force-dynamic", () => {
    expect(dynamic).toBe("force-dynamic");
  });
});
