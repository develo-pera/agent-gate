# Codebase Concerns

**Analysis Date:** 2026-03-19

## Tech Debt

**In-Memory Delegation Storage:**
- Issue: Delegation storage is in-memory only, stored in a plain `Map<string, {}>` at `packages/mcp-server/src/tools/delegation.ts:24-30`
- Files: `packages/mcp-server/src/tools/delegation.ts`
- Impact: Delegations are lost when the MCP server restarts. This breaks the delegation workflow for persistent agents that rely on redeeming delegations across sessions.
- Fix approach: Implement persistent storage (database, IPFS, or contract-based registry). Store serialized delegations to a database backend and load them on server startup. Consider implementing a simple IPFS/Arweave integration for decentralized storage.

**Hardcoded Contract Addresses:**
- Issue: All external contract addresses are hardcoded in tool files rather than configurable via environment variables. Examples: `packages/mcp-server/src/tools/lido.ts:99-107`, `packages/mcp-server/src/tools/uniswap.ts:13-20`, `packages/mcp-server/src/tools/monitor.ts:28`
- Files: `packages/mcp-server/src/tools/lido.ts`, `packages/mcp-server/src/tools/uniswap.ts`, `packages/mcp-server/src/tools/monitor.ts`
- Impact: Cannot easily deploy to different networks or use different token pools. Requires code modification to support new addresses or chains.
- Fix approach: Move all address constants to environment variables with defaults. Create a `.env.example` with all required addresses. Document per-chain configuration.

**ABI Duplication & Maintenance:**
- Issue: Contract ABIs are duplicated inline in multiple tool files (`packages/mcp-server/src/tools/lido.ts:7-95`, `packages/mcp-server/src/tools/treasury.ts:8-90`, `packages/mcp-server/src/tools/monitor.ts:9-24`) instead of being imported from a shared module
- Files: `packages/mcp-server/src/tools/lido.ts`, `packages/mcp-server/src/tools/treasury.ts`, `packages/mcp-server/src/tools/monitor.ts`
- Impact: If a contract ABI changes, multiple files must be updated. Risk of inconsistency. Makes the codebase harder to maintain.
- Fix approach: Extract all ABIs to `packages/mcp-server/src/abis/` directory as separate files. Import ABIs as needed. Use type generation from `viem` to ensure type safety.

**Manual Token Decimals Management:**
- Issue: Token decimals are hardcoded in `packages/mcp-server/src/tools/uniswap.ts:13-20` and rely on caller passing `token_decimals` parameter
- Files: `packages/mcp-server/src/tools/uniswap.ts`
- Impact: Risk of off-by-one errors in amount calculations. Agents must remember correct decimals for custom tokens or face silent errors.
- Fix approach: Query token decimals on-chain via ERC20 `decimals()` function when not in the well-known registry. Cache results.

## Known Bugs

**Snapshot Governance Vote Signature Vulnerability:**
- Symptoms: The `lido_governance_vote` tool at `packages/mcp-server/src/tools/lido.ts:545-685` constructs EIP-712 vote messages without validating the proposal exists or is active. An agent could sign a vote for a non-existent or expired proposal.
- Files: `packages/mcp-server/src/tools/lido.ts:615-626`
- Trigger: Call `lido_governance_vote` with an invalid `proposal_id` and the tool will still sign and submit
- Workaround: Validate the proposal exists in `lido_governance` output before voting

**Silent Fallthrough on Aragon API Failure:**
- Symptoms: Lido governance data is incomplete when Aragon API is unavailable. The tool returns Snapshot data only without indicating that on-chain votes are missing.
- Files: `packages/mcp-server/src/tools/lido.ts:471-483`
- Trigger: Aragon voting API is down or returns non-200 status
- Workaround: Always check the `aragon_votes` field — if it contains the disclaimer string, on-chain votes were not available

**Treasury Contract Initialization Without Vault Check:**
- Symptoms: Calling `withdrawYield()` on a vault that doesn't exist reverts with `NoVault` error instead of providing a helpful message in the tool
- Files: `packages/mcp-server/src/tools/treasury.ts:112-126`
- Trigger: Call `treasury_withdraw_yield` before calling `treasury_deposit` on the same address
- Workaround: Always call `treasury_status` first to verify the vault exists

**Stale Lido APR Data in Monitor Tool:**
- Symptoms: The `vault_health` tool uses a hardcoded benchmark APR (3.5%) that may not reflect current network conditions if the Lido API fetch fails silently
- Files: `packages/mcp-server/src/tools/monitor.ts:52-57`
- Trigger: Lido API endpoint is down or rate-limited
- Workaround: Tool logs a message on fetch failure but still returns the hardcoded baseline. Agents should cross-check APR independently.

## Security Considerations

**Private Key Exposure Risk:**
- Risk: The `PRIVATE_KEY` environment variable is used directly in multiple tools without key rotation or encryption. The private key is loaded into memory and used for signing. If the MCP server process is compromised, the key is exposed.
- Files: `packages/mcp-server/src/index.ts:20`, `packages/mcp-server/src/tools/delegation.ts:122-127`, `packages/mcp-server/src/tools/lido.ts:628-634`, `packages/mcp-server/src/tools/uniswap.ts:252`
- Current mitigation: Keys are only kept in process memory. No logging of keys. No key export.
- Recommendations:
  1. Implement key management best practices: use a secure key vault (AWS KMS, HashiCorp Vault) instead of env vars for production
  2. Rotate keys regularly
  3. Restrict private key permissions on the system
  4. Never log or export the private key
  5. Consider implementing a timelock or approval pattern for sensitive operations

**No Slippage Protection on Uniswap Swaps:**
- Risk: The `uniswap_swap` tool accepts a `slippage_bps` parameter but doesn't validate it before submission. An agent could inadvertently set very high slippage (e.g., 5000 bps = 50% slippage) and lose funds to MEV/sandwich attacks.
- Files: `packages/mcp-server/src/tools/uniswap.ts:177-315`
- Current mitigation: Default slippage is 50 bps (0.5%), reasonable for most swaps
- Recommendations:
  1. Implement a hard maximum slippage limit (e.g., 500 bps = 5%)
  2. Warn agents if they request slippage above a threshold
  3. Implement MEV protection (e.g., use MEV blockers or batch auctions)
  4. Log all swap parameters for audit trail

**Missing Authorization for Delegation Revocation:**
- Risk: The `delegate_revoke` tool revokes delegations stored in memory without verifying that the caller is the delegator (the original key holder). An agent could revoke another agent's delegation if it knows the delegation ID.
- Files: `packages/mcp-server/src/tools/delegation.ts:383-462`
- Current mitigation: Delegations are stored in a Map, not on-chain, so revocation is local only
- Recommendations:
  1. Verify that `msg.sender` (wallet account) matches the `from` address in the delegation before revoking
  2. Consider moving delegations to on-chain storage where the DelegationManager enforces access control
  3. Implement a delegation ownership check

**No Rate Limiting on External API Calls:**
- Risk: Tools make unlimited external API calls (Lido APR API, Snapshot GraphQL, Uniswap Trading API) without rate limiting. An agent could be rate-limited or cause service disruptions.
- Files: `packages/mcp-server/src/tools/lido.ts:273`, `packages/mcp-server/src/tools/lido.ts:462`, `packages/mcp-server/src/tools/uniswap.ts:40-56`, `packages/mcp-server/src/tools/monitor.ts:54`
- Current mitigation: None
- Recommendations:
  1. Implement request queuing and exponential backoff
  2. Cache API responses with reasonable TTLs
  3. Add request budgets per agent/session
  4. Gracefully handle 429 (rate limit) responses

**Permit2 Signature Reuse Risk:**
- Risk: The `uniswap_swap` tool signs Permit2 data without nonce validation, which could allow replay attacks if the same signed data is submitted multiple times.
- Files: `packages/mcp-server/src/tools/uniswap.ts:248-259`
- Current mitigation: Uniswap's Trading API likely includes nonce in the permit data, but this is not explicitly verified
- Recommendations:
  1. Verify that permit data includes a nonce field before signing
  2. Track signed nonces to prevent reuse
  3. Document the security assumptions of Permit2 for agents

## Performance Bottlenecks

**Sequential Blockchain Calls in vault_health:**
- Problem: The `vault_health` tool makes multiple sequential calls to fetch wstETH exchange rate, APR data, wstETH balance, and stETH balance. The API fetch for APR is blocking and could timeout.
- Files: `packages/mcp-server/src/tools/monitor.ts:43-84`
- Cause: RPC calls are awaited sequentially. External API call (Lido APR API) blocks the entire response.
- Improvement path: Parallelize RPC calls with `Promise.all()`. Run APR fetch in parallel with contract reads. Implement a timeout for the APR fetch with fallback to benchmark.

**Lido Governance Proposal Fetching is Unbounded:**
- Problem: The `lido_governance` tool fetches `proposalLimit` proposals (default 5) but doesn't cache results. Every call re-fetches from Snapshot GraphQL.
- Files: `packages/mcp-server/src/tools/lido.ts:426-543`
- Cause: No caching layer for governance data
- Improvement path: Cache governance proposals for 1-5 minutes. Implement cache invalidation on manual refresh. Consider using a lighter index service instead of full GraphQL.

**No Connection Pooling for RPC Calls:**
- Problem: The `publicClient` and `l1PublicClient` are created once at startup (`packages/mcp-server/src/index.ts:24-33`), which is good, but there's no connection pooling or request batching for high-volume scenarios.
- Files: `packages/mcp-server/src/index.ts:24-33`
- Cause: Viem's HTTP transport may create a new connection per request
- Improvement path: Use viem's built-in batching or implement manual batching of RPC calls. Monitor RPC request rates during load testing.

## Fragile Areas

**Delegation Creation Without Smart Account Balance Check:**
- Files: `packages/mcp-server/src/tools/delegation.ts:161-170`
- Why fragile: Creating a MetaMask Smart Account requires deployment, which costs gas. If the signer has insufficient balance, the tool silently fails without checking gas balance beforehand.
- Safe modification: Before creating a smart account, check if the smart account is already deployed. Query signer balance and estimate deployment cost. Return a helpful error if insufficient balance.
- Test coverage: No tests for insufficient gas scenarios

**Treasury Contract Yield Accounting Without Timestamp/Block Tracking:**
- Files: `packages/treasury-contract/contracts/AgentTreasury.sol:93-103`
- Why fragile: The `addYield()` function trusts the caller to calculate and inject the correct yield amount. There's no record of when yield was accrued or which block it corresponds to, making it hard to audit or detect errors.
- Safe modification: Add an optional `yieldDate` or `blockHeight` field to track when yield was earned. Emit richer events with timestamp. Implement yield reconciliation checks.
- Test coverage: Tests exist but don't cover long-term yield tracking scenarios

**Uniswap Quote Response Parsing Without Type Safety:**
- Files: `packages/mcp-server/src/tools/uniswap.ts:124-155`, `packages/mcp-server/src/tools/uniswap.ts:228-270`
- Why fragile: The code accesses `quoteResponse.quote?.amountOut` and other fields without validating the response schema. If Uniswap API changes, the tool breaks silently.
- Safe modification: Use Zod to validate the quote response schema. Implement a mock Uniswap API client for testing. Add integration tests against the real API.
- Test coverage: No tests for Uniswap API interactions

**Snapshot EIP-712 Message Construction With Hardcoded Domain Version:**
- Files: `packages/mcp-server/src/tools/lido.ts:597-626`
- Why fragile: The EIP-712 domain version is hardcoded as `"0.1.4"` and may be outdated if Snapshot changes their signing scheme.
- Safe modification: Fetch the current Snapshot domain version from their API or documentation. Validate against known versions. Warn if a mismatch is detected.
- Test coverage: No tests for EIP-712 signing with Snapshot

## Scaling Limits

**In-Memory Delegation Store Size:**
- Current capacity: Unbounded `Map` can grow to millions of entries
- Limit: Node.js process memory (~512MB to 4GB per instance)
- Scaling path: With ~1KB per delegation entry, the server can handle ~500K delegations before memory pressure. For production, migrate to persistent storage (database) immediately.

**Single RPC Endpoint per Chain:**
- Current capacity: Default RPC endpoints are rate-limited (often 100-200 req/s)
- Limit: When multiple agents query simultaneously, rate limits are hit
- Scaling path: Implement RPC endpoint failover. Use a service like QuickNode, Alchemy, or Infura for higher rate limits. Implement request batching and caching.

**Uniswap API Key Rate Limits:**
- Current capacity: Uniswap Trading API has rate limits per API key (not documented in code)
- Limit: Unknown, but likely 100s of requests per second
- Scaling path: Request higher tier API key from Uniswap. Implement request budgeting per agent. Use quote caching to reduce API calls.

## Dependencies at Risk

**@metamask/smart-accounts-kit Version Pinning:**
- Risk: Dependency on version `^0.3.0` with potentially breaking changes in future versions. The ERC-4337 spec is still evolving.
- Impact: Future updates may break delegation workflows or smart account creation
- Migration plan: Lock to specific version. Monitor GitHub releases. Test breaking changes before updating.

**viem Library Major Version Risk:**
- Risk: Dependency on `^2.23.0` of viem. Major version bumps could introduce breaking changes to the SDK API.
- Impact: Tool code may fail if viem introduces incompatible changes
- Migration plan: Use a version lock strategy. Test viem updates in CI before deploying.

**Lido API Stability:**
- Risk: Lido APR and rewards APIs (`https://eth-api.lido.fi`) are external services with no SLA. If they become unavailable, yield tracking breaks.
- Impact: `lido_get_apr`, `lido_rewards`, and `vault_health` tools will fail
- Migration plan: Implement fallback to on-chain data sources (subgraphs, alternative providers). Cache APR data locally with a longer TTL.

**Snapshot Governance API Changes:**
- Risk: Snapshot GraphQL API is external and may change schema or deprecate endpoints without notice
- Impact: `lido_governance` and `lido_governance_vote` tools may break
- Migration plan: Implement schema validation on API responses. Use a snapshot subgraph as a fallback data source.

## Missing Critical Features

**No Dry-Run Validation for Transaction Outcomes:**
- Problem: Dry-run modes preview transactions but don't actually simulate them on-chain. An agent could call `treasury_withdraw_yield` in dry-run, see success, then fail when executed due to a front-run that drained the yield pool.
- Blocks: Agents cannot confidently predict transaction outcomes
- Fix: Implement `eth_call` simulation for all state-changing operations. Return simulated gas usage and actual output in dry-run mode.

**No Multi-Signature Support for Delegations:**
- Problem: Delegations are signed by a single private key. Multi-sig agents cannot use the delegation system without a shared private key (which is a security risk).
- Blocks: Enterprise agents cannot use delegations safely
- Fix: Implement ERC-1271 smart contract signature support. Allow delegations to be signed by any wallet type (EOA, smart contract, multi-sig).

**No Delegation Scope Visualization:**
- Problem: When an agent receives a delegation, there's no easy way to inspect what scopes/permissions the delegation grants before redeeming.
- Blocks: Agents accept delegations blindly and may accidentally overspend
- Fix: Implement a `delegation_inspect` tool that decodes and displays delegation scopes in human-readable format.

**No Yield Compounding Strategy:**
- Problem: The Treasury contract supports manual yield injection but has no automatic compounding. Agents must manually call `addYield` periodically.
- Blocks: Agents cannot achieve true passive yield accumulation
- Fix: Implement a keeper pattern (external bot) that automatically compounds yield. Or implement a strategy registry for auto-rebalancing.

**No Cross-Chain Bridge Support:**
- Problem: All tools are hardcoded to Base mainnet only. No support for bridging wstETH from L1 or using stETH on other chains.
- Blocks: Multi-chain agents cannot utilize their assets across chains
- Fix: Implement bridge abstraction for wstETH (Lido Bridge, Across, Stargate). Support Arbitrum, Optimism, and other chains.

## Test Coverage Gaps

**Uniswap API Integration Untested:**
- What's not tested: Quote parsing, permit2 signature generation, swap execution paths
- Files: `packages/mcp-server/src/tools/uniswap.ts`
- Risk: Uniswap API response format changes could silently break swaps
- Priority: High - swaps involve real token transfers

**Snapshot Governance Voting Untested:**
- What's not tested: EIP-712 signature generation, Snapshot API response parsing, vote submission
- Files: `packages/mcp-server/src/tools/lido.ts:545-685`
- Risk: Signature format mismatches or API changes could prevent voting
- Priority: High - voting involves governance participation

**Delegation Redeem Path Untested:**
- What's not tested: DelegationManager contract interaction, execution mode encoding, caveat enforcement
- Files: `packages/mcp-server/src/tools/delegation.ts:243-352`
- Risk: Delegations may fail to redeem due to caveat validation failures
- Priority: High - delegations are core to agent authorization

**Cross-Chain Lido Reads Untested:**
- What's not tested: L1 Ethereum client is used but never tested. Exchange rate calculations, balance queries, reward history parsing.
- Files: `packages/mcp-server/src/tools/lido.ts:128-379`, `packages/mcp-server/src/index.ts:30-33`
- Risk: L1 RPC failures or endpoint issues could cascade through tools
- Priority: Medium - affects yield calculation accuracy

**Treasury Contract Spender Authorization Untested in MCP:**
- What's not tested: The `treasury_authorize_spender` tool is implemented but no end-to-end test verifies authorization flows between agents
- Files: `packages/mcp-server/src/tools/treasury.ts:447-503`
- Risk: Authorization state may be inconsistent between on-chain and tool expectations
- Priority: Medium - affects multi-agent treasury workflows

---

*Concerns audit: 2026-03-19*
