# Feature Landscape

**Domain:** Live Agent Activity Dashboard with Pixel-Art Sprites
**Researched:** 2026-03-21
**Existing app:** AgentGate Dashboard (Next.js 15, Tailwind v4, shadcn/ui, wagmi, dark crypto theme)
**Context:** v1.1 milestone -- adding live agent monitoring to existing v1.0 dashboard for hackathon demo video

## Table Stakes

Features judges expect from a "live agent activity dashboard." Missing any of these and the demo feels hollow.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Agent cards with status indicators | Every monitoring dashboard shows entity status at a glance | Low | Agent registry `listAgents()` API | Green/yellow/red dot + agent name, address, type. Reuse existing card patterns from Treasury/Delegation pages |
| Real-time activity feed | Core promise of a "live" dashboard -- must show events appearing without refresh | Medium | Activity logging middleware in MCP server, SSE or polling endpoint | Chronological list of tool calls with agent name, tool name, timestamp, result status. Auto-scroll with new items appearing at top |
| Activity logging middleware | No data = no dashboard. Must capture tool calls with agent identity, tool name, params, result, timestamp | Medium | Instrument `executeOrPrepare` + MCP `server.tool()` wrappers | In-memory ring buffer (no DB needed for hackathon). Store last ~200 events |
| REST API for agents + activity | Dashboard needs data endpoints | Low | Middleware + registry already exist | `GET /api/agents` (list), `GET /api/activity` (recent events), `GET /api/activity/stream` (SSE) |
| Transaction hash display | DeFi dashboard must show on-chain tx evidence | Low | `executeOrPrepare` already returns `tx_hash` | Link to BaseScan. Show tx status (pending/confirmed/failed) |
| Agent type badges | Distinguish first-party vs third-party agents | Low | Registry already has `type` field | Visual badge on agent cards. First-party = trusted/gold, third-party = standard |
| Demo mode compatibility | Existing app supports demo mode -- new page must too | Low | Existing wallet connect + demo mode pattern | Seed fake activity events when no wallet connected, matching existing demo mode pattern |

## Differentiators

Features that make this dashboard memorable in a 2-minute hackathon video. These create the "wow" moment.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| Animated pixel-art agent sprites | Visual wow-factor that makes the dashboard instantly memorable. Judges see dozens of dashboards -- pixel art characters stand out | Medium | Sprite sheet assets (PNG), CSS `steps()` animation | Each agent gets a unique sprite character. States: idle (breathing), active (working animation), error (red flash). Use CSS `image-rendering: pixelated` for crisp scaling. Inspired by Pixels.xyz and VS Code Pixel Agents extension |
| State-driven sprite animations | Sprites react to real-time events -- agent starts a tool call, sprite animates "working"; tool fails, sprite shows "error" | Medium | SSE events + sprite system | Map activity events to sprite states. Transition animations between states. Creates a living, breathing dashboard |
| Command center layout | Full-screen "war room" feel with agent sprites in a scene area + activity feed sidebar | Medium | Layout design only | Split layout: left 2/3 is the agent scene (sprites in a pixel-art environment), right 1/3 is activity feed timeline. Dark theme with subtle retro aesthetic |
| Tool call detail expansion | Click an activity event to see full params/response JSON | Low | Activity data already includes params/result | Expandable accordion rows in feed. Reuse JSON viewer pattern from MCP Playground |
| Agent activity sparklines | Tiny inline charts showing each agent's activity over time | Medium | Activity history data | Small bar/line charts on agent cards showing recent activity density. Gives instant sense of which agents are busy |
| Live event counter / stats bar | Running totals: "47 tool calls, 12 transactions, 3 agents active" | Low | Aggregate from activity buffer | Sticky stats bar at top of dashboard. Numbers animate up when events arrive |

## Anti-Features

Features to explicitly NOT build. These waste time or harm the demo.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Persistent database for activity logs | Hackathon demo runs locally, no need for MongoDB/Postgres. Adds setup complexity for judges | In-memory ring buffer, cleared on restart. 200 events is plenty for a demo |
| WebSocket server | Overkill for unidirectional server-to-client updates. SSE is simpler, natively supported, works with Next.js App Router | Use SSE via Next.js Route Handler with `ReadableStream` |
| Full agent management CRUD | Registration flow already exists in MCP server. Building a UI for it is time-consuming and not demo-impressive | Show read-only agent list from registry. Management happens via API/CLI |
| Complex filtering/search on activity feed | With ~200 events max and 2-3 agents, filtering adds UI complexity with zero demo value | Simple "all events" feed, maybe filter by agent via click on agent card |
| Mobile responsive layout | PROJECT.md explicitly says desktop demo only | Fixed desktop layout optimized for 1920x1080 recording |
| Canvas/WebGL sprite rendering | Over-engineered for a few sprite characters. Canvas adds complexity and breaks accessibility | CSS sprite sheet animation with `steps()` + `background-position`. Pure CSS is simpler, more performant for 2-5 sprites, and trivially debuggable |
| Sound effects | Fun but distracting in a demo video where narration matters | Visual-only feedback for events |
| Real-time log streaming from MCP stdio | MCP server uses stdio transport -- intercepting that stream is fragile | Activity middleware writes to in-memory buffer; HTTP bridge reads from it |

## Feature Dependencies

```
Activity Logging Middleware
    |
    v
In-Memory Activity Buffer
    |
    +---> REST API endpoints (/api/agents, /api/activity)
    |         |
    |         +---> Agent Cards with Status
    |         |
    |         +---> Activity Feed (polling fallback)
    |         |
    |         +---> Live Stats Counter
    |
    +---> SSE Stream endpoint (/api/activity/stream)
              |
              +---> Real-time Activity Feed (preferred)
              |
              +---> State-driven Sprite Animations
              |
              +---> Live Event Counter updates

Sprite Sheet Assets (PNG files)
    |
    v
CSS Sprite Animation System
    |
    +---> Agent Sprite Components
    |         |
    |         +---> Idle / Active / Error state animations
    |
    +---> Command Center Scene Layout

Agent Registry (existing)
    |
    +---> Agent List API (existing listAgents())
              |
              +---> Agent Cards
              +---> Sprite Assignment (agent name -> sprite character)
```

## MVP Recommendation

Prioritize for maximum demo impact in minimum time:

1. **Activity logging middleware** -- without data, nothing works. Instrument `executeOrPrepare` and tool call wrappers to push events to an in-memory buffer. This is the critical path.

2. **REST API endpoints** -- `/api/agents` and `/api/activity` using existing bridge pattern. Simple, fast to build.

3. **Agent cards with pixel-art sprites** -- the visual hook. Even static sprites with idle animation create instant wow-factor. Use 2-3 pre-made sprite sheets (one per first-party agent: hackaclaw, merkle).

4. **Activity feed timeline** -- chronological list of events. Start with polling (`react-query` refetchInterval), upgrade to SSE if time permits.

5. **SSE real-time streaming** -- upgrade from polling. Makes the demo feel alive when tool calls trigger and events appear instantly.

6. **State-driven sprite animations** -- sprites react to events. This is the money shot for the demo video.

**Defer:**
- Agent activity sparklines: Nice but not essential. Only valuable with sustained activity over time, which a 2-minute demo may not showcase.
- Tool call detail expansion: Low priority -- the MCP Playground already shows JSON responses. Don't duplicate.
- CRT/scan-line visual effects: Polish layer, add only if all core features are done.

## Sprite Implementation Notes

**Approach:** CSS sprite sheet animation using `steps()` timing function.

- Each agent character = one PNG sprite sheet (horizontal strip of frames)
- Frame size: 32x32 or 64x64 pixels, scaled up 3-4x with `image-rendering: pixelated`
- States: `idle` (2-4 frames, looping), `active` (4-6 frames, looping while working), `error` (2 frames, flash red)
- Switching states: change CSS class which updates `animation` property and `background-position` row
- No canvas, no WebGL, no runtime libraries needed -- pure CSS + a React component managing state

**Asset strategy:** Use free pixel-art character generators or commission 2-3 simple sprites. Alternatively, create them in Aseprite and export as sprite sheets. For a hackathon, even simple 4-frame idle animations are effective.

**Scaling:** `image-rendering: pixelated` (Chrome/Edge) + `image-rendering: crisp-edges` (Firefox) ensures sharp upscaling without blur. Container size controls display scale.

## Sources

- [Smashing Magazine: UX Strategies for Real-Time Dashboards](https://www.smashingmagazine.com/2025/09/ux-strategies-real-time-dashboards/)
- [Microsoft Learn: Monitor AI Agent Activity in Agent Feed](https://learn.microsoft.com/en-us/dynamics365/release-plan/2025wave2/service/dynamics365-customer-service/monitor-ai-agent-activity-agent-feed)
- [Mission Control: Open-source AI Agent Orchestration Dashboard](https://github.com/builderz-labs/mission-control)
- [OpenClaw Dashboard: Real-time AI Agent Monitoring](https://github.com/tugcantopaloglu/openclaw-dashboard)
- [Treehouse: CSS Sprite Sheet Animations with steps()](https://blog.teamtreehouse.com/css-sprite-sheet-animations-steps)
- [CSS Sprite Sheets - Lean Rada](https://leanrada.com/notes/css-sprite-sheets/)
- [Animating Sprites with CSS and React](https://alechorner.com/blog/animating-pixel-sprites-with-css)
- [SSE in Next.js: Real-Time Notifications](https://www.pedroalonso.net/blog/sse-nextjs-real-time-notifications/)
- [SSE's Glorious Comeback: 2025 is the Year of Server-Sent Events](https://portalzine.de/sses-glorious-comeback-why-2025-is-the-year-of-server-sent-events/)
- [Pixels.xyz: Web3 Pixel Art Game](https://www.pixels.xyz/)
- [Inc: Pixel Art Game for AI Coding (Pixel Agents)](https://www.inc.com/fast-company-2/this-pixel-art-game-solves-1-of-ai-codings-most-annoying-problems/91311290)
