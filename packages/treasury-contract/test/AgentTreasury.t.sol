// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../contracts/AgentTreasury.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// ═══════════════════════════════════════════════════════════════════════
// Unit tests (mock token + mock oracle)
// ═══════════════════════════════════════════════════════════════════════

contract MockWstETH is ERC20 {
    constructor() ERC20("Wrapped stETH", "wstETH") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockPriceFeed {
    int256 public price;
    uint256 public updatedAt;

    constructor(int256 _price) {
        price = _price;
        updatedAt = block.timestamp;
    }

    function setPrice(int256 _price) external {
        price = _price;
        updatedAt = block.timestamp;
    }

    function latestRoundData() external view returns (
        uint80, int256, uint256, uint256, uint80
    ) {
        return (1, price, block.timestamp, updatedAt, 1);
    }
}

contract AgentTreasuryUnitTest is Test {
    AgentTreasury public treasury;
    MockWstETH public wstETH;
    MockPriceFeed public feed;

    address agent = address(0xA1);
    address spender = address(0xB1);
    address recipient = address(0xC1);

    // Initial rate: 1 wstETH = 1.2297 stETH (matches real Base Chainlink)
    int256 constant INITIAL_RATE = 1229700000000000000;
    // Rate after yield accrual: 1 wstETH = 1.2350 stETH (~0.43% increase)
    int256 constant INCREASED_RATE = 1235000000000000000;

    function setUp() public {
        wstETH = new MockWstETH();
        feed = new MockPriceFeed(INITIAL_RATE);
        treasury = new AgentTreasury(address(wstETH), address(feed));

        wstETH.mint(agent, 10 ether);
        vm.prank(agent);
        wstETH.approve(address(treasury), type(uint256).max);
    }

    function test_deposit() public {
        vm.prank(agent);
        treasury.deposit(1 ether);

        (uint256 principal, uint256 yield_, uint256 total, bool exists) = treasury.getVaultStatus(agent);
        assertEq(principal, 1 ether);
        assertEq(yield_, 0); // no rate change yet
        assertEq(total, 1 ether);
        assertTrue(exists);
    }

    function test_zero_deposit_reverts() public {
        vm.prank(agent);
        vm.expectRevert(AgentTreasury.ZeroAmount.selector);
        treasury.deposit(0);
    }

    function test_yield_accrues_with_rate_increase() public {
        vm.prank(agent);
        treasury.deposit(1 ether);

        // Rate increases — yield should appear
        feed.setPrice(INCREASED_RATE);

        (uint256 principal, uint256 yield_, uint256 total, ) = treasury.getVaultStatus(agent);
        assertEq(principal, 1 ether);
        assertGt(yield_, 0, "yield should be > 0 after rate increase");
        assertGt(total, 1 ether, "total should exceed principal");
    }

    function test_no_yield_if_rate_unchanged() public {
        vm.prank(agent);
        treasury.deposit(1 ether);

        (, uint256 yield_, ,) = treasury.getVaultStatus(agent);
        assertEq(yield_, 0, "no yield if rate hasn't changed");
    }

    function test_withdraw_yield() public {
        vm.prank(agent);
        treasury.deposit(1 ether);

        feed.setPrice(INCREASED_RATE);

        (, uint256 yield_, ,) = treasury.getVaultStatus(agent);
        assertGt(yield_, 0);

        vm.prank(agent);
        treasury.withdrawYield(recipient, yield_);

        assertEq(wstETH.balanceOf(recipient), yield_);
    }

    function test_cannot_withdraw_more_than_yield() public {
        vm.prank(agent);
        treasury.deposit(1 ether);

        feed.setPrice(INCREASED_RATE);

        (, uint256 yield_, ,) = treasury.getVaultStatus(agent);

        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(
            AgentTreasury.InsufficientYield.selector,
            yield_ + 1,
            yield_
        ));
        treasury.withdrawYield(recipient, yield_ + 1);
    }

    function test_authorize_and_withdraw_for() public {
        vm.prank(agent);
        treasury.deposit(1 ether);

        feed.setPrice(INCREASED_RATE);

        vm.prank(agent);
        treasury.authorizeSpender(spender, true, 0, 0, 0); // unlimited
        assertTrue(treasury.isAuthorizedSpender(agent, spender));

        (, uint256 yield_, ,) = treasury.getVaultStatus(agent);

        vm.prank(spender);
        treasury.withdrawYieldFor(agent, recipient, yield_);

        assertEq(wstETH.balanceOf(recipient), yield_);
    }

    function test_unauthorized_spender_reverts() public {
        vm.prank(agent);
        treasury.deposit(1 ether);

        feed.setPrice(INCREASED_RATE);

        vm.prank(spender);
        vm.expectRevert(AgentTreasury.NotAuthorized.selector);
        treasury.withdrawYieldFor(agent, recipient, 0.001 ether);
    }

    function test_revoke_spender() public {
        vm.prank(agent);
        treasury.authorizeSpender(spender, true, 0, 0, 0);
        assertTrue(treasury.isAuthorizedSpender(agent, spender));

        vm.prank(agent);
        treasury.revokeSpender(spender);
        assertFalse(treasury.isAuthorizedSpender(agent, spender));
    }

    function test_withdraw_all_as_owner() public {
        vm.prank(agent);
        treasury.deposit(1 ether);

        feed.setPrice(INCREASED_RATE);

        uint256 balBefore = wstETH.balanceOf(agent);
        vm.prank(agent);
        treasury.withdrawAll();

        // Owner gets back at least principal
        assertGe(wstETH.balanceOf(agent) - balBefore, 1 ether);

        (uint256 principal, , , ) = treasury.getVaultStatus(agent);
        assertEq(principal, 0);
    }

    function test_multiple_deposits_accumulate() public {
        vm.prank(agent);
        treasury.deposit(1 ether);
        vm.prank(agent);
        treasury.deposit(0.5 ether);

        (uint256 principal, , , ) = treasury.getVaultStatus(agent);
        assertEq(principal, 1.5 ether);
    }

    function test_stale_oracle_reverts() public {
        feed.setPrice(0); // invalid

        vm.prank(agent);
        vm.expectRevert(AgentTreasury.StaleOracle.selector);
        treasury.deposit(1 ether);
    }

    function test_getCurrentRate() public view {
        uint256 rate = treasury.getCurrentRate();
        assertEq(rate, uint256(INITIAL_RATE));
    }

    // ── Per-tx cap tests ─────────────────────────────────────────────

    function test_per_tx_cap_enforced() public {
        vm.prank(agent);
        treasury.deposit(1 ether);
        feed.setPrice(INCREASED_RATE);

        // Authorize spender with 0.001 wstETH per-tx cap
        vm.prank(agent);
        treasury.authorizeSpender(spender, true, 0.001 ether, 0, 0);

        // Try to withdraw more than cap
        vm.prank(spender);
        vm.expectRevert(abi.encodeWithSelector(
            AgentTreasury.ExceedsPerTxCap.selector,
            0.002 ether,
            0.001 ether
        ));
        treasury.withdrawYieldFor(agent, recipient, 0.002 ether);

        // Withdraw within cap — should succeed
        vm.prank(spender);
        treasury.withdrawYieldFor(agent, recipient, 0.001 ether);
        assertEq(wstETH.balanceOf(recipient), 0.001 ether);
    }

    // ── Time window allowance tests ──────────────────────────────────

    function test_window_allowance_enforced() public {
        vm.prank(agent);
        treasury.deposit(1 ether);
        feed.setPrice(INCREASED_RATE);

        // 0.002 wstETH per 1-hour window
        vm.prank(agent);
        treasury.authorizeSpender(spender, true, 0, 1 hours, 0.002 ether);

        // First withdrawal within window — ok
        vm.prank(spender);
        treasury.withdrawYieldFor(agent, recipient, 0.001 ether);

        // Second withdrawal still within window allowance — ok
        vm.prank(spender);
        treasury.withdrawYieldFor(agent, recipient, 0.001 ether);

        // Third withdrawal exceeds window — should revert
        vm.prank(spender);
        vm.expectRevert(abi.encodeWithSelector(
            AgentTreasury.ExceedsWindowAllowance.selector,
            0.001 ether,
            0 // remaining
        ));
        treasury.withdrawYieldFor(agent, recipient, 0.001 ether);

        // Warp past window — should reset and succeed
        vm.warp(block.timestamp + 1 hours + 1);
        vm.prank(spender);
        treasury.withdrawYieldFor(agent, recipient, 0.001 ether);
    }

    // ── Recipient whitelist tests ────────────────────────────────────

    function test_recipient_whitelist_enforced() public {
        vm.prank(agent);
        treasury.deposit(1 ether);
        feed.setPrice(INCREASED_RATE);

        vm.prank(agent);
        treasury.authorizeSpender(spender, true, 0, 0, 0);

        // Enable whitelist
        vm.prank(agent);
        treasury.setRecipientWhitelist(true);

        // Try to send to non-whitelisted recipient
        vm.prank(spender);
        vm.expectRevert(abi.encodeWithSelector(
            AgentTreasury.RecipientNotWhitelisted.selector,
            recipient
        ));
        treasury.withdrawYieldFor(agent, recipient, 0.001 ether);

        // Whitelist the recipient
        vm.prank(agent);
        treasury.setAllowedRecipient(recipient, true);

        // Now it should work
        vm.prank(spender);
        treasury.withdrawYieldFor(agent, recipient, 0.001 ether);
        assertEq(wstETH.balanceOf(recipient), 0.001 ether);
    }

    function test_recipient_whitelist_disabled_allows_any() public {
        vm.prank(agent);
        treasury.deposit(1 ether);
        feed.setPrice(INCREASED_RATE);

        vm.prank(agent);
        treasury.authorizeSpender(spender, true, 0, 0, 0);

        // Whitelist not enabled — any recipient ok
        vm.prank(spender);
        treasury.withdrawYieldFor(agent, recipient, 0.001 ether);
        assertEq(wstETH.balanceOf(recipient), 0.001 ether);
    }

    function test_get_spender_config() public {
        vm.prank(agent);
        treasury.authorizeSpender(spender, true, 0.01 ether, 1 hours, 0.05 ether);

        (bool auth, bool yieldOnly, uint256 maxPerTx, , , uint40 winDur, uint256 winAllow) =
            treasury.getSpenderConfig(agent, spender);

        assertTrue(auth);
        assertTrue(yieldOnly);
        assertEq(maxPerTx, 0.01 ether);
        assertEq(winDur, 1 hours);
        assertEq(winAllow, 0.05 ether);
    }
}

// ═══════════════════════════════════════════════════════════════════════
// Fork test — real Base mainnet state
// Run with: forge test --fork-url https://mainnet.base.org --match-contract AgentTreasuryForkTest -vvv
// ═══════════════════════════════════════════════════════════════════════

contract AgentTreasuryForkTest is Test {
    // Real Base mainnet addresses
    address constant WSTETH = 0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452;
    address constant CHAINLINK_RATE_FEED = 0xB88BAc61a4Ca37C43a3725912B1f472c9A5bc061;

    AgentTreasury public treasury;
    IERC20 public wstETH;

    address agent;
    address spender;
    address recipient;

    function setUp() public {
        // Deploy treasury against real Base contracts
        treasury = new AgentTreasury(WSTETH, CHAINLINK_RATE_FEED);
        wstETH = IERC20(WSTETH);

        agent = makeAddr("agent");
        spender = makeAddr("spender");
        recipient = makeAddr("recipient");

        // Deal wstETH to agent (uses forge's deal cheatcode on the real token)
        deal(WSTETH, agent, 1 ether);

        vm.prank(agent);
        wstETH.approve(address(treasury), type(uint256).max);
    }

    function test_fork_chainlink_rate_is_sane() public view {
        uint256 rate = treasury.getCurrentRate();
        // wstETH/stETH rate should be between 1.0 and 2.0
        assertGt(rate, 1e18, "rate should be > 1.0");
        assertLt(rate, 2e18, "rate should be < 2.0");
    }

    function test_fork_deposit_reads_real_rate() public {
        vm.prank(agent);
        treasury.deposit(0.5 ether);

        (uint256 principal, uint256 yield_, uint256 total, bool exists) = treasury.getVaultStatus(agent);
        assertEq(principal, 0.5 ether);
        assertEq(yield_, 0, "no yield immediately after deposit");
        assertEq(total, 0.5 ether);
        assertTrue(exists);
    }

    function test_fork_yield_positive_after_rate_appreciation() public {
        // Save current block (latest Base state)
        uint256 currentBlock = block.number;
        uint256 currentRate = treasury.getCurrentRate();

        // Make treasury persistent so its storage survives fork rolls
        vm.makePersistent(address(treasury));

        // Roll fork back ~60 days (~2,592,000 blocks at 2s/block on Base)
        // The Chainlink wstETH/stETH rate was lower in the past because
        // wstETH appreciates over time via Lido staking yield (~3-4% APR)
        vm.rollFork(currentBlock - 2_592_000);

        uint256 oldRate = treasury.getCurrentRate();
        // Sanity: old rate should be lower than current
        assertLt(oldRate, currentRate, "historical rate should be lower than current");

        // Deposit at the old (lower) rate — snapshots principalStETHValue at old rate
        deal(WSTETH, agent, 1 ether);
        vm.prank(agent);
        IERC20(WSTETH).approve(address(treasury), type(uint256).max);
        vm.prank(agent);
        treasury.deposit(0.5 ether);

        // Verify zero yield at old rate (just deposited)
        (, uint256 yieldAtOld, ,) = treasury.getVaultStatus(agent);
        assertEq(yieldAtOld, 0, "no yield right after deposit");

        // Roll fork forward to current block — rate is now higher
        vm.rollFork(currentBlock);

        // Yield should be > 0: real oracle rate increased between the two blocks
        (, uint256 yieldNow, uint256 total,) = treasury.getVaultStatus(agent);
        assertGt(yieldNow, 0, "yield should be > 0 after real rate appreciation");
        assertGt(total, 0.5 ether, "total should exceed principal");
    }

    function test_fork_spender_withdraws_real_yield() public {
        uint256 currentBlock = block.number;
        vm.makePersistent(address(treasury));
        vm.makePersistent(WSTETH); // token balance survives fork roll

        // Deposit at older (lower) rate
        vm.rollFork(currentBlock - 2_592_000);
        deal(WSTETH, agent, 1 ether);
        vm.prank(agent);
        IERC20(WSTETH).approve(address(treasury), type(uint256).max);
        vm.prank(agent);
        treasury.deposit(0.5 ether);

        // Roll forward — rate is higher, yield accrued
        vm.rollFork(currentBlock);

        // Authorize spender
        vm.prank(agent);
        treasury.authorizeSpender(spender, true, 0, 0, 0);

        (, uint256 yield_, ,) = treasury.getVaultStatus(agent);
        assertGt(yield_, 0, "yield must be > 0");

        // Spender withdraws yield — real oracle, real token transfer
        vm.prank(spender);
        treasury.withdrawYieldFor(agent, recipient, yield_);

        assertEq(wstETH.balanceOf(recipient), yield_);
    }

    function test_fork_principal_protected_from_spender() public {
        vm.prank(agent);
        treasury.deposit(0.5 ether);

        // No rate increase — no yield
        vm.prank(agent);
        treasury.authorizeSpender(spender, true, 0, 0, 0);

        vm.prank(spender);
        vm.expectRevert(); // InsufficientYield — 0 available
        treasury.withdrawYieldFor(agent, recipient, 0.001 ether);
    }

    function test_fork_withdraw_all_returns_principal() public {
        vm.prank(agent);
        treasury.deposit(0.5 ether);

        uint256 balBefore = wstETH.balanceOf(agent);
        vm.prank(agent);
        treasury.withdrawAll();

        // Agent gets back exactly what they deposited (no rate change = no yield)
        assertEq(wstETH.balanceOf(agent) - balBefore, 0.5 ether);
    }
}
