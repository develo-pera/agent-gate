# Domain Pitfalls

**Domain:** Live agent activity dashboard with pixel-art sprites (v1.1 milestone, added to existing Next.js + MCP server stack)
**Researched:** 2026-03-22

## Critical Pitfalls

Mistakes that cause rewrites, demo failures, or major issues.

### Pitfall 1: SSE Route Handler Buffering in Next.js App Router

**What goes wrong:** Next.js waits for the route handler function to complete before sending the Response to the client. If you `await` an async loop that pushes chunks before returning the Response, Next.js buffers everything and delivers it all at once when the handler finishes -- defeating the purpose of SSE entirely.

**Why it happens:** The natural pattern is `const stream = createStream(); await pushEvents(stream); return new Response(stream)`. But Next.js needs the Response returned *immediately* so the stream can be consumed in the background.

**Consequences:** SSE endpoint appears dead during the demo. Events arrive as a single batch after timeout, or not at all. Looks like a broken feature in front of judges.

**Prevention:**
- Return the `Response(readableStream)` immediately from the route handler
- Start async event-pushing work inside the `ReadableStream` constructor's `start()` callback, *without* awaiting it in the handler body
- Add `export const dynamic = 'force-dynamic'` to prevent Next.js from caching/statically optimizing the SSE route
- Add `export const runtime = 'nodejs'` -- edge runtime has different streaming constraints
- Set headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, `Connection: keep-alive`, `X-Accel-Buffering: no`

**Detection:** SSE endpoint returns nothing for 30+ seconds then dumps all events at once. `curl` against the endpoint shows no incremental output.

**Phase:** Must be correct from the start in the SSE endpoint phase. No way to patch later.

**Confidence:** HIGH -- verified via Next.js GitHub discussions (#48427) and multiple production reports.

---

### Pitfall 2: SSE Memory Leak from Uncleaned Connections

**What goes wrong:** SSE connections are long-lived. If the client navigates away, closes the tab, or React unmounts the component, the server-side interval/listener keeps running. Over time (or with fast page switching during a demo), this leaks memory and triggers `MaxListenersExceededWarning: Possible EventEmitter memory leak detected`.

**Why it happens:** Three independent cleanup points must all work: (1) server detects `request.signal.aborted` or `close` event, (2) server clears its interval/listener, (3) client-side `EventSource.close()` in React `useEffect` cleanup. Missing any one causes a leak.

**Consequences:** Server hangs or crashes during demo. EventEmitter warnings flood the console. CPU spikes from orphaned intervals pushing to dead streams.

**Prevention:**
- Server-side: Listen to `request.signal` (AbortSignal) in the route handler. When aborted, clear all intervals and close the stream controller.
  ```typescript
  request.signal.addEventListener('abort', () => {
    clearInterval(intervalId);
    controller.close();
  });
  ```
- Client-side: Always close `EventSource` in `useEffect` cleanup:
  ```typescript
  useEffect(() => {
    const es = new EventSource('/api/activity/stream');
    // ... handlers ...
    return () => es.close();
  }, []);
  ```
- Cap maximum SSE connections per page to 1 (browsers limit to ~6 per domain anyway)
- Add a heartbeat ping every 15-30 seconds so dead connections are detected

**Detection:** Check Node.js process memory over time. Watch for `MaxListenersExceededWarning` in console.

**Phase:** SSE implementation phase. Must be built into the initial SSE hook design.

**Confidence:** HIGH -- well-documented Next.js issue (#53949, #48427).

---

### Pitfall 3: Activity Logging Slows Down MCP Tool Execution

**What goes wrong:** Adding synchronous logging (e.g., writing to Upstash Redis, emitting SSE events) inside `executeOrPrepare` or tool handlers adds latency to every MCP tool call. In the existing architecture, each `/api/mcp-agent` request creates a fresh MCP server + transport per request (see `hosted.ts` lines 252-266). Adding blocking I/O to this hot path compounds the latency.

**Why it happens:** The natural instinct is to `await redis.lpush(...)` or `await emitToSSE(...)` inside the tool handler. But the MCP request is already waiting for the response. Every millisecond of logging delay is visible to the calling agent.

**Consequences:** Agent tool calls become noticeably slower. Demo feels sluggish. Agents that chain multiple tool calls (e.g., check balance -> deposit -> verify) experience compounding delays.

**Prevention:**
- Use fire-and-forget logging: `void logActivity(event).catch(console.error)` -- do NOT await
- Buffer activity events in an in-memory array; flush to persistent store on an interval (e.g., every 2 seconds) or when buffer hits a size threshold
- For SSE: use an in-process EventEmitter or shared `Map<connectionId, WritableStreamDefaultWriter>` -- push events to connected SSE clients without any async I/O in the tool path
- Keep the activity log store separate from the Upstash agent store. An in-memory circular buffer (last 200 events) is sufficient for a demo
- Never add logging inside the `waitForTransactionReceipt` await in `executeOrPrepare` -- that's already slow enough

**Detection:** Compare tool call latency before and after adding logging. If > 50ms increase, logging is too heavy.

**Phase:** Activity logging middleware phase. Architecture decision that's hard to change later.

**Confidence:** HIGH -- derived from codebase analysis of the per-request server creation pattern in hosted.ts.

---

### Pitfall 4: Per-Request MCP Server Creation Loses Activity State

**What goes wrong:** The existing `handleMcpRequest` in `hosted.ts` creates a brand new `McpServer` instance for every HTTP request, then closes it after the response (`finally { await transport.close(); await server.close(); }`). Any activity state, event emitters, or logging middleware attached to the server instance is destroyed after each call. There is no persistent process or server instance to accumulate activity history.

**Why it happens:** The stateless per-request pattern was correct for the v1.0 REST bridge (no need for state). But activity tracking needs a persistent store that survives across requests.

**Consequences:** Activity feed shows nothing because each request's logging is discarded with the server. Developers waste time debugging "why aren't events appearing" when the real problem is architectural.

**Prevention:**
- Create a module-level singleton activity store (NOT attached to the MCP server instance):
  ```typescript
  // activity-store.ts -- module-level singleton
  class ActivityStore {
    private events: ActivityEvent[] = [];
    private listeners = new Set<(event: ActivityEvent) => void>();

    push(event: ActivityEvent) { ... }
    subscribe(fn: (event: ActivityEvent) => void) { ... }
  }
  export const activityStore = new ActivityStore();
  ```
- Import this singleton into both the MCP tool handlers (to push events) and the SSE route handler (to subscribe)
- The singleton lives in the Next.js server process, which persists across requests in dev mode
- Be aware: in production with serverless (Vercel), this singleton resets per cold start. For a hackathon demo on localhost, this is fine.

**Detection:** Activity feed is empty despite tools being called successfully.

**Phase:** Architecture decision -- must be resolved before implementing either logging or SSE.

**Confidence:** HIGH -- directly observed in the codebase (`hosted.ts` create-use-destroy pattern).

---

### Pitfall 5: Sprite Animation Causes React Re-render Cascade

**What goes wrong:** Driving sprite frame changes via React state (`useState` for current frame index) triggers a full component re-render on every frame tick (typically 60fps or at sprite framerate like 8-12fps). If the sprite component is inside a list of agent cards, every frame tick re-renders the entire agent list.

**Why it happens:** React's reconciliation runs on every state change. Even with `React.memo`, if the parent re-renders due to frame state, children without stable references get re-rendered too.

**Consequences:** Janky animation. Dropped frames. Browser tab becomes unresponsive if 5+ agents are animating simultaneously. Demo looks cheap instead of polished.

**Prevention:**
- Use CSS `steps()` animation for sprite sheets -- zero JavaScript, runs on compositor thread, no React re-renders at all:
  ```css
  .sprite {
    background: url('/sprites/agent.png');
    width: 32px; height: 32px;
    animation: walk 0.8s steps(4) infinite;
  }
  @keyframes walk {
    to { background-position: -128px 0; }
  }
  ```
- If JS control is needed (state-driven animation switching), use `requestAnimationFrame` + a ref to mutate a canvas or DOM element directly, bypassing React's render cycle
- Never store animation frame index in `useState` -- use `useRef` instead
- Isolate sprite components so their internal animation state doesn't propagate upward

**Detection:** React DevTools Profiler shows sprite components re-rendering at 8-60fps. CPU usage spikes with more agent cards visible.

**Phase:** Sprite animation implementation phase. The CSS approach should be chosen from the start.

**Confidence:** HIGH -- well-established React performance pattern.

## Moderate Pitfalls

### Pitfall 6: Browser EventSource Reconnection Floods Server

**What goes wrong:** The browser's native `EventSource` automatically reconnects when a connection drops (network blip, server restart during dev). It retries with exponential backoff by default, but if the server responds with an error (non-200), EventSource keeps retrying. During development with hot reload, each HMR cycle can spawn a new EventSource before the old cleanup runs, creating connection pile-ups.

**Prevention:**
- Set a `retry:` field in SSE messages to control reconnect interval (e.g., `retry: 5000\n`)
- Use a ref to track the current EventSource and close it before creating a new one
- Consider using a custom `useEventSource` hook that handles reconnection with a maximum retry count
- In dev mode, consider polling instead of SSE to avoid HMR-related connection chaos

**Phase:** SSE client hook implementation.

**Confidence:** MEDIUM -- common web pattern, not Next.js-specific.

---

### Pitfall 7: Sprite Sheet Image Loading Race Condition

**What goes wrong:** The sprite sheet image hasn't loaded when the CSS animation starts, causing a flash of empty/broken frames. Or worse, the image is large and takes 500ms+ to load, so the agent card renders without its sprite for the first half-second of the demo.

**Prevention:**
- Preload sprite sheet images using `<link rel="preload" as="image" href="/sprites/...">` in the layout head
- Use small sprite sheets (a 4-frame 32x32 pixel-art sprite is ~2KB as PNG -- trivially small)
- Set `image-rendering: pixelated` CSS to prevent blurring when scaling up pixel art
- Place sprite images in `/public/sprites/` for direct serving, not via Next.js image optimization (which would blur pixel art)
- Do NOT use `next/image` for sprite sheets -- it applies lossy optimization and responsive sizing that destroys pixel art

**Phase:** Sprite asset preparation phase.

**Confidence:** HIGH -- standard web dev issue, pixel-art-specific `image-rendering` is critical.

---

### Pitfall 8: Activity Event Schema Mismatch Between MCP Server and Dashboard

**What goes wrong:** The MCP tool handlers emit activity events with one shape (e.g., `{ tool, params, result }`), but the dashboard expects a different shape (e.g., `{ toolName, input, output, agentId, timestamp }`). Since the logging middleware and dashboard are built in separate phases or by different people, the contract drifts.

**Prevention:**
- Define a shared `ActivityEvent` TypeScript type in a shared location (`packages/mcp-server/src/activity-types.ts`) and import it from both the MCP server logging and the Next.js app
- Include all fields the dashboard needs from day one: `agentId`, `agentName`, `toolName`, `params`, `result`, `timestamp`, `duration`, `txHash?`, `status: 'success' | 'error'`
- Include a `type` discriminator: `'tool_call' | 'tx_submitted' | 'tx_confirmed' | 'agent_registered' | 'agent_status_change'`

**Phase:** Activity logging middleware -- define the type before implementing either producer or consumer.

**Confidence:** HIGH -- standard integration pitfall.

---

### Pitfall 9: In-Memory Activity Store Lost on Next.js HMR

**What goes wrong:** During development, Next.js hot module replacement re-imports modules, creating new instances of module-level singletons. The activity store resets, losing all accumulated events. The dashboard appears to "forget" history on every code save.

**Prevention:**
- Use the `globalThis` pattern to persist singletons across HMR:
  ```typescript
  const globalStore = globalThis as any;
  if (!globalStore.__activityStore) {
    globalStore.__activityStore = new ActivityStore();
  }
  export const activityStore: ActivityStore = globalStore.__activityStore;
  ```
- This is the same pattern used by Prisma, drizzle, and other libraries for dev-mode singleton persistence in Next.js
- Only needed in development -- production doesn't have HMR

**Detection:** Activity feed clears every time you save a file during development.

**Phase:** Activity store implementation.

**Confidence:** HIGH -- well-known Next.js development pattern (Prisma docs recommend identical approach).

---

### Pitfall 10: Anvil Fork Event Watching Limitations

**What goes wrong:** If using an Anvil fork for demo purposes, `viem`'s `watchContractEvents` or `publicClient.watchBlockNumber` may not work as expected. Anvil doesn't mine blocks automatically unless configured with `--block-time`, so event watchers that depend on new blocks never fire.

**Prevention:**
- If using Anvil for demo: set `--block-time 2` to auto-mine blocks
- For the activity dashboard, do NOT rely on on-chain event watching as the primary activity source. Instead, instrument the MCP tool layer (which you control) and treat on-chain events as supplementary confirmation
- The existing `executeOrPrepare` already returns `tx_hash` and `block_number` -- capture these at the tool layer, don't re-fetch from chain
- If you need real-time tx status, poll `getTransactionReceipt` on known hashes rather than watching for log events

**Phase:** On-chain transaction tracking phase.

**Confidence:** MEDIUM -- depends on whether demo uses Anvil fork or live Base mainnet.

---

### Pitfall 11: SSE + Existing MCP Streamable HTTP Transport Conflict

**What goes wrong:** The existing `hosted.ts` already uses `WebStandardStreamableHTTPServerTransport` which itself supports SSE for MCP protocol streaming. Adding a separate SSE endpoint for the activity dashboard creates confusion about which SSE stream serves what purpose. Worse, if both use the same path prefix or port, they can interfere.

**Prevention:**
- Keep the two SSE concerns completely separate:
  - `/api/mcp-agent` -- existing MCP protocol transport (Streamable HTTP, used by AI agents)
  - `/api/activity/stream` -- new activity SSE endpoint (used by dashboard browser UI)
- The activity SSE endpoint is a plain Next.js route handler, NOT an MCP transport
- Do not try to piggyback activity events onto the MCP Streamable HTTP transport -- it's per-request and stateless
- Document the distinction clearly in code comments

**Phase:** SSE endpoint architecture decision -- must be clear before implementation.

**Confidence:** HIGH -- directly observed the existing Streamable HTTP transport in the codebase.

## Minor Pitfalls

### Pitfall 12: Pixel Art Scaling Blurriness

**What goes wrong:** Browser default image scaling uses bilinear interpolation, turning crisp 32x32 pixel art into blurry mush when scaled up for display.

**Prevention:**
- Apply `image-rendering: pixelated` (Chrome/Edge) and `image-rendering: crisp-edges` (Firefox fallback) to all sprite elements
- If using CSS `background-image` for sprites, apply to the container element
- Test at the exact display size planned for the demo (e.g., 64x64 or 96x96 upscaled from 32x32)

**Phase:** Sprite component styling.

**Confidence:** HIGH.

---

### Pitfall 13: Demo Mode Activity Feed is Empty

**What goes wrong:** In demo mode (no wallet connected), no MCP tool calls are happening, so the activity feed shows nothing. The dashboard looks broken rather than impressive.

**Prevention:**
- Seed the activity store with a set of realistic demo events on initialization when demo mode is detected
- Consider auto-playing a scripted sequence of "simulated" tool calls that populate the feed in real-time during demo mode
- The demo events should include a mix of tool types, agent identities, and both successful/failed calls for visual variety

**Phase:** Demo mode integration, after core activity feed is working.

**Confidence:** HIGH -- the existing app already has a demo mode pattern for other features.

---

### Pitfall 14: Too Many Simultaneous Animation Timers

**What goes wrong:** If each agent card creates its own `setInterval` or `requestAnimationFrame` loop for sprite animation, having 10+ agents means 10+ independent timers competing for the main thread.

**Prevention:**
- Use CSS `steps()` animation (zero JS timers needed) -- this is the primary recommendation
- If using JS: use a single `requestAnimationFrame` loop that updates all sprites, not one loop per sprite
- Or use CSS animation with `animation-delay` to stagger sprites for visual variety without any JS

**Phase:** Sprite animation implementation.

**Confidence:** HIGH.

## Inherited v1.0 Pitfalls (Still Relevant)

These pitfalls from v1.0 research remain relevant for the v1.1 milestone:

### Pitfall 15: Hydration Mismatch with Wallet State
**What goes wrong:** New dashboard components using wagmi hooks server-render differently than client, causing hydration errors.
**Prevention:** All new agent dashboard components that check wallet state must use `"use client"` and the mounted-state pattern. The activity feed component needs this if it conditionally shows demo vs live data based on wallet connection.

### Pitfall 16: RPC Rate Limiting During Demo
**What goes wrong:** Activity dashboard adds more chain reads (agent balances, tx confirmations) on top of existing pages.
**Prevention:** Continue using React Query staleTime. For the activity dashboard, derive chain data from MCP tool results already captured in the activity log rather than making additional RPC calls.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Activity logging middleware | #3 (blocking I/O slows tools), #4 (per-request server loses state), #8 (schema mismatch) | Fire-and-forget logging, module-level singleton store, shared ActivityEvent type |
| SSE endpoint | #1 (buffering), #2 (memory leaks), #11 (transport confusion) | Return Response immediately, AbortSignal cleanup, separate from MCP transport |
| SSE client hook | #6 (reconnection flood), #9 (HMR resets store) | Custom hook with cleanup, globalThis singleton pattern |
| Sprite animation | #5 (React re-render cascade), #12 (blurry scaling), #14 (timer proliferation) | CSS steps() animation, pixelated rendering, no useState for frames |
| Sprite assets | #7 (image loading race) | Preload, small PNGs, /public/ serving, NO next/image |
| Activity feed UI | #8 (schema mismatch), #13 (empty in demo mode) | Shared ActivityEvent type, demo seed data |
| On-chain tracking | #10 (Anvil limitations) | Instrument tool layer, don't rely on chain event watching |
| Dashboard page | #15 (hydration mismatch), #16 (RPC rate limiting) | "use client", derive data from activity log |

## Sources

- [Next.js SSE Discussion #48427](https://github.com/vercel/next.js/discussions/48427) -- SSE route handler buffering issues
- [Next.js EventEmitter Leak #53949](https://github.com/vercel/next.js/issues/53949) -- MaxListenersExceededWarning with SSE
- [Next.js ResponseAborted Discussion #61972](https://github.com/vercel/next.js/discussions/61972) -- unhandledRejection on SSE disconnect
- [Fixing Slow SSE in Next.js (Jan 2026)](https://medium.com/@oyetoketoby80/fixing-slow-sse-server-sent-events-streaming-in-next-js-and-vercel-99f42fbdb996) -- streaming configuration requirements
- [Pedro Alonso: Real-Time SSE in Next.js](https://www.pedroalonso.net/blog/sse-nextjs-real-time-notifications/) -- connection cleanup patterns
- [Upstash: SSE Streaming in Next.js](https://upstash.com/blog/sse-streaming-llm-responses) -- ReadableStream implementation
- [Animating Pixel Sprites with CSS](https://alechorner.com/blog/animating-pixel-sprites-with-css) -- CSS steps() approach for sprites
- [CSS Sprite Sheet Animations](https://leanrada.com/notes/css-sprite-sheets/) -- performance characteristics
- [requestAnimationFrame in React](https://blog.openreplay.com/use-requestanimationframe-in-react-for-smoothest-animations/) -- cleanup and memory leak prevention
- [FastMCP Middleware](https://gofastmcp.com/servers/middleware) -- middleware pattern for MCP logging
- [MCP Server Logging Guide](https://mcpmanager.ai/blog/mcp-logging/) -- logging best practices
- Codebase analysis: `packages/mcp-server/src/hosted.ts` (per-request server lifecycle), `packages/mcp-server/src/execute-or-prepare.ts` (transaction execution path), `packages/app/src/lib/agent-store.ts` (Upstash singleton pattern)
