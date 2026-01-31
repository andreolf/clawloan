// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';

/// @title LPIncentives - Track early LP participation for future token rewards
/// @notice Tracks time-weighted deposits for future $CLAWLOAN airdrop
/// @dev Points accumulate based on deposit amount × time
contract LPIncentives is Ownable, ReentrancyGuard {
  // ============ Structs ============

  struct LPInfo {
    uint256 depositedAmount; // Current deposited amount
    uint256 cumulativePoints; // Accumulated points (amount × time)
    uint256 lastUpdateTime; // Last time points were updated
    uint256 firstDepositTime; // When user first deposited (for early bird bonus)
    uint256 totalDeposited; // Lifetime deposits (for loyalty tracking)
    uint256 totalWithdrawn; // Lifetime withdrawals
  }

  struct EpochInfo {
    uint256 startTime;
    uint256 endTime;
    uint256 multiplier; // Bonus multiplier in BPS (10000 = 1x)
    string name;
  }

  // ============ State ============

  mapping(address => LPInfo) public lpInfo;
  address[] public allLPs;
  mapping(address => bool) public isLP;

  EpochInfo[] public epochs;
  uint256 public currentEpoch;

  uint256 public totalPoints;
  uint256 public totalActiveDeposits;

  // Authorized caller (LendingPool)
  address public lendingPool;

  // Early bird bonus: first 30 days get 2x points
  uint256 public launchTime;
  uint256 public constant EARLY_BIRD_DURATION = 30 days;
  uint256 public constant EARLY_BIRD_MULTIPLIER = 20000; // 2x in BPS
  uint256 public constant BASE_MULTIPLIER = 10000; // 1x in BPS

  // ============ Events ============

  event PointsAccrued(address indexed lp, uint256 points, uint256 totalPoints);
  event DepositTracked(address indexed lp, uint256 amount, uint256 newBalance);
  event WithdrawTracked(address indexed lp, uint256 amount, uint256 newBalance);
  event EpochCreated(uint256 indexed epochId, string name, uint256 multiplier);
  event LendingPoolSet(address indexed pool);
  event Launched(uint256 timestamp);

  // ============ Errors ============

  error NotAuthorized();
  error AlreadyLaunched();
  error NotLaunched();
  error InvalidAmount();

  // ============ Constructor ============

  constructor() Ownable(msg.sender) {
    // Create initial epoch
    epochs.push(
      EpochInfo({
        startTime: block.timestamp,
        endTime: 0, // Ongoing
        multiplier: BASE_MULTIPLIER,
        name: 'Genesis'
      })
    );
  }

  // ============ Modifiers ============

  modifier onlyLendingPool() {
    if (msg.sender != lendingPool && msg.sender != owner())
      revert NotAuthorized();
    _;
  }

  modifier afterLaunch() {
    if (launchTime == 0) revert NotLaunched();
    _;
  }

  // ============ Admin Functions ============

  /// @notice Set the lending pool address
  function setLendingPool(address _pool) external onlyOwner {
    lendingPool = _pool;
    emit LendingPoolSet(_pool);
  }

  /// @notice Launch the incentive program
  function launch() external onlyOwner {
    if (launchTime != 0) revert AlreadyLaunched();
    launchTime = block.timestamp;
    emit Launched(launchTime);
  }

  /// @notice Create a new bonus epoch
  function createEpoch(
    string calldata name,
    uint256 multiplier,
    uint256 duration
  ) external onlyOwner {
    // End current epoch
    epochs[currentEpoch].endTime = block.timestamp;

    // Create new epoch
    epochs.push(
      EpochInfo({
        startTime: block.timestamp,
        endTime: duration > 0 ? block.timestamp + duration : 0,
        multiplier: multiplier,
        name: name
      })
    );

    currentEpoch = epochs.length - 1;
    emit EpochCreated(currentEpoch, name, multiplier);
  }

  // ============ Core Functions ============

  /// @notice Track a deposit (called by LendingPool)
  function trackDeposit(address lp, uint256 amount) external onlyLendingPool {
    if (amount == 0) revert InvalidAmount();

    // Update points before changing balance
    _accruePoints(lp);

    LPInfo storage info = lpInfo[lp];

    // First time LP
    if (!isLP[lp]) {
      isLP[lp] = true;
      allLPs.push(lp);
      info.firstDepositTime = block.timestamp;
    }

    info.depositedAmount += amount;
    info.totalDeposited += amount;
    info.lastUpdateTime = block.timestamp;

    totalActiveDeposits += amount;

    emit DepositTracked(lp, amount, info.depositedAmount);
  }

  /// @notice Track a withdrawal (called by LendingPool)
  function trackWithdraw(address lp, uint256 amount) external onlyLendingPool {
    if (amount == 0) revert InvalidAmount();

    // Update points before changing balance
    _accruePoints(lp);

    LPInfo storage info = lpInfo[lp];

    // Handle partial/full withdrawal
    uint256 withdrawAmount = amount > info.depositedAmount
      ? info.depositedAmount
      : amount;

    info.depositedAmount -= withdrawAmount;
    info.totalWithdrawn += withdrawAmount;
    info.lastUpdateTime = block.timestamp;

    totalActiveDeposits -= withdrawAmount;

    emit WithdrawTracked(lp, withdrawAmount, info.depositedAmount);
  }

  /// @notice Manually accrue points for an LP
  function accruePoints(address lp) external {
    _accruePoints(lp);
  }

  /// @notice Batch accrue points for multiple LPs
  function batchAccruePoints(address[] calldata lps) external {
    for (uint256 i = 0; i < lps.length; i++) {
      _accruePoints(lps[i]);
    }
  }

  // ============ Internal Functions ============

  function _accruePoints(address lp) internal {
    LPInfo storage info = lpInfo[lp];

    if (info.depositedAmount == 0 || info.lastUpdateTime == 0) {
      info.lastUpdateTime = block.timestamp;
      return;
    }

    uint256 timeElapsed = block.timestamp - info.lastUpdateTime;
    if (timeElapsed == 0) return;

    // Calculate base points: amount × time (in hours for readability)
    uint256 basePoints = (info.depositedAmount * timeElapsed) / 1 hours;

    // Apply epoch multiplier
    uint256 epochMultiplier = epochs[currentEpoch].multiplier;

    // Apply early bird bonus if within first 30 days
    uint256 effectiveMultiplier = epochMultiplier;
    if (launchTime > 0 && block.timestamp < launchTime + EARLY_BIRD_DURATION) {
      effectiveMultiplier =
        (epochMultiplier * EARLY_BIRD_MULTIPLIER) /
        BASE_MULTIPLIER;
    }

    uint256 points = (basePoints * effectiveMultiplier) / BASE_MULTIPLIER;

    info.cumulativePoints += points;
    info.lastUpdateTime = block.timestamp;

    totalPoints += points;

    emit PointsAccrued(lp, points, info.cumulativePoints);
  }

  // ============ View Functions ============

  /// @notice Get current points for an LP (including pending)
  function getPoints(address lp) external view returns (uint256) {
    LPInfo memory info = lpInfo[lp];

    if (info.depositedAmount == 0 || info.lastUpdateTime == 0) {
      return info.cumulativePoints;
    }

    uint256 timeElapsed = block.timestamp - info.lastUpdateTime;
    uint256 basePoints = (info.depositedAmount * timeElapsed) / 1 hours;

    uint256 epochMultiplier = epochs[currentEpoch].multiplier;
    uint256 effectiveMultiplier = epochMultiplier;

    if (launchTime > 0 && block.timestamp < launchTime + EARLY_BIRD_DURATION) {
      effectiveMultiplier =
        (epochMultiplier * EARLY_BIRD_MULTIPLIER) /
        BASE_MULTIPLIER;
    }

    uint256 pendingPoints = (basePoints * effectiveMultiplier) /
      BASE_MULTIPLIER;

    return info.cumulativePoints + pendingPoints;
  }

  /// @notice Get LP's share of total points (in BPS)
  function getPointsShare(address lp) external view returns (uint256) {
    if (totalPoints == 0) return 0;

    LPInfo memory info = lpInfo[lp];
    return (info.cumulativePoints * 10000) / totalPoints;
  }

  /// @notice Get all LP addresses
  function getAllLPs() external view returns (address[] memory) {
    return allLPs;
  }

  /// @notice Get LP count
  function getLPCount() external view returns (uint256) {
    return allLPs.length;
  }

  /// @notice Get current multiplier (including early bird)
  function getCurrentMultiplier() external view returns (uint256) {
    uint256 epochMultiplier = epochs[currentEpoch].multiplier;

    if (launchTime > 0 && block.timestamp < launchTime + EARLY_BIRD_DURATION) {
      return (epochMultiplier * EARLY_BIRD_MULTIPLIER) / BASE_MULTIPLIER;
    }

    return epochMultiplier;
  }

  /// @notice Check if still in early bird period
  function isEarlyBird() external view returns (bool) {
    return launchTime > 0 && block.timestamp < launchTime + EARLY_BIRD_DURATION;
  }

  /// @notice Get time remaining in early bird period
  function earlyBirdTimeRemaining() external view returns (uint256) {
    if (launchTime == 0) return EARLY_BIRD_DURATION;
    if (block.timestamp >= launchTime + EARLY_BIRD_DURATION) return 0;
    return (launchTime + EARLY_BIRD_DURATION) - block.timestamp;
  }

  /// @notice Get leaderboard (top N LPs by points)
  function getLeaderboard(
    uint256 n
  ) external view returns (address[] memory lps, uint256[] memory points) {
    uint256 count = n > allLPs.length ? allLPs.length : n;
    lps = new address[](count);
    points = new uint256[](count);

    // Simple insertion sort for small n (gas efficient for top 10-20)
    for (uint256 i = 0; i < allLPs.length; i++) {
      uint256 lpPoints = lpInfo[allLPs[i]].cumulativePoints;

      for (uint256 j = 0; j < count; j++) {
        if (lpPoints > points[j]) {
          // Shift down
          for (uint256 k = count - 1; k > j; k--) {
            lps[k] = lps[k - 1];
            points[k] = points[k - 1];
          }
          lps[j] = allLPs[i];
          points[j] = lpPoints;
          break;
        }
      }
    }
  }
}
