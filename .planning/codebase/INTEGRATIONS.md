# External Integrations

**Analysis Date:** 2026-03-19

## APIs & External Services

**Lido Protocol:**
- Lido stETH/wstETH staking operations via `@lidofinance/lido-ethereum-sdk`
  - SDK/Client: `@lidofinance/lido-ethereum-sdk` ^4.1.0
  - Used in: `packages/mcp-server/src/tools/lido.ts`
  - Operations: deposit stETH, wrap/unwrap, balance queries, protocol stats

- Lido APR API - retrieves current staking APR
  - Endpoint: `https://eth-api.lido.fi/v1/protocol/steth/apr/last`
  - Used in: `packages/mcp-server/src/index.ts` (resource) and `packages/mcp-server/src/tools/monitor.ts`
  - Returns: JSON with APR data, used for yield tracking on Base wstETH

- Snapshot Governance - voting and proposal submission
  - GraphQL API: `https://hub.snapshot.org/graphql`
  - Proposal submission: `https://seq.snapshot.org` (HTTP POST)
  - Used in: `packages/mcp-server/src/tools/lido.ts`
  - Purpose: Query Lido governance proposals and submit signed votes

**Uniswap:**
- Uniswap Trading API - swap quotes and routing
  - SDK/Client: HTTP REST API via `fetch()`
  - Base URL: `https://trading-api.gateway.uniswap.org/v1`
  - Auth: `UNISWAP_API_KEY` environment variable (header `x-api-key`)
  - Endpoints: `/quote` (GET pricing), `/swap` (POST execution)
  - Used in: `packages/mcp-server/src/tools/uniswap.ts`
  - Purpose: Token swaps and price quotes on Base mainnet
  - Supports: WETH, USDC, DAI, wstETH, cbETH token pairs

**Ethereum RPC:**
- Base Mainnet RPC
  - Default: `https://mainnet.base.org`
  - Configurable: `RPC_URL` environment variable
  - Client: viem `createPublicClient()` and `createWalletClient()`
  - Used throughout MCP server for contract reads and transaction submission

- L1 Ethereum RPC (for Lido stETH reads)
  - Default: `https://eth.llamarpc.com` (free, rate-limited)
  - Configurable: `L1_RPC_URL` environment variable
  - Client: viem `createPublicClient(chain: mainnet)`
  - Used in: Lido tools for stETH balance/share queries (stETH only exists on L1)
  - Essential for: Exchange rate calculations, protocol state queries

## Data Storage

**Databases:**
- None — stateless MCP server
- In-memory storage only: delegation signatures stored in Map (not persistent)
- Location: `packages/mcp-server/src/tools/delegation.ts` (line 24-30)

**File Storage:**
- Local filesystem only - `.env` and environment config
- No persistent data layer (Solidity contracts manage on-chain state)

**Caching:**
- None configured - all reads are fresh RPC calls

## Authentication & Identity

**Auth Provider:**
- Custom private key-based authentication
  - Private key source: `PRIVATE_KEY` environment variable
  - Accounts generated via viem `privateKeyToAccount()`
  - Used for: transaction signing, smart account creation, delegation

**ENS Integration:**
- ENS name resolution and reverse resolution
  - SDK: viem built-in ENS utilities
  - Used in: `packages/mcp-server/src/tools/ens.ts`
  - Functions: resolve ENS names to addresses, reverse-resolve addresses to ENS names
  - Avatar and description metadata fetching supported

**Smart Account (ERC-4337):**
- MetaMask Smart Accounts Kit
  - SDK: `@metamask/smart-accounts-kit` ^0.3.0
  - Implementation: Hybrid smart accounts
  - Used in: `packages/mcp-server/src/tools/delegation.ts`
  - Purpose: ERC-4337 account abstraction for delegation and execution

## Monitoring & Observability

**Error Tracking:**
- None detected - errors logged to console via `console.error()`
- Location: MCP server startup logging in `packages/mcp-server/src/index.ts` (line 137-140)

**Logs:**
- Console-based: Server startup info (chain name, dry-run mode, wallet status)
- No structured logging framework

## CI/CD & Deployment

**Hosting:**
- Not detected - MCP server designed to run as stdio process

**CI Pipeline:**
- Not detected - no GitHub Actions or CI config found

## Environment Configuration

**Required env vars:**
- `TREASURY_ADDRESS` - AgentTreasury contract deployment address on Base (required for treasury tools)
  - Default: `0x0000000000000000000000000000000000000000` if unset
  - Set in: `.env.example` line 16

**Optional env vars:**
- `RPC_URL` - Base mainnet RPC endpoint (defaults to `https://mainnet.base.org`)
- `L1_RPC_URL` - L1 Ethereum RPC endpoint (defaults to `https://eth.llamarpc.com`)
- `PRIVATE_KEY` - Private key for signing transactions (omit for read-only mode, format: `0x...`)
- `DRY_RUN` - Set to `"true"` to enable dry-run simulation mode (all writes are simulated, not executed)
- `UNISWAP_API_KEY` - Uniswap Trading API key from `https://app.uniswap.org/developers` (required for swap execution and live quotes)

**Secrets location:**
- `.env` file (local, not committed)
- Private keys and API keys stored as environment variables only (never in source code)

## Webhooks & Callbacks

**Incoming:**
- None — MCP server receives tool calls via stdio transport

**Outgoing:**
- Lido Snapshot governance votes submitted via HTTP POST to `https://seq.snapshot.org`
- No webhook subscriptions

## Smart Contract Interactions

**AgentTreasury Contract:**
- Address: Configured via `TREASURY_ADDRESS` env var
- Network: Base mainnet
- Purpose: Agent yield vault with delegation-aware authorization
- Key operations (via viem):
  - `deposit(amount)` - Deposit wstETH principal
  - `addYield(amount)` - Add yield to vault
  - `withdrawYield(recipient, amount)` - Withdraw from yield pool
  - `withdrawYieldFor(agent, recipient, amount)` - Authorized spender withdrawal
  - `authorizeSpender(spender, yieldOnly)` - Grant spending permissions
  - `getVaultStatus(agent)` - Query vault balances
- Location: `packages/mcp-server/src/tools/treasury.ts`

**Lido Token Addresses:**
- Base wstETH (bridged): `0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452`
- L1 stETH: `0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84`
- L1 wstETH: `0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0`
- L1 Withdrawal Queue: `0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1`

**Token Addresses (Base Mainnet):**
- ETH: `0x0000000000000000000000000000000000000000`
- WETH: `0x4200000000000000000000000000000000000006`
- USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- DAI: `0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb`
- cbETH: `0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22`

---

*Integration audit: 2026-03-19*
