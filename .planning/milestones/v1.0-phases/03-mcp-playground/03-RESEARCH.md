# Phase 3: MCP Playground - Research

**Researched:** 2026-03-20
**Domain:** Interactive MCP tool browser/executor with dynamic forms and JSON visualization
**Confidence:** HIGH

## Summary

The MCP Playground is a three-column interactive page where users browse 28 MCP tools, configure parameters via dynamically generated forms, and view raw JSON request/response with syntax highlighting. The core technical challenges are: (1) extracting tool schemas from the MCP server for dynamic form generation, (2) expanding the bridge tool registry to cover all 28 tools (currently only 16), and (3) building a custom JSON syntax highlighter that matches the VS Code dark theme without external dependencies.

The existing infrastructure is strong. The `useMcpAction` hook, `/api/mcp/[tool]` route, and `toolRegistry` in `bridge.ts` provide a working execution pipeline. The main gap is that the bridge registry only covers treasury and delegation tools -- Lido (7 tools), ENS (2), Monitor (1), and Uniswap (3) are missing. Additionally, tool schemas (parameter names, types, descriptions, optionality) need to be exposed to the frontend for dynamic form generation -- currently schemas are embedded in `server.tool()` calls as Zod objects and are not accessible from the bridge.

**Primary recommendation:** Create a static tool schema registry (tool-schemas.ts) that defines each tool's parameters, descriptions, domain grouping, and human-friendly names. Expose this alongside the bridge. Use this registry to drive both the tool selector and the dynamic parameter form. Expand the bridge toolRegistry to cover all non-Uniswap tools (Uniswap is hidden per CONTEXT.md).

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Three-column layout: tool selector (~20%) | parameter form (~30%) | JSON response (~50%)
- Tool selector always visible (no collapse), one-click switching
- Collapsible domain groups: Lido, Treasury, Delegation, ENS, Monitor
- Hide Uniswap domain (incomplete/placeholder -- avoid awkward demo moments)
- Search/filter input at top of tool selector column
- Human/Agent view toggle in page header (default: agent view)
- Agent view: snake_case names, raw JSON params/response
- Human view: friendly names, labeled params, formatted response summary
- Smart defaults: connected wallet address for address fields, "1.0" for amounts, dry_run=true
- Global dry-run toggle in page header, individual tool dry_run params hidden from form
- Dark code theme syntax highlighting (green strings, blue numbers, purple booleans, grey keys)
- Status bar between request/response: status badge, execution time, HTTP status
- JSON panel actions: copy, collapse/expand nodes, word wrap toggle, download .json
- Empty state placeholder before first execution

### Claude's Discretion
- JSON highlighting library choice (custom component preferred per UI-SPEC registry safety)
- Schema extraction approach (static config vs bridge endpoint)
- Search filter implementation details
- Human view response formatting per tool
- Exact spacing, typography, glassmorphism treatment
- Loading state during tool execution
- Error display for failed tool calls

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PLAY-01 | Tool selector listing all available MCP tools grouped by domain | Tool schema registry with domain grouping; full tool catalog of 25 visible tools (28 minus 3 Uniswap) |
| PLAY-02 | Dynamic parameter form generated from tool schema | Static schema definitions with field types, descriptions, defaults, optionality; form field type mapping |
| PLAY-03 | JSON request/response viewer showing raw MCP communication | Custom JSON syntax highlighter using recursive React component; copy/download/collapse interactions |
| PLAY-04 | Dry-run toggle for safe demonstration of write tools | Global dry-run state in playground; bridge already supports `dry_run` param and `ctx.dryRun`; force dry-run in demo mode |

</phase_requirements>

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.4 | UI framework | Already in project |
| Next.js | 16.2.0 | App router, API routes | Already in project |
| shadcn/Radix | 4.1.0 | UI components (input, select, switch, badge, etc.) | Already installed, 15 components available |
| lucide-react | 0.577.0 | Icons (Search, ChevronDown, Copy, Download, WrapText, Play, Terminal) | Already in project |
| wagmi | 2.19.5 | Wallet address for smart defaults | Already in project |

### Supporting (no new installs needed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| clsx + tailwind-merge | existing | Conditional class composition | All component styling |
| @agentgate/mcp-server/bridge | workspace | Tool execution via bridge | API route handler |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom JSON highlighter | react-json-view, prism-react-renderer | External dependency vs. full control; UI-SPEC explicitly says "no external registry dependency" for JSON highlighting |
| Static tool schema config | Runtime schema extraction from Zod | Zod schemas are embedded inside `server.tool()` closures -- not extractable at runtime without MCP SDK dependency in the browser; static config is simpler and more reliable |

**Installation:**
```bash
# No new packages needed -- all dependencies are already installed
```

## Architecture Patterns

### Recommended Project Structure
```
packages/app/src/
  app/playground/
    page.tsx                  # Three-column layout page
  components/playground/
    playground-header.tsx     # Title + tool count + toggles
    tool-selector.tsx         # Left column: search + domain groups + tool items
    parameter-form.tsx        # Center column: dynamic form from schema
    json-viewer.tsx           # Syntax-highlighted JSON with collapse/copy/download
    execution-status-bar.tsx  # Status badge + time + HTTP code
  lib/
    tool-schemas.ts           # Static tool schema registry (names, params, domains, descriptions)
    hooks/
      use-playground.ts       # Playground state: selected tool, form values, dry-run, human/agent mode
```

### Pattern 1: Static Tool Schema Registry
**What:** A single TypeScript file defining all tool metadata: name, domain, description, human-friendly name, and parameter schema (field name, type, description, required, default value).
**When to use:** Always -- this is the source of truth for tool selector, form generation, and human view labels.
**Example:**
```typescript
// Source: project analysis of packages/mcp-server/src/tools/*.ts
export interface ToolParam {
  name: string;
  type: "string" | "number" | "boolean" | "enum";
  description: string;
  required: boolean;
  default?: string | number | boolean;
  enumValues?: string[];
  isAddress?: boolean;  // For smart default (wallet address)
  isAmount?: boolean;   // For smart default ("1.0")
}

export interface ToolSchema {
  name: string;              // snake_case tool name (bridge key)
  humanName: string;         // "Stake ETH (Lido)"
  domain: "Lido" | "Treasury" | "Delegation" | "ENS" | "Monitor";
  description: string;       // One-line from MCP server.tool() description
  params: ToolParam[];
  hasWriteEffect: boolean;   // true = supports dry_run
}

export const TOOL_SCHEMAS: ToolSchema[] = [
  {
    name: "lido_stake",
    humanName: "Stake ETH (Lido)",
    domain: "Lido",
    description: "Simulate staking ETH with Lido to receive stETH",
    params: [
      { name: "amount_eth", type: "string", description: "Amount of ETH to stake", required: true, isAmount: true },
      { name: "referral", type: "string", description: "Referral address", required: false, isAddress: true },
    ],
    hasWriteEffect: true,
  },
  // ... 24 more tools
];
```

### Pattern 2: Playground State Hook
**What:** A custom hook that manages all playground state: selected tool, form values, execution results, dry-run toggle, human/agent view.
**When to use:** Single source of truth for the playground page.
**Example:**
```typescript
export function usePlayground() {
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [globalDryRun, setGlobalDryRun] = useState(true);
  const [isHumanView, setIsHumanView] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [request, setRequest] = useState<Record<string, unknown> | null>(null);
  const [response, setResponse] = useState<Record<string, unknown> | null>(null);
  const [status, setStatus] = useState<{ code: number; time: number; mode: string } | null>(null);

  // Clear form when tool changes
  // Pre-fill smart defaults from schema
  // Execute via useMcpAction pattern (inline fetch, not hook -- tool name is dynamic)
}
```

### Pattern 3: Custom JSON Syntax Highlighter
**What:** A recursive React component that renders JSON with VS Code dark-style syntax colors. No external library.
**When to use:** Both request and response JSON panels.
**Example:**
```typescript
// Recursive JSON node renderer
function JsonNode({ data, depth, collapsed }: { data: unknown; depth: number; collapsed: Set<string> }) {
  if (typeof data === "string") return <span className="text-[hsl(142,60%,60%)]">"{data}"</span>;
  if (typeof data === "number") return <span className="text-[hsl(210,80%,65%)]">{data}</span>;
  if (typeof data === "boolean" || data === null) return <span className="text-[hsl(270,60%,70%)]">{String(data)}</span>;
  if (Array.isArray(data)) { /* render array with collapsible bracket */ }
  if (typeof data === "object") { /* render object with collapsible keys */ }
}
```

### Pattern 4: Dynamic Form Field Mapping
**What:** Map schema param types to shadcn form components.
**When to use:** parameter-form.tsx renders fields based on `ToolParam.type`.

| Schema Type | Component | Notes |
|-------------|-----------|-------|
| `string` (isAddress) | `<Input>` prefilled with wallet address | Validate 0x prefix + 42 chars |
| `string` (isAmount) | `<Input type="text">` prefilled with "1.0" | Validate positive number |
| `string` (plain) | `<Input>` | No special validation |
| `number` | `<Input type="number">` | Standard number input |
| `boolean` | `<Switch>` | Toggle on/off |
| `enum` | `<Select>` with options | From `enumValues` array |

### Anti-Patterns to Avoid
- **Importing Zod or MCP SDK in the frontend:** The MCP server uses `@modelcontextprotocol/sdk` which is a Node.js-only package. Never import tool files or Zod schemas directly in React components. Use the static schema registry instead.
- **One useMcpAction per tool:** The existing `useMcpAction` hook takes a fixed `toolName` at call time. For the playground (dynamic tool selection), use a direct `fetch()` call instead of the hook, or create a new hook that accepts tool name as a parameter to `execute()`.
- **Inline large JSON in state:** Store the raw response object, not a pre-stringified version. Let the JSON viewer component handle serialization with proper formatting.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Clipboard copy | Manual document.execCommand | `navigator.clipboard.writeText()` | Modern API, works in all target browsers |
| File download | Complex blob handling | Simple `URL.createObjectURL(new Blob([json]))` + anchor click | 5-line pattern, no library needed |
| Form validation | Complex validation framework | Inline validation per field (address format, positive number) | Only 3-4 validation rules total |
| State management | Redux/Zustand | React useState in usePlayground hook | Single page, manageable state |

**Key insight:** This phase is UI-intensive but architecturally simple. The bridge handles all complexity. The playground is a thin client that sends POST requests and displays results.

## Common Pitfalls

### Pitfall 1: Bridge Registry Incomplete
**What goes wrong:** User selects a Lido or ENS tool but gets "Unknown tool" 404 from the bridge.
**Why it happens:** The bridge `toolRegistry` in `bridge.ts` only has 16 tools (treasury + delegation). Lido (7), ENS (2), Monitor (1) are missing.
**How to avoid:** Expand `toolRegistry` in `bridge.ts` with handlers for all visible tools. For read-only tools, implement real handlers. For write tools, use the existing `dryRunStub()` pattern. For tools that call external APIs (lido_get_apr, lido_rewards, lido_governance), implement real API calls in the bridge.
**Warning signs:** 404 errors when clicking non-treasury tools in the playground.

### Pitfall 2: Dynamic Tool Name in useMcpAction
**What goes wrong:** `useMcpAction(toolName)` creates a new hook identity every time the selected tool changes, causing state loss and re-renders.
**Why it happens:** The hook memoizes `execute` with `toolName` in deps. Changing tool name creates a new callback.
**How to avoid:** Don't use `useMcpAction` for the playground. Use a direct `fetch()` call inside the playground state hook, passing tool name as a parameter.
**Warning signs:** Loading state flickers, previous results disappear on tool switch.

### Pitfall 3: JSON Highlighting Performance
**What goes wrong:** Large JSON responses (e.g., lido_governance with 5+ proposals) cause lag during recursive rendering.
**Why it happens:** Deeply nested objects create many React elements. Re-rendering on collapse/expand touches the whole tree.
**How to avoid:** Use `React.memo` on JsonNode. Collapse large arrays by default (>5 items). Memoize the JSON tree.
**Warning signs:** Slow response panel updates, jank when expanding nodes.

### Pitfall 4: Zod Schema Extraction Temptation
**What goes wrong:** Developer tries to import Zod schemas from MCP server tool files to auto-generate forms.
**Why it happens:** Seems DRY to reuse existing schemas rather than duplicating in a static config.
**How to avoid:** The Zod schemas are embedded inside `server.tool()` calls as inline objects -- they cannot be imported separately. The MCP SDK is Node.js only. A static `tool-schemas.ts` is the correct approach. It also enables human-friendly metadata (humanName, isAddress, isAmount) that Zod schemas don't have.
**Warning signs:** Build errors from importing `@modelcontextprotocol/sdk` in client code.

### Pitfall 5: Next.js 16 API Route Params
**What goes wrong:** TypeScript errors on `params` in the API route.
**Why it happens:** Next.js 16 changed `params` to be a Promise. The existing route already handles this correctly (`{ params }: { params: Promise<{ tool: string }> }`).
**How to avoid:** Follow the existing pattern in `packages/app/src/app/api/mcp/[tool]/route.ts`.

## Code Examples

### Bridge Tool Expansion Pattern
```typescript
// Source: packages/mcp-server/src/bridge.ts (existing pattern)
// Add missing tools to toolRegistry:

// Lido read-only tools (need real implementation)
lido_get_apr: async (_params, _ctx) => {
  const res = await fetch("https://eth-api.lido.fi/v1/protocol/steth/apr/last");
  const data = await res.json();
  return { apr: data };
},

// Lido write tools (dry-run stubs)
lido_stake: dryRunStub("lido_stake"),
lido_wrap: dryRunStub("lido_wrap"),
lido_governance_vote: dryRunStub("lido_governance_vote"),

// ENS read-only tools
ens_resolve: async (params, ctx) => {
  const address = await ctx.l1PublicClient.getEnsAddress({ name: params.name });
  return { name: params.name, address };
},
```

### Dynamic Form Generation
```typescript
// Source: project convention from Phase 2 MCP form pattern
function ParameterForm({ schema, values, onChange, onSubmit }: Props) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {schema.params.map((param) => {
        if (param.type === "boolean") {
          return (
            <div key={param.name} className="flex items-center justify-between">
              <Label>{param.name}</Label>
              <Switch checked={!!values[param.name]} onCheckedChange={(v) => onChange(param.name, v)} />
            </div>
          );
        }
        if (param.type === "enum") {
          return (
            <div key={param.name}>
              <Label>{param.name}</Label>
              <Select value={values[param.name] as string} onValueChange={(v) => onChange(param.name, v)}>
                {/* ... options from param.enumValues */}
              </Select>
            </div>
          );
        }
        return (
          <div key={param.name}>
            <Label>{param.name}</Label>
            <Input value={values[param.name] as string || ""} onChange={(e) => onChange(param.name, e.target.value)} placeholder={param.description} />
          </div>
        );
      })}
      <Button type="submit" className="w-full">Execute Tool</Button>
    </form>
  );
}
```

### Clipboard Copy Pattern
```typescript
async function copyToClipboard(json: unknown) {
  const text = JSON.stringify(json, null, 2);
  await navigator.clipboard.writeText(text);
  // Show "Copied" feedback for 2s
}
```

### JSON File Download Pattern
```typescript
function downloadJson(json: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

## Complete Tool Catalog

28 tools in MCP server. 25 visible in playground (3 Uniswap hidden).

| Domain | Tool Name | Has Write Effect | In Bridge? | Action Needed |
|--------|-----------|-----------------|------------|---------------|
| **Lido** | lido_stake | Yes | No | Add dryRunStub or real impl |
| | lido_wrap | Yes | No | Add dryRunStub or real impl |
| | lido_get_apr | No | No | Add real impl (fetch Lido API) |
| | lido_balance | No | No | Add real impl (L1 + Base reads) |
| | lido_rewards | No | No | Add real impl (fetch Lido API) |
| | lido_governance | No | No | Add real impl (fetch Snapshot API) |
| | lido_governance_vote | Yes | No | Add dryRunStub |
| **Treasury** | treasury_deposit | Yes | Yes (stub) | Already done |
| | treasury_status | No | Yes (real) | Already done |
| | treasury_get_rate | No | Yes (real) | Already done |
| | treasury_get_spender_config | No | Yes (real) | Already done |
| | treasury_authorize_spender | Yes | Yes (stub) | Already done |
| | treasury_revoke_spender | Yes | Yes (stub) | Already done |
| | treasury_withdraw_yield | Yes | Yes (stub) | Already done |
| | treasury_withdraw_yield_for | Yes | Yes (stub) | Already done |
| | treasury_set_recipient_whitelist | Yes | Yes (stub) | Already done |
| | treasury_set_allowed_recipient | Yes | Yes (stub) | Already done |
| **Delegation** | delegate_create_account | Yes | No | Add dryRunStub |
| | delegate_create | Yes | Yes (stub) | Already done |
| | delegate_redeem | Yes | Yes (stub) | Already done |
| | delegate_list | No | Yes (stub) | Already done |
| | delegate_revoke | Yes | Yes (stub) | Already done |
| **ENS** | ens_resolve | No | No | Add real impl (L1 ENS read) |
| | ens_reverse | No | No | Add real impl (L1 ENS read) |
| **Monitor** | vault_health | No | No | Add real impl (Base reads + API) |
| **Uniswap** | uniswap_quote | No | No | HIDDEN -- do not add |
| | uniswap_swap | Yes | No | HIDDEN -- do not add |
| | uniswap_tokens | No | No | HIDDEN -- do not add |

**Bridge expansion:** 12 tools need to be added (7 Lido, 1 Delegation, 2 ENS, 1 Monitor, 1 Delegation create_account). Of these, 4 are read-only needing real implementations, 4 are write-only needing dryRunStubs, and 4 are read-only with external API calls.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-json-view for JSON display | Custom recursive component or react-json-view-lite | 2024+ | react-json-view is unmaintained; custom is preferred for this project per UI-SPEC |
| Importing Zod schemas cross-package | Static schema registry | Project convention | Zod/MCP SDK are Node.js only |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest + @testing-library/react + jsdom |
| Config file | packages/app/vitest.config.ts |
| Quick run command | `cd packages/app && npx vitest run --reporter=verbose` |
| Full suite command | `cd packages/app && npx vitest run --reporter=verbose` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PLAY-01 | Tool selector renders all tools grouped by domain, search filters | unit | `cd packages/app && npx vitest run src/__tests__/playground-selector.test.tsx -x` | No - Wave 0 |
| PLAY-02 | Dynamic form renders correct fields per tool schema, smart defaults | unit | `cd packages/app && npx vitest run src/__tests__/playground-form.test.tsx -x` | No - Wave 0 |
| PLAY-03 | JSON viewer renders request/response with syntax highlighting, copy works | unit | `cd packages/app && npx vitest run src/__tests__/playground-json.test.tsx -x` | No - Wave 0 |
| PLAY-04 | Dry-run toggle injects dry_run param, demo mode forces dry-run | unit | `cd packages/app && npx vitest run src/__tests__/playground-dryrun.test.tsx -x` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `cd packages/app && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd packages/app && npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/playground-selector.test.tsx` -- covers PLAY-01 (tool listing and filtering)
- [ ] `src/__tests__/playground-form.test.tsx` -- covers PLAY-02 (dynamic form generation)
- [ ] `src/__tests__/playground-json.test.tsx` -- covers PLAY-03 (JSON viewer rendering)
- [ ] `src/__tests__/playground-dryrun.test.tsx` -- covers PLAY-04 (dry-run toggle behavior)

## Open Questions

1. **Lido/ENS/Monitor bridge handlers: full implementation or simplified?**
   - What we know: Some tools (lido_get_apr, lido_rewards, lido_governance) call external APIs. Others (lido_balance, ens_resolve, vault_health) read from blockchain via publicClient.
   - What's unclear: Whether the bridge should fully replicate the MCP server logic or return simplified responses.
   - Recommendation: For read-only tools, implement real handlers to make the playground demo impressive with real data. For write tools, dryRunStub is sufficient. This maximizes demo value for judges.

2. **Human view response formatting**
   - What we know: Human view should show formatted summaries like "Simulated -- ~0.87 stETH received" alongside raw JSON.
   - What's unclear: How to define per-tool formatters without excessive code.
   - Recommendation: Add an optional `humanFormat` function to the tool schema registry that extracts key values from the response. Default to showing top-level key-value pairs for tools without a custom formatter.

## Sources

### Primary (HIGH confidence)
- Project codebase analysis: `packages/mcp-server/src/tools/*.ts` (all 6 tool files examined)
- Project codebase analysis: `packages/mcp-server/src/bridge.ts` (bridge registry examined)
- Project codebase analysis: `packages/app/src/lib/hooks/use-mcp-action.ts` (existing hook pattern)
- Project codebase analysis: `packages/app/src/app/api/mcp/[tool]/route.ts` (API route pattern)
- `.planning/phases/03-mcp-playground/03-CONTEXT.md` (locked decisions)
- `.planning/phases/03-mcp-playground/03-UI-SPEC.md` (design contract)

### Secondary (MEDIUM confidence)
- React 19 / Next.js 16 patterns (from project's existing working code)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already installed and used in Phase 1/2
- Architecture: HIGH - patterns follow existing project conventions (useMcpAction, bridge, shadcn)
- Pitfalls: HIGH - identified from direct codebase analysis (bridge gaps, schema extraction, hook identity)
- Tool catalog: HIGH - exact tool names extracted from grep of all server.tool() calls

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable -- internal project, no external dependency changes expected)
