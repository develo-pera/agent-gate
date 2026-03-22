# Phase 8: Dashboard Page Assembly - Research

**Researched:** 2026-03-22
**Domain:** React page assembly, SSE real-time data, client-side state management
**Confidence:** HIGH

## Summary

Phase 8 is a pure assembly phase -- it wires together existing backend endpoints (Phase 6) and sprite components (Phase 7) into a single "Live Agents" dashboard page. No new API endpoints, no new npm dependencies, no new sprite features. The work is entirely in `packages/app/src/` creating new React components and a custom SSE hook.

The codebase already has all the building blocks: `SpriteScene`/`AgentSprite` components, `/api/agents` and `/api/activity` REST endpoints, `/api/activity/sse` streaming endpoint, `Card`/`Badge`/`Button` shadcn components, `AddressDisplay` for address truncation, and established page patterns (treasury/page.tsx). The research confirms zero new dependencies are needed -- the project already has `@tanstack/react-query` for REST fetching and native `EventSource` API for SSE.

**Primary recommendation:** Build the page in two waves -- first the static page with data fetching (sidebar nav, agent cards, activity feed from REST), then the real-time layer (SSE hook, live updates, demo mode drip).

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Stacked vertical sections: sprite scene banner (~250px) on top, agent cards row below, full-width activity feed at bottom
- Activity feed has a fixed max height (~400-500px) with its own internal scrollbar
- Page title: "Live Agents" heading with live stat badges
- New events slide in from top with a brief highlight glow animation
- Agent cards: compact info with pulsing colored dot for status (green=active, amber=idle, gray=registered)
- No mini robot avatar on cards -- text-only
- Clickable cards to filter activity feed to that agent; click again (or click "All") to unfilter
- Timeline rows: timestamp | agent name | tool name | status badge (success/pending/error)
- Expandable on click -- reveals params + result JSON below the row
- Entries with on-chain transactions show a chain-link icon + truncated tx hash
- Auto-scroll to top for new events unless user has scrolled down, then show "N new events" badge
- Real-time updates via SSE subscription (Phase 6 endpoint)
- Client-side agent filtering (SSE streams all events, filter in UI)
- Demo mode: "Run Demo" button in empty state (NOT automatic)
- Uses real registered agent names (Hackaclaw, Merkel)
- Timed drip playback: events appear one by one every 2-3 seconds
- "Demo Mode" chip/badge while demo is running

### Claude's Discretion
- Exact stat badge implementation and positioning
- Activity row internal layout and spacing
- Expand/collapse animation for activity detail view
- Demo event timing variation
- SSE hook implementation details
- Empty state illustration/messaging before "Run Demo" is clicked

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DASH-01 | Live Agent Activity page accessible from sidebar navigation | Add entry to NAV_ITEMS in sidebar.tsx, create page at src/app/agents/page.tsx |
| DASH-02 | Agent cards display each registered agent's name, address, type, and status | Fetch from /api/agents, render with Card component + AddressDisplay + statusToColor |
| DASH-03 | Live activity timeline shows chronological feed of tool calls and transactions | Fetch from /api/activity for initial load, render ActivityFeed + ActivityRow components |
| DASH-04 | Activity timeline updates in real-time via SSE without page refresh | useActivitySSE hook subscribing to /api/activity/sse, merging with initial REST data |
| DASH-05 | Agent status indicators update in real-time | SSE events update agent status derived client-side (pending event = active, else idle) |
| DEMO-01 | Demo mode shows seed activity data and animated agents | Client-side seed data with setInterval drip, "Run Demo" button in empty state |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.4 | Component framework | Already installed |
| Next.js | 16.2.0 | App router, page routing | Already installed |
| @tanstack/react-query | 5.91.2 | REST data fetching for /api/agents and /api/activity | Already installed, used by existing hooks |
| EventSource (native) | Browser API | SSE subscription to /api/activity/sse | No library needed -- native browser API |
| Tailwind CSS | 4.x | Styling | Already installed |
| lucide-react | 0.577.0 | Icons (Activity, Link, ChevronDown) | Already installed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn Card | installed | Agent card wrapper | Agent cards |
| shadcn Badge | installed | Status badges, stat badges, demo chip | Activity rows, page header |
| shadcn Button | installed | "Run Demo" button | Empty state CTA |

### Alternatives Considered
None. Zero new dependencies constraint from project decisions.

## Architecture Patterns

### Recommended Project Structure
```
packages/app/src/
  app/agents/
    page.tsx              # LiveAgentsPage -- "use client" page component
  components/agents/
    agent-card-row.tsx    # Responsive flex row of AgentCard components
    agent-card.tsx        # Single agent card with status dot
    activity-feed.tsx     # Scrollable timeline container
    activity-row.tsx      # Single activity entry, expandable
    live-stat-bar.tsx     # Inline stat badges
    demo-mode-button.tsx  # "Run Demo" CTA in empty state
  lib/hooks/
    use-activity-sse.ts   # SSE subscription hook
    use-agents.ts         # @tanstack/react-query hook for /api/agents
```

### Pattern 1: SSE Hook with EventSource
**What:** Custom hook wrapping native EventSource for real-time activity events
**When to use:** On the Live Agents page for real-time updates
**Example:**
```typescript
// useActivitySSE hook pattern
function useActivitySSE() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const lastEventIdRef = useRef<number>(0);

  useEffect(() => {
    const url = new URL("/api/activity/sse", window.location.origin);
    const es = new EventSource(url.toString());

    es.addEventListener("activity", (e: MessageEvent) => {
      const event: ActivityEvent = JSON.parse(e.data);
      lastEventIdRef.current = event.id;
      setEvents((prev) => {
        // Deduplicate by ID (handles reconnection replay)
        const exists = prev.some((p) => p.id === event.id);
        if (exists) {
          // Update existing (pending -> success/error transition)
          return prev.map((p) => (p.id === event.id ? event : p));
        }
        return [event, ...prev]; // Newest first
      });
    });

    es.onerror = () => {
      es.close();
      // Reconnect with backoff
      setTimeout(() => {
        // Re-create with Last-Event-ID handled by browser
      }, 3000);
    };

    return () => es.close();
  }, []);

  return { events };
}
```

### Pattern 2: Page Data Flow
**What:** REST for initial load, SSE for live updates, client-side merge
**When to use:** LiveAgentsPage state management
**Example:**
```typescript
// In LiveAgentsPage:
// 1. Fetch agents list via react-query (useQuery)
// 2. Fetch initial activity via react-query (useQuery)
// 3. Subscribe to SSE for live events
// 4. Merge initial + SSE events, deduplicate by ID
// 5. Derive agent status client-side from merged events
```

### Pattern 3: Demo Mode Drip
**What:** Client-side seed events dripped via setInterval
**When to use:** Empty state when user clicks "Run Demo"
**Example:**
```typescript
const DEMO_EVENTS: Omit<ActivityEvent, "id">[] = [
  { agentId: "hackaclaw", toolName: "checkVaultHealth", status: "pending", ... },
  { agentId: "hackaclaw", toolName: "checkVaultHealth", status: "success", ... },
  { agentId: "merkel", toolName: "deposit", status: "pending", ... },
  // ... 10-15 events telling a coherent DeFi workflow story
];

function useDemoMode(agents: Agent[]) {
  const [demoEvents, setDemoEvents] = useState<ActivityEvent[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const nextIdRef = useRef(10000); // High ID to avoid collision

  const startDemo = useCallback(() => {
    setIsRunning(true);
    let index = 0;
    const interval = setInterval(() => {
      if (index >= DEMO_EVENTS.length) {
        clearInterval(interval);
        return; // Keep isRunning true, chip stays
      }
      const event = { ...DEMO_EVENTS[index], id: nextIdRef.current++ };
      setDemoEvents((prev) => [event, ...prev]);
      index++;
    }, 2500);
  }, []);

  return { demoEvents, isRunning, startDemo };
}
```

### Pattern 4: Auto-Scroll with User Override
**What:** Feed auto-scrolls to top for new events unless user has scrolled down
**When to use:** Activity feed container
**Example:**
```typescript
const feedRef = useRef<HTMLDivElement>(null);
const [userScrolled, setUserScrolled] = useState(false);
const [newCount, setNewCount] = useState(0);

const handleScroll = () => {
  const el = feedRef.current;
  if (!el) return;
  setUserScrolled(el.scrollTop > 48);
};

// When new events arrive:
if (!userScrolled) {
  feedRef.current?.scrollTo({ top: 0, behavior: "smooth" });
} else {
  setNewCount((n) => n + 1);
}
```

### Anti-Patterns to Avoid
- **Filtering SSE server-side:** SSE streams all events. Agent filtering is purely client-side on the rendered list. Do NOT add query params to the SSE endpoint.
- **Using WebSocket:** The project uses SSE (unidirectional). Do not introduce WebSocket.
- **JavaScript animation timers:** All animations are CSS-only (transitions, animate-pulse, keyframes). No requestAnimationFrame or JS timer-based animations for UI.
- **Adding new npm packages:** Zero new dependencies constraint. Everything needed is already installed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Address display | Custom truncation + copy | `AddressDisplay` component | Already handles truncation, copy, basename resolution |
| Agent card wrapper | Custom styled div | shadcn `Card` component | Matches design system |
| Status badges | Custom pill components | shadcn `Badge` component | Existing variant system |
| Data fetching | Custom fetch + state | `@tanstack/react-query` `useQuery` | Already used by all other hooks in the project |
| Status dot colors | Hardcoded hex values | `statusToColor()` from sprite-utils.ts | Already maps status to CSS variables |

**Key insight:** Every visual primitive needed already exists in the codebase. This phase is assembly, not creation.

## Common Pitfalls

### Pitfall 1: SSE Event Deduplication
**What goes wrong:** SSE events arrive both from initial REST load and live stream, causing duplicate entries
**Why it happens:** On page mount, initial REST fetch returns existing events, then SSE replays missed events via Last-Event-ID
**How to avoid:** Deduplicate by event `id` when merging REST + SSE events. Update existing events (pending -> success) rather than appending duplicates
**Warning signs:** Same event appearing twice in the feed

### Pitfall 2: EventSource Reconnection
**What goes wrong:** Browser EventSource auto-reconnects but may lose the Last-Event-ID context
**Why it happens:** Native EventSource auto-reconnect does send Last-Event-ID, but only if the connection was previously established successfully
**How to avoid:** The SSE endpoint already handles Last-Event-ID replay (Phase 6). Use the native EventSource reconnection behavior. For custom reconnection logic, store the lastEventId in a ref and pass it via URL params if needed.
**Warning signs:** Missing events after temporary disconnection

### Pitfall 3: React State Updates During SSE Streaming
**What goes wrong:** Frequent SSE events cause excessive re-renders
**Why it happens:** Each SSE event triggers a setState, which re-renders the entire component tree
**How to avoid:** Batch updates naturally (React 18+ batches by default). Use `useCallback` and `React.memo` for child components. The activity feed only needs to update the events array, not the entire page.
**Warning signs:** Laggy UI when many events arrive rapidly

### Pitfall 4: Demo Mode vs Real Mode Confusion
**What goes wrong:** Demo events persist in the feed when real events start arriving
**Why it happens:** Demo events are client-side state, real events come from SSE
**How to avoid:** Keep demo events in separate state. When real SSE events arrive, they naturally appear alongside demo events. Demo events have high IDs (10000+) so they sort correctly. Consider clearing demo state when a real event arrives, or keep them separate.
**Warning signs:** Mixing fake and real data without visual distinction

### Pitfall 5: Scroll Position Disruption
**What goes wrong:** New events prepending to the list causes the user's scroll position to jump
**Why it happens:** Adding items to the top of a scrollable container shifts existing content down
**How to avoid:** Track `scrollTop` to detect user scrolling. Only auto-scroll when user is at the top. Show "N new events" badge when user has scrolled down.
**Warning signs:** Feed "jumping" while reading older events

## Code Examples

### Sidebar Nav Entry
```typescript
// Add to NAV_ITEMS array in sidebar.tsx
// Activity icon from lucide-react
import { Activity } from "lucide-react";
{ href: "/agents", label: "Live Agents", icon: Activity },
```

### Page Component Structure
```typescript
// src/app/agents/page.tsx
"use client";

import { SpriteScene } from "@/components/sprites/SpriteScene";
import { AgentCardRow } from "@/components/agents/agent-card-row";
import { ActivityFeed } from "@/components/agents/activity-feed";
import { LiveStatBar } from "@/components/agents/live-stat-bar";

export default function LiveAgentsPage() {
  // 1. Fetch agents via useQuery
  // 2. Fetch initial events via useQuery
  // 3. Subscribe to SSE via useActivitySSE
  // 4. Merge events, derive agent statuses
  // 5. Manage filter and demo state

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Live Agents</h1>
        <LiveStatBar agentCount={...} eventCount={...} activeCount={...} />
        {/* Demo Mode chip when running */}
      </div>
      <SpriteScene agents={spriteAgents} className="rounded-lg bg-secondary" />
      <AgentCardRow agents={agents} selectedAgent={filter} onSelect={setFilter} />
      <ActivityFeed events={filteredEvents} feedRef={feedRef} />
    </div>
  );
}
```

### Agent Status Derivation (Client-Side from Events)
```typescript
// Derive status from merged event list for each agent
function deriveAgentStatus(
  agentId: string,
  events: ActivityEvent[]
): "active" | "idle" | "registered" {
  const agentEvents = events.filter((e) => e.agentId === agentId);
  if (agentEvents.length === 0) return "registered";
  return agentEvents.some((e) => e.status === "pending") ? "active" : "idle";
}
```

### Activity Row with Expand/Collapse
```typescript
// Grid-template-rows trick for smooth height animation
<div
  className="grid transition-[grid-template-rows] duration-200 ease-out"
  style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
>
  <div className="overflow-hidden">
    <div className="bg-secondary p-4">
      <p className="text-xs font-semibold text-muted-foreground">Parameters</p>
      <pre className="mt-1 max-h-[160px] overflow-auto font-mono text-xs">
        {JSON.stringify(event.params, null, 2)}
      </pre>
    </div>
  </div>
</div>
```

### Timestamp Formatting
```typescript
// HH:mm:ss 24-hour format from CONTEXT.md copywriting contract
function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| WebSocket for real-time | SSE via native EventSource | Project decision | Simpler, no extra server, unidirectional sufficient |
| Custom fetch hooks | @tanstack/react-query | Already in project | Automatic caching, refetching, deduplication |
| CSS Modules / styled-components | Tailwind CSS v4 | Already in project | Utility-first, theme variables |
| React.useState for server state | useQuery for REST, useState for SSE | Project pattern | Separation of concerns |

## Open Questions

1. **EventSource vs fetch-based SSE**
   - What we know: Native EventSource handles reconnection and Last-Event-ID automatically. The SSE endpoint supports both.
   - What's unclear: Whether Next.js 16 dev server proxying affects EventSource behavior
   - Recommendation: Use native EventSource first. If issues arise, fall back to fetch-based ReadableStream parsing.

2. **Demo event IDs vs real event IDs**
   - What we know: Real events start from ID 1 (auto-incrementing in ActivityLog). Demo events are client-side only.
   - What's unclear: Whether demo events should be distinguishable in the feed
   - Recommendation: Use high IDs (10000+) for demo events and add a `isDemo` flag to distinguish visually if needed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 + @testing-library/react 16.3.2 |
| Config file | `packages/app/vitest.config.ts` |
| Quick run command | `cd packages/app && npx vitest run --reporter=verbose` |
| Full suite command | `cd packages/app && npx vitest run --reporter=verbose` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-01 | Sidebar has "Live Agents" nav item linking to /agents | unit | `cd packages/app && npx vitest run src/__tests__/live-agents-page.test.tsx -x` | Wave 0 |
| DASH-02 | Agent cards render name, address, status dot | unit | `cd packages/app && npx vitest run src/__tests__/agent-card.test.tsx -x` | Wave 0 |
| DASH-03 | Activity feed renders timeline rows with agent, tool, status | unit | `cd packages/app && npx vitest run src/__tests__/activity-feed.test.tsx -x` | Wave 0 |
| DASH-04 | SSE events appear in feed without refresh | unit | `cd packages/app && npx vitest run src/__tests__/use-activity-sse.test.ts -x` | Wave 0 |
| DASH-05 | Agent status dot updates when SSE event changes status | unit | `cd packages/app && npx vitest run src/__tests__/agent-card.test.tsx -x` | Wave 0 |
| DEMO-01 | "Run Demo" button drips seed events into feed | unit | `cd packages/app && npx vitest run src/__tests__/demo-mode-drip.test.tsx -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd packages/app && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd packages/app && npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/live-agents-page.test.tsx` -- covers DASH-01 (sidebar nav + page renders)
- [ ] `src/__tests__/agent-card.test.tsx` -- covers DASH-02, DASH-05 (card rendering + status updates)
- [ ] `src/__tests__/activity-feed.test.tsx` -- covers DASH-03 (timeline rows)
- [ ] `src/__tests__/use-activity-sse.test.ts` -- covers DASH-04 (SSE hook)
- [ ] `src/__tests__/demo-mode-drip.test.tsx` -- covers DEMO-01 (demo drip)

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `packages/app/src/components/sidebar.tsx` -- NAV_ITEMS pattern
- Codebase inspection: `packages/app/src/app/treasury/page.tsx` -- page structure pattern
- Codebase inspection: `packages/app/src/app/api/activity/sse/route.ts` -- SSE endpoint implementation
- Codebase inspection: `packages/app/src/app/api/agents/route.ts` -- Agent list + status derivation
- Codebase inspection: `packages/mcp-server/src/activity-log.ts` -- ActivityEvent interface
- Codebase inspection: `packages/app/src/components/sprites/SpriteScene.tsx` -- SpriteAgent interface
- Codebase inspection: `packages/app/src/lib/sprite-utils.ts` -- statusToColor, statusToAnimation utilities
- Phase 8 UI-SPEC: `.planning/phases/08-dashboard-page-assembly/08-UI-SPEC.md` -- full visual contract

### Secondary (MEDIUM confidence)
- MDN EventSource API documentation -- reconnection and Last-Event-ID behavior

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and in use in the codebase
- Architecture: HIGH -- following exact patterns from existing pages (treasury, staking)
- Pitfalls: HIGH -- derived from actual codebase SSE implementation and React patterns

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable -- assembly of existing components)
