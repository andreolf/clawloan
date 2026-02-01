// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * ⚠️  NOT DEPLOYED - FUTURE FEATURE
 * 
 * This contract is NOT deployed and is for future development only.
 * There is NO staking token. See ClawloanToken.sol for details.
 * 
 * Any tokens claiming to be Clawloan are SCAMS.
 * Official info: https://x.com/clawloan
 */

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import '@openzeppelin/contracts/utils/Pausable.sol';

/// @title StakingModule - Safety module for protocol backstop (NOT DEPLOYED)
/// @notice Future feature - not currently active
/// @dev Similar to Aave Safety Module with cooldown and slashing
contract StakingModule is Ownable, ReentrancyGuard, Pausable {
  using SafeERC20 for IERC20;

  // ============ Constants ============

  uint256 public constant COOLDOWN_SECONDS = 10 days;
  uint256 public constant UNSTAKE_WINDOW = 2 days;
  uint256 public constant SLASH_MAX_BPS = 3000; // 30% max slash
  uint256 public constant BPS_DENOMINATOR = 10000;
  uint256 public constant PRECISION = 1e18;

  // ============ State Variables ============

  IERC20 public immutable moltloan; // Staking token
  IERC20 public immutable usdc; // Reward token

  uint256 public totalStaked;
  uint256 public rewardIndex; // Accumulated rewards per staked token

  struct Stake {
    uint256 amount;
    uint256 rewardDebt;
    uint256 cooldownStart;
  }

  mapping(address => Stake) public stakes;

  // Slashing
  uint256 public totalSlashed;
  bool public slashingEnabled;

  // ============ Events ============

  event Staked(address indexed user, uint256 amount);
  event CooldownStarted(address indexed user, uint256 cooldownEnd);
  event Unstaked(address indexed user, uint256 amount);
  event Slashed(uint256 amount, string reason);
  event RewardsDistributed(uint256 amount);
  event RewardsClaimed(address indexed user, uint256 amount);
  event SlashingToggled(bool enabled);

  // ============ Errors ============

  error ZeroAmount();
  error InsufficientStake();
  error CooldownNotStarted();
  error CooldownNotComplete();
  error UnstakeWindowClosed();
  error SlashingDisabled();
  error SlashExceedsMax();
  error NoRewardsToClaim();

  // ============ Constructor ============

  constructor(address _moltloan, address _usdc) Ownable(msg.sender) {
    moltloan = IERC20(_moltloan);
    usdc = IERC20(_usdc);
    slashingEnabled = true;
  }

  // ============ View Functions ============

  /// @notice Get pending rewards for a user
  function pendingRewards(address user) public view returns (uint256) {
    Stake storage userStake = stakes[user];
    if (userStake.amount == 0) return 0;

    uint256 accumulated = (userStake.amount * rewardIndex) / PRECISION;
    return accumulated - userStake.rewardDebt;
  }

  /// @notice Check if user is in unstake window
  function canUnstake(address user) public view returns (bool) {
    Stake storage userStake = stakes[user];
    if (userStake.cooldownStart == 0) return false;

    uint256 cooldownEnd = userStake.cooldownStart + COOLDOWN_SECONDS;
    uint256 windowEnd = cooldownEnd + UNSTAKE_WINDOW;

    return block.timestamp >= cooldownEnd && block.timestamp <= windowEnd;
  }

  /// @notice Get cooldown status
  function getCooldownStatus(
    address user
  )
    external
    view
    returns (
      uint256 cooldownStart,
      uint256 cooldownEnd,
      uint256 windowEnd,
      bool canUnstakeNow
    )
  {
    Stake storage userStake = stakes[user];
    cooldownStart = userStake.cooldownStart;

    if (cooldownStart == 0) {
      return (0, 0, 0, false);
    }

    cooldownEnd = cooldownStart + COOLDOWN_SECONDS;
    windowEnd = cooldownEnd + UNSTAKE_WINDOW;
    canUnstakeNow = canUnstake(user);
  }

  // ============ Staking Functions ============

  /// @notice Stake MOLTLOAN tokens
  /// @param amount Amount to stake
  function stake(uint256 amount) external nonReentrant whenNotPaused {
    if (amount == 0) revert ZeroAmount();

    // Claim pending rewards first
    _claimRewards(msg.sender);

    // Transfer tokens
    moltloan.safeTransferFrom(msg.sender, address(this), amount);

    // Update stake
    Stake storage userStake = stakes[msg.sender];
    userStake.amount += amount;
    userStake.rewardDebt = (userStake.amount * rewardIndex) / PRECISION;
    userStake.cooldownStart = 0; // Reset cooldown on new stake

    totalStaked += amount;

    emit Staked(msg.sender, amount);
  }

  /// @notice Start cooldown period before unstaking
  function cooldown() external {
    Stake storage userStake = stakes[msg.sender];
    if (userStake.amount == 0) revert InsufficientStake();

    userStake.cooldownStart = block.timestamp;

    emit CooldownStarted(msg.sender, block.timestamp + COOLDOWN_SECONDS);
  }

  /// @notice Unstake tokens after cooldown
  /// @param amount Amount to unstake
  function unstake(uint256 amount) external nonReentrant {
    if (amount == 0) revert ZeroAmount();

    Stake storage userStake = stakes[msg.sender];
    if (amount > userStake.amount) revert InsufficientStake();
    if (userStake.cooldownStart == 0) revert CooldownNotStarted();

    uint256 cooldownEnd = userStake.cooldownStart + COOLDOWN_SECONDS;
    if (block.timestamp < cooldownEnd) revert CooldownNotComplete();
    if (block.timestamp > cooldownEnd + UNSTAKE_WINDOW)
      revert UnstakeWindowClosed();

    // Claim pending rewards first
    _claimRewards(msg.sender);

    // Update stake
    userStake.amount -= amount;
    userStake.rewardDebt = (userStake.amount * rewardIndex) / PRECISION;
    userStake.cooldownStart = 0;

    totalStaked -= amount;

    // Transfer tokens back
    moltloan.safeTransfer(msg.sender, amount);

    emit Unstaked(msg.sender, amount);
  }

  // ============ Reward Functions ============

  /// @notice Claim accumulated USDC rewards
  function claimRewards() external nonReentrant {
    _claimRewards(msg.sender);
  }

  function _claimRewards(address user) internal {
    uint256 pending = pendingRewards(user);
    if (pending == 0) return;

    Stake storage userStake = stakes[user];
    userStake.rewardDebt = (userStake.amount * rewardIndex) / PRECISION;

    usdc.safeTransfer(user, pending);

    emit RewardsClaimed(user, pending);
  }

  /// @notice Distribute rewards to stakers (called by LendingPool or admin)
  /// @param amount Amount of USDC to distribute
  function distributeRewards(uint256 amount) external nonReentrant {
    if (amount == 0) revert ZeroAmount();
    if (totalStaked == 0) return;

    usdc.safeTransferFrom(msg.sender, address(this), amount);

    rewardIndex += (amount * PRECISION) / totalStaked;

    emit RewardsDistributed(amount);
  }

  // ============ Slashing Functions ============

  /// @notice Slash stakers in case of protocol shortfall (owner only)
  /// @param amount Amount to slash
  /// @param reason Reason for slashing
  function slash(uint256 amount, string calldata reason) external onlyOwner {
    if (!slashingEnabled) revert SlashingDisabled();

    uint256 maxSlash = (totalStaked * SLASH_MAX_BPS) / BPS_DENOMINATOR;
    if (amount > maxSlash) revert SlashExceedsMax();

    totalSlashed += amount;

    // Transfer slashed tokens to owner (for recovery/distribution)
    moltloan.safeTransfer(owner(), amount);

    emit Slashed(amount, reason);
  }

  /// @notice Toggle slashing (owner only)
  function toggleSlashing(bool enabled) external onlyOwner {
    slashingEnabled = enabled;
    emit SlashingToggled(enabled);
  }

  // ============ Admin Functions ============

  /// @notice Pause staking
  function pause() external onlyOwner {
    _pause();
  }

  /// @notice Unpause staking
  function unpause() external onlyOwner {
    _unpause();
  }

  /// @notice Emergency withdraw stuck tokens (not staked tokens)
  function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
    require(
      token != address(moltloan) ||
        amount <= IERC20(token).balanceOf(address(this)) - totalStaked
    );
    IERC20(token).safeTransfer(owner(), amount);
  }
}
