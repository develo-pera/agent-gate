# Architecture

**Analysis Date:** 2026-03-19

## Pattern Overview

**Overall:** Agent-to-agent DeFi infrastructure using the Model Context Protocol (MCP) combined with Solidity primitives.

**Key Characteristics:**
- Tool-based MCP server exposing DeFi operations as agent-callable functions
- Monorepo structure with TypeScript MCP server and Solidity smart contract layers
- Separation of concerns: transaction simulation (dry-run), read-only operations, and on-chain execution
- Multi-chain awareness (L1 Ethereum + Base mainnet) with dual RPC clients
- Off-chain yield calculation with on-chain enforcement

## Layers

**Application Layer (MCP Tools):**
- Purpose: Expose DeFi operations as callable tools for AI agents via the Model Context Protocol
- Location: `packages/mcp-server/src/tools/`
- Contains: Six tool modules (Lido, Treasury, Delegation, ENS, Monitor, Uniswap) each registering 1-7 tools
- Depends on: Viem clients, SDKs (Lido, MetaMask Smart Accounts), shared AgentGateContext
- Used by: MCP consumers (Claude Code, OpenClaw, other agents)

**Client Abstraction Layer:**
- Purpose: Provide unified RPC client interface for reading state and sending transactions
- Location: `packages/mcp-server/src/index.ts` (lines 24-44)
- Contains: `publicClient` (Base L2), `l1PublicClient` (L1 Ethereum), `walletClient` (optional signer)
- Depends on: Viem createPublicClient, createWalletClient
- Used by: All tool modules via shared `AgentGateContext`

**Smart Contract Layer:**
- Purpose: Enforce yield-only spending restrictions and authorization logic on-chain
- Location: `packages/treasury-contract/contracts/AgentTreasury.sol`
- Contains: Vault struct with principal/yield separation, spender authorization mappings
- Depends on: OpenZeppelin SafeERC20, ReentrancyGuard
- Used by: treasury_* tools and authorized spenders

**Configuration & Context:**
- Purpose: Centralize environment, chain selection, and wallet state
- Location: `packages/mcp-server/src/index.ts` (lines 16-63)
- Contains: AgentGateContext interface with publicClient, walletClient, chain, dryRun
- Depends on: Environment variables (RPC_URL, L1_RPC_URL, PRIVATE_KEY, DRY_RUN)
- Used by: All tool registration functions

## Data Flow

**Read-Only Flow (lido_get_apr):**
1. Agent calls `lido_get_apr` tool via MCP
2. Tool fetches L1 Ethereum state (stETH total pooled, total shares) via `l1PublicClient.readContract()`
3. Tool fetches off-chain APR data from Lido API
4. Tool formats and returns estimated exchange rate to agent

**Deposit → Spend Flow (treasury_deposit + treasury_withdraw_yield):**
1. Agent calls `treasury_deposit` with amount and optional `dry_run=true`
2. If dry_run: return simulation without sending transaction
3. If live: sign and broadcast deposit transaction via `walletClient.writeContract()`
4. Principal is locked in `vault.principalWstETH`, separated from `vault.yieldWstETH`
5. Agent later calls `treasury_withdraw_yield` to spend only accrued yield
6. Contract enforces: `yieldWstETH >= requested_amount` to prevent principal spending

**Delegation Flow (delegate_create → delegate_redeem):**
1. Agent A calls `delegate_create` with delegation scope (erc20TransferAmount, max_amount)
2. MetaMask Smart Account (ERC-4337) created for delegator if not exists
3. ERC-7710 delegation signed off-chain with scope and caveats
4. Delegation stored in memory-backed store with ID
5. Agent B calls `delegate_redeem(delegation_id)` with target contract + calldata
6. DelegationManager contract validates caveats and executes on behalf of delegator
7. Agent B can redeem only within scope (e.g., max transfer amount)

**State Management:**
- **Read-only state:** L1 stETH exchange rates, L1 Ethereum state
- **User state on Base:** AgentTreasury vault mappings (principal, yield, spender auths)
- **Session state:** Delegation store (in-memory; lost on server restart)
- **Wallet state:** Private key loaded from PRIVATE_KEY env var at startup

## Key Abstractions

**AgentGateContext:**
- Purpose: Shared context injected into all tool registration functions
- Examples: Lines 47-63 in `packages/mcp-server/src/index.ts`
- Pattern: Passed as `ctx` parameter to `registerLidoTools()`, `registerTreasuryTools()`, etc.
- Contains: publicClient, walletClient, walletAccount, dryRun flag, chain reference

**Dry-Run Pattern:**
- Purpose: Allow agents to simulate transactions before executing
- Examples: `lido_stake` (lines 143-158), `treasury_deposit` (lines 108-120)
- Pattern: Each tool accepts optional `dry_run` parameter; if true, return JSON simulation instead of tx hash
- Usage: Agents use dry_run to estimate outcomes before committing

**Tool Registration Functions:**
- Purpose: Modular tool organization; each domain (Lido, Treasury, Delegation) owns its tools
- Examples: `registerLidoTools()` (6 tools), `registerTreasuryTools()` (5 tools)
- Pattern: Each function imports MCP server instance and context, calls `server.tool()` to register
- Location: `packages/mcp-server/src/tools/*.ts`

**MCP Resources:**
- Purpose: Provide static data (contract addresses, APR data) agents can reference
- Examples: `lido://contracts` (line 81), `lido://apr` (line 106)
- Pattern: Registered via `server.resource()` and fetched via agent's resource API
- Usage: Agents query resources to get current contract addresses or APR without calling tools

## Entry Points

**MCP Server:**
- Location: `packages/mcp-server/src/index.ts` (main entry point)
- Triggers: `npm start` or `tsx watch src/index.ts` (dev)
- Responsibilities:
  - Initialize Viem clients (Base L2 + L1 Ethereum)
  - Load wallet if PRIVATE_KEY provided
  - Create MCP server instance
  - Register all tool groups
  - Connect to stdio transport and start listening
- Log output: Sends server startup messages to stderr

**AgentTreasury Contract:**
- Location: `packages/treasury-contract/contracts/AgentTreasury.sol`
- Triggers: `deposit()` call from agent with wstETH approval
- Responsibilities:
  - Accept wstETH deposits and track principal
  - Accept yield additions via `addYield()`
  - Enforce yield-only spending for authorized spenders
  - Protect principal via vault separation

**Forge Tests:**
- Location: `packages/treasury-contract/test/`
- Triggers: `forge test -vvv` command
- Responsibilities: Validate vault operations, spender authorization, yield enforcement

## Error Handling

**Strategy:** Tool-level error handling with consistent JSON error responses.

**Patterns:**
- Contract not deployed: Return error JSON with helpful message (treasury_status, line 253-259)
- Authorization failure: Throw custom Solidity error (NotAuthorized) caught by tool
- Missing wallet: Return isError=true with JSON explaining missing PRIVATE_KEY (lines 47, 124)
- Network/API errors: Try-catch with graceful fallback (lido_governance, lines 430-540)
- Invalid delegation: Return error JSON with list of available delegations (delegate_redeem, lines 258-271)

## Cross-Cutting Concerns

**Logging:**
- Server startup and chain info logged to stderr (index.ts, lines 137-140)
- Transaction outcomes logged implicitly via transaction receipts

**Validation:**
- Zod schema validation on all tool inputs (e.g., delegation.ts lines 109-116)
- Contract-side validation for amount > 0 and authorization checks

**Authentication:**
- Wallet authentication via PRIVATE_KEY environment variable
- On-chain authorization via AgentTreasury.authorizedSpenders mapping
- ERC-7710 delegation signature validation via DelegationManager

**Chain Handling:**
- Base mainnet hardcoded as primary chain (index.ts, line 17)
- L1 Ethereum RPC used only for stETH reads (wstETH exchange rate)
- Tools detect if operation unavailable on current chain and provide guidance

---

*Architecture analysis: 2026-03-19*
