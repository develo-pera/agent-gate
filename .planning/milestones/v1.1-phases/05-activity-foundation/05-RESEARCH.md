# Phase 5: Activity Foundation - Research

**Researched:** 2026-03-22
**Domain:** In-memory event logging, MCP tool call interception, circular buffer data structures
**Confidence:** HIGH

## Summary

Phase 5 builds a structured activity logging system that captures every MCP tool call and on-chain write as an ActivityEvent. The implementation requires three components: (1) an ActivityEvent type and circular buffer singleton, (2) a logging wrapper around `server.tool()` calls in `createMcpServer`, and (3) enrichment of events with transaction data from `executeOrPrepare`.

The codebase is well-structured for this. `createMcpServer` in `hosted.ts` is the single factory for all hosted MCP servers, making it the ideal interception point. `executeOrPrepare` already returns `ExecuteResult` with `tx_hash`, `status`, and `block_number` fields that map directly to the event schema. The `globalThis` singleton pattern (already decided in STATE.md) ensures buffer survives Next.js HMR reloads.

**Primary recommendation:** Create a new `packages/mcp-server/src/activity-log.ts` module containing the ActivityEvent interface, CircularBuffer class, and ActivityLog singleton. Wrap tool callbacks in `createMcpServer` to log events. Pass the current event ID through context so `executeOrPrepare` can enrich it with tx data.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Full capture: agent ID (name), agent address, tool name, full params, full result, timestamp, duration, and tx hash/status/block_number when applicable
- Single event type with optional tx fields (tx_hash, status, block_number are null for read-only calls)
- Events have a lifecycle status: pending -> success/error. Two writes to buffer per event (create on start, update on completion)
- Auto-increment numeric ID per event. Resets on server restart (acceptable)
- Instrument hosted.ts (real MCP agent calls) and executeOrPrepare (on-chain tx enrichment)
- Bridge.ts playground calls are completely invisible to the activity system
- Hook into hosted.ts by wrapping server.tool() calls in createMcpServer with a logging layer
- executeOrPrepare enriches the parent tool call event with tx_hash, status, block_number -- no separate tx event
- Circular buffer, 500 events max, silent drop of oldest on overflow
- Buffer returns all events; Phase 6 API layer handles per-agent filtering
- Buffer exposes onEvent(callback) listener mechanism for Phase 6 SSE to subscribe to new/updated events
- globalThis pattern for singleton to survive HMR
- Each event stores agentId (name) and agentAddress -- required fields, no anonymous support
- Agent identity passed from handleMcpRequest into createMcpServer, then into the logging wrapper

### Claude's Discretion
- Exact ActivityEvent TypeScript interface field names and types
- Internal buffer data structure (array vs ring buffer implementation)
- How the server.tool() wrapper intercepts and delegates
- Error serialization format in event results

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-01 | Activity logging middleware captures all MCP tool calls with agent identity, tool name, parameters, result, and timestamp | Wrapping `server.tool()` callbacks in `createMcpServer` captures all hosted tool calls. Agent identity is already resolved in `handleMcpRequest` and passed as `agentId` to `createMcpServer`. |
| INFRA-02 | Activity logging captures all on-chain write operations from executeOrPrepare with tx hash and status | `executeOrPrepare` already returns `ExecuteResult` with `tx_hash`, `status`, `block_number`. The logging wrapper captures the return value and enriches the parent event. |
| INFRA-03 | In-memory circular buffer stores last 500 activity events as a module-level singleton | `globalThis` singleton pattern with a fixed-size array implementing circular buffer semantics. Pattern already established by `defaultRegistry` in `hosted.ts`. |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.7+ | Type-safe ActivityEvent interface | Already in project |
| Node.js built-ins | N/A | `performance.now()` for duration, `Date.now()` for timestamps | Zero dependencies (STATE.md: "Zero new npm dependencies for v1.1") |

### Supporting
No new libraries needed. This phase uses only TypeScript language features and existing project dependencies.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual circular buffer | `mnemonist` or similar | Adds dependency for trivial data structure -- not worth it |
| globalThis singleton | Module-level variable | Module var doesn't survive Next.js HMR; globalThis does |
| EventEmitter for listeners | Custom callback array | EventEmitter adds Node.js dependency to what could be isomorphic code; simple callback array is sufficient |

## Architecture Patterns

### Recommended Project Structure
```
packages/mcp-server/src/
  activity-log.ts      # ActivityEvent type, CircularBuffer, ActivityLog singleton
  hosted.ts            # Modified: wrap tool callbacks with activity logging
  execute-or-prepare.ts # Modified: enrich parent event with tx data
  context.ts           # Modified: add optional activeEventId field
```

### Pattern 1: globalThis Singleton for HMR Survival
**What:** Store the ActivityLog instance on `globalThis` so Next.js hot module replacement doesn't reset it
**When to use:** Any module-level state that must persist across HMR in Next.js dev mode
**Example:**
```typescript
const GLOBAL_KEY = "__agentgate_activity_log__" as const;

function getActivityLog(): ActivityLog {
  if (!(globalThis as any)[GLOBAL_KEY]) {
    (globalThis as any)[GLOBAL_KEY] = new ActivityLog(500);
  }
  return (globalThis as any)[GLOBAL_KEY];
}

export const activityLog = getActivityLog();
```

### Pattern 2: Tool Callback Wrapping
**What:** After registering all tools via `registerXTools(server, ctx)`, iterate over `server._registeredTools` and wrap each handler's callback with logging
**When to use:** When you need to intercept all tool calls without modifying every individual tool file
**Why this approach:** The MCP SDK stores registered tools in `this._registeredTools` as an internal map. After all `registerXTools` calls complete, we can post-process this map. However, `_registeredTools` is a private/internal field. A safer alternative is to wrap the `server.tool()` method itself before tools are registered.

**Recommended approach -- Monkey-patch server.tool():**
```typescript
function wrapServerWithLogging(
  server: McpServer,
  agentId: string,
  agentAddress: string,
): void {
  const originalTool = server.tool.bind(server);

  server.tool = function(name: string, ...rest: any[]) {
    // Extract the callback (always the last argument)
    const callback = rest[rest.length - 1];

    // Replace callback with logging wrapper
    rest[rest.length - 1] = async (args: any, extra: any) => {
      const event = activityLog.startEvent({
        agentId,
        agentAddress,
        toolName: name,
        params: args,
      });

      try {
        const result = await callback(args, extra);
        activityLog.completeEvent(event.id, {
          result,
          status: result.isError ? "error" : "success",
        });
        return result;
      } catch (err) {
        activityLog.completeEvent(event.id, {
          result: { error: err instanceof Error ? err.message : String(err) },
          status: "error",
        });
        throw err;
      }
    };

    return originalTool(name, ...rest);
  } as typeof server.tool;
}
```

### Pattern 3: Event Lifecycle (Pending -> Complete)
**What:** Two-phase event writes -- create with "pending" status on tool call start, update to "success"/"error" on completion
**When to use:** Captures in-flight operations for real-time dashboard display
**Example:**
```typescript
// Start: creates event with status "pending", returns the event
const event = activityLog.startEvent({ agentId, agentAddress, toolName, params });

// Complete: updates existing event in buffer
activityLog.completeEvent(event.id, { result, status: "success", durationMs });
```

### Pattern 4: Transaction Enrichment via Context Threading
**What:** Pass the current event ID through the AgentGateContext so `executeOrPrepare` can enrich the parent tool event with tx data
**When to use:** When a tool's internal function (executeOrPrepare) produces data that should be added to the tool's event
**Example:**
```typescript
// In context.ts -- add optional field
interface AgentGateContext {
  // ... existing fields
  activeEventId?: number;  // Set by logging wrapper
}

// In execute-or-prepare.ts -- enrich after execution
if (ctx.activeEventId != null) {
  activityLog.enrichEvent(ctx.activeEventId, {
    txHash: result.tx_hash,
    txStatus: result.status,
    blockNumber: result.block_number,
  });
}
```

### Anti-Patterns to Avoid
- **Creating separate tx events:** User explicitly decided executeOrPrepare enriches the parent tool event -- no separate transaction event
- **Instrumenting bridge.ts:** Playground/bridge calls must be invisible to the activity system
- **Optional agent fields:** Agent identity is required -- no "unknown agent" fallback
- **Per-request ActivityLog:** The singleton must be module-level (via globalThis), not created per request

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Event ID generation | UUID or crypto.randomUUID | Simple auto-incrementing counter | User decided: numeric ID that resets on restart is acceptable |
| Observable/EventEmitter | Full EventEmitter class | Simple `Set<(event: ActivityEvent) => void>` callback registry | Only need onEvent for SSE subscription in Phase 6 |
| Thread-safe buffer | Mutex/lock mechanisms | Single-threaded Node.js makes this unnecessary | JavaScript is single-threaded; no concurrent writes to worry about |

**Key insight:** This is a simple in-memory data structure with no persistence, no concurrency concerns, and no complex query needs. Keep it minimal.

## Common Pitfalls

### Pitfall 1: HMR Resets Singleton State
**What goes wrong:** Module-level `const activityLog = new ActivityLog()` gets recreated every time Next.js hot-reloads the module in dev mode
**Why it happens:** Next.js HMR re-evaluates module scope on file changes
**How to avoid:** Use `globalThis` pattern to store the singleton instance
**Warning signs:** Activity data disappears during development after code changes

### Pitfall 2: Circular References in Event Serialization
**What goes wrong:** Storing raw `result` from tool callbacks that contain circular references (e.g., viem client objects) causes JSON.stringify to throw
**Why it happens:** Tool results may contain complex objects, not just plain JSON
**How to avoid:** Only store the `content` array from tool results (which is always serializable MCP content blocks). Do NOT store the entire response object.
**Warning signs:** `TypeError: Converting circular structure to JSON`

### Pitfall 3: Memory Leak from Unbounded Listener Set
**What goes wrong:** SSE connections add listeners but never remove them, growing the callback set indefinitely
**Why it happens:** Network disconnects don't trigger explicit cleanup
**How to avoid:** Return an unsubscribe function from `onEvent()` and ensure Phase 6 SSE handler calls it on connection close
**Warning signs:** Growing memory usage over time, duplicate event deliveries

### Pitfall 4: server.tool() Overload Signature Complexity
**What goes wrong:** The MCP SDK's `server.tool()` has 6+ overload signatures. A naive wrapper that assumes fixed argument positions breaks some tool registrations.
**Why it happens:** `server.tool()` accepts `(name, cb)`, `(name, desc, cb)`, `(name, schema, cb)`, `(name, desc, schema, cb)`, `(name, desc, schema, annotations, cb)`, etc.
**How to avoid:** The callback is ALWAYS the last argument in `rest`. Wrap `rest[rest.length - 1]` unconditionally.
**Warning signs:** Tools failing to register, "Tool X is already registered" errors

### Pitfall 5: BigInt Serialization in Event Params
**What goes wrong:** Zod-parsed tool params may contain BigInt values (from viem), which `JSON.stringify` cannot serialize
**Why it happens:** Ethereum values use BigInt; JSON doesn't support BigInt natively
**How to avoid:** Use a replacer function or convert params to a safe format before storing: `JSON.parse(JSON.stringify(params, (_, v) => typeof v === 'bigint' ? v.toString() : v))`
**Warning signs:** `TypeError: Do not know how to serialize a BigInt`

### Pitfall 6: Wrapping tool() After Tools Are Already Registered
**What goes wrong:** If `wrapServerWithLogging()` is called after `registerXTools()`, the tools are already registered with unwrapped callbacks
**Why it happens:** Order of operations matters -- wrapping must happen before tool registration
**How to avoid:** Call `wrapServerWithLogging()` immediately after creating the McpServer, before any `registerXTools()` calls

## Code Examples

### ActivityEvent Interface
```typescript
export interface ActivityEvent {
  id: number;
  agentId: string;
  agentAddress: string;
  toolName: string;
  params: Record<string, unknown>;
  result: unknown | null;         // null while pending
  status: "pending" | "success" | "error";
  timestamp: number;              // Date.now() at start
  durationMs: number | null;      // null while pending
  txHash: string | null;          // null for read-only calls
  txStatus: string | null;        // null for read-only calls
  blockNumber: string | null;     // null for read-only calls
}
```

### CircularBuffer Implementation
```typescript
export class CircularBuffer<T> {
  private buffer: (T | undefined)[];
  private head = 0;   // next write position
  private count = 0;  // current number of items

  constructor(private capacity: number) {
    this.buffer = new Array(capacity);
  }

  push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }

  getAll(): T[] {
    if (this.count === 0) return [];
    const result: T[] = [];
    // Start from oldest item
    const start = this.count < this.capacity ? 0 : this.head;
    for (let i = 0; i < this.count; i++) {
      const idx = (start + i) % this.capacity;
      result.push(this.buffer[idx] as T);
    }
    return result;
  }

  findById(predicate: (item: T) => boolean): T | undefined {
    for (let i = 0; i < this.count; i++) {
      const idx = (this.count < this.capacity ? i : (this.head + i) % this.capacity);
      const item = this.buffer[idx];
      if (item && predicate(item)) return item;
    }
    return undefined;
  }

  get size(): number { return this.count; }
}
```

### ActivityLog Class
```typescript
export class ActivityLog {
  private buffer: CircularBuffer<ActivityEvent>;
  private nextId = 1;
  private listeners = new Set<(event: ActivityEvent) => void>();

  constructor(capacity: number = 500) {
    this.buffer = new CircularBuffer(capacity);
  }

  startEvent(data: {
    agentId: string;
    agentAddress: string;
    toolName: string;
    params: Record<string, unknown>;
  }): ActivityEvent {
    const event: ActivityEvent = {
      id: this.nextId++,
      ...data,
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

  completeEvent(id: number, update: {
    result: unknown;
    status: "success" | "error";
  }): void {
    const event = this.buffer.findById(e => e.id === id);
    if (!event) return;
    event.result = update.result;
    event.status = update.status;
    event.durationMs = Date.now() - event.timestamp;
    this.notify(event);
  }

  enrichEvent(id: number, tx: {
    txHash: string;
    txStatus: string;
    blockNumber: string;
  }): void {
    const event = this.buffer.findById(e => e.id === id);
    if (!event) return;
    event.txHash = tx.txHash;
    event.txStatus = tx.txStatus;
    event.blockNumber = tx.blockNumber;
    // Don't notify here -- completeEvent will notify with full data
  }

  getAll(): ActivityEvent[] {
    return this.buffer.getAll();
  }

  onEvent(callback: (event: ActivityEvent) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notify(event: ActivityEvent): void {
    for (const cb of this.listeners) {
      try { cb(event); } catch { /* swallow listener errors */ }
    }
  }
}
```

### globalThis Singleton Export
```typescript
const GLOBAL_KEY = "__agentgate_activity_log__";

export function getActivityLog(): ActivityLog {
  const g = globalThis as any;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = new ActivityLog(500);
  }
  return g[GLOBAL_KEY];
}

export const activityLog = getActivityLog();
```

### Modification to hosted.ts createMcpServer
```typescript
function createMcpServer(
  ctx: AgentGateContext,
  agentId: string,
  registry: AgentRegistry,
): McpServer {
  const server = new McpServer({ name: "agentgate", version: "0.1.0" });

  // Wrap server.tool() BEFORE registering any tools
  wrapServerWithLogging(server, agentId, ctx.agentAddress);

  // Identity tool, register_challenge, register_agent, submit_tx_hash...
  // (all existing tool registrations remain unchanged)

  registerLidoTools(server, ctx);
  // ... etc
  return server;
}
```

### Modification to executeOrPrepare
```typescript
export async function executeOrPrepare(
  ctx: AgentGateContext,
  params: WriteContractParams,
  toolName: string,
  description: string,
): Promise<ExecuteResult | PrepareResult> {
  if (ctx.walletClient) {
    const hash = await ctx.walletClient.writeContract({ /* ... */ });
    const receipt = await ctx.publicClient.waitForTransactionReceipt({ hash });

    const result: ExecuteResult = {
      mode: "executed",
      tx_hash: hash,
      status: receipt.status,
      block_number: receipt.blockNumber.toString(),
    };

    // Enrich parent activity event with tx data
    if (ctx.activeEventId != null) {
      const { activityLog } = await import("./activity-log");
      activityLog.enrichEvent(ctx.activeEventId, {
        txHash: result.tx_hash,
        txStatus: result.status,
        blockNumber: result.block_number,
      });
    }

    return result;
  }
  // ... third-party path unchanged
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| EventEmitter for pub/sub | Simple callback Set | Always (for small subscriber counts) | Simpler, no Node.js dependency |
| Module-level singletons | globalThis for Next.js apps | Next.js HMR became default | Required for dev-mode state persistence |
| Separate logging middleware | Wrapper/decorator pattern | Standard practice | Avoids modifying every tool file individually |

**Deprecated/outdated:**
- None relevant to this phase

## Open Questions

1. **Should the logging wrapper also capture the `extra` RequestHandlerExtra parameter?**
   - What we know: The MCP SDK passes request metadata in `extra` (session ID, etc.)
   - What's unclear: Whether this data is useful for the dashboard
   - Recommendation: Don't capture `extra` -- it's internal SDK plumbing. If needed later, easy to add.

2. **How should executeOrPrepareMany be handled?**
   - What we know: `executeOrPrepareMany` executes multiple txs in sequence but returns only the last receipt. It's used by trading tools for approve+swap patterns.
   - What's unclear: Should only the last tx enrich the event, or should there be multi-tx support?
   - Recommendation: Enrich with the last tx only (matching the current return type). Multi-tx tracking is a v2 concern.

3. **Timing of enrichEvent vs completeEvent for tx-producing tools**
   - What we know: `executeOrPrepare` is called inside the tool callback. The logging wrapper calls `completeEvent` after the callback returns.
   - What's unclear: Race conditions between enrichEvent and completeEvent
   - Recommendation: No race -- JavaScript is single-threaded. `executeOrPrepare` runs inside `await callback()`, so `enrichEvent` runs before `completeEvent`. The sequence is: startEvent -> callback starts -> executeOrPrepare -> enrichEvent -> callback returns -> completeEvent.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (via `packages/app/vitest.config.ts`) |
| Config file | `packages/app/vitest.config.ts` (exists, jsdom environment) |
| Quick run command | `cd packages/app && npx vitest run --reporter=verbose` |
| Full suite command | `cd packages/app && npx vitest run --reporter=verbose` |

Note: The mcp-server package has no test config. Activity log tests should either use a new vitest config in mcp-server or be placed in the app package tests. Recommendation: Add a minimal `vitest.config.ts` to `packages/mcp-server/` for unit testing the buffer and activity log in isolation.

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-01 | Tool calls produce ActivityEvents with agent identity, tool name, params, result, timestamp | unit | `cd packages/mcp-server && npx vitest run src/activity-log.test.ts -x` | No -- Wave 0 |
| INFRA-02 | executeOrPrepare enriches events with tx_hash, status, block_number | unit | `cd packages/mcp-server && npx vitest run src/activity-log.test.ts -x` | No -- Wave 0 |
| INFRA-03 | Circular buffer holds 500 events and drops oldest on overflow | unit | `cd packages/mcp-server && npx vitest run src/activity-log.test.ts -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cd packages/mcp-server && npx vitest run`
- **Per wave merge:** `cd packages/mcp-server && npx vitest run && cd ../app && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/mcp-server/vitest.config.ts` -- test config for mcp-server package
- [ ] `packages/mcp-server/src/activity-log.test.ts` -- unit tests for CircularBuffer, ActivityLog, event lifecycle
- [ ] Add `vitest` to mcp-server devDependencies (or use workspace-level)
- [ ] Framework install: `cd packages/mcp-server && npm install -D vitest`

## Sources

### Primary (HIGH confidence)
- `packages/mcp-server/src/hosted.ts` -- createMcpServer factory, handleMcpRequest flow, agent resolution
- `packages/mcp-server/src/execute-or-prepare.ts` -- executeOrPrepare/Many return types, tx execution flow
- `packages/mcp-server/src/context.ts` -- AgentGateContext interface
- `packages/mcp-server/src/registry.ts` -- RegisteredAgent type, AgentRegistry.listAgents()
- `node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.js` -- McpServer.tool() internals, _registeredTools structure
- `.planning/phases/05-activity-foundation/05-CONTEXT.md` -- User decisions
- `.planning/STATE.md` -- Project decisions (globalThis, zero new deps, etc.)

### Secondary (MEDIUM confidence)
- MCP SDK server.tool() overload patterns -- verified by reading SDK source directly

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new dependencies, pure TypeScript
- Architecture: HIGH -- all integration points verified by reading source code
- Pitfalls: HIGH -- based on direct code analysis of MCP SDK internals and Next.js patterns

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable domain, no external dependencies)
