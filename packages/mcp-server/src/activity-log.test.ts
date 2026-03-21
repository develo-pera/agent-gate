import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  CircularBuffer,
  ActivityLog,
  ActivityEvent,
  getActivityLog,
} from "./activity-log";

describe("CircularBuffer", () => {
  it("starts with size 0", () => {
    const buf = new CircularBuffer<number>(3);
    expect(buf.size).toBe(0);
  });

  it("returns items in insertion order", () => {
    const buf = new CircularBuffer<number>(3);
    buf.push(1);
    buf.push(2);
    buf.push(3);
    expect(buf.getAll()).toEqual([1, 2, 3]);
  });

  it("drops oldest item on overflow", () => {
    const buf = new CircularBuffer<number>(3);
    buf.push(1);
    buf.push(2);
    buf.push(3);
    buf.push(4);
    expect(buf.getAll()).toEqual([2, 3, 4]);
  });

  it("handles 500 items at capacity 500", () => {
    const buf = new CircularBuffer<number>(500);
    for (let i = 0; i < 500; i++) buf.push(i);
    expect(buf.size).toBe(500);
    expect(buf.getAll()[0]).toBe(0);
    expect(buf.getAll()[499]).toBe(499);
  });

  it("findById returns matching item or undefined", () => {
    const buf = new CircularBuffer<{ id: number }>(5);
    buf.push({ id: 1 });
    buf.push({ id: 2 });
    expect(buf.findById((item) => item.id === 2)).toEqual({ id: 2 });
    expect(buf.findById((item) => item.id === 99)).toBeUndefined();
  });
});

describe("ActivityLog", () => {
  let log: ActivityLog;

  beforeEach(() => {
    log = new ActivityLog(500);
  });

  describe("startEvent", () => {
    it("returns event with auto-increment id", () => {
      const e1 = log.startEvent({
        agentId: "a1",
        agentAddress: "0x1",
        toolName: "stake",
        params: {},
      });
      const e2 = log.startEvent({
        agentId: "a1",
        agentAddress: "0x1",
        toolName: "stake",
        params: {},
      });
      expect(e1.id).toBe(1);
      expect(e2.id).toBe(2);
    });

    it("creates event with pending status and null fields", () => {
      const e = log.startEvent({
        agentId: "a1",
        agentAddress: "0x1",
        toolName: "stake",
        params: { amount: "100" },
      });
      expect(e.status).toBe("pending");
      expect(e.result).toBeNull();
      expect(e.durationMs).toBeNull();
      expect(e.txHash).toBeNull();
      expect(e.txStatus).toBeNull();
      expect(e.blockNumber).toBeNull();
    });

    it("stores agentId, agentAddress, toolName, params", () => {
      const e = log.startEvent({
        agentId: "agent-1",
        agentAddress: "0xABC",
        toolName: "wrap",
        params: { value: "42" },
      });
      expect(e.agentId).toBe("agent-1");
      expect(e.agentAddress).toBe("0xABC");
      expect(e.toolName).toBe("wrap");
      expect(e.params).toEqual({ value: "42" });
    });

    it("sets timestamp close to Date.now()", () => {
      const before = Date.now();
      const e = log.startEvent({
        agentId: "a",
        agentAddress: "0x",
        toolName: "t",
        params: {},
      });
      const after = Date.now();
      expect(e.timestamp).toBeGreaterThanOrEqual(before);
      expect(e.timestamp).toBeLessThanOrEqual(after);
    });

    it("event is retrievable via getAll()", () => {
      log.startEvent({
        agentId: "a",
        agentAddress: "0x",
        toolName: "t",
        params: {},
      });
      expect(log.getAll()).toHaveLength(1);
    });
  });

  describe("completeEvent", () => {
    it("updates event status and result", () => {
      const e = log.startEvent({
        agentId: "a",
        agentAddress: "0x",
        toolName: "t",
        params: {},
      });
      log.completeEvent(e.id, { result: "ok", status: "success" });
      const updated = log.getAll().find((ev) => ev.id === e.id)!;
      expect(updated.status).toBe("success");
      expect(updated.result).toBe("ok");
    });

    it("sets durationMs > 0", () => {
      const e = log.startEvent({
        agentId: "a",
        agentAddress: "0x",
        toolName: "t",
        params: {},
      });
      log.completeEvent(e.id, { result: "ok", status: "success" });
      const updated = log.getAll().find((ev) => ev.id === e.id)!;
      expect(updated.durationMs).toBeTypeOf("number");
      expect(updated.durationMs!).toBeGreaterThanOrEqual(0);
    });

    it("silently ignores non-existent id", () => {
      expect(() =>
        log.completeEvent(999, { result: "ok", status: "success" })
      ).not.toThrow();
    });
  });

  describe("enrichEvent", () => {
    it("sets tx fields on existing event", () => {
      const e = log.startEvent({
        agentId: "a",
        agentAddress: "0x",
        toolName: "t",
        params: {},
      });
      log.enrichEvent(e.id, {
        txHash: "0xabc",
        txStatus: "confirmed",
        blockNumber: "123",
      });
      const updated = log.getAll().find((ev) => ev.id === e.id)!;
      expect(updated.txHash).toBe("0xabc");
      expect(updated.txStatus).toBe("confirmed");
      expect(updated.blockNumber).toBe("123");
    });

    it("does NOT trigger listener notification", () => {
      const listener = vi.fn();
      log.onEvent(listener);
      const e = log.startEvent({
        agentId: "a",
        agentAddress: "0x",
        toolName: "t",
        params: {},
      });
      listener.mockClear();
      log.enrichEvent(e.id, {
        txHash: "0x",
        txStatus: "pending",
        blockNumber: "1",
      });
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("onEvent listener", () => {
    it("fires on startEvent with the pending event", () => {
      const listener = vi.fn();
      log.onEvent(listener);
      const e = log.startEvent({
        agentId: "a",
        agentAddress: "0x",
        toolName: "t",
        params: {},
      });
      expect(listener).toHaveBeenCalledWith(e);
    });

    it("fires on completeEvent with the updated event", () => {
      const listener = vi.fn();
      log.onEvent(listener);
      const e = log.startEvent({
        agentId: "a",
        agentAddress: "0x",
        toolName: "t",
        params: {},
      });
      listener.mockClear();
      log.completeEvent(e.id, { result: "done", status: "success" });
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].status).toBe("success");
    });

    it("unsubscribe removes listener", () => {
      const listener = vi.fn();
      const unsub = log.onEvent(listener);
      unsub();
      log.startEvent({
        agentId: "a",
        agentAddress: "0x",
        toolName: "t",
        params: {},
      });
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("BigInt safety", () => {
    it("serializes BigInt params without TypeError", () => {
      expect(() =>
        log.startEvent({
          agentId: "a",
          agentAddress: "0x",
          toolName: "t",
          params: { amount: BigInt("1000000000000000000") },
        })
      ).not.toThrow();
      const e = log.getAll()[0];
      expect(e.params.amount).toBe("1000000000000000000");
    });
  });
});

describe("getActivityLog singleton", () => {
  it("returns same instance on repeated calls", () => {
    const a = getActivityLog();
    const b = getActivityLog();
    expect(a).toBe(b);
  });
});
