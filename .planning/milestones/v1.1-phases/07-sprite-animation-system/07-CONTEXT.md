# Phase 7: Sprite Animation System - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Pixel-art agent characters animate on screen with state-driven animations, independent of live data. This phase builds the sprite SVG templates, the AgentSprite React component with CSS steps() animation, a scene container with random wandering, and hover detail cards. It does NOT build the dashboard page layout (Phase 8), real-time data wiring (Phase 8), or demo mode seeding (Phase 8).

</domain>

<decisions>
## Implementation Decisions

### Character design
- Pixel robots — small robot characters fitting the AI/agent theme, Cursouls-inspired
- SVG sprite sheets — vector-based for scalability with `image-rendering: pixelated` for authentic pixel look
- Parameterized SVG template — one base robot template with CSS variable slots for body color, visor style, antenna shape
- Agent visual uniqueness derived from address hash — each agent gets a deterministic unique color/feature combo
- 32x32 pixel grid per frame, rendered at 3x scale (~96px on screen)
- 4 frames per animation row, 3 rows per sheet (idle, walk, work) — 12 frames total per character

### Scene movement
- Random wandering — sprites pick a random point in the scene, walk there, pause (idle 2-5s), then pick a new destination
- Scene area is a full-width top banner (~250px tall) at the top of the Live Agents page, above agent cards and activity feed
- Page background only — sprites wander on the existing dark page background with subtle dot grid at most (no pixel-art environment — VIS-03 deferred to v2)
- Sprites face their walking direction via CSS `scaleX(-1)` horizontal flip
- Pure CSS transitions for position movement between points

### State-animation mapping
- Direct mapping from Phase 6 agent status:
  - `active` → working animation (stays in place, plays work loop)
  - `idle` → wander cycle (idle 2-5s → walk to random point → idle → repeat)
  - `registered` → idle animation only (stationary, breathing/blinking in place, no wandering)
- Prop-driven with demo default: AgentSprite accepts optional `status` prop; defaults to 'idle' with random wander when no status provided
- Phase 8 wires real status from SSE; Phase 7 works standalone with defaults
- Frame rate: ~4 FPS (250ms per frame) for classic retro pixel-art feel — 4 frames × 250ms = 1 second per animation cycle

### Hover card behavior
- Floating card appears above the sprite on hover, anchored to sprite position
- Sprite pauses movement on hover (switches to idle animation), resumes wandering on mouse leave
- Card fades in/out on hover/leave
- Card shows: agent name, truncated address, colored status dot (green=active, amber=idle, gray=registered), current action text
- Status dot color matches the Phase 8 agent card status indicator pattern for visual consistency
- Uses existing Card/Tooltip component styling from shadcn/ui

### Claude's Discretion
- SVG template internal structure and drawing details
- Exact CSS animation keyframe implementation
- Random wandering algorithm (destination picking, collision avoidance if needed)
- Wander timing variation ranges
- Hover card exact dimensions and typography
- How address hash maps to visual feature parameters

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 7 requirements
- `.planning/REQUIREMENTS.md` — SPRITE-01 through SPRITE-04 acceptance criteria
- `.planning/ROADMAP.md` §Phase 7 — Success criteria (CSS steps(), no JS timers, crisp pixelated rendering)

### Agent types (Phase 5/6 output)
- `packages/mcp-server/src/activity-log.ts` — ActivityEvent interface, AgentStatus type definition
- `packages/mcp-server/src/registry.ts` — RegisteredAgent type with name, address, type, createdAt fields

### Existing UI patterns
- `packages/app/src/app/globals.css` — Theme variables (--primary: hot-pink, --success: green, --warning: amber, --muted-foreground: gray)
- `packages/app/src/components/ui/card.tsx` — Existing Card component for hover card styling
- `packages/app/src/components/ui/tooltip.tsx` — Existing Tooltip component (potential reuse)
- `packages/app/src/components/shared/address-display.tsx` — Address truncation component

### Prior phase context
- `.planning/phases/06-api-and-real-time-endpoints/06-CONTEXT.md` — Agent status derivation (active/idle/registered) that drives sprite animations

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Card` component (shadcn/ui): Can style hover detail cards
- `Tooltip` component (shadcn/ui): Potential base for hover interaction
- `AddressDisplay` component: Already handles address truncation with copy
- Theme CSS variables: `--primary` (hot-pink), `--success` (green), `--warning` (amber) for status colors
- `Skeleton` component: Could be used for loading states

### Established Patterns
- Tailwind CSS v4 with `@theme inline` custom properties
- shadcn/ui components in `src/components/ui/`
- Shared components in `src/components/shared/`
- Dark theme as default (all CSS variables set for dark mode)
- No existing animation or sprite patterns — this is new territory

### Integration Points
- New directory: `public/sprites/` for SVG sprite sheet templates
- New component: `src/components/sprites/AgentSprite.tsx`
- New component: `src/components/sprites/SpriteScene.tsx` (scene container)
- Phase 8 will import AgentSprite and SpriteScene into the Live Agents page
- AgentSprite needs to accept `agent` object (name, address) and optional `status` prop

</code_context>

<specifics>
## Specific Ideas

- Cursouls-inspired visual feel — pixel robots with personality
- Each agent should be visually distinguishable at a glance via address-derived colors
- The scene should feel alive and playful — maximum hackathon demo impact
- SVG approach chosen specifically to enable truly randomized, distinct characters without needing hand-drawn art per agent

</specifics>

<deferred>
## Deferred Ideas

- VIS-01: Celebration animation when agent completes a transaction — v2
- VIS-02: Speech bubbles showing current tool call on sprite — v2
- VIS-03: Scene environment (cafe, office, blockchain-themed background) — v2

</deferred>

---

*Phase: 07-sprite-animation-system*
*Context gathered: 2026-03-22*
