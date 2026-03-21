# Technology Stack

**Project:** AgentGate Dashboard
**Researched:** 2026-03-21 (v1.1 additions), 2026-03-19 (v1.0 baseline)
**Context:** v1.1 milestone adds live agent activity dashboard with pixel-art sprites, real-time SSE streaming, and activity logging middleware to the existing Next.js 15 + Tailwind v4 + shadcn/ui monorepo app.

---

## v1.1 Stack Additions (NEW)

**Key finding: Zero new npm dependencies required.** Every v1.1 capability maps to built-in browser APIs, Node.js core modules, or CSS features. This is intentional — the existing stack is already comprehensive and the new features are better served by platform primitives than libraries.

### Pixel-Art Sprite Animation

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| CSS `steps()` + `background-position` | N/A (CSS spec) | Sprite sheet frame animation | Zero dependencies. CSS `animation-timing-function: steps(N)` with `background-position` shift is the standard technique for pixel-art sprite animation. Works with Tailwind's arbitrary value syntax. No library needed. | HIGH |
| CSS `image-rendering: pixelated` | N/A (CSS spec) | Crisp upscaling of pixel art | Native CSS property prevents anti-aliasing blur when scaling up small sprites. Use `crisp-edges` as Firefox fallback. | HIGH |

**Why no animation library:** Framer Motion (already in deps as `motion`), react-spring, and GSAP are designed for continuous/physics-based animation, not discrete sprite frame stepping. CSS `steps()` is purpose-built for this use case. The motion library already in deps is useful for UI micro-animations (card transitions, number tickers) but wrong for sprite stepping.

**Sprite creation:** Use [Aseprite](https://www.aseprite.org/) ($20, industry standard) or [Pixelorama](https://orama-interactive.itch.io/pixelorama) (free, open source, Godot-based) to create sprite sheets. Export as horizontal strip PNGs with consistent frame dimensions (e.g., 48x48px per frame, 4-8 frames per animation state).

**Implementation pattern:**
```css
/* Tailwind-compatible sprite animation */
.sprite-idle {
  width: 48px;
  height: 48px;
  image-rendering: pixelated;
  background: url('/sprites/agent-alpha.png') 0 0 no-repeat;
  background-size: 384px 192px; /* 8 cols x 4 rows */
  animation: sprite-idle 0.8s steps(8) infinite;
}

@keyframes sprite-idle {
  to { background-position: -384px 0; }
}
```

### Real-Time Event Streaming (SSE)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `ReadableStream` in Next.js Route Handler | Built-in (Next.js 16 / Web Streams API) | SSE endpoint pushing activity events to dashboard | Next.js Route Handlers natively support streaming. Set `Content-Type: text/event-stream`, `Cache-Control: no-cache`. Use `export const dynamic = 'force-dynamic'` and `export const runtime = 'nodejs'` to prevent caching/static optimization. | HIGH |
| Browser `EventSource` API | Built-in (all browsers) | Client-side SSE consumption | Native API for consuming SSE streams. Automatic reconnection built-in. Wrap in a custom React hook with `useEffect` cleanup. | HIGH |

**Why SSE over WebSocket:** The activity feed is unidirectional (server-to-client). SSE is simpler, works over HTTP/2, auto-reconnects natively, and requires zero infrastructure. WebSocket would require a custom server setup that breaks the existing Next.js architecture — Next.js Route Handlers do not support WebSocket upgrade.

**Why no `use-next-sse` library:** Only 13 GitHub stars. The native implementation is ~30 lines in the route handler and ~20 lines in a custom hook. Not worth a dependency for this.

**Critical implementation detail:** The route handler must return the `Response` immediately while writing to the stream asynchronously. Do NOT `await` the event loop inside the handler function — start it in `ReadableStream.start()` without awaiting:

```typescript
// app/api/activity/stream/route.ts
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      const handler = (event: ActivityEvent) => {
        controller.enqueue(`data: ${JSON.stringify(event)}\n\n`);
      };
      activityEmitter.on('activity', handler);
      // Clean up when client disconnects
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
```

### Activity Logging Middleware (MCP Server)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Node.js `EventEmitter` | Built-in (`node:events`) | Pub/sub for activity events within the MCP server process | The MCP server bridge is imported directly into the Next.js app process. An `EventEmitter` singleton lets the logging middleware publish events that the SSE route handler subscribes to. Zero latency, no serialization overhead. | HIGH |
| `crypto.randomUUID()` | Built-in (`node:crypto`) | Unique event IDs for SSE `id:` field | Enables SSE `Last-Event-ID` reconnection after disconnect. Built into Node.js. | HIGH |
| In-memory circular buffer | Custom (~30 LOC) | Store last N activity events for history endpoint | Simple array with modulo index. ~500 events is plenty for a demo session. No persistence needed per project constraints. | HIGH |

**Why not a database/queue:** Project explicitly scopes out persistent backends. Events are ephemeral — they exist only while the server is running, which is correct for a hackathon demo recording.

**Middleware wrapping pattern:** Wrap each `toolRegistry` handler to emit events:

```typescript
// activity-logger.ts
import { EventEmitter } from 'node:events';

export const activityEmitter = new EventEmitter();
const activityBuffer: ActivityEvent[] = [];
const MAX_BUFFER = 500;

export function withActivityLogging(
  toolName: string,
  handler: ToolHandler,
): ToolHandler {
  return async (params, ctx) => {
    const event = { id: crypto.randomUUID(), tool: toolName, agent: ctx.walletAddress, params, timestamp: Date.now(), status: 'pending' };
    activityEmitter.emit('activity', event);
    try {
      const result = await handler(params, ctx);
      const completed = { ...event, status: 'success', result };
      pushToBuffer(completed);
      activityEmitter.emit('activity', completed);
      return result;
    } catch (error) {
      const failed = { ...event, status: 'error', error: String(error) };
      pushToBuffer(failed);
      activityEmitter.emit('activity', failed);
      throw error;
    }
  };
}
```

### Status Indicators

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `tw-animate-css` | ^1.4.0 (already installed) | Pulse, ping animations for live status dots | Already in `package.json`. Provides `animate-pulse` for idle state, `animate-ping` for active state. No new dep. | HIGH |

## What NOT to Add for v1.1

| Tempting Option | Why Skip |
|----------------|----------|
| Framer Motion for sprites | Already have `motion` in deps for UI animations, but CSS `steps()` is the correct tool for sprite frame stepping. Motion/Framer uses spring physics — wrong paradigm. |
| `use-next-sse` / `eventsource-parser` | 30 lines of native code vs. a nascent dependency (13 stars). |
| Zustand / Jotai | `@tanstack/react-query` handles server state. SSE events feed a simple `useState` buffer — no global store needed. |
| Redis pub/sub / BullMQ | Single-process demo. `EventEmitter` is correct. The existing `@upstash/redis` dep is for registry persistence, not event streaming. |
| PixiJS / Phaser / react-three-fiber | CSS handles 4-6 small animated sprites. A game engine is absurd overkill. |
| Socket.io / ws | SSE covers unidirectional needs. WebSocket requires custom server infrastructure that Next.js Route Handlers don't support. |
| SQLite / Prisma / Drizzle | Out of scope. In-memory circular buffer for activity. |

## Integration Points with Existing Stack

### SSE Route Handler + Bridge
The SSE endpoint at `/api/activity/stream` imports the `activityEmitter` singleton from `@agentgate/mcp-server`. The bridge (`bridge.ts`) already exports `toolRegistry` — the logging middleware wraps each handler via `Object.fromEntries(Object.entries(toolRegistry).map(...))`.

### Activity Hook + @tanstack/react-query
Use react-query for initial activity history fetch (`GET /api/activity`), then layer the SSE `EventSource` hook for real-time updates. The SSE `onmessage` handler appends to local component state — no query cache invalidation needed.

### Sprite Component + Tailwind
The `<AgentSprite>` component uses Tailwind arbitrary values: `className="w-[48px] h-[48px] [image-rendering:pixelated]"` with inline `style` for dynamic `backgroundImage`, `backgroundPosition`, and CSS animation class switching based on agent state (idle/active/error).

### Agent Registry Data Model
The existing `RegisteredAgent` interface (`{ address, name, type, createdAt }`) from `registry.ts` provides all needed agent metadata. The activity logger enriches this with runtime state (last tool call, current status). No schema changes required.

## Event Flow Architecture

```
Agent calls MCP tool
  --> toolRegistry handler wrapped by withActivityLogging()
    --> EventEmitter.emit('activity', { agent, tool, params, result, timestamp })
      --> SSE Route Handler receives via EventEmitter.on('activity')
        --> controller.enqueue() writes to ReadableStream
          --> Browser EventSource receives SSE event
            --> useActivityStream() hook updates React state
              --> Activity feed + agent cards re-render
```

## New Files to Create

| File | Package | Purpose |
|------|---------|---------|
| `src/lib/activity-logger.ts` | `mcp-server` | EventEmitter singleton, logging middleware wrapper, circular buffer |
| `src/app/api/activity/stream/route.ts` | `app` | SSE Route Handler subscribing to activity events |
| `src/app/api/activity/route.ts` | `app` | REST endpoint for activity history + agent list |
| `src/hooks/use-activity-stream.ts` | `app` | Custom React hook wrapping `EventSource` with auto-reconnection |
| `src/components/agent-sprite.tsx` | `app` | Pixel-art sprite component with CSS `steps()` animation |
| `src/app/agents/page.tsx` | `app` | Live Agent Activity dashboard page |
| `public/sprites/*.png` | `app` | Sprite sheet PNG assets for agent characters |

## Installation for v1.1

```bash
# No new npm packages required.
# All v1.1 capabilities use:
#   - CSS steps() + background-position (browser built-in)
#   - EventSource API (browser built-in)
#   - ReadableStream (Node.js / Web Streams API, built into Next.js)
#   - EventEmitter (Node.js core: 'node:events')
#   - crypto.randomUUID() (Node.js core: 'node:crypto')
#
# The only new assets are sprite sheet PNGs in public/sprites/
```

---

## v1.0 Baseline Stack (reference — do not modify)

### Core Framework

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Next.js | 16.2.0 | App framework | Shipped with v1.0. App Router for layouts/server components. | HIGH |
| React | 19.2.4 | UI library | Ships with Next.js. Required by wagmi and RainbowKit. | HIGH |
| TypeScript | ^5 | Type safety | Already in monorepo. | HIGH |

### Wallet Connection

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| wagmi | ^2.19.5 | React hooks for Ethereum | HIGH |
| viem | ^2.47.5 | Ethereum client | HIGH |
| @rainbow-me/rainbowkit | ^2.2.10 | Wallet modal UI | HIGH |
| @tanstack/react-query | ^5.91.2 | Async state management | HIGH |

### Styling & UI

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| Tailwind CSS | ^4 | Utility CSS | HIGH |
| shadcn/ui (via shadcn ^4.1.0) | latest | Component library | HIGH |
| lucide-react | ^0.577.0 | Icons | HIGH |
| tw-animate-css | ^1.4.0 | CSS animations | HIGH |
| class-variance-authority | ^0.7.1 | Variant styling | HIGH |
| clsx + tailwind-merge | latest | Class merging | HIGH |

### Other

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| sonner | ^2.0.7 | Toast notifications | HIGH |
| @upstash/redis | ^1.37.0 | Registry persistence | HIGH |

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| CSS `steps()` for sprites | HIGH | Well-documented CSS standard, multiple authoritative sources, battle-tested technique since CSS3 |
| SSE via Next.js Route Handler | HIGH | Verified pattern in Next.js 15+/16, multiple 2025-2026 guides confirm `ReadableStream` + `force-dynamic` approach |
| EventEmitter for in-process events | HIGH | Node.js core module, standard pattern for single-process event broadcasting |
| Zero new deps needed | HIGH | Every capability maps to a built-in API |
| Sprite asset creation | MEDIUM | Tooling is clear but actual sprite art quality depends on artistic skill or asset sourcing |

## Sources

- [Josh Comeau — Sprites on the Web](https://www.joshwcomeau.com/animation/sprites/) — CSS sprite animation reference
- [Alec Horner — Animating Pixel Sprites with CSS](https://alechorner.com/blog/animating-pixel-sprites-with-css/) — React + CSS steps() integration
- [kirupa.com — Sprite Sheet Animations Using Only CSS](https://www.kirupa.com/html5/sprite_sheet_animations_using_only_css.htm) — steps() deep dive
- [HackerNoon — Streaming in Next.js 15: WebSockets vs SSE](https://hackernoon.com/streaming-in-nextjs-15-websockets-vs-server-sent-events) — SSE vs WebSocket comparison
- [Damian Hodgkiss — Real-Time Updates with SSE in Next.js 15](https://damianhodgkiss.com/tutorials/real-time-updates-sse-nextjs) — Practical SSE implementation
- [Pedro Alonso — Real-Time Notifications with SSE in Next.js](https://www.pedroalonso.net/blog/sse-nextjs-real-time-notifications/) — SSE configuration patterns
- [Pixelorama](https://orama-interactive.itch.io/pixelorama) — Free open-source pixel art editor
- [Next.js Route Handlers docs](https://nextjs.org/docs/app/building-your-application/routing/route-handlers) — Streaming response patterns
