# Phase 2: Dashboard Pages - Research

**Researched:** 2026-03-20
**Domain:** React dashboard UI with wagmi on-chain reads, MCP bridge writes, shadcn components
**Confidence:** HIGH

## Summary

Phase 2 replaces three placeholder pages (Treasury, Staking, Delegations) with fully functional dashboards that display real on-chain data and provide forms for write operations. The architecture is split: wagmi hooks handle all read operations directly (fast, cached via react-query), while write operations (deposit, withdraw, create/redeem delegation) route through the existing `/api/mcp/[tool]` bridge with dry-run support.

The project already has a solid foundation: wagmi + react-query + viem are installed and configured for Base mainnet, the MCP bridge is operational with treasury tool handlers, and the design system (glassmorphism cards, dark theme, purple accent) is established. The main gaps are: (1) no Lido or delegation tool handlers in the bridge registry, (2) ABIs from the MCP server need to be shared or duplicated for client-side wagmi reads, (3) L1 reads (Lido APR, stETH balances) need a separate publicClient since wagmi is configured for Base only, and (4) the donut chart should be pure SVG per the UI-SPEC (no chart library).

**Primary recommendation:** Build three page modules in parallel tracks (Treasury, Staking, Delegations), sharing a small set of custom components (stat-card, address-display, dry-run-result, health-score). Use wagmi's `useReadContract` for all on-chain reads with the existing react-query cache. Create a shared `contracts/` directory for ABIs and addresses. Add Lido and delegation dry-run stubs to the bridge registry for write operations.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Donut/ring chart visualization for treasury vault principal vs yield proportions
- Chart inside glassmorphism card with numeric balances alongside
- Chainlink oracle rate displayed inside the donut card
- Deposit and withdraw forms as side-by-side cards below vault chart (inline, not tabbed)
- Each form has amount input and dry-run toggle switch
- Dry-run simulation shows inline result card below form
- Hero APR metric at top of staking page with glow accent
- Position card showing wstETH balance, stETH equivalent, USD value
- Vault health report card with score (0-100, color-coded) plus collateral ratio, utilization rate, active alerts
- Delegation default view: stacked glassmorphism cards, one per delegation
- Each delegation card: delegate address (truncated), scope/permissions, caveats, status badge (Live/Expired)
- Action buttons per delegation card: Redeem, Revoke
- Card and table view toggle for delegations
- "Create Delegation" button opens slide-in drawer/modal
- Dashboard pages use wagmi hooks for all read operations
- Write operations go through /api/mcp/[tool] bridge
- MCP bridge NOT used for reads on dashboard pages
- Demo mode: hardcoded treasury address for reads, writes auto-force dry_run=true

### Claude's Discretion
- Donut chart library choice (lightweight option preferred -- recharts, or pure SVG/CSS)
- Exact card/table view toggle design for delegations
- Form validation patterns and error messages
- Exact spacing, typography, and responsive breakpoints within desktop layout
- USD value display source and formatting
- Whether to add shadcn card/input/form components or build custom

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TREA-01 | Vault status display -- principal vs yield balances for connected wallet | wagmi `useReadContract` with `getVaultStatus` ABI; `useApp()` for wallet address vs demo address |
| TREA-02 | Yield vs principal visualization (chart showing vault separation) | Pure SVG donut chart component; `--chart-1` (principal) and `--chart-2` (yield) CSS variables |
| TREA-03 | Deposit wstETH form with dry-run simulation toggle | MCP bridge POST to `/api/mcp/treasury_deposit` with `dry_run` param; form with shadcn input + switch |
| TREA-04 | Withdraw yield form with dry-run simulation toggle | MCP bridge POST to `/api/mcp/treasury_withdraw_yield`; same pattern as deposit |
| TREA-05 | Chainlink oracle exchange rate display | wagmi `useReadContract` with `getCurrentRate` ABI on treasury contract |
| DELG-01 | Active delegations list showing scope, caveats, and status | MCP bridge GET via `/api/mcp/delegate_list`; delegation-card component; table view with shadcn table |
| DELG-02 | Create delegation form (ERC-7710 with amount caveats) | MCP bridge POST to `/api/mcp/delegate_create`; sheet/dialog with delegate address, scope selector, amount input |
| DELG-03 | Redeem delegation UI with target contract/calldata input | MCP bridge POST to `/api/mcp/delegate_redeem`; sheet/dialog with target contract and calldata inputs |
| STAK-01 | Lido staking APR display with current rate | Lido API `https://eth-api.lido.fi/v1/protocol/steth/apr/last` via server-side API route (avoid CORS) |
| STAK-02 | wstETH/stETH position balance display for connected wallet | wagmi `useReadContract` on Base wstETH (`0xc1CBa...`); L1 reads need separate viem publicClient |
| STAK-03 | Vault health report card (aggregated metrics, alerts) | Computed from treasury vault data + staking positions; health-score component |
</phase_requirements>

## Standard Stack

### Core (Already Installed)
| Library | Installed Version | Purpose | Why Standard |
|---------|-------------------|---------|--------------|
| wagmi | 2.19.5 | React hooks for on-chain reads (useReadContract, useBalance) | Already configured, cached via react-query |
| viem | 2.47.5 | TypeScript Ethereum library, ABI types, formatEther/parseEther | Already used by MCP server and bridge |
| @tanstack/react-query | 5.91.2 | Caching layer for wagmi hooks and API calls | Already wrapping the app |
| next | 16.2.0 | App framework, API routes for MCP bridge | Already serving pages |
| shadcn | 4.1.0 | UI component toolkit (card, input, switch, dialog, etc.) | Already initialized, preset base-nova |
| lucide-react | 0.577.0 | Icon library | Already used throughout |
| tailwindcss | 4.x | Styling | Already configured with design tokens |

### To Add (shadcn Components)
| Component | Add Command | Purpose |
|-----------|-------------|---------|
| card | `npx shadcn add card` | All dashboard cards |
| input | `npx shadcn add input` | Form amount/address inputs |
| label | `npx shadcn add label` | Form field labels |
| switch | `npx shadcn add switch` | Dry-run toggle |
| dialog | `npx shadcn add dialog` | Revoke confirmation, delegation modals |
| sheet | `npx shadcn add sheet` | Create/redeem delegation slide-in |
| table | `npx shadcn add table` | Delegation table view |
| tabs | `npx shadcn add tabs` | Cards/table view toggle |
| select | `npx shadcn add select` | Scope selector in delegation form |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Pure SVG donut | recharts | Recharts adds ~150KB for a single chart; SVG is simpler for one donut. UI-SPEC specifies pure SVG. **Use pure SVG.** |
| shadcn form components | Custom form primitives | shadcn components ensure consistent styling with design tokens. **Use shadcn.** |
| Client-side Lido API fetch | Server-side API route | Lido API may have CORS restrictions from browser. **Use Next.js API route as proxy.** |

**Installation (one command):**
```bash
cd packages/app && npx shadcn add card input label switch dialog sheet table tabs select
```

## Architecture Patterns

### Recommended Project Structure
```
packages/app/src/
  app/
    treasury/page.tsx         # Treasury dashboard (replace placeholder)
    staking/page.tsx          # Staking dashboard (replace placeholder)
    delegations/page.tsx      # Delegations dashboard (replace placeholder)
    api/mcp/[tool]/route.ts   # Existing MCP bridge (add Lido + delegation handlers)
    api/lido/apr/route.ts     # NEW: Server-side proxy for Lido APR API
  components/
    ui/                       # shadcn components (existing + new)
    treasury/                 # Treasury page components
      vault-overview.tsx      # Donut chart + balance stats card
      deposit-form.tsx        # Deposit wstETH form
      withdraw-form.tsx       # Withdraw yield form
    staking/                  # Staking page components
      apr-hero.tsx            # Hero APR metric with glow
      position-card.tsx       # wstETH/stETH position display
      health-report.tsx       # Vault health report card
    delegations/              # Delegations page components
      delegation-card.tsx     # Single delegation card
      delegation-table.tsx    # Table view of delegations
      create-delegation.tsx   # Create delegation sheet
      redeem-delegation.tsx   # Redeem delegation sheet
    shared/                   # Reusable across pages
      stat-card.tsx           # Label + value + sub-value metric display
      address-display.tsx     # Truncated address with tooltip + copy
      dry-run-result.tsx      # Inline simulation result card
      health-score.tsx        # Color-coded 0-100 gauge
      error-card.tsx          # Inline error with retry button
  lib/
    contracts/                # NEW: Shared ABIs and addresses
      treasury-abi.ts         # Treasury contract ABI (extracted from MCP server)
      lido-abi.ts             # Lido stETH/wstETH ABIs
      addresses.ts            # Contract addresses (Base + L1)
    hooks/                    # NEW: Custom hooks
      use-treasury.ts         # useVaultStatus, useOracleRate hooks
      use-staking.ts          # useLidoApr, useWstethBalance hooks
      use-delegations.ts      # useDelegationList hook
      use-mcp-action.ts       # Generic MCP bridge mutation hook
```

### Pattern 1: wagmi Read Hooks with Demo Mode Fallback
**What:** Every on-chain read uses wagmi hooks with the address from `useApp()`. In demo mode, `activeAddress` is `DEMO_TREASURY_ADDRESS`. In connected mode, it is the wallet address.
**When to use:** All dashboard read operations.
**Example:**
```typescript
// Source: project patterns from app-provider.tsx + wagmi docs
import { useReadContract } from "wagmi";
import { useApp } from "@/providers/app-provider";
import { TREASURY_ABI } from "@/lib/contracts/treasury-abi";
import { TREASURY_ADDRESS } from "@/lib/contracts/addresses";

export function useVaultStatus() {
  const { activeAddress } = useApp();

  return useReadContract({
    address: TREASURY_ADDRESS,
    abi: TREASURY_ABI,
    functionName: "getVaultStatus",
    args: [activeAddress as `0x${string}`],
  });
}
```

### Pattern 2: MCP Bridge Mutation with Dry-Run
**What:** Write operations POST to `/api/mcp/[tool]` with params including `dry_run` flag. In demo mode, `dry_run` is forced to `true`.
**When to use:** Deposit, withdraw, create delegation, redeem delegation, revoke delegation.
**Example:**
```typescript
// Source: existing bridge route pattern
import { useApp } from "@/providers/app-provider";

export function useMcpAction(toolName: string) {
  const { isDemo, activeAddress } = useApp();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const execute = async (params: Record<string, unknown>, dryRun: boolean) => {
    setLoading(true);
    const forceDryRun = isDemo ? true : dryRun;

    const res = await fetch(`/api/mcp/${toolName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...params,
        wallet_address: activeAddress,
        dry_run: forceDryRun,
      }),
    });

    const data = await res.json();
    setResult(data);
    setLoading(false);
    return data;
  };

  return { execute, result, loading };
}
```

### Pattern 3: SVG Donut Chart
**What:** Pure SVG ring chart using `stroke-dasharray` and `stroke-dashoffset` for segment rendering.
**When to use:** Treasury vault principal vs yield visualization.
**Example:**
```typescript
// Source: standard SVG circle technique
interface DonutChartProps {
  principal: number;
  yield_: number;
  size?: number;
}

export function DonutChart({ principal, yield_, size = 200 }: DonutChartProps) {
  const total = principal + yield_;
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const principalPct = total > 0 ? principal / total : 0;
  const yieldPct = total > 0 ? yield_ / total : 0;

  return (
    <svg width={size} height={size} viewBox="0 0 200 200">
      {/* Principal segment */}
      <circle
        cx="100" cy="100" r={radius}
        fill="none"
        stroke="hsl(var(--chart-1))"
        strokeWidth="20"
        strokeDasharray={`${principalPct * circumference} ${circumference}`}
        strokeDashoffset="0"
        transform="rotate(-90 100 100)"
      />
      {/* Yield segment */}
      <circle
        cx="100" cy="100" r={radius}
        fill="none"
        stroke="hsl(var(--chart-2))"
        strokeWidth="20"
        strokeDasharray={`${yieldPct * circumference} ${circumference}`}
        strokeDashoffset={`${-principalPct * circumference}`}
        transform="rotate(-90 100 100)"
      />
      {/* Center text */}
      <text x="100" y="95" textAnchor="middle" className="fill-foreground text-sm font-semibold">
        {total.toFixed(4)}
      </text>
      <text x="100" y="115" textAnchor="middle" className="fill-muted-foreground text-xs">
        wstETH
      </text>
    </svg>
  );
}
```

### Pattern 4: L1 Reads via API Route (Lido APR)
**What:** Lido APR data comes from `https://eth-api.lido.fi` and L1 contract reads. Since wagmi is configured for Base only and the Lido API may block CORS, use a Next.js API route as a server-side proxy.
**When to use:** Lido APR, stETH/wstETH conversion rates from L1.
**Example:**
```typescript
// app/api/lido/apr/route.ts
export async function GET() {
  const res = await fetch("https://eth-api.lido.fi/v1/protocol/steth/apr/last");
  const data = await res.json();
  return Response.json(data);
}
```

### Pattern 5: Loading and Error States
**What:** Skeleton shimmer during loading, inline error card with retry on failure.
**When to use:** Every data-dependent section.
**Example:**
```typescript
if (isLoading) return <Skeleton className="h-[200px] rounded-xl" />;
if (error) return (
  <ErrorCard
    message="Failed to load vault data. Check your connection and try again."
    onRetry={() => refetch()}
  />
);
```

### Anti-Patterns to Avoid
- **Fetching via MCP bridge for reads:** Dashboard reads use wagmi hooks for speed and caching. MCP bridge is for writes only (and Phase 3 playground).
- **BigInt literals (e.g., `0n`):** The project uses `BigInt(0)` due to ES2017 target compatibility with Next.js transpilation (established in Phase 1).
- **Opaque `bg-card` for content cards:** All dashboard cards use the glassmorphism pattern: `bg-card/60 border border-border/50 backdrop-blur-lg rounded-xl`.
- **Full-page error states:** Errors display inline within the affected card section with a retry button.
- **Relative imports across packages:** Use the `@agentgate/mcp-server/bridge` subpath export pattern established in Phase 1.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Form inputs with consistent styling | Custom input components | `npx shadcn add input` + `label` | Automatic design token integration, focus rings, dark theme |
| Modal/drawer overlays | Custom portal + backdrop | `npx shadcn add dialog` + `sheet` | Accessibility (focus trap, escape key, aria attributes) |
| Toggle switches | Custom checkbox styling | `npx shadcn add switch` | Accessible, animated, consistent with design system |
| Data table | Custom table HTML | `npx shadcn add table` | Styled headers, borders, alignment matching theme |
| View toggle (cards/table) | Custom radio group | `npx shadcn add tabs` | Clean tab switching with active indicator |
| Dropdown select | Custom dropdown | `npx shadcn add select` | Keyboard navigation, portal rendering, scroll handling |
| Address formatting | Manual string slicing everywhere | Shared `address-display.tsx` component | Copy-to-clipboard, tooltip, consistent truncation |
| BigInt formatting | Inline `formatEther` calls | Helper functions in `lib/format.ts` | Consistent decimal places, null handling, USD conversion |

**Key insight:** The shadcn components from the UI-SPEC are mandated and handle accessibility, keyboard navigation, and dark theme integration out of the box. Custom alternatives would need to replicate all of that.

## Common Pitfalls

### Pitfall 1: wagmi Config Only Has Base Chain
**What goes wrong:** Lido stETH/wstETH balance reads require L1 Ethereum. The wagmi config (`wagmiConfig`) only includes Base chain. Using `useReadContract` for L1 contracts will fail.
**Why it happens:** The app is Base-focused; L1 reads are an edge case needed for staking data.
**How to avoid:** For L1 reads (stETH balance, wstETH L1 balance), either: (a) create a separate viem publicClient for mainnet in a custom hook (not wagmi), or (b) create a server-side API route that uses the bridge's `l1PublicClient`. The bridge already has an L1 client configured. **Recommendation: use server-side API route** for L1 data (APR, L1 balances) to keep the client simple.
**Warning signs:** `useReadContract` returning errors about unsupported chain.

### Pitfall 2: Bridge Registry Missing Lido and Delegation Handlers
**What goes wrong:** Write operations for delegation (create, redeem, revoke) and Lido are not registered in `bridge.ts`. Calling `/api/mcp/delegate_create` returns 404.
**Why it happens:** The bridge was built in Phase 1 with treasury tools only.
**How to avoid:** Add dry-run stubs for Lido and delegation write tools to the bridge's `toolRegistry`. The delegation tools need at minimum: `delegate_create`, `delegate_redeem`, `delegate_revoke`, `delegate_list`. For reads (delegate_list), implement a real handler. For writes, dry-run stubs suffice since the bridge is read-only/dry-run by design.
**Warning signs:** 404 responses from MCP bridge for non-treasury tools.

### Pitfall 3: BigInt Serialization in API Responses
**What goes wrong:** `JSON.stringify` throws on BigInt values. Contract reads return BigInt, and passing them directly to API responses crashes.
**Why it happens:** JavaScript's JSON serializer does not support BigInt natively.
**How to avoid:** Always use `formatEther()` or `.toString()` on BigInt values before JSON serialization. The existing MCP tools already do this correctly -- follow their pattern.
**Warning signs:** "TypeError: Do not know how to serialize a BigInt" in API routes.

### Pitfall 4: CORS on External APIs (Lido)
**What goes wrong:** Direct client-side `fetch("https://eth-api.lido.fi/...")` may be blocked by CORS policy in the browser.
**Why it happens:** External APIs may not include `Access-Control-Allow-Origin` headers for arbitrary origins.
**How to avoid:** Proxy Lido API calls through a Next.js API route (e.g., `/api/lido/apr`). The server-side route has no CORS restrictions.
**Warning signs:** Console error "blocked by CORS policy" on staking page.

### Pitfall 5: Demo Mode Write Behavior
**What goes wrong:** In demo mode (no wallet connected), clicking "Deposit" or "Create Delegation" should not attempt real transactions.
**Why it happens:** Missing guard for demo mode in form submission logic.
**How to avoid:** In demo mode, ALL write operations must force `dry_run: true`. The `useApp().isDemo` flag determines this. Show a message: "Dry-run only in demo mode. Connect a wallet to execute transactions."
**Warning signs:** Error messages about missing wallet when clicking form buttons without connection.

### Pitfall 6: Delegation Data Source
**What goes wrong:** The MCP server stores delegations in memory (`delegationStore` Map). This is session-scoped to the MCP server process, NOT the browser session. The dashboard bridge has no access to this in-memory store.
**Why it happens:** The delegation tools use an in-memory Map that only exists in the full MCP server, not in the bridge.
**How to avoid:** For the dashboard, implement delegation listing differently: either (a) add a delegation list bridge handler that returns mock/demo data in demo mode, or (b) store delegations in the browser's local state and display them. Since this is a hackathon demo, **recommended approach: show demo/sample delegation data in demo mode, and for connected wallets, track delegations created in the current browser session using React state or context.**
**Warning signs:** Empty delegation list even after creating delegations via the form.

### Pitfall 7: Next.js 16 API Route Params
**What goes wrong:** In Next.js 16, dynamic route params are async. The existing bridge route already handles this correctly with `await params`.
**Why it happens:** Next.js 16 changed route handler params to be a Promise.
**How to avoid:** Follow the existing pattern in `route.ts`: `const { tool } = await params;`
**Warning signs:** Build errors about params not being awaited.

## Code Examples

### Shared ABI File
```typescript
// lib/contracts/treasury-abi.ts
// Extract from packages/mcp-server/src/tools/treasury.ts
export const TREASURY_ABI = [
  {
    name: "getVaultStatus",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [
      { name: "depositedPrincipal", type: "uint256" },
      { name: "availableYield", type: "uint256" },
      { name: "totalBalance", type: "uint256" },
      { name: "hasVault", type: "bool" },
    ],
  },
  {
    name: "getCurrentRate",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
```

### Shared Contract Addresses
```typescript
// lib/contracts/addresses.ts
import type { Address } from "viem";

export const TREASURY_ADDRESS = (process.env.NEXT_PUBLIC_TREASURY_ADDRESS ||
  "0x0000000000000000000000000000000000000000") as Address;

export const BASE_WSTETH = "0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452" as Address;

export const L1_ADDRESSES = {
  stETH: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84" as Address,
  wstETH: "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0" as Address,
};
```

### Glassmorphism Card Pattern
```typescript
// Established pattern from Phase 1 placeholder-page.tsx and UI-SPEC
<Card className="border-border/50 bg-card/60 backdrop-blur-lg">
  <CardHeader>
    <CardTitle className="text-xl font-semibold">Section Title</CardTitle>
  </CardHeader>
  <CardContent>
    {/* content */}
  </CardContent>
</Card>
```

### Stat Card Component
```typescript
// components/shared/stat-card.tsx
interface StatCardProps {
  label: string;
  value: string;
  subValue?: string;
  glow?: boolean;
}

export function StatCard({ label, value, subValue, glow }: StatCardProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <span className={cn(
        "text-3xl font-semibold",
        glow && "text-primary [text-shadow:0_0_20px_hsl(270_95%_65%/0.5)]"
      )}>
        {value}
      </span>
      {subValue && (
        <span className="text-sm text-muted-foreground">{subValue}</span>
      )}
    </div>
  );
}
```

### Dry-Run Result Component
```typescript
// components/shared/dry-run-result.tsx
interface DryRunResultProps {
  data: Record<string, unknown>;
  onDismiss: () => void;
}

export function DryRunResult({ data, onDismiss }: DryRunResultProps) {
  const success = data.would_succeed !== false;

  return (
    <div className={cn(
      "mt-4 rounded-lg border p-4",
      success
        ? "border-success/30 bg-success/5"
        : "border-destructive/30 bg-destructive/5"
    )}>
      <div className="flex items-center justify-between mb-2">
        <Badge variant={success ? "default" : "destructive"}>
          {success ? "Simulation passed" : "Simulation failed"}
        </Badge>
        <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <pre className="text-xs text-muted-foreground overflow-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| wagmi v1 hooks (`useContractRead`) | wagmi v2 hooks (`useReadContract`) | wagmi 2.x (2024) | Different hook names and API surface |
| Next.js `getServerSideProps` | Next.js App Router server components + API routes | Next.js 13+ | Pages in `app/` directory, `route.ts` for API |
| shadcn `npx shadcn-ui@latest add` | shadcn v4 `npx shadcn add` | 2025 | Simplified CLI, CSS variable theming |
| BigInt literal `0n` | `BigInt(0)` | Project decision | ES2017 target compatibility |

**Deprecated/outdated:**
- `useContractRead` (wagmi v1): replaced by `useReadContract` in wagmi v2
- `getDefaultWallets` (RainbowKit v1): replaced by `getDefaultConfig` in v2 (already used)
- Direct `import { ... } from "../../../mcp-server/..."`: blocked by Turbopack; use subpath exports

## Open Questions

1. **Vault health score computation**
   - What we know: UI-SPEC specifies a 0-100 score with collateral ratio, utilization rate, and active alerts
   - What's unclear: There is no explicit "vault health" function in the treasury contract. The score must be computed client-side from vault status data.
   - Recommendation: Compute health score from: (a) collateral ratio = total / principal, (b) utilization = yield_withdrawn / available_yield, (c) alerts = flag if yield < threshold. Define thresholds in constants. For demo, hardcode reasonable sample data.

2. **USD value source**
   - What we know: Staking page should show "~$X USD" for wstETH position
   - What's unclear: No price feed is integrated. Options: CoinGecko API, hardcoded estimate, or derive from Chainlink rate
   - Recommendation: Use a simple server-side API route that fetches wstETH USD price from CoinGecko's free API (`/api/v3/simple/price?ids=wrapped-steth&vs_currencies=usd`). Cache for 60 seconds. Fallback to "Price unavailable" if API is down.

3. **Delegation data persistence**
   - What we know: The MCP server stores delegations in-memory. The bridge does not share this state.
   - What's unclear: How to show delegation data on the dashboard when the store is session-scoped to the MCP server
   - Recommendation: For the hackathon demo, provide sample/mock delegation data in demo mode. For connected wallet mode, track delegations created in the current browser session via React context. This is sufficient for a demo.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 + @testing-library/react 16.3.2 |
| Config file | `packages/app/vitest.config.ts` |
| Quick run command | `cd packages/app && npm test` |
| Full suite command | `cd packages/app && npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TREA-01 | Vault status renders principal/yield balances | unit | `cd packages/app && npx vitest run src/__tests__/treasury-page.test.tsx -t "vault status"` | -- Wave 0 |
| TREA-02 | Donut chart renders with correct proportions | unit | `cd packages/app && npx vitest run src/__tests__/donut-chart.test.tsx` | -- Wave 0 |
| TREA-03 | Deposit form submits to MCP bridge | unit | `cd packages/app && npx vitest run src/__tests__/treasury-forms.test.tsx -t "deposit"` | -- Wave 0 |
| TREA-04 | Withdraw form submits to MCP bridge | unit | `cd packages/app && npx vitest run src/__tests__/treasury-forms.test.tsx -t "withdraw"` | -- Wave 0 |
| TREA-05 | Oracle rate displays formatted value | unit | `cd packages/app && npx vitest run src/__tests__/treasury-page.test.tsx -t "oracle rate"` | -- Wave 0 |
| DELG-01 | Delegation list renders cards and table | unit | `cd packages/app && npx vitest run src/__tests__/delegations-page.test.tsx -t "list"` | -- Wave 0 |
| DELG-02 | Create delegation form validates and submits | unit | `cd packages/app && npx vitest run src/__tests__/delegation-forms.test.tsx -t "create"` | -- Wave 0 |
| DELG-03 | Redeem delegation form submits with calldata | unit | `cd packages/app && npx vitest run src/__tests__/delegation-forms.test.tsx -t "redeem"` | -- Wave 0 |
| STAK-01 | APR hero displays formatted percentage | unit | `cd packages/app && npx vitest run src/__tests__/staking-page.test.tsx -t "apr"` | -- Wave 0 |
| STAK-02 | Position card shows wstETH and stETH balances | unit | `cd packages/app && npx vitest run src/__tests__/staking-page.test.tsx -t "position"` | -- Wave 0 |
| STAK-03 | Health report card renders score and metrics | unit | `cd packages/app && npx vitest run src/__tests__/staking-page.test.tsx -t "health"` | -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cd packages/app && npm test`
- **Per wave merge:** `cd packages/app && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/treasury-page.test.tsx` -- covers TREA-01, TREA-05
- [ ] `src/__tests__/donut-chart.test.tsx` -- covers TREA-02
- [ ] `src/__tests__/treasury-forms.test.tsx` -- covers TREA-03, TREA-04
- [ ] `src/__tests__/staking-page.test.tsx` -- covers STAK-01, STAK-02, STAK-03
- [ ] `src/__tests__/delegations-page.test.tsx` -- covers DELG-01
- [ ] `src/__tests__/delegation-forms.test.tsx` -- covers DELG-02, DELG-03
- [ ] Test mocks for wagmi hooks (`useReadContract`) and fetch (MCP bridge)

## Sources

### Primary (HIGH confidence)
- Project codebase: `packages/mcp-server/src/tools/treasury.ts` -- Treasury ABI, contract functions, dry-run patterns
- Project codebase: `packages/mcp-server/src/tools/lido.ts` -- Lido ABIs, L1 addresses, APR fetch pattern, balance read pattern
- Project codebase: `packages/mcp-server/src/tools/delegation.ts` -- Delegation tool structure, in-memory store, ERC-7710 patterns
- Project codebase: `packages/mcp-server/src/bridge.ts` -- Bridge registry, tool handler type, existing treasury handlers
- Project codebase: `packages/app/src/providers/app-provider.tsx` -- useApp hook, demo mode detection, activeAddress pattern
- Project codebase: `packages/app/src/lib/wagmi-config.ts` -- Base chain only, getDefaultConfig
- Project codebase: `packages/app/src/app/globals.css` -- All CSS variables, design tokens, chart colors

### Secondary (MEDIUM confidence)
- `.planning/phases/02-dashboard-pages/02-UI-SPEC.md` -- Component inventory, page layouts, interaction patterns, copywriting
- `.planning/phases/02-dashboard-pages/02-CONTEXT.md` -- Locked design decisions, data fetching strategy

### Tertiary (LOW confidence)
- Lido API (`https://eth-api.lido.fi/v1/protocol/steth/apr/last`) -- Endpoint structure assumed from MCP tool code; needs runtime validation
- CoinGecko free API for USD pricing -- Standard public API, but rate limits and availability not verified

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all packages already installed, versions verified from package.json and npm registry
- Architecture: HIGH -- patterns derived from existing codebase (bridge, wagmi config, app provider)
- Pitfalls: HIGH -- identified from actual code analysis (missing bridge handlers, L1 chain config, BigInt serialization)
- Donut chart: MEDIUM -- SVG approach is standard but specific stroke-dash math needs testing
- Delegation data flow: MEDIUM -- in-memory store limitation confirmed; recommended workaround is reasonable for hackathon

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable stack, project-specific)
