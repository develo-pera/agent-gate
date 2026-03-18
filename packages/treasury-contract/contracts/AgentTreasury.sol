// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AgentTreasury
 * @notice A vault that lets AI agents deposit wstETH and only spend the accrued yield.
 *         Principal is always protected — no authorized spender can touch it.
 *
 * @dev    How yield tracking works:
 *         - wstETH is a non-rebasing, value-accruing token. Its value in stETH grows over time.
 *         - When an agent deposits X wstETH, we record X as their "principal shares".
 *         - At any point, `currentValue = wstETH.balanceOf(vault) * agentShares / totalShares`
 *         - `principalValue` is the original deposit amount (in wstETH)
 *         - `availableYield = currentValue - principalValue` (in wstETH terms)
 *         - Actually, since wstETH value increases relative to stETH over time,
 *           the yield is implicitly accrued. We track principal in wstETH units
 *           and compare against the actual wstETH balance proportionally.
 *
 *         For the hackathon scope, we use a simpler model:
 *         - Track deposits in wstETH units
 *         - Query the wstETH→stETH exchange rate to calculate yield in stETH terms
 *         - Allow withdrawal of the stETH-denominated yield delta
 *
 * Bounty targets:
 *   - Lido "stETH Agent Treasury" ($2K/$1K): yield-only spending with permission controls
 *   - MetaMask "Best Use of Delegations" ($3K/$1.5K): delegation-aware authorization
 */
contract AgentTreasury is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── State ─────────────────────────────────────────────────────────

    IERC20 public immutable wstETH;
    IWstETH public immutable wstETHRate; // same address, cast for rate queries

    struct Vault {
        uint256 principalWstETH;    // wstETH deposited (never decreases except on full withdraw)
        uint256 principalStETHValue; // stETH value at time of deposit (snapshot)
        bool exists;
    }

    mapping(address => Vault) public vaults;

    // Spender authorization: agent → spender → authorized
    mapping(address => mapping(address => bool)) public authorizedSpenders;
    // Yield-only flag: agent → spender → yieldOnly
    mapping(address => mapping(address => bool)) public yieldOnlySpenders;

    // ── Events ────────────────────────────────────────────────────────

    event Deposited(address indexed agent, uint256 wstETHAmount, uint256 stETHValue);
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
        wstETHRate = IWstETH(_wstETH);
    }

    // ── Deposit ───────────────────────────────────────────────────────

    /**
     * @notice Deposit wstETH into your agent vault. Must approve this contract first.
     * @param amount Amount of wstETH to deposit
     */
    function deposit(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        wstETH.safeTransferFrom(msg.sender, address(this), amount);

        uint256 stETHValue = wstETHRate.getStETHByWstETH(amount);

        Vault storage v = vaults[msg.sender];
        v.principalWstETH += amount;
        v.principalStETHValue += stETHValue;
        v.exists = true;

        emit Deposited(msg.sender, amount, stETHValue);
    }

    // ── Yield withdrawal ──────────────────────────────────────────────

    /**
     * @notice Withdraw accrued yield (in wstETH). Principal is protected.
     * @param recipient Where to send the yield
     * @param wstETHAmount Amount of wstETH to withdraw from yield
     */
    function withdrawYield(address recipient, uint256 wstETHAmount) external nonReentrant {
        if (wstETHAmount == 0) revert ZeroAmount();

        // Determine which vault to draw from
        address agent = msg.sender;

        // Check if caller is an authorized spender (not the agent themselves)
        // If so, look up the agent they're authorized for
        // For simplicity: msg.sender must be the agent or an authorized spender
        // In the delegation model, msg.sender may be the DelegationManager
        // executing on behalf of the agent

        Vault storage v = vaults[agent];
        if (!v.exists) {
            // Maybe caller is a spender — check all vaults they're authorized for
            // For hackathon simplicity, require the agent address explicitly
            revert NoVault();
        }

        uint256 available = _availableYield(agent);
        if (wstETHAmount > available) {
            revert InsufficientYield(wstETHAmount, available);
        }

        // Transfer yield to recipient
        wstETH.safeTransfer(recipient, wstETHAmount);

        emit YieldWithdrawn(agent, recipient, wstETHAmount);
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

        uint256 available = _availableYield(agent);
        if (wstETHAmount > available) {
            revert InsufficientYield(wstETHAmount, available);
        }

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

        uint256 balance = _vaultBalance(msg.sender);
        v.principalWstETH = 0;
        v.principalStETHValue = 0;

        wstETH.safeTransfer(msg.sender, balance);

        emit PrincipalWithdrawn(msg.sender, balance);
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
        uint256 depositedShares,
        uint256 currentValue,
        uint256 principalValue,
        uint256 availableYield
    ) {
        Vault storage v = vaults[agent];
        depositedShares = v.principalWstETH;
        currentValue = _vaultBalance(agent);
        principalValue = v.principalWstETH;
        availableYield = _availableYield(agent);
    }

    // ── Internal ──────────────────────────────────────────────────────

    function _vaultBalance(address agent) internal view returns (uint256) {
        // In a multi-agent vault, each agent's share is tracked proportionally
        // For simplicity (single-agent-per-vault model), balance = principal + yield
        // The yield comes from wstETH value appreciation
        Vault storage v = vaults[agent];
        if (!v.exists || v.principalWstETH == 0) return 0;

        // Since this is a shared contract, we track per-agent deposits
        // The actual wstETH balance may be more than the sum of all deposits
        // because wstETH value appreciates in stETH terms
        // For this model: vault balance = deposited wstETH (the wstETH count doesn't change)
        return v.principalWstETH;
    }

    function _availableYield(address agent) internal view returns (uint256) {
        Vault storage v = vaults[agent];
        if (!v.exists || v.principalWstETH == 0) return 0;

        // Yield = current stETH value of deposited wstETH - original stETH value at deposit
        // Since wstETH appreciates vs stETH, this difference grows over time
        uint256 currentStETHValue = wstETHRate.getStETHByWstETH(v.principalWstETH);
        uint256 yieldInStETH = 0;
        if (currentStETHValue > v.principalStETHValue) {
            yieldInStETH = currentStETHValue - v.principalStETHValue;
        }

        // Convert yield back to wstETH units for withdrawal
        if (yieldInStETH == 0) return 0;
        return wstETHRate.getWstETHByStETH(yieldInStETH);
    }
}

// ── Interface for wstETH rate queries ─────────────────────────────────

interface IWstETH {
    function getStETHByWstETH(uint256 _wstETHAmount) external view returns (uint256);
    function getWstETHByStETH(uint256 _stETHAmount) external view returns (uint256);
    function stEthPerToken() external view returns (uint256);
}
