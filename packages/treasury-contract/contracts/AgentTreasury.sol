// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AgentTreasury
 * @notice A vault that lets AI agents deposit wstETH and manage yield-only spending permissions.
 *         Principal is always protected — authorized spenders can only access yield.
 *
 * @dev    Yield model (Base-compatible):
 *         - wstETH on Base is a bridged ERC-20 without on-chain rate functions.
 *         - The contract tracks deposits purely in wstETH units.
 *         - Yield calculation (wstETH→stETH exchange rate) is performed off-chain
 *           by the MCP server using the L1 Ethereum client.
 *         - The owner can inject yield by calling `addYield(amount)` after bridging
 *           or earning yield externally. This allows the vault to work on any chain.
 *         - Authorized spenders can only withdraw from the yield pool, never principal.
 *
 * Bounty targets:
 *   - Lido "stETH Agent Treasury" ($2K/$1K): yield-only spending with permission controls
 *   - MetaMask "Best Use of Delegations" ($3K/$1.5K): delegation-aware authorization
 */
contract AgentTreasury is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── State ─────────────────────────────────────────────────────────

    IERC20 public immutable wstETH;

    struct Vault {
        uint256 principalWstETH;    // wstETH deposited (protected, never touched by spenders)
        uint256 yieldWstETH;        // wstETH yield available for spending
        bool exists;
    }

    mapping(address => Vault) public vaults;

    // Spender authorization: agent → spender → authorized
    mapping(address => mapping(address => bool)) public authorizedSpenders;
    // Yield-only flag: agent → spender → yieldOnly
    mapping(address => mapping(address => bool)) public yieldOnlySpenders;

    // ── Events ────────────────────────────────────────────────────────

    event Deposited(address indexed agent, uint256 wstETHAmount);
    event YieldAdded(address indexed agent, uint256 wstETHAmount);
    event YieldWithdrawn(address indexed agent, address indexed recipient, uint256 wstETHAmount);
    event SpenderAuthorized(address indexed agent, address indexed spender, bool yieldOnly);
    event SpenderRevoked(address indexed agent, address indexed spender);
    event PrincipalWithdrawn(address indexed agent, uint256 wstETHAmount);

    // ── Errors ────────────────────────────────────────────────────────

    error NotAuthorized();
    error InsufficientYield(uint256 requested, uint256 available);
    error ZeroAmount();
    error NoVault();

    // ── Constructor ───────────────────────────────────────────────────

    constructor(address _wstETH) {
        wstETH = IERC20(_wstETH);
    }

    // ── Deposit ───────────────────────────────────────────────────────

    /**
     * @notice Deposit wstETH into your agent vault. Must approve this contract first.
     * @param amount Amount of wstETH to deposit
     */
    function deposit(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        wstETH.safeTransferFrom(msg.sender, address(this), amount);

        Vault storage v = vaults[msg.sender];
        v.principalWstETH += amount;
        v.exists = true;

        emit Deposited(msg.sender, amount);
    }

    // ── Yield management ──────────────────────────────────────────────

    /**
     * @notice Add yield to your vault. Call this after yield has been calculated off-chain
     *         and the equivalent wstETH has been transferred/bridged. Must approve first.
     * @param amount Amount of wstETH to add as yield
     */
    function addYield(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        Vault storage v = vaults[msg.sender];
        if (!v.exists) revert NoVault();

        wstETH.safeTransferFrom(msg.sender, address(this), amount);
        v.yieldWstETH += amount;

        emit YieldAdded(msg.sender, amount);
    }

    // ── Yield withdrawal ──────────────────────────────────────────────

    /**
     * @notice Withdraw accrued yield (in wstETH). Principal is protected.
     * @param recipient Where to send the yield
     * @param wstETHAmount Amount of wstETH to withdraw from yield
     */
    function withdrawYield(address recipient, uint256 wstETHAmount) external nonReentrant {
        if (wstETHAmount == 0) revert ZeroAmount();

        Vault storage v = vaults[msg.sender];
        if (!v.exists) revert NoVault();

        if (wstETHAmount > v.yieldWstETH) {
            revert InsufficientYield(wstETHAmount, v.yieldWstETH);
        }

        v.yieldWstETH -= wstETHAmount;
        wstETH.safeTransfer(recipient, wstETHAmount);

        emit YieldWithdrawn(msg.sender, recipient, wstETHAmount);
    }

    /**
     * @notice Withdraw yield as an authorized spender on behalf of an agent
     * @param agent The vault owner
     * @param recipient Where to send the yield
     * @param wstETHAmount Amount to withdraw
     */
    function withdrawYieldFor(
        address agent,
        address recipient,
        uint256 wstETHAmount
    ) external nonReentrant {
        if (!authorizedSpenders[agent][msg.sender]) revert NotAuthorized();
        if (wstETHAmount == 0) revert ZeroAmount();

        Vault storage v = vaults[agent];
        if (!v.exists) revert NoVault();

        if (wstETHAmount > v.yieldWstETH) {
            revert InsufficientYield(wstETHAmount, v.yieldWstETH);
        }

        v.yieldWstETH -= wstETHAmount;
        wstETH.safeTransfer(recipient, wstETHAmount);

        emit YieldWithdrawn(agent, recipient, wstETHAmount);
    }

    // ── Principal withdrawal (owner only) ─────────────────────────────

    /**
     * @notice Withdraw all wstETH (principal + yield). Only the vault owner can do this.
     */
    function withdrawAll() external nonReentrant {
        Vault storage v = vaults[msg.sender];
        if (!v.exists) revert NoVault();

        uint256 total = v.principalWstETH + v.yieldWstETH;
        v.principalWstETH = 0;
        v.yieldWstETH = 0;

        wstETH.safeTransfer(msg.sender, total);

        emit PrincipalWithdrawn(msg.sender, total);
    }

    // ── Authorization ─────────────────────────────────────────────────

    /**
     * @notice Authorize another address to spend yield from your vault
     * @param spender Address to authorize
     * @param yieldOnly If true, spender can only access yield (not principal)
     */
    function authorizeSpender(address spender, bool yieldOnly) external {
        authorizedSpenders[msg.sender][spender] = true;
        yieldOnlySpenders[msg.sender][spender] = yieldOnly;

        emit SpenderAuthorized(msg.sender, spender, yieldOnly);
    }

    /**
     * @notice Revoke a spender's authorization
     * @param spender Address to revoke
     */
    function revokeSpender(address spender) external {
        authorizedSpenders[msg.sender][spender] = false;
        yieldOnlySpenders[msg.sender][spender] = false;

        emit SpenderRevoked(msg.sender, spender);
    }

    // ── View functions ────────────────────────────────────────────────

    function isAuthorizedSpender(address agent, address spender) external view returns (bool) {
        return authorizedSpenders[agent][spender];
    }

    function getVaultStatus(address agent) external view returns (
        uint256 depositedPrincipal,
        uint256 availableYield,
        uint256 totalBalance,
        bool hasVault
    ) {
        Vault storage v = vaults[agent];
        depositedPrincipal = v.principalWstETH;
        availableYield = v.yieldWstETH;
        totalBalance = v.principalWstETH + v.yieldWstETH;
        hasVault = v.exists;
    }
}
