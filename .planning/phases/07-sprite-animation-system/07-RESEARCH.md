# Phase 7: Sprite Animation System - Research

**Researched:** 2026-03-22
**Domain:** CSS sprite sheet animation, SVG parameterization, pixel art rendering
**Confidence:** HIGH

## Summary

Phase 7 builds a self-contained sprite animation system: parameterized SVG robot characters with CSS-only frame animation, random wandering movement across a scene banner, and hover detail cards. The core technical challenge is combining two requirements that normally conflict: CSS `steps()` sprite animation (which traditionally uses `background-image` + `background-position`) and parameterized SVG colors via CSS custom properties (which requires inline SVG). The solution is to render the SVG sprite strip inline and animate with `transform: translateX()` inside an `overflow: hidden` container using `steps()`.

No new npm dependencies are needed. The entire system uses inline SVG, CSS animations, CSS custom properties, CSS transitions, and React state only for hover/wander logic (never for frame advancement). This aligns with the project's zero-new-dependencies constraint for v1.1.

**Primary recommendation:** Use inline SVG rendered by a React component with CSS `steps(4)` animation on `transform: translateX()` inside `overflow: hidden` containers. Use CSS custom properties (`--sprite-body`, `--sprite-visor`) set via inline styles derived from address hashing to colorize each robot uniquely.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Pixel robots -- small robot characters fitting the AI/agent theme, Cursouls-inspired
- SVG sprite sheets -- vector-based for scalability with `image-rendering: pixelated` for authentic pixel look
- Parameterized SVG template -- one base robot template with CSS variable slots for body color, visor style, antenna shape
- Agent visual uniqueness derived from address hash -- each agent gets a deterministic unique color/feature combo
- 32x32 pixel grid per frame, rendered at 3x scale (~96px on screen)
- 4 frames per animation row, 3 rows per sheet (idle, walk, work) -- 12 frames total per character
- Random wandering -- sprites pick a random point in the scene, walk there, pause (idle 2-5s), then pick a new destination
- Scene area is a full-width top banner (~250px tall) at the top of the Live Agents page
- Page background only -- no pixel-art environment (VIS-03 deferred to v2)
- Sprites face walking direction via CSS `scaleX(-1)` horizontal flip
- Pure CSS transitions for position movement between points
- Direct mapping from agent status: active->working, idle->wander cycle, registered->idle only
- Prop-driven with demo default: AgentSprite accepts optional status prop; defaults to 'idle'
- Frame rate: ~4 FPS (250ms per frame) -- 4 frames x 250ms = 1s per animation cycle
- Hover card: floating above sprite, pause movement on hover, fade in/out, shows name/address/status/action
- Uses existing Card/Tooltip component styling from shadcn/ui
- Status dot colors: green (active), amber (idle), gray (registered)

### Claude's Discretion
- SVG template internal structure and drawing details
- Exact CSS animation keyframe implementation
- Random wandering algorithm (destination picking, collision avoidance if needed)
- Wander timing variation ranges
- Hover card exact dimensions and typography
- How address hash maps to visual feature parameters

### Deferred Ideas (OUT OF SCOPE)
- VIS-01: Celebration animation when agent completes a transaction -- v2
- VIS-02: Speech bubbles showing current tool call on sprite -- v2
- VIS-03: Scene environment (cafe, office, blockchain-themed background) -- v2
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SPRITE-01 | Pixel-art sprite sheet with at least 2 unique agent character skins | Parameterized SVG template with 8-hue address-derived palette generates unlimited unique skins from one base template. "2 unique skins" satisfied by any 2 agents with different addresses. |
| SPRITE-02 | CSS `steps()` sprite animation with idle, walking, and working states per agent | Inline SVG + overflow:hidden + `transform: translateX()` with `steps(4)` keyframes. Three animation names (sprite-idle, sprite-walk, sprite-work) selecting rows via `translateY`. No JS timers. |
| SPRITE-03 | Agent sprites walk freely on a scene area on the dashboard page | SpriteScene container (relative, 250px) with absolutely-positioned sprites. CSS `transition` on left/top for smooth movement. React `useEffect` + `setTimeout` for wander scheduling (not frame animation). |
| SPRITE-04 | Hovering a sprite reveals agent details card (name, address, current action, status) | CSS hover state on sprite container triggers card visibility. Card positioned absolute above sprite. Uses existing Card component styling and AddressDisplay pattern. |
</phase_requirements>

## Standard Stack

### Core (zero new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.4 | Component rendering, state for hover/wander | Already installed |
| Next.js | 16.2.0 | App framework | Already installed |
| Tailwind CSS | v4 | Utility classes, custom properties | Already installed |
| shadcn/ui | 4.1.0 | Card component for hover card | Already installed |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| clsx | 2.1.1 | Conditional class names | Animation state classes |
| tailwind-merge | 3.5.0 | Merge Tailwind classes | className prop merging |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline SVG | PNG sprite sheets as background-image | PNG works with background-position but cannot be parameterized with CSS variables. Inline SVG enables address-derived coloring. |
| CSS transitions for movement | requestAnimationFrame | CSS transitions are simpler, GPU-accelerated, and sufficient for point-to-point movement |
| React state for wander timing | Web Animations API | React state + setTimeout is simpler for scheduling destination picks; WAPI is overkill |

**Installation:** None required. Zero new dependencies.

## Architecture Patterns

### Recommended Project Structure
```
packages/app/
  public/
    sprites/               # (optional) static assets if needed
  src/
    components/
      sprites/
        AgentSprite.tsx    # Single sprite: SVG + animation + hover card
        SpriteScene.tsx    # Scene container: layout + wandering logic
        robot-svg.tsx      # Inline SVG template as React component
        sprite.css         # CSS keyframes for sprite animations (or in globals.css)
    lib/
      sprite-utils.ts     # Address hashing, color derivation, wander math
```

### Pattern 1: Inline SVG Sprite Animation with steps()

**What:** Render the full 4-frame sprite strip as an inline SVG inside an `overflow: hidden` container. Animate `transform: translateX()` with `steps(4)` to advance frames. Select animation row with `translateY()`.

**When to use:** When you need CSS `steps()` sprite animation AND parameterized colors via CSS custom properties. Traditional `background-image` + `background-position` cannot access CSS custom properties from the document.

**Why not background-image:** SVGs loaded via `background-image: url()` are sandboxed -- they cannot inherit CSS custom properties from the page. Since the design requires address-derived coloring via `--sprite-body`, the SVG must be inline.

**Example:**
```css
/* Source: MDN + Treehouse blog pattern adapted for inline SVG */

/* Container: shows one 96x96 frame */
.sprite-viewport {
  width: 96px;
  height: 96px;
  overflow: hidden;
  image-rendering: pixelated;
  image-rendering: crisp-edges; /* Firefox fallback */
}

/* Inner strip: 384px wide (4 frames x 96px), 288px tall (3 rows x 96px) */
.sprite-strip {
  width: 384px;
  height: 288px;
}

/* Frame advancement: slide strip left through 4 frames */
@keyframes sprite-idle {
  from { transform: translateX(0) translateY(0); }
  to   { transform: translateX(-384px) translateY(0); }
}

@keyframes sprite-walk {
  from { transform: translateX(0) translateY(-96px); }
  to   { transform: translateX(-384px) translateY(-96px); }
}

@keyframes sprite-work {
  from { transform: translateX(0) translateY(-192px); }
  to   { transform: translateX(-384px) translateY(-192px); }
}

.sprite-strip[data-anim="idle"] {
  animation: sprite-idle 1s steps(4) infinite;
}
.sprite-strip[data-anim="walk"] {
  animation: sprite-walk 1s steps(4) infinite;
}
.sprite-strip[data-anim="work"] {
  animation: sprite-work 1s steps(4) infinite;
}
```

### Pattern 2: Address-Derived Color Parameterization

**What:** Deterministically map an Ethereum address to a hue index, then apply via CSS custom properties on the sprite container. The inline SVG uses `fill: var(--sprite-body)` for its body paths.

**Example:**
```typescript
// Source: UI-SPEC color palette definition
const HUES = [0, 45, 90, 135, 180, 225, 270, 315];

function addressToSpriteColor(address: string): string {
  const index = parseInt(address.slice(2, 4), 16) % 8;
  return `hsl(${HUES[index]}, 70%, 60%)`;
}

// In component:
<div
  className="sprite-viewport"
  style={{ '--sprite-body': addressToSpriteColor(agent.address) } as React.CSSProperties}
>
  <RobotSvg />
</div>
```

### Pattern 3: Random Wander with CSS Transitions

**What:** Use React state for position (x, y) and CSS transitions for movement. Schedule destination picks with `setTimeout`. No `requestAnimationFrame` needed.

**Example:**
```typescript
// Wander logic in SpriteScene or per-sprite hook
function useWander(sceneWidth: number, sceneHeight: number, status: string) {
  const [pos, setPos] = useState({ x: randomInRange(48, sceneWidth - 48), y: randomInRange(48, sceneHeight - 48) });
  const [isMoving, setIsMoving] = useState(false);

  useEffect(() => {
    if (status !== 'idle') return; // only idle agents wander

    const pickNewDestination = () => {
      const newX = randomInRange(48, sceneWidth - 48);
      const newY = randomInRange(48, sceneHeight - 48);
      setPos({ x: newX, y: newY });
      setIsMoving(true);

      // After transition completes (~800ms), idle for 2-5s, then move again
      const transitionDuration = 800;
      const idlePause = 2000 + Math.random() * 3000;

      setTimeout(() => {
        setIsMoving(false);
        setTimeout(pickNewDestination, idlePause);
      }, transitionDuration);
    };

    const initialDelay = Math.random() * 2000; // stagger starts
    const timer = setTimeout(pickNewDestination, initialDelay);
    return () => clearTimeout(timer);
  }, [status, sceneWidth, sceneHeight]);

  return { pos, isMoving };
}
```

```css
/* Movement via CSS transition, not JS animation */
.sprite-container {
  position: absolute;
  transition: left 0.8s ease-in-out, top 0.8s ease-in-out;
}
```

### Pattern 4: Hover Card with Pause

**What:** On mouseenter, pause wandering (clear timeouts), switch to idle animation, show card. On mouseleave, resume.

**Example:**
```tsx
<div
  onMouseEnter={() => { setHovered(true); clearWanderTimeout(); }}
  onMouseLeave={() => { setHovered(false); resumeWander(); }}
  className="sprite-container"
  style={{ left: pos.x, top: pos.y }}
>
  <div className="sprite-viewport">
    <RobotSvg data-anim={hovered ? 'idle' : currentAnim} />
  </div>
  {hovered && (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 ...">
      {/* Card content */}
    </div>
  )}
</div>
```

### Anti-Patterns to Avoid
- **JS timer for frame advancement:** Never use `setInterval`/`requestAnimationFrame`/React state to cycle sprite frames. CSS `steps()` handles this with zero JS overhead. This is an explicit requirement.
- **background-image with CSS variables:** SVGs loaded as `background-image: url()` cannot inherit CSS custom properties. Always use inline SVG for parameterized sprites.
- **React re-renders for animation:** Position transitions and frame animation must be CSS-only. React state is only for wander destination scheduling and hover state.
- **Sub-pixel positioning:** Avoid fractional pixel values for sprite positions. Use `Math.round()` for wander destinations to maintain crisp pixel alignment.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Hover card styling | Custom card from scratch | shadcn/ui Card component patterns | Consistent with existing UI, already styled for dark theme |
| Address truncation | Custom string slicing | Existing `shortenAddress` from `@/lib/format` | Already battle-tested in the codebase |
| Class merging | String concatenation | `clsx` + `tailwind-merge` (already installed) | Handles conditional classes and Tailwind conflicts correctly |
| Status colors | Hardcoded hex values | Existing CSS variables: `--success`, `--warning`, `--muted-foreground` | Theme-consistent, already defined |

**Key insight:** This phase is primarily CSS/SVG work, not library integration. The complexity is in the SVG drawing, animation keyframes, and wander scheduling -- all of which are hand-crafted by necessity. The "don't hand-roll" items are mainly about reusing existing UI patterns rather than rebuilding them.

## Common Pitfalls

### Pitfall 1: SVG background-image cannot use CSS custom properties
**What goes wrong:** Developer creates SVG sprite sheet file, references it via `background-image: url(robot.svg)`, then tries to colorize with CSS `--sprite-body`. Colors don't change -- SVG is sandboxed.
**Why it happens:** SVGs loaded as external resources (background-image, img src) are rendered in an isolated context without access to the page's CSS custom properties.
**How to avoid:** Always render the SVG inline as a React component. The `<RobotSvg>` component outputs raw `<svg>` JSX so CSS custom properties cascade into `fill` attributes.
**Warning signs:** Colors appear as fallback/default regardless of `--sprite-body` value.

### Pitfall 2: Anti-aliasing blurs pixel art at non-integer scales
**What goes wrong:** Sprite appears blurry/smooth instead of crisp pixel art when scaled to 96px from 32px source.
**Why it happens:** Browsers default to bilinear interpolation for scaled images.
**How to avoid:** Apply `image-rendering: pixelated` on the viewport container. Also add `image-rendering: crisp-edges` as a fallback for Firefox. For inline SVGs, `shape-rendering: crispEdges` on SVG elements prevents anti-aliasing of vector paths.
**Warning signs:** Soft/blurry edges on what should be sharp pixel boundaries.

### Pitfall 3: steps() off-by-one leaves partial frame visible
**What goes wrong:** Animation shows a sliver of the next frame or an empty gap at the end of the cycle.
**Why it happens:** Mismatch between `steps(N)` count and actual frame count, or the `translateX` end value doesn't exactly equal `N * frameWidth`.
**How to avoid:** Ensure `steps(4)` with exactly 4 frames, and `translateX` goes from `0` to exactly `-384px` (4 * 96px). The `to` keyframe value must be exactly `-totalStripWidth`.
**Warning signs:** Flickering at animation loop point, visible seam between last and first frame.

### Pitfall 4: Wander timeouts leak on unmount
**What goes wrong:** Component unmounts but `setTimeout` callbacks still fire, causing "setState on unmounted component" warnings or stale state updates.
**Why it happens:** Wander scheduling uses chained `setTimeout` calls that aren't cleaned up on unmount.
**How to avoid:** Store timeout IDs in a ref and clear them in the `useEffect` cleanup function. Use an `isMounted` ref pattern or AbortController.
**Warning signs:** Console warnings about state updates on unmounted components.

### Pitfall 5: CSS transition interferes with animation state change
**What goes wrong:** When switching from walk to idle animation, the sprite "jumps" visually because the transform changes abruptly.
**Why it happens:** The `transition` on left/top also accidentally transitions the `transform` used for sprite frame animation.
**How to avoid:** Be specific with transition properties: `transition: left 0.8s ease-in-out, top 0.8s ease-in-out` -- never use `transition: all`. The `animation` property on the inner sprite strip is separate from the `transition` on the outer position container.
**Warning signs:** Sprite frames sliding instead of snapping when animation state changes.

### Pitfall 6: Hover card clipped by scene overflow
**What goes wrong:** The hover card that should appear above the sprite is clipped by the scene container's boundaries.
**Why it happens:** If the scene container has `overflow: hidden`, child elements can't render outside it.
**How to avoid:** The scene container should NOT have `overflow: hidden`. Only the individual sprite viewports (96x96) have `overflow: hidden`. The scene uses `position: relative` with sprite containers as `position: absolute`. Hover cards use `z-index: 10` to appear above other sprites.
**Warning signs:** Hover cards cut off at scene edges, especially for sprites near the top.

## Code Examples

### Inline SVG Robot Template (simplified)
```tsx
// Source: Architecture decision -- inline SVG for CSS variable access
interface RobotSvgProps {
  className?: string;
}

export function RobotSvg({ className }: RobotSvgProps) {
  // Full 128x96 native SVG (4 columns x 3 rows of 32x32 frames)
  // Each frame draws a simple robot with fill using CSS variables
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 128 96"
      className={className}
      style={{ width: 384, height: 288 }}
      shapeRendering="crispEdges"
    >
      {/* Row 0: Idle frames (y=0..31) */}
      {/* Frame 0,0 - idle pose 1 */}
      <rect x={10} y={4} width={12} height={8} fill="var(--sprite-body, hsl(225,70%,60%))" />
      {/* ... more pixel rectangles for robot body, visor, antenna ... */}

      {/* Row 1: Walk frames (y=32..63) */}
      {/* Row 2: Work frames (y=64..95) */}
    </svg>
  );
}
```

### CSS Animation Definitions
```css
/* Source: CSS steps() sprite pattern adapted for inline SVG */

.sprite-viewport {
  width: 96px;
  height: 96px;
  overflow: hidden;
  /* Crisp pixel rendering for both Chrome and Firefox */
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}

@keyframes sprite-idle {
  from { transform: translateX(0) translateY(0); }
  to   { transform: translateX(-384px) translateY(0); }
}

@keyframes sprite-walk {
  from { transform: translateX(0) translateY(-96px); }
  to   { transform: translateX(-384px) translateY(-96px); }
}

@keyframes sprite-work {
  from { transform: translateX(0) translateY(-192px); }
  to   { transform: translateX(-384px) translateY(-192px); }
}

.anim-idle  { animation: sprite-idle 1s steps(4) infinite; }
.anim-walk  { animation: sprite-walk 1s steps(4) infinite; }
.anim-work  { animation: sprite-work 1s steps(4) infinite; }
```

### Direction Facing
```tsx
// CSS scaleX(-1) for facing left
<div
  className="sprite-viewport"
  style={{
    transform: isMovingLeft ? 'scaleX(-1)' : 'scaleX(1)',
  }}
>
```

Note: `scaleX(-1)` on the viewport container, not the strip. The strip transform handles frame animation only.

### Hover Card Content
```tsx
// Source: UI-SPEC hover card layout
<div className="w-[200px] rounded-[var(--radius)] bg-card p-4 ring-1 ring-foreground/10">
  <div className="flex items-center gap-1">
    <span
      className="h-2 w-2 rounded-full"
      style={{ backgroundColor: statusColor }}
    />
    <span className="text-[16px] font-semibold leading-[1.2] text-foreground">
      {agent.name}
    </span>
  </div>
  <div className="mt-1 font-mono text-[12px] leading-[1.4] text-muted-foreground">
    {shortenAddress(agent.address)}
  </div>
  <div className="mt-1 text-[14px] leading-[1.5] text-foreground">
    {actionText}
  </div>
</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| background-position sprite sheets | Inline SVG + transform + overflow:hidden | Always valid, but inline SVG enables CSS var | Enables parameterized colors impossible with background-image |
| JS setInterval for frame cycling | CSS steps() timing function | CSS Animations Level 1 (2013+) | Zero JS overhead for frame animation |
| Canvas-based sprite rendering | CSS-only sprite animation | Always valid choice | Simpler, no canvas context management, GPU-accelerated |
| image-rendering: -webkit-crisp-edges | image-rendering: pixelated | Chrome 41+ (2015), widely supported 2020+ | Standard property, cross-browser with crisp-edges fallback |

**Deprecated/outdated:**
- `-webkit-optimize-contrast`: Non-standard, replaced by `pixelated`
- `-ms-interpolation-mode: nearest-neighbor`: IE-only, no longer needed
- `image-rendering: -webkit-crisp-edges`: Safari-specific, modern Safari supports `pixelated`

## Open Questions

1. **SVG complexity vs file size**
   - What we know: 12 frames of a 32x32 pixel robot drawn with SVG `<rect>` elements could be verbose (potentially 50-100+ rects per frame)
   - What's unclear: Whether the SVG rendering performance is acceptable with 5-10 sprites animating simultaneously
   - Recommendation: Keep robot designs simple (15-25 rects per frame). The SVG is inline so it's part of the DOM -- measure performance if more than 10 sprites are on screen. If needed, pre-render to `<canvas>` as a fallback.

2. **shape-rendering: crispEdges on SVG**
   - What we know: `image-rendering: pixelated` applies to raster image scaling. For inline SVG vector paths, `shape-rendering: crispEdges` prevents anti-aliasing.
   - What's unclear: Whether both properties are needed together for the desired pixel-art look with inline SVG
   - Recommendation: Apply both -- `image-rendering: pixelated` on the viewport and `shape-rendering="crispEdges"` on the SVG element. Test visually and remove if redundant.

3. **Wander cleanup complexity**
   - What we know: Chained setTimeout for wander creates cleanup complexity
   - What's unclear: Best pattern for cancellable chained timeouts in React 19
   - Recommendation: Use a single `useRef` for the current timeout ID, clear in useEffect cleanup. Alternatively, use a `useReducer` state machine (idle -> walking -> paused -> idle) with a single effect that dispatches on timeouts.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 + React Testing Library 16.3.2 |
| Config file | `packages/app/vitest.config.ts` |
| Quick run command | `cd packages/app && npx vitest run --reporter=verbose` |
| Full suite command | `cd packages/app && npx vitest run --reporter=verbose` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SPRITE-01 | Address-derived color produces distinct hues for different addresses | unit | `cd packages/app && npx vitest run src/__tests__/sprite-utils.test.ts -x` | No -- Wave 0 |
| SPRITE-02 | AgentSprite renders with correct CSS animation class per status | unit | `cd packages/app && npx vitest run src/__tests__/agent-sprite.test.tsx -x` | No -- Wave 0 |
| SPRITE-03 | SpriteScene renders sprites with absolute positioning in scene container | unit | `cd packages/app && npx vitest run src/__tests__/sprite-scene.test.tsx -x` | No -- Wave 0 |
| SPRITE-04 | Hovering sprite shows detail card with agent name, address, status | unit | `cd packages/app && npx vitest run src/__tests__/agent-sprite.test.tsx -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cd packages/app && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd packages/app && npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/sprite-utils.test.ts` -- covers SPRITE-01 (color derivation, address hashing)
- [ ] `src/__tests__/agent-sprite.test.tsx` -- covers SPRITE-02, SPRITE-04 (animation class, hover card)
- [ ] `src/__tests__/sprite-scene.test.tsx` -- covers SPRITE-03 (scene layout, sprite positioning)

Note: CSS animation visual correctness (actual frame stepping, pixel crispness) cannot be verified in jsdom. Unit tests verify correct class/attribute application. Visual verification is manual.

## Sources

### Primary (HIGH confidence)
- [MDN: image-rendering](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/image-rendering) -- pixelated/crisp-edges property support and usage
- [MDN: Crisp pixel art look](https://developer.mozilla.org/en-US/docs/Games/Techniques/Crisp_pixel_art_look) -- complete CSS for pixel art rendering
- [Treehouse Blog: CSS Sprite Sheet Animations with steps()](https://blog.teamtreehouse.com/css-sprite-sheet-animations-steps) -- core steps() animation pattern
- [Can I Use: image-rendering crisp-edges/pixelated](https://caniuse.com/css-crisp-edges) -- browser compatibility

### Secondary (MEDIUM confidence)
- [CSS-Tricks: Spriting with img](https://css-tricks.com/spriting-img/) -- object-position alternative for inline sprite approach
- [DEV Community: CSS Sprite Animation](https://dev.to/mcardona9015/create-a-simple-sprite-animation-with-css-35a0) -- overflow:hidden + transform approach
- [LogRocket: CSS Sprite Sheet Animation](https://blog.logrocket.com/making-css-animations-using-a-sprite-sheet/) -- comprehensive tutorial

### Tertiary (LOW confidence)
- [CodePen: Multicolor SVG with CSS Custom Properties](https://codepen.io/brianmtreese/pen/eWNaGz) -- demonstrates CSS variable parameterization of SVG fills (pattern validated by MDN CSS custom properties spec)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new dependencies, all libraries already in project
- Architecture: HIGH -- CSS steps() animation is well-documented and battle-tested; inline SVG with CSS variables is standard web platform behavior
- Pitfalls: HIGH -- the background-image vs inline SVG pitfall is the most critical finding and is well-documented across multiple sources
- SVG drawing details: MEDIUM -- the actual robot pixel art drawing is creative work, not a technical research question

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable web platform features, no expiration risk)
