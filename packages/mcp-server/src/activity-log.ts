export interface ActivityEvent {
  id: number;
  agentId: string;
  agentAddress: string;
  toolName: string;
  params: Record<string, unknown>;
  result: unknown | null;
  status: "pending" | "success" | "error";
  timestamp: number;
  durationMs: number | null;
  txHash: string | null;
  txStatus: string | null;
  blockNumber: string | null;
}

export class CircularBuffer<T> {
  private buffer: (T | undefined)[];
  private head = 0;
  private count = 0;

  constructor(private readonly capacity: number) {
    this.buffer = new Array(capacity);
  }

  push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) {
      this.count++;
    }
  }

  getAll(): T[] {
    if (this.count === 0) return [];
    const result: T[] = [];
    const start =
      this.count < this.capacity
        ? 0
        : this.head; // oldest item position
    for (let i = 0; i < this.count; i++) {
      const idx = (start + i) % this.capacity;
      result.push(this.buffer[idx] as T);
    }
    return result;
  }

  findById(predicate: (item: T) => boolean): T | undefined {
    for (let i = 0; i < this.count; i++) {
      const start = this.count < this.capacity ? 0 : this.head;
      const idx = (start + i) % this.capacity;
      const item = this.buffer[idx] as T;
      if (predicate(item)) return item;
    }
    return undefined;
  }

  get size(): number {
    return this.count;
  }
}

export class ActivityLog {
  private buffer: CircularBuffer<ActivityEvent>;
  private nextId = 1;
  private listeners = new Set<(event: ActivityEvent) => void>();

  constructor(capacity: number = 500) {
    this.buffer = new CircularBuffer<ActivityEvent>(capacity);
  }

  startEvent(data: {
    agentId: string;
    agentAddress: string;
    toolName: string;
    params: Record<string, unknown>;
  }): ActivityEvent {
    const safeParams = JSON.parse(
      JSON.stringify(data.params, (_, v) =>
        typeof v === "bigint" ? v.toString() : v
      )
    );

    const event: ActivityEvent = {
      id: this.nextId++,
      agentId: data.agentId,
      agentAddress: data.agentAddress,
      toolName: data.toolName,
      params: safeParams,
      result: null,
      status: "pending",
      timestamp: Date.now(),
      durationMs: null,
      txHash: null,
      txStatus: null,
      blockNumber: null,
    };

    this.buffer.push(event);
    this.notify(event);
    return event;
  }

  completeEvent(
    id: number,
    update: { result: unknown; status: "success" | "error" }
  ): void {
    const event = this.buffer.findById((e) => e.id === id);
    if (!event) return;
    event.result = update.result;
    event.status = update.status;
    event.durationMs = Date.now() - event.timestamp;
    this.notify(event);
  }

  enrichEvent(
    id: number,
    tx: { txHash: string; txStatus: string; blockNumber: string }
  ): void {
    const event = this.buffer.findById((e) => e.id === id);
    if (!event) return;
    event.txHash = tx.txHash;
    event.txStatus = tx.txStatus;
    event.blockNumber = tx.blockNumber;
    // NO notify — enrichment is silent
  }

  getAll(): ActivityEvent[] {
    return this.buffer.getAll();
  }

  onEvent(callback: (event: ActivityEvent) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notify(event: ActivityEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // swallow listener errors
      }
    }
  }
}

const GLOBAL_KEY = "__agentgate_activity_log__";

export function getActivityLog(): ActivityLog {
  const g = globalThis as any;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = new ActivityLog(500);
  }
  return g[GLOBAL_KEY];
}

export const activityLog = getActivityLog();
