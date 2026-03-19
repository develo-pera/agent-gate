# Technology Stack

**Analysis Date:** 2026-03-19

## Languages

**Primary:**
- TypeScript 5.7.0 - MCP server implementation (`packages/mcp-server/src`)
- Solidity 0.8.24 - Smart contracts (`packages/treasury-contract/contracts`)

**Secondary:**
- JavaScript/Node.js - Configuration and scripts

## Runtime

**Environment:**
- Node.js (no specific version enforced; TypeScript target ES2022)

**Package Manager:**
- npm (workspaces enabled)
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Model Context Protocol SDK (`@modelcontextprotocol/sdk` ^1.12.1) - MCP server implementation and stdio transport
- viem 2.23.0 - Ethereum/EVM interaction and client library for Base and L1 chains
- Foundry - Solidity smart contract development and testing

**Testing:**
- Foundry Test (`forge-std/Test.sol`) - Solidity contract unit tests
- No JavaScript test framework configured (test-e2e.mjs is standalone)

**Build/Dev:**
- TypeScript Compiler (tsc) - Compilation to ES2022 CommonJS modules
- tsx 4.19.0 - TypeScript execution and watch mode during development

## Key Dependencies

**Critical:**
- `@modelcontextprotocol/sdk` ^1.12.1 - Provides McpServer and StdioServerTransport for server initialization
- `viem` ^2.23.0 - Core library for blockchain interactions (chain clients, contract reads/writes, account management)
- `@lidofinance/lido-ethereum-sdk` ^4.1.0 - Lido protocol SDK for stETH/wstETH operations
- `@metamask/smart-accounts-kit` ^0.3.0 - ERC-4337 smart account creation and delegation management
- `@ensdomains/ensjs` ^4.0.2 - ENS name resolution and reverse resolution
- `zod` ^3.24.0 - Runtime schema validation for MCP tool parameters

**Infrastructure:**
- `@openzeppelin/contracts` - Solidity utilities (ReentrancyGuard, SafeERC20, ERC20 interface)
- `forge-std` - Foundry standard library for testing

## Configuration

**Environment:**
- Base mainnet (chainId 8453) — primary network
- L1 Ethereum (chainId 1) — for Lido stETH reads and protocol state
- Configuration via environment variables in `.env`
- `.env.example` documents required and optional configuration

**Build:**
- `tsconfig.json` in `packages/mcp-server/` with strict type checking enabled
- `foundry.toml` in `packages/treasury-contract/` with optimization enabled (200 runs)
- Module resolution: NodeNext for ES2022+ module support

## Platform Requirements

**Development:**
- Node.js with npm workspaces support
- Foundry installation (for contract development and testing)
- TypeScript 5.7.0+

**Production:**
- Node.js runtime (ES2022 compatible)
- Base mainnet RPC endpoint (via `RPC_URL` env var or default `https://mainnet.base.org`)
- L1 Ethereum RPC endpoint (via `L1_RPC_URL` env var or default `https://eth.llamarpc.com`)
- Private key for signing transactions (optional, enables write operations)

---

*Stack analysis: 2026-03-19*
