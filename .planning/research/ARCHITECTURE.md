# Architecture Patterns

**Domain:** Live Agent Activity Dashboard (v1.1 milestone)
**Researched:** 2026-03-21
**Focus:** Integration with existing monorepo -- new components, modified components, data flow for real-time activity

## System Architecture (v1.1)

```
+-------------------+       SSE/Polling       +-------------------+
|                   |<========================|                   |
|  Next.js App      |                         |  API Routes       |
|  (packages/app)   |----POST /api/mcp/[tool]->|  /api/agents      |
|                   |                         |  /api/activity     |  <-- NEW
|  New pages:       |                         |  /api/activity/sse |  <-- NEW
|   /agents         |                         +--------+----------+
|                   |                                  |
+--------+----------+                                  |
         |                                             |
         | Direct viem reads                           | Reads from
         v                                             v
+------------------+                         +-------------------+
|  Base / L1 RPC   |                         |  ActivityLog      |  <-- NEW
|  (on-chain state)|                         |  (in-memory ring  |
+------------------+                         |   buffer in MCP)  |
                                             +--------+----------+
                                                      ^
                                                      | Middleware writes
                                                      |
                                             +-------------------+
                                             |  MCP Server       |
                                             |  (mcp-server pkg) |
                                             |                   |
                                             |  Modified:        |
                                             |   hosted.ts       |
                                             |   bridge.ts       |
                                             |  New:             |
                                             |   activity-log.ts |
                                             +-------------------+
```

## Integration Strategy

The v1.1 milestone adds three capabilities to the existing architecture:

1. **Activity Logging** -- middleware layer inside mcp-server that captures every tool call
2. **Agent Status API** -- REST endpoints exposing agent list + activity history + live status
3. **Real-time Dashboard** -- new Next.js page consuming the above via SSE or polling

No new packages. No database. Everything stays in-memory (hackathon constraint: "stateless, all state from chain" -- activity log is ephemeral session state, acceptable).

## Component Inventory

### New Components (to create)

| Component | Package | File Path | Purpose |
|-----------|---------|-----------|---------|
| ActivityLog | mcp-server | `src/activity-log.ts` | In-memory ring buffer storing tool call events |
| Activity middleware | mcp-server | Wired into `hosted.ts` + `bridge.ts` | Intercepts tool calls, writes to ActivityLog |
| SSE endpoint | app | `src/app/api/activity/sse/route.ts` | Server-Sent Events stream for real-time updates |
| Activity REST endpoint | app | `src/app/api/activity/route.ts` | GET recent activity, GET agent status |
| Agents page | app | `src/app/agents/page.tsx` | Main dashboard page |
| AgentCard | app | `src/components/agents/agent-card.tsx` | Card per agent with sprite, status, recent activity |
| ActivityFeed | app | `src/components/agents/activity-feed.tsx` | Scrolling timeline of tool calls across all agents |
| AgentSprite | app | `src/components/agents/agent-sprite.tsx` | Pixel-art animated character component |
| StatusIndicator | app | `src/components/agents/status-indicator.tsx` | Pulsing dot showing active/idle/error |
| useAgentActivity hook | app | `src/lib/hooks/use-agent-activity.ts` | React hook consuming SSE or polling for activity |
| useAgents hook | app | `src/lib/hooks/use-agents.ts` | React Query hook for agent list |
| Sprite assets | app | `public/sprites/` | PNG sprite sheets for pixel-art agents |

### Modified Components (existing, need changes)

| Component | File | Change | Scope |
|-----------|------|--------|-------|
| Sidebar | `src/components/sidebar.tsx` | Add "Agents" nav item with Activity icon | 1 line in NAV_ITEMS array |
| Bridge tool handler | `packages/mcp-server/src/bridge.ts` | Wrap `toolRegistry` calls with activity logging | Small middleware wrapper |
| Hosted MCP handler | `packages/mcp-server/src/hosted.ts` | Pass activity log to server factory, log tool executions | Pass ActivityLog instance |
| MCP server package.json | `packages/mcp-server/package.json` | Add `./activity` subpath export | 3 lines |
| Agent list API | `src/app/api/agents/route.ts` | Enrich response with live status from activity log | Merge agent list + last-seen |

### Unchanged Components (no modifications needed)

| Component | Why Unchanged |
|-----------|---------------|
| `execute-or-prepare.ts` | Activity logging wraps around callers, not inside this module |
| `registry.ts` | Agent registration is already complete; activity is a separate concern |
| `context.ts` | No new context fields needed |
| All existing pages (treasury, staking, delegations, playground, trading) | Independent features |
| `agent-store.ts` (Upstash) | Activity is in-memory, not persisted to Redis |
| All tool files (`tools/*.ts`) | Logging happens at the dispatch layer, not inside each tool |

## Data Flow

### Activity Event Lifecycle

```
1. Agent calls tool via HTTP (bridge or hosted MCP)
      |
2. Middleware intercepts BEFORE execution
      - Records: { id, agentId, agentName, tool, params, timestamp, status: "running" }
      - Pushes to ActivityLog ring buffer
      - Notifies SSE subscribers
      |
3. Tool executes (existing logic, unchanged)
      |
4. Middleware intercepts AFTER execution
      - Updates event: { status: "success"|"error", result/error, duration_ms }
      - Updates agent last-seen timestamp
      - Notifies SSE subscribers
      |
5. Dashboard receives SSE event, React Query invalidates, UI updates
```

### Activity Event Schema

```typescript
interface ActivityEvent {
  id: string;                    // crypto.randomUUID()
  timestamp: number;             // Date.now()
  agentId: string;               // "hackaclaw", "merkle", or registered name
  agentAddress: string;          // 0x...
  agentType: "first-party" | "third-party";
  tool: string;                  // "treasury_deposit", "lido_get_apr", etc.
  params: Record<string, unknown>; // Tool parameters (sanitized -- no keys)
  status: "running" | "success" | "error";
  result?: unknown;              // Tool result (on success)
  error?: string;                // Error message (on failure)
  duration_ms?: number;          // Execution time
  txHash?: string;               // If tool produced a transaction
}
```

### Agent Status Derivation

Agent status is derived from activity, not stored separately:

```typescript
type AgentStatus = "active" | "idle" | "error";

function deriveStatus(agent: RegisteredAgent, events: ActivityEvent[]): AgentStatus {
  const agentEvents = events.filter(e => e.agentId === agent.name);
  if (agentEvents.length === 0) return "idle";

  const latest = agentEvents[0]; // sorted newest first
  if (latest.status === "running") return "active";
  if (latest.status === "error") return "error";

  // "idle" if last activity was more than 30 seconds ago
  const IDLE_THRESHOLD_MS = 30_000;
  return (Date.now() - latest.timestamp) < IDLE_THRESHOLD_MS ? "active" : "idle";
}
```

## Key Architectural Decisions

### 1. ActivityLog as Shared Singleton (not per-request)

The MCP hosted handler creates a new McpServer per request (`createMcpServer` in hosted.ts). The ActivityLog must be a **module-level singleton** that persists across requests, not scoped to a single request.

```typescript
// activity-log.ts -- singleton, imported by both bridge.ts and hosted.ts
class ActivityLog {
  private events: ActivityEvent[] = [];
  private maxEvents = 500;           // ring buffer size
  private subscribers = new Set<(event: ActivityEvent) => void>();

  push(event: ActivityEvent): void { /* ... */ }
  getRecent(limit?: number): ActivityEvent[] { /* ... */ }
  getByAgent(agentId: string): ActivityEvent[] { /* ... */ }
  subscribe(callback: (event: ActivityEvent) => void): () => void { /* returns unsubscribe */ }
}

export const activityLog = new ActivityLog(); // singleton
```

**Why:** Per-request instances would lose events when the request ends. A singleton survives across HTTP requests within the same Node.js process (which is the Next.js dev server or the MCP server process).

**Caveat:** In serverless production (Vercel), each invocation may be a cold start with empty log. Acceptable for hackathon (local dev server = persistent process).

### 2. SSE over WebSocket

Use Server-Sent Events (SSE), not WebSocket:

- SSE works natively with Next.js API routes (no socket upgrade needed)
- Unidirectional (server-to-client) is all we need -- dashboard only reads
- Works with React Query's `onSuccess` to invalidate queries
- Simpler implementation: a single `ReadableStream` in a Route Handler

```typescript
// app/api/activity/sse/route.ts
export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      const unsubscribe = activityLog.subscribe((event) => {
        controller.enqueue(`data: ${JSON.stringify(event)}\n\n`);
      });
      // Clean up when client disconnects
      // (AbortSignal from request)
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
```

**Fallback:** If SSE proves problematic with Next.js dev server (Turbopack sometimes buffers responses), fall back to polling at 2-second intervals via React Query's `refetchInterval`.

### 3. Middleware at Dispatch Layer, Not Inside Tools

Logging wraps the tool dispatch, not each individual tool. This avoids modifying 25+ tool handlers.

**For bridge.ts** (HTTP bridge used by playground):
```typescript
// Wrap the existing toolRegistry lookup
const originalHandler = toolRegistry[tool];
const wrappedHandler: ToolHandler = async (params, ctx) => {
  const event = activityLog.startEvent(agentId, tool, params);
  try {
    const result = await originalHandler(params, ctx);
    activityLog.completeEvent(event.id, result);
    return result;
  } catch (err) {
    activityLog.failEvent(event.id, err);
    throw err;
  }
};
```

**For hosted.ts** (MCP protocol used by AI agents):
Intercept in `createMcpServer` -- wrap `server.tool()` calls or intercept at the transport level. The cleanest approach: wrap each `registerXxxTools` call with a logging proxy, or add an `onToolCall` callback to the server factory.

### 4. Agent Identity Resolution for Bridge Calls

The bridge (`/api/mcp/[tool]`) currently has no agent identity -- it is called by the dashboard UI on behalf of the connected wallet. For activity logging to attribute bridge calls:

- Dashboard bridge calls are attributed to a synthetic "dashboard" agent
- OR the bridge route extracts `wallet_address` from the request body and maps to a registered agent via the registry

Recommendation: Use `wallet_address` when present, fall back to "dashboard-user" for demo mode calls. This gives activity entries meaningful attribution without requiring auth on the bridge.

### 5. Pixel-Art Sprites as CSS Sprite Sheets

Each agent gets a sprite sheet PNG (e.g., 128x32 with 4 frames at 32x32 each). Animation states:

| State | Animation | Frames |
|-------|-----------|--------|
| idle | Gentle bobbing | 2 frames, slow loop |
| active | Working/typing | 4 frames, fast loop |
| error | Red flash/shake | 2 frames, one-shot |

Implementation: CSS `background-position` animation via `@keyframes` + `steps()` timing function. No JavaScript animation library needed.

```typescript
// components/agents/agent-sprite.tsx
interface AgentSpriteProps {
  agentId: string;      // maps to sprite sheet file
  status: AgentStatus;  // controls animation
  size?: number;        // pixel size (default 64, rendered at 2x for crisp pixels)
}
```

Use `image-rendering: pixelated` CSS to keep sprites crisp at 2x/3x sizes.

**Asset creation:** Hand-draw 3-4 distinct agent character sprite sheets (32x32 base). Each first-party agent (hackaclaw, merkle) gets a unique character. Third-party agents get assigned from a pool of generic sprites.

## Component Architecture (Frontend)

### Page Layout: `/agents`

```
+------------------------------------------------------------------+
|  AGENT COMMAND CENTER                              [status dots]  |
+------------------------------------------------------------------+
|                                                                    |
|  +------------------+  +------------------+  +-----------------+  |
|  | [sprite]         |  | [sprite]         |  | [sprite]        |  |
|  | hackaclaw        |  | merkle           |  | agent-0xAB..    |  |
|  | * Active         |  | * Idle           |  | * Idle          |  |
|  | Last: 2s ago     |  | Last: 1m ago     |  | Last: 5m ago    |  |
|  | Tools: 12        |  | Tools: 8         |  | Tools: 3        |  |
|  +------------------+  +------------------+  +-----------------+  |
|                                                                    |
|  LIVE ACTIVITY FEED                                                |
|  +--------------------------------------------------------------+ |
|  | 12:34:05  hackaclaw  treasury_deposit     SUCCESS  0.5s      | |
|  | 12:34:03  hackaclaw  treasury_status      SUCCESS  0.2s      | |
|  | 12:33:58  merkle     lido_get_apr         SUCCESS  0.8s      | |
|  | 12:33:55  hackaclaw  who_am_i             SUCCESS  0.1s      | |
|  | ...                                                          | |
|  +--------------------------------------------------------------+ |
+------------------------------------------------------------------+
```

### Component Tree

```
AgentsPage (server component shell)
  +-- AgentsClient ("use client")
       +-- AgentCardGrid
       |    +-- AgentCard (per agent)
       |         +-- AgentSprite (animated pixel art)
       |         +-- StatusIndicator (pulsing dot)
       |         +-- AgentStats (tool count, last seen)
       +-- ActivityFeed
            +-- ActivityRow (per event)
                 +-- ToolBadge (colored by domain)
                 +-- StatusBadge (success/error/running)
                 +-- TxLink (if txHash present)
```

### Data Fetching Strategy

```typescript
// use-agents.ts -- agent list (infrequent changes)
const { data: agents } = useQuery({
  queryKey: ["agents"],
  queryFn: () => fetch("/api/agents").then(r => r.json()),
  refetchInterval: 10_000, // 10s -- agents rarely change
});

// use-agent-activity.ts -- activity feed (real-time via SSE)
function useAgentActivity() {
  const queryClient = useQueryClient();
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    const source = new EventSource("/api/activity/sse");
    source.onmessage = (e) => {
      const event = JSON.parse(e.data);
      setEvents(prev => [event, ...prev].slice(0, 100));
      // Invalidate agent status queries
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    };
    return () => source.close();
  }, []);

  // Also fetch initial batch on mount
  useEffect(() => {
    fetch("/api/activity?limit=50")
      .then(r => r.json())
      .then(data => setEvents(data.events));
  }, []);

  return events;
}
```

## Cross-Package Data Flow

The ActivityLog singleton lives in `packages/mcp-server` but the SSE endpoint lives in `packages/app`. This requires a subpath export:

```jsonc
// packages/mcp-server/package.json exports
"./activity": {
  "types": "./src/activity-log.ts",
  "import": "./src/activity-log.ts",
  "default": "./src/activity-log.ts"
}
```

The Next.js API routes import directly from the MCP server package (same pattern as existing `@agentgate/mcp-server/bridge` and `@agentgate/mcp-server/hosted` imports).

**Important:** The ActivityLog singleton must be the SAME instance across:
- `/api/mcp/[tool]` route (bridge calls)
- `/api/mcp-agent` route (hosted MCP calls)
- `/api/activity/sse` route (SSE streaming)
- `/api/activity` route (REST queries)

In Next.js dev server (single Node.js process), module-level singletons are shared across route handlers. This works. In serverless (Vercel edge functions), each route could be a separate isolate -- but we are local-only for the hackathon.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Persisting Activity to Redis/Upstash
**What:** Storing activity events in Upstash like agent registrations.
**Why bad:** Adds latency, cost, and complexity for ephemeral data. Activity is session-scoped for the demo.
**Instead:** In-memory ring buffer. Accept data loss on restart.

### Anti-Pattern 2: Logging Inside Each Tool Handler
**What:** Adding `activityLog.push()` calls inside `registerTreasuryTools()`, `registerLidoTools()`, etc.
**Why bad:** Touches 7+ tool files, 25+ individual tool registrations. Fragile, easy to miss one.
**Instead:** Wrap at the dispatch layer (bridge toolRegistry lookup, hosted server.tool proxy).

### Anti-Pattern 3: WebSocket for Real-Time
**What:** Using socket.io or ws for real-time activity updates.
**Why bad:** Requires WebSocket server setup, doesn't work with Next.js API routes out of the box, overkill for unidirectional data.
**Instead:** SSE via ReadableStream in a Route Handler. Falls back to polling if needed.

### Anti-Pattern 4: Complex Sprite Animation Library
**What:** Using Phaser, PixiJS, or react-spring for pixel-art sprites.
**Why bad:** Massive dependency for simple sprite sheet animation. Pixel art needs `steps()` timing, not smooth interpolation.
**Instead:** CSS `@keyframes` with `background-position` and `animation-timing-function: steps(N)`. Pure CSS, zero dependencies.

### Anti-Pattern 5: Separate Activity Microservice
**What:** Building a separate Node.js process for activity logging.
**Why bad:** Another process to manage, IPC complexity, deployment overhead.
**Instead:** Activity is a module inside mcp-server, shared via subpath export.

## Build Order (Dependency-Aware)

Phase ordering matters because later components depend on earlier ones:

```
1. ActivityLog module (mcp-server)     -- no dependencies, foundation for everything
     |
2. Activity middleware (bridge.ts)     -- depends on ActivityLog
   Activity middleware (hosted.ts)     -- depends on ActivityLog (parallel with bridge)
     |
3. REST API endpoints (app)            -- depends on ActivityLog being populated
   SSE endpoint (app)                  -- depends on ActivityLog.subscribe()
     |
4. useAgents + useAgentActivity hooks  -- depends on API endpoints
     |
5. Pixel-art sprite assets             -- independent (can be done anytime)
   AgentSprite component               -- depends on assets
     |
6. AgentCard, StatusIndicator          -- depends on hooks + sprite component
   ActivityFeed, ActivityRow           -- depends on hooks
     |
7. Agents page (assembly)             -- depends on all components
   Sidebar update                      -- trivial, do with page
```

**Critical path:** Steps 1-2-3-4-6-7 are serial. Steps 5 (sprites) can be done in parallel with 2-3-4.

## Sources

- Existing codebase analysis (primary source -- all architecture decisions derived from code inspection)
- Next.js Route Handlers documentation (SSE via ReadableStream)
- CSS sprite animation via `steps()` timing function (standard CSS, well-supported)
- EventSource API (built into all modern browsers)
