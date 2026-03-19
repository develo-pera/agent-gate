// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../contracts/AgentTreasury.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Mock wstETH — simple ERC20 (no rate functions needed on Base)
contract MockWstETH is ERC20 {
    constructor() ERC20("Wrapped stETH", "wstETH") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract AgentTreasuryTest is Test {
    AgentTreasury public treasury;
    MockWstETH public wstETH;

    address agent = address(0xA1);
    address spender = address(0xB1);
    address recipient = address(0xC1);

    function setUp() public {
        wstETH = new MockWstETH();
        treasury = new AgentTreasury(address(wstETH));

        // Fund agent with wstETH
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

    function test_zero_deposit_reverts() public {
        vm.prank(agent);
        vm.expectRevert(AgentTreasury.ZeroAmount.selector);
        treasury.deposit(0);
    }

    function test_add_yield() public {
        vm.prank(agent);
        treasury.deposit(1 ether);

        // Agent adds yield
        vm.prank(agent);
        treasury.addYield(0.05 ether);

        (uint256 principal, uint256 yield_, uint256 total, ) = treasury.getVaultStatus(agent);
        assertEq(principal, 1 ether);
        assertEq(yield_, 0.05 ether);
        assertEq(total, 1.05 ether);
    }

    function test_withdraw_yield_only() public {
        vm.prank(agent);
        treasury.deposit(1 ether);
        vm.prank(agent);
        treasury.addYield(0.05 ether);

        // Agent withdraws yield
        vm.prank(agent);
        treasury.withdrawYield(recipient, 0.03 ether);

        assertEq(wstETH.balanceOf(recipient), 0.03 ether);

        (, uint256 yield_, ,) = treasury.getVaultStatus(agent);
        assertEq(yield_, 0.02 ether);
    }

    function test_cannot_withdraw_more_than_yield() public {
        vm.prank(agent);
        treasury.deposit(1 ether);
        vm.prank(agent);
        treasury.addYield(0.01 ether);

        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(AgentTreasury.InsufficientYield.selector, 0.02 ether, 0.01 ether));
        treasury.withdrawYield(recipient, 0.02 ether);
    }

    function test_authorize_spender() public {
        vm.prank(agent);
        treasury.deposit(1 ether);
        vm.prank(agent);
        treasury.addYield(0.05 ether);

        // Authorize spender
        vm.prank(agent);
        treasury.authorizeSpender(spender, true);
        assertTrue(treasury.isAuthorizedSpender(agent, spender));

        // Spender withdraws yield on behalf of agent
        vm.prank(spender);
        treasury.withdrawYieldFor(agent, recipient, 0.02 ether);

        assertEq(wstETH.balanceOf(recipient), 0.02 ether);
        (, uint256 yield_, ,) = treasury.getVaultStatus(agent);
        assertEq(yield_, 0.03 ether);
    }

    function test_unauthorized_spender_reverts() public {
        vm.prank(agent);
        treasury.deposit(1 ether);
        vm.prank(agent);
        treasury.addYield(0.05 ether);

        // Unauthorized spender tries to withdraw
        vm.prank(spender);
        vm.expectRevert(AgentTreasury.NotAuthorized.selector);
        treasury.withdrawYieldFor(agent, recipient, 0.01 ether);
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
        treasury.deposit(1 ether);
        vm.prank(agent);
        treasury.addYield(0.05 ether);

        uint256 balBefore = wstETH.balanceOf(agent);
        vm.prank(agent);
        treasury.withdrawAll();

        assertEq(wstETH.balanceOf(agent) - balBefore, 1.05 ether);
        (uint256 principal, uint256 yield_, ,) = treasury.getVaultStatus(agent);
        assertEq(principal, 0);
        assertEq(yield_, 0);
    }

    function test_add_yield_no_vault_reverts() public {
        vm.prank(agent);
        vm.expectRevert(AgentTreasury.NoVault.selector);
        treasury.addYield(0.01 ether);
    }

    function test_multiple_deposits_accumulate() public {
        vm.prank(agent);
        treasury.deposit(1 ether);
        vm.prank(agent);
        treasury.deposit(0.5 ether);

        (uint256 principal, , uint256 total, ) = treasury.getVaultStatus(agent);
        assertEq(principal, 1.5 ether);
        assertEq(total, 1.5 ether);
    }
}
