// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import '@openzeppelin/contracts/access/Ownable.sol';
import './BotRegistry.sol';

/// @title CreditScoring - On-chain credit history for AI agents
/// @notice Tracks loan history and calculates credit scores for dynamic limits
/// @dev Called by LendingPool on borrow/repay to update history
contract CreditScoring is Ownable {
  // Credit tiers with corresponding limit multipliers
  uint256 public constant TIER_NEW = 0; // New agent, no history
  uint256 public constant TIER_BRONZE = 1; // 1-5 successful loans
  uint256 public constant TIER_SILVER = 2; // 6-20 successful loans
  uint256 public constant TIER_GOLD = 3; // 21-50 successful loans
  uint256 public constant TIER_PLATINUM = 4; // 50+ successful loans

  // Base credit limit for new agents (in USDC, 6 decimals)
  uint256 public baseCreditLimit = 10e6; // $10 USDC

  // Multipliers per tier (in basis points, 10000 = 1x)
  mapping(uint256 => uint256) public tierMultipliers;

  struct CreditHistory {
    uint256 totalLoans; // Total loans taken
    uint256 successfulRepayments; // On-time repayments
    uint256 defaults; // Failed to repay
    uint256 totalBorrowed; // Cumulative borrow volume
    uint256 totalRepaid; // Cumulative repay volume
    uint256 lastLoanTimestamp; // Last activity
    uint256 longestStreak; // Longest consecutive repayment streak
    uint256 currentStreak; // Current streak
  }

  // Bot ID => Credit History
  mapping(uint256 => CreditHistory) public creditHistory;

  // Authorized callers (LendingPool contracts)
  mapping(address => bool) public authorizedCallers;

  // Reference to bot registry
  BotRegistry public immutable botRegistry;

  // Events
  event LoanRecorded(
    uint256 indexed botId,
    uint256 amount,
    uint256 totalLoans
  );
  event RepaymentRecorded(
    uint256 indexed botId,
    uint256 amount,
    uint256 newStreak
  );
  event DefaultRecorded(uint256 indexed botId, uint256 amount);
  event TierUpgrade(uint256 indexed botId, uint256 oldTier, uint256 newTier);
  event CallerAuthorized(address indexed caller);
  event CallerRevoked(address indexed caller);
  event BaseCreditLimitUpdated(uint256 oldLimit, uint256 newLimit);

  // Errors
  error NotAuthorized();
  error BotNotFound();

  modifier onlyAuthorized() {
    if (!authorizedCallers[msg.sender]) revert NotAuthorized();
    _;
  }

  constructor(address _botRegistry) Ownable(msg.sender) {
    botRegistry = BotRegistry(_botRegistry);

    // Set default tier multipliers
    tierMultipliers[TIER_NEW] = 10000; // 1x ($10)
    tierMultipliers[TIER_BRONZE] = 50000; // 5x ($50)
    tierMultipliers[TIER_SILVER] = 200000; // 20x ($200)
    tierMultipliers[TIER_GOLD] = 500000; // 50x ($500)
    tierMultipliers[TIER_PLATINUM] = 1000000; // 100x ($1000)
  }

  // ============ Core Functions ============

  /// @notice Record a new loan (called by LendingPool on borrow)
  /// @param botId The bot taking the loan
  /// @param amount The loan amount
  function recordLoan(
    uint256 botId,
    uint256 amount
  ) external onlyAuthorized {
    CreditHistory storage history = creditHistory[botId];

    history.totalLoans++;
    history.totalBorrowed += amount;
    history.lastLoanTimestamp = block.timestamp;

    emit LoanRecorded(botId, amount, history.totalLoans);
  }

  /// @notice Record a successful repayment (called by LendingPool on repay)
  /// @param botId The bot repaying
  /// @param amount The repayment amount
  function recordRepayment(
    uint256 botId,
    uint256 amount
  ) external onlyAuthorized {
    CreditHistory storage history = creditHistory[botId];

    uint256 oldTier = getCreditTier(botId);

    history.successfulRepayments++;
    history.totalRepaid += amount;
    history.currentStreak++;

    if (history.currentStreak > history.longestStreak) {
      history.longestStreak = history.currentStreak;
    }

    uint256 newTier = getCreditTier(botId);

    if (newTier > oldTier) {
      emit TierUpgrade(botId, oldTier, newTier);
    }

    emit RepaymentRecorded(botId, amount, history.currentStreak);
  }

  /// @notice Record a default (called by admin or automated process)
  /// @param botId The bot that defaulted
  /// @param amount The defaulted amount
  function recordDefault(
    uint256 botId,
    uint256 amount
  ) external onlyAuthorized {
    CreditHistory storage history = creditHistory[botId];

    history.defaults++;
    history.currentStreak = 0; // Reset streak on default

    emit DefaultRecorded(botId, amount);
  }

  // ============ View Functions ============

  /// @notice Get the credit tier for a bot
  /// @param botId The bot to check
  /// @return tier The credit tier (0-4)
  function getCreditTier(uint256 botId) public view returns (uint256 tier) {
    CreditHistory storage history = creditHistory[botId];

    // Penalize defaults heavily
    if (history.defaults > 0) {
      // Each default reduces effective repayments by 5
      uint256 effectiveRepayments = history.successfulRepayments > history.defaults * 5
        ? history.successfulRepayments - (history.defaults * 5)
        : 0;

      return _tierFromRepayments(effectiveRepayments);
    }

    return _tierFromRepayments(history.successfulRepayments);
  }

  function _tierFromRepayments(
    uint256 repayments
  ) internal pure returns (uint256) {
    if (repayments >= 50) return TIER_PLATINUM;
    if (repayments >= 21) return TIER_GOLD;
    if (repayments >= 6) return TIER_SILVER;
    if (repayments >= 1) return TIER_BRONZE;
    return TIER_NEW;
  }

  /// @notice Get the recommended credit limit for a bot
  /// @param botId The bot to check
  /// @return limit The recommended max borrow limit in USDC
  function getRecommendedLimit(
    uint256 botId
  ) external view returns (uint256 limit) {
    uint256 tier = getCreditTier(botId);
    uint256 multiplier = tierMultipliers[tier];

    return (baseCreditLimit * multiplier) / 10000;
  }

  /// @notice Get credit score (0-1000 scale)
  /// @param botId The bot to check
  /// @return score Credit score
  function getCreditScore(uint256 botId) external view returns (uint256 score) {
    CreditHistory storage history = creditHistory[botId];

    if (history.totalLoans == 0) return 500; // Neutral starting score

    // Base score from repayment rate (0-600 points)
    uint256 repaymentRate = (history.successfulRepayments * 600) /
      history.totalLoans;

    // Bonus for streak (0-200 points)
    uint256 streakBonus = history.longestStreak > 20
      ? 200
      : (history.longestStreak * 10);

    // Bonus for volume (0-200 points, capped at $10k total)
    uint256 volumeBonus = history.totalRepaid > 10000e6
      ? 200
      : (history.totalRepaid * 200) / 10000e6;

    // Penalty for defaults (-100 per default)
    uint256 defaultPenalty = history.defaults * 100;

    uint256 rawScore = repaymentRate + streakBonus + volumeBonus;

    if (defaultPenalty >= rawScore) return 0;

    return rawScore - defaultPenalty;
  }

  /// @notice Get basic credit stats for a bot
  /// @param botId The bot to check
  function getBasicStats(
    uint256 botId
  )
    external
    view
    returns (
      uint256 totalLoans,
      uint256 successfulRepayments,
      uint256 defaults,
      uint256 currentStreak,
      uint256 creditTier
    )
  {
    CreditHistory storage history = creditHistory[botId];

    return (
      history.totalLoans,
      history.successfulRepayments,
      history.defaults,
      history.currentStreak,
      getCreditTier(botId)
    );
  }

  /// @notice Get volume stats for a bot
  /// @param botId The bot to check
  function getVolumeStats(
    uint256 botId
  )
    external
    view
    returns (
      uint256 totalBorrowed,
      uint256 totalRepaid,
      uint256 longestStreak,
      uint256 recommendedLimit
    )
  {
    CreditHistory storage history = creditHistory[botId];

    return (
      history.totalBorrowed,
      history.totalRepaid,
      history.longestStreak,
      this.getRecommendedLimit(botId)
    );
  }

  // ============ Admin Functions ============

  /// @notice Authorize a caller (LendingPool)
  function authorizeCaller(address caller) external onlyOwner {
    authorizedCallers[caller] = true;
    emit CallerAuthorized(caller);
  }

  /// @notice Revoke a caller
  function revokeCaller(address caller) external onlyOwner {
    authorizedCallers[caller] = false;
    emit CallerRevoked(caller);
  }

  /// @notice Update base credit limit
  function setBaseCreditLimit(uint256 newLimit) external onlyOwner {
    uint256 oldLimit = baseCreditLimit;
    baseCreditLimit = newLimit;
    emit BaseCreditLimitUpdated(oldLimit, newLimit);
  }

  /// @notice Update tier multiplier
  function setTierMultiplier(
    uint256 tier,
    uint256 multiplier
  ) external onlyOwner {
    require(tier <= TIER_PLATINUM, "Invalid tier");
    tierMultipliers[tier] = multiplier;
  }
}
