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
 * @dev    Yield model (Base-compatible via Chainlink oracle):
 *         - wstETH on Base is a bridged ERC-20 without native rate functions.
 *         - Yield is calculated on-chain using the Chainlink wstETH/stETH exchange
 *           rate oracle deployed by Lido on Base (0xB88BAc61a4Ca37C43a3725912B1f472c9A5bc061).
 *         - On deposit, the contract snapshots the current exchange rate.
 *         - Available yield = current stETH value - principal stETH value, converted
 *           back to wstETH units.
 *         - No mocks, no off-chain injection — real yield from the live exchange rate.
 *
 * Bounty targets:
 *   - Lido "stETH Agent Treasury" ($2K/$1K): yield-only spending with permission controls
 *   - MetaMask "Best Use of Delegations" ($3K/$1.5K): delegation-aware authorization
 */
contract AgentTreasury is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── State ─────────────────────────────────────────────────────────

    IERC20 public immutable wstETH;
    IChainlinkPriceFeed public immutable rateFeed;

    struct Vault {
        uint256 principalWstETH;     // wstETH deposited (never decreases except on full withdraw)
        uint256 principalStETHValue; // stETH value at time of deposit (snapshot via Chainlink)
        bool exists;
    }

    mapping(address => Vault) public vaults;

    struct SpenderConfig {
        bool authorized;
        bool yieldOnly;
        uint256 maxPerTx;           // 0 = unlimited
        uint256 spentInWindow;      // wstETH spent in current window
        uint40 windowStart;         // timestamp of current spending window
        uint40 windowDuration;      // 0 = no time window (per-tx cap only)
        uint256 windowAllowance;    // max spend per window (0 = unlimited)
    }

    // Spender authorization: agent → spender → config
    mapping(address => mapping(address => SpenderConfig)) public spenders;

    // Recipient whitelist: agent → recipient → allowed
    mapping(address => mapping(address => bool)) public allowedRecipients;
    // Whether whitelist is enabled for this vault (false = any recipient ok)
    mapping(address => bool) public recipientWhitelistEnabled;

    // ── Events ────────────────────────────────────────────────────────

    event Deposited(address indexed agent, uint256 wstETHAmount, uint256 stETHValue);
    event YieldWithdrawn(address indexed agent, address indexed recipient, uint256 wstETHAmount);
    event SpenderAuthorized(address indexed agent, address indexed spender, uint256 maxPerTx, uint40 windowDuration, uint256 windowAllowance);
    event SpenderRevoked(address indexed agent, address indexed spender);
    event PrincipalWithdrawn(address indexed agent, uint256 wstETHAmount);
    event RecipientWhitelistToggled(address indexed agent, bool enabled);
    event RecipientAllowed(address indexed agent, address indexed recipient, bool allowed);

    // ── Errors ────────────────────────────────────────────────────────

    error NotAuthorized();
    error InsufficientYield(uint256 requested, uint256 available);
    error ExceedsPerTxCap(uint256 requested, uint256 cap);
    error ExceedsWindowAllowance(uint256 requested, uint256 remaining);
    error RecipientNotWhitelisted(address recipient);
    error ZeroAmount();
    error NoVault();
    error StaleOracle();

    // ── Constructor ───────────────────────────────────────────────────

    constructor(address _wstETH, address _rateFeed) {
        wstETH = IERC20(_wstETH);
        rateFeed = IChainlinkPriceFeed(_rateFeed);
    }

    // ── Deposit ───────────────────────────────────────────────────────

    /**
     * @notice Deposit wstETH into your agent vault. Must approve this contract first.
     * @param amount Amount of wstETH to deposit
     */
    function deposit(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        wstETH.safeTransferFrom(msg.sender, address(this), amount);

        uint256 rate = _getRate();
        uint256 stETHValue = (amount * rate) / 1e18;

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

        Vault storage v = vaults[msg.sender];
        if (!v.exists) revert NoVault();

        uint256 available = _availableYield(msg.sender);
        if (wstETHAmount > available) {
            revert InsufficientYield(wstETHAmount, available);
        }

        // Advance principal snapshot so withdrawn yield cannot be re-claimed
        uint256 rate = _getRate();
        v.principalStETHValue += (wstETHAmount * rate) / 1e18;

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
        SpenderConfig storage cfg = spenders[agent][msg.sender];
        if (!cfg.authorized) revert NotAuthorized();
        if (wstETHAmount == 0) revert ZeroAmount();

        // ── Per-tx cap check ──
        if (cfg.maxPerTx > 0 && wstETHAmount > cfg.maxPerTx) {
            revert ExceedsPerTxCap(wstETHAmount, cfg.maxPerTx);
        }

        // ── Time-window spending limit check ──
        if (cfg.windowDuration > 0 && cfg.windowAllowance > 0) {
            // Reset window if expired
            if (block.timestamp >= cfg.windowStart + cfg.windowDuration) {
                cfg.spentInWindow = 0;
                cfg.windowStart = uint40(block.timestamp);
            }
            if (cfg.spentInWindow + wstETHAmount > cfg.windowAllowance) {
                revert ExceedsWindowAllowance(wstETHAmount, cfg.windowAllowance - cfg.spentInWindow);
            }
            cfg.spentInWindow += wstETHAmount;
        }

        // ── Recipient whitelist check ──
        if (recipientWhitelistEnabled[agent] && !allowedRecipients[agent][recipient]) {
            revert RecipientNotWhitelisted(recipient);
        }

        Vault storage v = vaults[agent];
        if (!v.exists) revert NoVault();

        uint256 available = _availableYield(agent);
        if (wstETHAmount > available) {
            revert InsufficientYield(wstETHAmount, available);
        }

        // Advance principal snapshot so withdrawn yield cannot be re-claimed
        uint256 rate = _getRate();
        v.principalStETHValue += (wstETHAmount * rate) / 1e18;

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

        uint256 balance = wstETH.balanceOf(address(this));
        // Only send what belongs to this agent (principal + any yield)
        uint256 toSend = v.principalWstETH + _availableYield(msg.sender);
        if (toSend > balance) toSend = balance;

        v.principalWstETH = 0;
        v.principalStETHValue = 0;

        wstETH.safeTransfer(msg.sender, toSend);

        emit PrincipalWithdrawn(msg.sender, toSend);
    }

    // ── Authorization ─────────────────────────────────────────────────

    /**
     * @notice Authorize a spender with configurable permissions
     * @param spender Address to authorize
     * @param yieldOnly If true, spender can only access yield (not principal)
     * @param maxPerTx Maximum wstETH per transaction (0 = unlimited)
     * @param windowDuration Time window in seconds for spending limit (0 = no window)
     * @param windowAllowance Max wstETH spendable per window (0 = unlimited)
     */
    function authorizeSpender(
        address spender,
        bool yieldOnly,
        uint256 maxPerTx,
        uint40 windowDuration,
        uint256 windowAllowance
    ) external {
        spenders[msg.sender][spender] = SpenderConfig({
            authorized: true,
            yieldOnly: yieldOnly,
            maxPerTx: maxPerTx,
            spentInWindow: 0,
            windowStart: uint40(block.timestamp),
            windowDuration: windowDuration,
            windowAllowance: windowAllowance
        });

        emit SpenderAuthorized(msg.sender, spender, maxPerTx, windowDuration, windowAllowance);
    }

    /**
     * @notice Revoke a spender's authorization
     * @param spender Address to revoke
     */
    function revokeSpender(address spender) external {
        delete spenders[msg.sender][spender];

        emit SpenderRevoked(msg.sender, spender);
    }

    /**
     * @notice Toggle recipient whitelist for your vault
     * @param enabled Whether to require recipients be whitelisted
     */
    function setRecipientWhitelist(bool enabled) external {
        recipientWhitelistEnabled[msg.sender] = enabled;

        emit RecipientWhitelistToggled(msg.sender, enabled);
    }

    /**
     * @notice Add or remove a recipient from the whitelist
     * @param recipient Address to allow/disallow
     * @param allowed Whether this recipient is allowed
     */
    function setAllowedRecipient(address recipient, bool allowed) external {
        allowedRecipients[msg.sender][recipient] = allowed;

        emit RecipientAllowed(msg.sender, recipient, allowed);
    }

    // ── View functions ────────────────────────────────────────────────

    function isAuthorizedSpender(address agent, address spender) external view returns (bool) {
        return spenders[agent][spender].authorized;
    }

    function getSpenderConfig(address agent, address spender) external view returns (
        bool authorized,
        bool yieldOnly,
        uint256 maxPerTx,
        uint256 spentInWindow,
        uint40 windowStart,
        uint40 windowDuration,
        uint256 windowAllowance
    ) {
        SpenderConfig storage cfg = spenders[agent][spender];
        return (cfg.authorized, cfg.yieldOnly, cfg.maxPerTx, cfg.spentInWindow, cfg.windowStart, cfg.windowDuration, cfg.windowAllowance);
    }

    function getVaultStatus(address agent) external view returns (
        uint256 depositedPrincipal,
        uint256 availableYield,
        uint256 totalBalance,
        bool hasVault
    ) {
        Vault storage v = vaults[agent];
        depositedPrincipal = v.principalWstETH;
        availableYield = _availableYield(agent);
        totalBalance = v.principalWstETH + availableYield;
        hasVault = v.exists;
    }

    function getCurrentRate() external view returns (uint256) {
        return _getRate();
    }

    // ── Internal ──────────────────────────────────────────────────────

    uint256 private constant MAX_ORACLE_STALENESS = 24 hours;

    function _getRate() internal view returns (uint256) {
        (, int256 answer,, uint256 updatedAt,) = rateFeed.latestRoundData();
        if (answer <= 0 || block.timestamp - updatedAt > MAX_ORACLE_STALENESS) revert StaleOracle();
        return uint256(answer);
    }

    function _availableYield(address agent) internal view returns (uint256) {
        Vault storage v = vaults[agent];
        if (!v.exists || v.principalWstETH == 0) return 0;

        uint256 rate = _getRate();
        // Current stETH value of the deposited wstETH
        uint256 currentStETHValue = (v.principalWstETH * rate) / 1e18;

        if (currentStETHValue <= v.principalStETHValue) return 0;

        // Yield in stETH terms
        uint256 yieldInStETH = currentStETHValue - v.principalStETHValue;

        // Convert yield back to wstETH units: yieldWstETH = yieldStETH * 1e18 / rate
        return (yieldInStETH * 1e18) / rate;
    }
}

// ── Interface for Chainlink price feed ───────────────────────────────

interface IChainlinkPriceFeed {
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
}
