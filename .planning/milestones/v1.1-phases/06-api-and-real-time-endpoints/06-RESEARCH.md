# Phase 6: API and Real-Time Endpoints - Research

**Researched:** 2026-03-22
**Domain:** Next.js App Router API routes + Server-Sent Events (SSE)
**Confidence:** HIGH

## Summary

Phase 6 builds three API endpoints in the Next.js App Router: an enhanced GET /api/agents (adding status and lastActivityAt), a new GET /api/activity (returning the circular buffer contents), and a new GET /api/activity/sse (streaming real-time ActivityEvents via SSE). The implementation leverages the existing ActivityLog singleton from Phase 5 (`getActivityLog()` via globalThis) and the existing AgentRegistry.

The SSE endpoint is the only non-trivial piece. Next.js App Router supports SSE via `ReadableStream` with `text/event-stream` content type. The critical pattern is: return the `Response` immediately (do not await before returning), use `req.signal.addEventListener("abort", ...)` for cleanup, and set `export const dynamic = 'force-dynamic'` to prevent caching. The ActivityLog already provides `onEvent(callback)` which returns an unsubscribe function -- this maps cleanly to the SSE listener lifecycle.

**Primary recommendation:** Use the Web Streams API (ReadableStream + TextEncoder) pattern for SSE, register an ActivityLog listener in the stream's `start()` callback, and clean up via the request abort signal. Zero new dependencies needed.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- GET /api/activity returns full dump of all events from the 500-event circular buffer -- no pagination
- Supports `?agent=<agentId>` query param for per-agent filtering -- no other filters
- Events returned newest-first (reverse chronological)
- Full event payload returned raw -- no field truncation or stripping of params/result
- GET /api/activity/sse streams all event updates -- both pending and completion
- Streams all events (no per-agent filtering) -- Phase 8 does client-side filtering if needed
- Supports Last-Event-ID header for reconnection -- server replays missed events from buffer on reconnect
- 30-second heartbeat comment (`: heartbeat`) to keep connection alive through proxies
- SSE streams ActivityEvents only -- no separate agent-status event type
- Three agent states: active (has pending event), idle (has completed events but none pending), registered (zero activity ever)
- Status computed server-side in GET /api/agents response
- Enhance existing GET /api/agents route in-place (no new endpoint)
- Add `status` and `lastActivityAt` fields to agent response

### Claude's Discretion
- SSE event naming convention (e.g., `event: activity` or default message type)
- Exact JSON response envelope shape
- Error response format for invalid query params
- Internal implementation of Last-Event-ID replay logic

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-04 | SSE endpoint streams new activity events to connected dashboard clients in real-time | SSE via ReadableStream pattern documented; ActivityLog.onEvent() provides listener; heartbeat + Last-Event-ID patterns researched |
| INFRA-05 | REST API endpoint returns list of registered agents with name, address, type, and registration date | Existing GET /api/agents route enhanced with status derivation from ActivityLog buffer |
| INFRA-06 | REST API endpoint returns activity history for a specific agent or all agents | New GET /api/activity route using ActivityLog.getAll() with optional agent filter + reverse sort |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 16.2.0 | Route handlers for API endpoints | Already in use; route.ts convention |
| Web Streams API (ReadableStream) | Built-in | SSE streaming | Native browser/Node API; no library needed |
| TextEncoder | Built-in | Encode SSE text to Uint8Array | Standard Web API |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @agentgate/mcp-server (activity-log) | workspace | ActivityLog singleton, ActivityEvent type | Import getActivityLog() and ActivityEvent for all three endpoints |
| @agentgate/mcp-server (hosted) | workspace | AgentRegistry, RegisteredAgent type | Import for enhanced /api/agents |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ReadableStream SSE | WebSocket | Overkill; SSE is unidirectional, simpler, no custom server needed |
| In-handler filtering | Database query | No persistence needed; 500-event buffer fits in memory |

**Installation:**
```bash
# No new dependencies -- zero new npm packages (project constraint)
```

## Architecture Patterns

### Recommended Project Structure
```
packages/app/src/app/api/
├── agents/
│   └── route.ts          # Enhanced GET /api/agents (existing file, modify in-place)
├── activity/
│   ├── route.ts          # NEW: GET /api/activity
│   └── sse/
│       └── route.ts      # NEW: GET /api/activity/sse
```

### Pattern 1: SSE Route Handler with ReadableStream
**What:** Next.js App Router SSE endpoint using ReadableStream and abort signal cleanup
**When to use:** Any endpoint that needs to push real-time events to the browser
**Example:**
```typescript
// Source: Next.js App Router SSE pattern (verified via multiple sources)
import { NextRequest } from "next/server";
import { getActivityLog } from "@agentgate/mcp-server/activity-log";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const log = getActivityLog();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Subscribe to new events
      const unsub = log.onEvent((event) => {
        const data = JSON.stringify(event);
        controller.enqueue(
          encoder.encode(`id: ${event.id}\nevent: activity\ndata: ${data}\n\n`)
        );
      });

      // 30-second heartbeat
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": heartbeat\n\n"));
      }, 30_000);

      // Cleanup on client disconnect
      req.signal.addEventListener("abort", () => {
        unsub();
        clearInterval(heartbeat);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
```

### Pattern 2: Agent Status Derivation from Buffer
**What:** Compute active/idle/registered status by scanning the activity buffer for pending events
**When to use:** GET /api/agents response enrichment
**Example:**
```typescript
// Derive status for a single agent from the activity buffer
function deriveAgentStatus(
  agentId: string,
  events: ActivityEvent[],
): { status: "active" | "idle" | "registered"; lastActivityAt: number | null } {
  const agentEvents = events.filter((e) => e.agentId === agentId);
  if (agentEvents.length === 0) {
    return { status: "registered", lastActivityAt: null };
  }
  const hasPending = agentEvents.some((e) => e.status === "pending");
  const lastActivityAt = Math.max(...agentEvents.map((e) => e.timestamp));
  return {
    status: hasPending ? "active" : "idle",
    lastActivityAt,
  };
}
```

### Pattern 3: Last-Event-ID Replay
**What:** On SSE reconnect, client sends Last-Event-ID header; server replays missed events from buffer
**When to use:** SSE endpoint connection setup
**Example:**
```typescript
// In the SSE route handler start() callback, before subscribing:
const lastEventId = req.headers.get("Last-Event-ID");
if (lastEventId) {
  const lastId = parseInt(lastEventId, 10);
  if (!isNaN(lastId)) {
    const missed = log.getAll().filter((e) => e.id > lastId);
    for (const event of missed) {
      controller.enqueue(
        encoder.encode(`id: ${event.id}\nevent: activity\ndata: ${JSON.stringify(event)}\n\n`)
      );
    }
  }
}
```

### Anti-Patterns to Avoid
- **Awaiting before returning Response:** Never `await` async work before returning the Response object in SSE routes. The Response must be returned immediately so Next.js can begin streaming to the client.
- **Missing abort cleanup:** Always unsubscribe listeners and clear intervals in the abort handler. Failing to do so causes memory leaks and `ResponseAborted` errors in Next.js.
- **Using `NextResponse` for SSE:** Use `new Response(stream, { headers })` directly. `NextResponse.json()` is for JSON responses only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSE message formatting | Custom serializer | Template literal: `` `id: ${id}\nevent: activity\ndata: ${json}\n\n` `` | SSE format is simple; just follow the spec (`id:`, `event:`, `data:`, double newline) |
| Event listener lifecycle | Manual Set tracking | ActivityLog.onEvent() returns unsubscribe fn | Already built in Phase 5; returns cleanup function |
| Circular buffer access | Direct buffer manipulation | ActivityLog.getAll() | Encapsulates buffer traversal logic |
| Agent status computation | Separate status store | Derive from buffer on each request | 500 events max; O(n) scan is fast enough |

**Key insight:** Phase 5 built the ActivityLog with exactly the API surface needed here. `getAll()` for REST, `onEvent()` for SSE, and the auto-incrementing `id` field maps to SSE event IDs.

## Common Pitfalls

### Pitfall 1: Buffering by Reverse Proxies
**What goes wrong:** SSE messages are buffered by nginx/Vercel edge and arrive in batches instead of real-time
**Why it happens:** Proxies buffer small responses for efficiency
**How to avoid:** Set `X-Accel-Buffering: no` header and `Cache-Control: no-cache, no-transform`
**Warning signs:** Events arrive in bursts instead of individually during local testing behind a proxy

### Pitfall 2: ResponseAborted Unhandled Rejection
**What goes wrong:** Next.js throws `unhandledRejection: ResponseAborted` when client disconnects
**Why it happens:** The stream controller tries to enqueue after the client has disconnected, but the abort handler hasn't fired yet or doesn't close the controller
**How to avoid:** In the abort handler: (1) unsubscribe from event sources, (2) clear heartbeat interval, (3) call `controller.close()`. Also guard enqueue calls if the stream might be closing.
**Warning signs:** Error logs showing `ResponseAborted` when refreshing the dashboard page

### Pitfall 3: ActivityLog Import from Wrong Package Path
**What goes wrong:** Import fails or creates a second ActivityLog instance
**Why it happens:** The mcp-server package needs a subpath export for `activity-log` (currently only exports `hosted`, `registry`, `bridge`)
**How to avoid:** Add `"./activity-log"` to `packages/mcp-server/package.json` exports before importing from the app package
**Warning signs:** `getActivityLog()` returns an empty log even when events have been created

### Pitfall 4: Missing `export const dynamic = 'force-dynamic'`
**What goes wrong:** Next.js statically renders the route at build time or caches responses
**Why it happens:** Default Next.js behavior is to optimize routes as static when possible
**How to avoid:** Add `export const dynamic = 'force-dynamic'` to all three route files
**Warning signs:** Stale data returned, SSE connection immediately closes

### Pitfall 5: Last-Event-ID Race Condition
**What goes wrong:** Events emitted between replay and subscription are lost
**Why it happens:** If you replay missed events first then subscribe, events emitted during replay are not captured
**How to avoid:** Subscribe to onEvent FIRST (buffer incoming events), then replay missed events, then start forwarding buffered + live events. Alternatively, since the event rate is low for a demo, the simpler approach (replay then subscribe) is acceptable with the understanding that a rare edge case exists.
**Warning signs:** Missing events on reconnection during high-activity periods

## Code Examples

### GET /api/activity (REST endpoint)
```typescript
// Source: Project conventions + ActivityLog API
import { NextRequest, NextResponse } from "next/server";
import { getActivityLog } from "@agentgate/mcp-server/activity-log";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const log = getActivityLog();
  const agentFilter = req.nextUrl.searchParams.get("agent");

  let events = log.getAll();

  if (agentFilter) {
    events = events.filter((e) => e.agentId === agentFilter);
  }

  // Reverse for newest-first
  events.reverse();

  return NextResponse.json({ events });
}
```

### Enhanced GET /api/agents
```typescript
// Source: Existing route.ts + status derivation
import { NextResponse } from "next/server";
import { AgentRegistry } from "@agentgate/mcp-server/hosted";
import { getActivityLog } from "@agentgate/mcp-server/activity-log";
import type { ActivityEvent } from "@agentgate/mcp-server/activity-log";
import { UpstashAgentStore } from "@/lib/agent-store";

export const dynamic = "force-dynamic";

const store = new UpstashAgentStore();
const registry = new AgentRegistry(store);

function deriveStatus(agentId: string, events: ActivityEvent[]) {
  const agentEvents = events.filter((e) => e.agentId === agentId);
  if (agentEvents.length === 0) {
    return { status: "registered" as const, lastActivityAt: null };
  }
  const hasPending = agentEvents.some((e) => e.status === "pending");
  const lastActivityAt = Math.max(...agentEvents.map((e) => e.timestamp));
  return {
    status: hasPending ? ("active" as const) : ("idle" as const),
    lastActivityAt,
  };
}

export async function GET() {
  const agents = await registry.listAgents();
  const events = getActivityLog().getAll();

  const enriched = agents.map((a) => {
    const { status, lastActivityAt } = deriveStatus(a.agent_id, events);
    return { ...a, status, lastActivityAt };
  });

  return NextResponse.json({ agents: enriched });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pages Router API routes for SSE | App Router route handlers with ReadableStream | Next.js 13+ (2023) | No need for `res.write()`; use Web Streams API |
| `res.write()` / `res.flush()` | `controller.enqueue()` via ReadableStream | Next.js App Router | Aligns with Web platform APIs |
| WebSocket for real-time | SSE for server-to-client | Project decision | Simpler, no custom server, works on serverless |

**Deprecated/outdated:**
- Pages Router `res.write()` pattern: Does not work in App Router route handlers
- `NextResponse` for streaming: Use `new Response()` directly for SSE streams

## Open Questions

1. **Activity-log subpath export**
   - What we know: `packages/mcp-server/package.json` exports `./hosted`, `./registry`, `./bridge` but NOT `./activity-log`
   - What's unclear: Whether the app can import `activity-log.ts` directly without adding the export
   - Recommendation: Add `"./activity-log"` subpath export to mcp-server package.json as a prerequisite task

2. **SSE on Vercel serverless**
   - What we know: Vercel serverless functions have execution time limits (default 10s on Hobby, 60s on Pro)
   - What's unclear: Whether the demo will be deployed to Vercel or run locally
   - Recommendation: For demo purposes, localhost is fine. If deploying to Vercel, may need Vercel's streaming runtime. Not blocking for Phase 6.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 (app package) |
| Config file | `packages/app/vitest.config.ts` |
| Quick run command | `cd packages/app && npx vitest run --reporter=verbose` |
| Full suite command | `cd packages/app && npx vitest run --reporter=verbose && cd ../mcp-server && npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-04 | SSE streams ActivityEvents in real-time | unit | `cd packages/app && npx vitest run src/app/api/activity/sse/route.test.ts -x` | No - Wave 0 |
| INFRA-05 | GET /api/agents returns agents with status fields | unit | `cd packages/app && npx vitest run src/app/api/agents/route.test.ts -x` | No - Wave 0 |
| INFRA-06 | GET /api/activity returns history, filterable by agent | unit | `cd packages/app && npx vitest run src/app/api/activity/route.test.ts -x` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `cd packages/app && npx vitest run --reporter=verbose`
- **Per wave merge:** Full suite across both packages
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/app/src/app/api/activity/route.test.ts` -- covers INFRA-06
- [ ] `packages/app/src/app/api/activity/sse/route.test.ts` -- covers INFRA-04
- [ ] `packages/app/src/app/api/agents/route.test.ts` -- covers INFRA-05

Note: Testing SSE route handlers in unit tests requires mocking the `ReadableStream` and consuming events. The test can create an `ActivityLog` instance, call the route handler, read from the response body stream, and verify SSE message format. The abort signal can be simulated with `AbortController`.

## Sources

### Primary (HIGH confidence)
- `packages/mcp-server/src/activity-log.ts` -- ActivityLog API surface (getAll, onEvent, startEvent, completeEvent)
- `packages/app/src/app/api/agents/route.ts` -- existing route to enhance
- `packages/mcp-server/src/registry.ts` -- RegisteredAgent type, listAgents() return shape
- `packages/mcp-server/src/hosted.ts` -- activityLog singleton import, wrapServerWithLogging pattern

### Secondary (MEDIUM confidence)
- [Pedro Alonso - Real-Time Notifications with SSE in Next.js](https://www.pedroalonso.net/blog/sse-nextjs-real-time-notifications/) -- ReadableStream SSE pattern
- [Next.js GitHub Discussion #61972](https://github.com/vercel/next.js/discussions/61972) -- ResponseAborted cleanup pattern
- [MDN - Using Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events) -- SSE protocol spec reference
- [Next.js GitHub Discussion #48427](https://github.com/vercel/next.js/discussions/48427) -- SSE in Next.js route handlers

### Tertiary (LOW confidence)
- None -- all findings verified against multiple sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new dependencies, uses existing codebase primitives
- Architecture: HIGH -- SSE via ReadableStream is well-documented, ActivityLog API maps cleanly
- Pitfalls: HIGH -- documented from Next.js community issues and SSE protocol spec

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable patterns, no fast-moving dependencies)
