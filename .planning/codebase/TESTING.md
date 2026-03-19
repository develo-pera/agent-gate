# Testing Patterns

**Analysis Date:** 2026-03-19

## Test Framework

**Runner:**
- Solidity: Foundry (Forge) for contract tests
- TypeScript/JavaScript: No test framework configured for MCP server
- Config: `foundry.toml` in `packages/treasury-contract/`

**Assertion Library:**
- Solidity: Forge's built-in assertions (from `forge-std/Test.sol`)
- TypeScript: No assertions library configured

**Run Commands:**
```bash
npm run test:contracts                # Run Solidity tests (Forge)
```

**Configured in package root:**
- `packages/treasury-contract/`: `forge test -vvv` (triple verbose)
- `packages/mcp-server/`: No test command configured

## Test File Organization

**Location:**
- Solidity: co-located in `packages/treasury-contract/test/`
- File naming: `*.t.sol` convention (e.g., `AgentTreasury.t.sol`)

**Structure:**
```
packages/treasury-contract/
├── contracts/
│   └── AgentTreasury.sol          # Implementation
└── test/
    └── AgentTreasury.t.sol         # Tests (co-located)
```

**TypeScript/MCP Server:**
- No test files present
- No test configuration in `packages/mcp-server/package.json`

## Test Structure

**Solidity Suite Organization:**

From `packages/treasury-contract/test/AgentTreasury.t.sol`:

```solidity
contract AgentTreasuryTest is Test {
    AgentTreasury public treasury;
    MockWstETH public wstETH;

    address agent = address(0xA1);
    address spender = address(0xB1);
    address recipient = address(0xC1);

    function setUp() public {
        wstETH = new MockWstETH();
        treasury = new AgentTreasury(address(wstETH));

        // Fund and approve in setup
        wstETH.mint(agent, 10 ether);
        vm.prank(agent);
        wstETH.approve(address(treasury), type(uint256).max);
    }

    function test_deposit() public {
        vm.prank(agent);
        treasury.deposit(1 ether);

        (uint256 principal, uint256 yield_, uint256 total, bool exists) = treasury.getVaultStatus(agent);
        assertEq(principal, 1 ether);
        assertEq(yield_, 0);
        assertEq(total, 1 ether);
        assertTrue(exists);
    }
}
```

**Patterns:**
- Test contract inherits from `Test`
- `setUp()` function runs before each test method
- Test methods: `function test_[description]() public { ... }`
- Naming uses snake_case for readability (e.g., `test_deposit`, `test_zero_deposit_reverts`)
- State variables for contracts and mock addresses defined at class level
- VM cheatcodes via `vm.*` (e.g., `vm.prank()`, `vm.expectRevert()`)

## Mocking

**Framework:** Foundry VM cheatcodes + custom mocks

**Patterns:**

Custom mock ERC20:
```solidity
contract MockWstETH is ERC20 {
    constructor() ERC20("Wrapped stETH", "wstETH") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
```

**Mocking approach:**
- Create mock contracts for external dependencies (e.g., `MockWstETH`)
- Use `vm.prank(address)` to simulate function calls from specific addresses
- Use `vm.expectRevert(selector)` to test revert conditions
- Use `type(uint256).max` for unlimited approvals in test setup

**What to Mock:**
- External ERC20 tokens (e.g., wstETH mock for testing Treasury)
- Access control: use `vm.prank()` to simulate msg.sender

**What NOT to Mock:**
- The contract under test (deploy actual instance)
- Solidity language features (let compiler handle)
- Internal contract state (test via public getters)

## Fixtures and Factories

**Test Data:**
- Mock token deployed in `setUp()`
- Mock addresses hardcoded as state variables: `address agent = address(0xA1);`
- Test balances established in `setUp()`: `wstETH.mint(agent, 10 ether);`

**Location:**
- Mock contracts defined inline in same test file as test contract
- Example: `MockWstETH` defined in `test/AgentTreasury.t.sol`

**Pattern:** Single contract inherits `Test` and defines mocks; all setup centralized in `setUp()` method

## Coverage

**Requirements:** None enforced

**View Coverage:**
```bash
cd packages/treasury-contract
forge coverage
```

(No coverage analysis configured, but Forge supports `coverage` flag)

## Test Types

**Unit Tests:**
- **Scope:** Individual function behavior within contract
- **Approach:** Test contract method with different inputs and state transitions
- **Example:** `test_deposit()` verifies balance updates correctly; `test_zero_deposit_reverts()` verifies revert condition
- **Location:** `packages/treasury-contract/test/AgentTreasury.t.sol`

**Integration Tests:**
- Not explicitly separated; would involve testing multiple contracts together
- Example: Testing Treasury interaction with external ERC20 token (covered via MockWstETH)

**E2E Tests:**
- No E2E test framework configured
- MCP server would require client simulation; not present in codebase

## Common Patterns

**Assertion Pattern (Solidity):**
```solidity
function test_deposit() public {
    vm.prank(agent);
    treasury.deposit(1 ether);

    (uint256 principal, uint256 yield_, uint256 total, bool exists) = treasury.getVaultStatus(agent);
    assertEq(principal, 1 ether);
    assertEq(yield_, 0);
}
```

**Revert Testing Pattern:**
```solidity
function test_zero_deposit_reverts() public {
    vm.prank(agent);
    vm.expectRevert(AgentTreasury.ZeroAmount.selector);
    treasury.deposit(0);
}
```

**Revert with Arguments:**
```solidity
function test_cannot_withdraw_more_than_yield() public {
    vm.prank(agent);
    treasury.deposit(1 ether);
    vm.prank(agent);
    treasury.addYield(0.01 ether);

    vm.prank(agent);
    vm.expectRevert(abi.encodeWithSelector(
        AgentTreasury.InsufficientYield.selector,
        0.02 ether,
        0.01 ether
    ));
    treasury.withdrawYield(recipient, 0.02 ether);
}
```

## TypeScript/MCP Server Testing

**Current Status:** No tests configured or present

**Patterns to implement (if added):**
- Tool input validation would use Zod schemas as test fixtures
- Dry-run mode serves as manual integration test (returns simulated output without side effects)
- API call mocking would use `jest.mock('fetch')` or similar
- Contract reading would mock Viem's `publicClient.readContract()`

**Recommended approach when testing is added:**
- Jest or Vitest for test runner
- Mock external APIs (Lido API, Uniswap API, ENS, Snapshot)
- Mock Viem clients for contract reads
- Test both dry-run and execution paths for each tool

## Test Coverage Gaps

**Solidity:**
- Coverage present for happy path (deposit, add yield, withdraw)
- Coverage for revert conditions (zero amounts, insufficient yield)
- Coverage for authorization flow (authorize spender, withdraw for spender)

**TypeScript/MCP:**
- **No tests present** for:
  - Tool parameter validation (Zod schemas)
  - Error handling in fetch/API calls
  - Contract read failures
  - Authorization logic
  - DRY_RUN flag behavior
  - All integration with Lido, ENS, Uniswap, Snapshot APIs
  - Tool registration and server initialization

---

*Testing analysis: 2026-03-19*
