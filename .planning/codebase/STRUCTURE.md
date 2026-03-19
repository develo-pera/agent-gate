# Codebase Structure

**Analysis Date:** 2026-03-19

## Directory Layout

```
agent-gate/
├── packages/
│   ├── mcp-server/                 # TypeScript MCP server
│   │   ├── src/
│   │   │   ├── index.ts            # Entry point, client setup, server init
│   │   │   └── tools/              # Tool modules
│   │   │       ├── lido.ts         # Lido stETH/wstETH operations (6 tools)
│   │   │       ├── treasury.ts     # AgentTreasury vault operations (5 tools)
│   │   │       ├── delegation.ts   # MetaMask delegation management (5 tools)
│   │   │       ├── ens.ts          # ENS name resolution (2 tools)
│   │   │       ├── monitor.ts      # Vault health monitoring (1 tool)
│   │   │       └── uniswap.ts      # (placeholder for swap tools)
│   │   ├── dist/                   # Compiled output (generated)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── README.md
│   │
│   └── treasury-contract/          # Solidity smart contract
│       ├── contracts/
│       │   └── AgentTreasury.sol   # Yield-only vault with authorization
│       ├── test/
│       │   └── AgentTreasury.t.sol # Forge tests
│       ├── foundry.toml            # Forge configuration
│       ├── lib/                    # External dependencies (forge-std, OpenZeppelin)
│       ├── out/                    # Compiled artifacts (generated)
│       └── scripts/                # Deployment scripts
│
├── .planning/
│   └── codebase/                   # GSD codebase mapping (this file location)
│
├── docs/
│   └── SKILL.md                    # Agent-consumable skill file
│
├── .env                            # Environment variables (git-ignored)
├── .env.example                    # Example env template
├── package.json                    # Root workspace manifest
├── README.md                        # Project overview
├── test-e2e.mjs                    # End-to-end test runner
└── BOUNTIES-TODO.md               # Hackathon bounty checklist
```

## Directory Purposes

**packages/mcp-server/:**
- Purpose: TypeScript-based MCP server exposing DeFi tools for agents
- Contains: Tool implementations, client setup, server initialization
- Key files: `src/index.ts` (main), `src/tools/*.ts` (6 tool modules)
- Built to: `dist/` via `tsc` (TypeScript compiler)

**packages/mcp-server/src/tools/:**
- Purpose: Modular tool implementations; one file per DeFi domain
- Contains: Tool registration functions and handler logic
- Pattern: Each file exports `register[Domain]Tools(server, ctx)` function
- Organization: Lido (6 tools), Treasury (5 tools), Delegation (5 tools), ENS (2 tools), Monitor (1 tool)

**packages/treasury-contract/:**
- Purpose: Solidity smart contract for yield-only treasury with authorization
- Contains: Contract source, tests, and deployment artifacts
- Build system: Foundry (forge)
- Output: `out/` directory with compiled JSON artifacts

**packages/treasury-contract/test/:**
- Purpose: Forge test suite for AgentTreasury
- File: `AgentTreasury.t.sol`
- Contains: Unit tests for deposit, withdrawal, authorization, and yield enforcement
- Run: `forge test -vvv` from root or `npm run test:contracts`

## Key File Locations

**Entry Points:**
- `packages/mcp-server/src/index.ts`: MCP server startup; initializes clients, registers tools
- `packages/mcp-server/package.json` scripts: `build` (tsc), `start` (node), `dev` (tsx watch)

**Configuration:**
- `packages/mcp-server/tsconfig.json`: TypeScript compiler options (ES2022, strict mode)
- `packages/treasury-contract/foundry.toml`: Forge settings (solc 0.8.24, optimizer)
- `.env`: Runtime environment variables (RPC_URL, PRIVATE_KEY, DRY_RUN) — git-ignored

**Core Logic:**
- `packages/mcp-server/src/index.ts` (lines 47-63): AgentGateContext interface and instantiation
- `packages/mcp-server/src/tools/treasury.ts` (lines 92-504): Treasury vault operations
- `packages/treasury-contract/contracts/AgentTreasury.sol` (lines 26-216): Smart contract logic
- `packages/mcp-server/src/tools/delegation.ts` (lines 32-463): ERC-7710 delegation handling

**Testing:**
- `packages/treasury-contract/test/AgentTreasury.t.sol`: Forge tests
- `test-e2e.mjs`: End-to-end test runner at root
- Run: `npm run test:contracts` (Forge) or `node test-e2e.mjs` (E2E)

## Naming Conventions

**Files:**
- MCP tools: `[domain].ts` (e.g., `lido.ts`, `treasury.ts`)
- Solidity contracts: `[ContractName].sol` (e.g., `AgentTreasury.sol`)
- Tests: `[ContractName].t.sol` for Forge, `*.test.ts` or `*.spec.ts` for TypeScript (if added)
- Config files: `tsconfig.json`, `foundry.toml`, `package.json`

**Directories:**
- Source code: `src/` (TypeScript), `contracts/` (Solidity)
- Compiled output: `dist/` (TypeScript), `out/` (Solidity)
- Tests: `test/` directory
- Tools: `src/tools/` organized by domain

**Functions & Types:**
- Tool registration: `register[Domain]Tools(server, ctx)` — PascalCase with camelCase domain
- Example: `registerLidoTools()`, `registerTreasuryTools()`, `registerDelegationTools()`
- Tool names: `snake_case` in registration (e.g., `lido_stake`, `treasury_deposit`)
- Context type: `AgentGateContext` (PascalCase interface)

**Solidity:**
- Contract name: `AgentTreasury` (PascalCase)
- State variables: `camelCase` (e.g., `principalWstETH`, `yieldWstETH`)
- Public structs: `Vault` (PascalCase)
- Events: PascalCase with `ed` suffix (e.g., `Deposited`, `YieldWithdrawn`)
- Custom errors: `NotAuthorized`, `InsufficientYield` (PascalCase)

## Where to Add New Code

**New DeFi Tool (same pattern as Lido, Treasury):**
- Primary code: `packages/mcp-server/src/tools/[domain].ts`
- Implementation pattern:
  ```typescript
  export function register[Domain]Tools(server: McpServer, ctx: AgentGateContext) {
    server.tool("[tool_name]", "description", { param: z.string() }, async ({ param }) => {
      // implementation
    });
  }
  ```
- Register in: `packages/mcp-server/src/index.ts` (add import + call in line 72-78 section)
- Tests: Add to `test-e2e.mjs` or create `packages/mcp-server/src/tools/[domain].test.ts`

**New Smart Contract Feature:**
- Implementation: `packages/treasury-contract/contracts/AgentTreasury.sol`
- Add new function following existing pattern:
  - Use `nonReentrant` modifier for state-changing functions
  - Emit events for state changes
  - Use custom errors instead of require strings
  - Example: New function at `AgentTreasury.sol` lines 155+
- Tests: Add to `packages/treasury-contract/test/AgentTreasury.t.sol`
- Build: `forge build` from treasury-contract directory

**New Configuration/Constant:**
- Tool-level: Add to tool module's `const` section (e.g., Lido addresses at `lido.ts` lines 99-107)
- Server-level: Add env var reading in `packages/mcp-server/src/index.ts` lines 16-21
- Contract-level: Add to AgentTreasury.sol state or constants

**Utilities or Shared Helpers:**
- Shared across tools: Create `packages/mcp-server/src/utils/[name].ts`
- Example: Common address validation, formatting functions
- Import in tools: `import { utility } from "../utils/[name].js"`

## Special Directories

**dist/ (TypeScript output):**
- Purpose: Compiled JavaScript ready for Node.js execution
- Generated: Yes (via `npm run build` → tsc)
- Committed: No (in .gitignore)
- Location: `packages/mcp-server/dist/`

**out/ (Solidity artifacts):**
- Purpose: Compiled contract JSON ABIs and bytecode
- Generated: Yes (via `forge build`)
- Committed: No (in .gitignore)
- Location: `packages/treasury-contract/out/`

**lib/ (External dependencies):**
- Purpose: Vendored Solidity libraries
- Committed: Yes (git submodules)
- Contents: `forge-std` (Foundry testing library), `openzeppelin-contracts` (SafeERC20, ReentrancyGuard)
- Location: `packages/treasury-contract/lib/`

**node_modules/:**
- Purpose: NPM dependencies
- Generated: Yes (via `npm install`)
- Committed: No (.gitignore)

**.planning/codebase/ (this location):**
- Purpose: GSD codebase mapping documents
- Generated: Manually by GSD agent
- Committed: Yes (aids future work planning)
- Contents: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md (if quality focus), etc.

---

*Structure analysis: 2026-03-19*
