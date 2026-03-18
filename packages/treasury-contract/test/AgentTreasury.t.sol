// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../contracts/AgentTreasury.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// ── Mock wstETH with controllable exchange rate ───────────────────────

contract MockWstETH is ERC20 {
    uint256 public rate = 1.15e18; // 1 wstETH = 1.15 stETH initially

    constructor() ERC20("Wrapped stETH", "wstETH") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function getStETHByWstETH(uint256 _wstETHAmount) external view returns (uint256) {
        return (_wstETHAmount * rate) / 1e18;
    }

    function getWstETHByStETH(uint256 _stETHAmount) external view returns (uint256) {
        return (_stETHAmount * 1e18) / rate;
    }

    function stEthPerToken() external view returns (uint256) {
        return rate;
    }

    // Simulate yield accrual by increasing the exchange rate
    function accrueYield(uint256 basisPoints) external {
        rate = rate + (rate * basisPoints) / 10000;
    }
}

contract AgentTreasuryTest is Test {
    AgentTreasury public treasury;
    MockWstETH public wsteth;

    address public agent = makeAddr("agent");
    address public spender = makeAddr("spender");
    address public recipient = makeAddr("recipient");

    function setUp() public {
        wsteth = new MockWstETH();
        treasury = new AgentTreasury(address(wsteth));

        // Give agent some wstETH
        wsteth.mint(agent, 10 ether);

        // Approve treasury
        vm.prank(agent);
        wsteth.approve(address(treasury), type(uint256).max);
    }

    function test_deposit() public {
        vm.prank(agent);
        treasury.deposit(5 ether);

        (uint256 deposited, uint256 current, uint256 principal, uint256 yield_) = treasury.getVaultStatus(agent);
        assertEq(deposited, 5 ether, "deposited should be 5 wstETH");
        assertEq(principal, 5 ether, "principal should be 5 wstETH");
        assertEq(yield_, 0, "yield should be 0 initially");
    }

    function test_yield_accrues() public {
        vm.prank(agent);
        treasury.deposit(5 ether);

        // Simulate 5% yield (500 basis points)
        wsteth.accrueYield(500);

        (, , , uint256 yield_) = treasury.getVaultStatus(agent);
        assertGt(yield_, 0, "yield should be > 0 after rate increase");
    }

    function test_withdraw_yield_only() public {
        vm.prank(agent);
        treasury.deposit(5 ether);

        // Accrue yield
        wsteth.accrueYield(500);

        (, , , uint256 yield_) = treasury.getVaultStatus(agent);
        assertGt(yield_, 0);

        // Withdraw yield
        vm.prank(agent);
        treasury.withdrawYield(recipient, yield_);

        assertGt(wsteth.balanceOf(recipient), 0, "recipient should have received yield");
    }

    function test_cannot_withdraw_more_than_yield() public {
        vm.prank(agent);
        treasury.deposit(5 ether);

        // No yield accrued yet — trying to withdraw should fail
        vm.prank(agent);
        vm.expectRevert();
        treasury.withdrawYield(recipient, 1 ether);
    }

    function test_authorize_spender() public {
        vm.prank(agent);
        treasury.deposit(5 ether);

        // Authorize spender
        vm.prank(agent);
        treasury.authorizeSpender(spender, true);

        assertTrue(treasury.isAuthorizedSpender(agent, spender));

        // Accrue yield
        wsteth.accrueYield(500);

        (, , , uint256 yield_) = treasury.getVaultStatus(agent);

        // Spender withdraws yield on behalf of agent
        vm.prank(spender);
        treasury.withdrawYieldFor(agent, recipient, yield_);

        assertGt(wsteth.balanceOf(recipient), 0);
    }

    function test_unauthorized_spender_reverts() public {
        vm.prank(agent);
        treasury.deposit(5 ether);

        wsteth.accrueYield(500);

        // Unauthorized spender tries to withdraw
        vm.prank(spender);
        vm.expectRevert(AgentTreasury.NotAuthorized.selector);
        treasury.withdrawYieldFor(agent, recipient, 0.1 ether);
    }

    function test_revoke_spender() public {
        vm.prank(agent);
        treasury.authorizeSpender(spender, true);
        assertTrue(treasury.isAuthorizedSpender(agent, spender));

        vm.prank(agent);
        treasury.revokeSpender(spender);
        assertFalse(treasury.isAuthorizedSpender(agent, spender));
    }

    function test_withdraw_all_as_owner() public {
        vm.prank(agent);
        treasury.deposit(5 ether);

        uint256 balBefore = wsteth.balanceOf(agent);

        vm.prank(agent);
        treasury.withdrawAll();

        uint256 balAfter = wsteth.balanceOf(agent);
        assertEq(balAfter - balBefore, 5 ether, "should get back full principal");
    }

    function test_zero_deposit_reverts() public {
        vm.prank(agent);
        vm.expectRevert(AgentTreasury.ZeroAmount.selector);
        treasury.deposit(0);
    }
}
