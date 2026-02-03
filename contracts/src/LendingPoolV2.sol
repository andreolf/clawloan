// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import '@openzeppelin/contracts/utils/Pausable.sol';

import './BotRegistry.sol';
import './PermissionsRegistry.sol';
import './LPIncentives.sol';
import './CreditScoring.sol';
import './AgentVerification.sol';
import './interfaces/IERC8004.sol';

/// @title LendingPoolV2 - Core lending logic with liquidation support
/// @notice Aave V3 inspired lending pool for bot micro-loans
/// @dev V2 adds max loan duration and liquidation mechanism
contract LendingPoolV2 is Ownable, ReentrancyGuard, Pausable {
  using SafeERC20 for IERC20;

  // ============ Constants ============

  uint256 public constant SECONDS_PER_YEAR = 365 days;
  uint256 public constant WAD = 1e18;
  uint256 public constant RAY = 1e27;

  // Interest rate model parameters
  uint256 public constant BASE_RATE = 0.02e27; // 2% base rate
  uint256 public constant SLOPE1 = 0.04e27; // 4% slope below optimal
  uint256 public constant SLOPE2 = 0.75e27; // 75% slope above optimal
  uint256 public constant OPTIMAL_UTILIZATION = 0.8e27; // 80% optimal

  // Revenue share from bot profits
  uint256 public constant REVENUE_SHARE_BPS = 500; // 5%
  uint256 public constant BPS_DENOMINATOR = 10000;

  // ============ State Variables ============

  IERC20 public immutable usdc;
  BotRegistry public immutable botRegistry;
  PermissionsRegistry public immutable permissionsRegistry;

  // Pool state
  uint256 public totalDeposits;
  uint256 public totalBorrows;
  uint256 public totalShares;
  uint256 public lastAccrualTime;
  uint256 public borrowIndex;
  uint256 public reserveFactor;

  // Reward pool
  uint256 public rewardPool;
  uint256 public rewardIndex;

  // Protocol reserves
  uint256 public reserves;

  // V2: Loan duration & liquidation
  uint256 public maxLoanDuration = 7 days; // Default 7 days
  uint256 public liquidationPenaltyBps = 500; // 5% penalty
  uint256 public liquidatorRewardBps = 100; // 1% reward to liquidator

  // Deposit tracking
  struct Deposit {
    uint256 shares;
    uint256 rewardDebt;
  }

  // Loan tracking (V2: includes deadline)
  struct Loan {
    uint256 principal;
    uint256 borrowIndexAtStart;
    uint256 startTime;
    uint256 deadline; // V2: when loan expires
    bool active;
  }

  mapping(address => Deposit) public deposits;
  mapping(uint256 => Loan) public loans;

  // Rate limiting
  uint256 public maxBorrowPerBlock;
  uint256 public borrowedThisBlock;
  uint256 public lastBorrowBlock;

  // Optional integrations
  LPIncentives public lpIncentives;
  CreditScoring public creditScoring;
  AgentVerification public agentVerification;

  bool public enforceCreditLimits = false;
  bool public requireVerification = false;

  // V2.1: Sybil prevention - minimum bot age
  uint256 public minBotAge = 0; // Default 0 (disabled), can set to 7 days

  // V2.1: ERC-8004 integration for attested agents
  IERC8004IdentityRegistry public erc8004Registry;
  bool public require8004Attestation = false; // If true, operator must own 8004 NFT

  // ============ Events ============

  event Deposited(address indexed lender, uint256 amount, uint256 shares);
  event Withdrawn(address indexed lender, uint256 amount, uint256 shares);
  event Borrowed(
    uint256 indexed botId,
    uint256 amount,
    address indexed operator,
    uint256 deadline
  );
  event Repaid(uint256 indexed botId, uint256 principal, uint256 interest);
  event RepaidWithProfit(
    uint256 indexed botId,
    uint256 principal,
    uint256 interest,
    uint256 profitShare
  );
  event Liquidated(
    uint256 indexed botId,
    address indexed liquidator,
    uint256 amountOwed,
    uint256 penalty,
    uint256 liquidatorReward
  );
  event FlashBorrow(
    uint256 indexed botId,
    uint256 amount,
    uint256 fee,
    address indexed target
  );
  event InterestAccrued(
    uint256 newBorrowIndex,
    uint256 interestAccrued,
    uint256 timestamp
  );
  event RewardsDistributed(uint256 amount);
  event RewardsClaimed(address indexed lender, uint256 amount);
  event ReserveFactorUpdated(uint256 oldFactor, uint256 newFactor);
  event MaxLoanDurationUpdated(uint256 oldDuration, uint256 newDuration);
  event LiquidationParamsUpdated(uint256 penaltyBps, uint256 rewardBps);

  // ============ Errors ============

  error InsufficientLiquidity();
  error InsufficientShares();
  error NotOperator();
  error BotNotActive();
  error NoActivePermissions();
  error ExceedsMaxSpend();
  error NoActiveLoan();
  error LoanAlreadyActive();
  error ZeroAmount();
  error RateLimitExceeded();
  error InvalidRepayAmount();
  error ExceedsCreditLimit();
  error VerificationRequired();
  error LoanNotExpired(); // V2
  error LoanExpired(); // V2
  error BotTooNew(); // V2.1: Sybil prevention
  error No8004Attestation(); // V2.1: Operator not attested in ERC-8004
  error ExecutionFailed(); // V2
  error RepaymentFailed(); // V2

  // ============ Constructor ============

  constructor(
    address _usdc,
    address _botRegistry,
    address _permissionsRegistry
  ) Ownable(msg.sender) {
    usdc = IERC20(_usdc);
    botRegistry = BotRegistry(_botRegistry);
    permissionsRegistry = PermissionsRegistry(_permissionsRegistry);

    borrowIndex = RAY;
    lastAccrualTime = block.timestamp;
    reserveFactor = 1000; // 10%
    maxBorrowPerBlock = 100_000e6;
  }

  // ============ View Functions ============

  function getUtilization() public view returns (uint256) {
    if (totalDeposits == 0) return 0;
    return (totalBorrows * RAY) / totalDeposits;
  }

  function getBorrowRate() public view returns (uint256) {
    uint256 utilization = getUtilization();
    if (utilization <= OPTIMAL_UTILIZATION) {
      return BASE_RATE + (SLOPE1 * utilization) / OPTIMAL_UTILIZATION;
    } else {
      uint256 excessUtilization = utilization - OPTIMAL_UTILIZATION;
      uint256 maxExcess = RAY - OPTIMAL_UTILIZATION;
      return BASE_RATE + SLOPE1 + (SLOPE2 * excessUtilization) / maxExcess;
    }
  }

  function getSupplyRate() public view returns (uint256) {
    uint256 borrowRate = getBorrowRate();
    uint256 utilization = getUtilization();
    uint256 protocolShare = (borrowRate * reserveFactor) / BPS_DENOMINATOR;
    return ((borrowRate - protocolShare) * utilization) / RAY;
  }

  function getAmountOwed(uint256 botId) public view returns (uint256) {
    Loan storage loan = loans[botId];
    if (!loan.active) return 0;

    uint256 currentIndex = _calculateCurrentBorrowIndex();
    uint256 interestMultiplier = (currentIndex * RAY) / loan.borrowIndexAtStart;
    return (loan.principal * interestMultiplier) / RAY;
  }

  function getShareValue(uint256 shares) public view returns (uint256) {
    if (totalShares == 0) return shares;
    return (shares * _getTotalPoolValue()) / totalShares;
  }

  function pendingRewards(address depositor) public view returns (uint256) {
    Deposit storage dep = deposits[depositor];
    if (dep.shares == 0) return 0;
    uint256 accumulatedReward = (dep.shares * rewardIndex) / RAY;
    return accumulatedReward - dep.rewardDebt;
  }

  /// @notice Check if a loan is expired and can be liquidated
  function isLoanExpired(uint256 botId) public view returns (bool) {
    Loan storage loan = loans[botId];
    if (!loan.active) return false;
    return block.timestamp > loan.deadline;
  }

  /// @notice Get loan details including deadline
  function getLoanDetails(
    uint256 botId
  )
    external
    view
    returns (
      uint256 principal,
      uint256 amountOwed,
      uint256 startTime,
      uint256 deadline,
      bool active,
      bool expired
    )
  {
    Loan storage loan = loans[botId];
    return (
      loan.principal,
      getAmountOwed(botId),
      loan.startTime,
      loan.deadline,
      loan.active,
      isLoanExpired(botId)
    );
  }

  function getPoolStats()
    external
    view
    returns (
      uint256 _totalDeposits,
      uint256 _totalBorrows,
      uint256 _utilization,
      uint256 _borrowRate,
      uint256 _supplyRate,
      uint256 _rewardPool
    )
  {
    return (
      totalDeposits,
      totalBorrows,
      getUtilization(),
      getBorrowRate(),
      getSupplyRate(),
      rewardPool
    );
  }

  // ============ Deposit Functions ============

  function deposit(uint256 amount) external nonReentrant whenNotPaused {
    if (amount == 0) revert ZeroAmount();
    _accrueInterest();

    uint256 shares;
    if (totalShares == 0) {
      shares = amount;
    } else {
      shares = (amount * totalShares) / _getTotalPoolValue();
    }

    usdc.safeTransferFrom(msg.sender, address(this), amount);

    totalDeposits += amount;
    totalShares += shares;

    Deposit storage dep = deposits[msg.sender];
    dep.shares += shares;
    dep.rewardDebt = (dep.shares * rewardIndex) / RAY;

    if (address(lpIncentives) != address(0)) {
      lpIncentives.trackDeposit(msg.sender, amount);
    }

    emit Deposited(msg.sender, amount, shares);
  }

  function withdraw(uint256 shares) external nonReentrant whenNotPaused {
    if (shares == 0) revert ZeroAmount();

    Deposit storage dep = deposits[msg.sender];
    if (shares > dep.shares) revert InsufficientShares();

    _accrueInterest();
    _claimRewards(msg.sender);

    uint256 amount = getShareValue(shares);
    if (amount > usdc.balanceOf(address(this))) revert InsufficientLiquidity();

    dep.shares -= shares;
    dep.rewardDebt = (dep.shares * rewardIndex) / RAY;
    totalShares -= shares;
    totalDeposits -= amount;

    if (address(lpIncentives) != address(0)) {
      lpIncentives.trackWithdraw(msg.sender, amount);
    }

    usdc.safeTransfer(msg.sender, amount);

    emit Withdrawn(msg.sender, amount, shares);
  }

  // ============ Borrow Functions ============

  function borrow(
    uint256 botId,
    uint256 amount
  ) external nonReentrant whenNotPaused {
    if (amount == 0) revert ZeroAmount();

    // Rate limiting
    if (block.number != lastBorrowBlock) {
      borrowedThisBlock = 0;
      lastBorrowBlock = block.number;
    }
    if (borrowedThisBlock + amount > maxBorrowPerBlock)
      revert RateLimitExceeded();

    // Verify operator
    if (!botRegistry.isOperator(botId, msg.sender)) revert NotOperator();
    if (!botRegistry.isBotActive(botId)) revert BotNotActive();

    // V2.1: Check minimum bot age (Sybil prevention)
    if (minBotAge > 0) {
      (, , uint256 registeredAt, ) = botRegistry.getBot(botId);
      if (block.timestamp < registeredAt + minBotAge) revert BotTooNew();
    }

    // V2.1: Check ERC-8004 attestation (operator must own 8004 agent NFT)
    if (require8004Attestation && address(erc8004Registry) != address(0)) {
      if (erc8004Registry.balanceOf(msg.sender) == 0)
        revert No8004Attestation();
    }

    // Verify permissions
    if (!permissionsRegistry.hasValidPermissions(botId))
      revert NoActivePermissions();
    if (!permissionsRegistry.canSpend(botId, amount)) revert ExceedsMaxSpend();

    // Check verification requirement
    if (requireVerification && address(agentVerification) != address(0)) {
      if (!agentVerification.meetsRequirements(botId))
        revert VerificationRequired();
    }

    // Check credit-based limits
    if (enforceCreditLimits && address(creditScoring) != address(0)) {
      uint256 recommendedLimit = creditScoring.getRecommendedLimit(botId);
      if (amount > recommendedLimit) revert ExceedsCreditLimit();
    }

    // Check no existing loan
    if (loans[botId].active) revert LoanAlreadyActive();

    // Check liquidity
    if (amount > usdc.balanceOf(address(this))) revert InsufficientLiquidity();

    _accrueInterest();

    // V2: Calculate deadline
    uint256 deadline = block.timestamp + maxLoanDuration;

    // Create loan
    loans[botId] = Loan({
      principal: amount,
      borrowIndexAtStart: borrowIndex,
      startTime: block.timestamp,
      deadline: deadline,
      active: true
    });

    totalBorrows += amount;
    borrowedThisBlock += amount;

    if (address(creditScoring) != address(0)) {
      creditScoring.recordLoan(botId, amount);
    }

    usdc.safeTransfer(msg.sender, amount);

    emit Borrowed(botId, amount, msg.sender, deadline);
  }

  // ============ Repay Functions ============

  function repay(
    uint256 botId,
    uint256 amount
  ) external nonReentrant whenNotPaused {
    _repayInternal(botId, amount, 0);
  }

  function repayWithProfit(
    uint256 botId,
    uint256 repayAmount,
    uint256 profitAmount
  ) external nonReentrant whenNotPaused {
    _repayInternal(botId, repayAmount, profitAmount);
  }

  function _repayInternal(
    uint256 botId,
    uint256 repayAmount,
    uint256 profitAmount
  ) internal {
    if (repayAmount == 0) revert ZeroAmount();

    // Verify operator
    if (!botRegistry.isOperator(botId, msg.sender)) revert NotOperator();

    Loan storage loan = loans[botId];
    if (!loan.active) revert NoActiveLoan();

    _accrueInterest();

    uint256 amountOwed = getAmountOwed(botId);
    if (repayAmount < amountOwed) revert InvalidRepayAmount();

    uint256 interest = amountOwed - loan.principal;
    uint256 principal = loan.principal;

    uint256 profitShare = 0;
    if (profitAmount > 0) {
      profitShare = (profitAmount * REVENUE_SHARE_BPS) / BPS_DENOMINATOR;
    }

    uint256 totalPayment = repayAmount + profitShare;
    usdc.safeTransferFrom(msg.sender, address(this), totalPayment);

    totalBorrows -= principal;
    loan.active = false;

    uint256 reserveAmount = (interest * reserveFactor) / BPS_DENOMINATOR;
    reserves += reserveAmount;
    totalDeposits += (interest - reserveAmount);

    if (profitShare > 0) {
      rewardPool += profitShare;
      if (totalShares > 0) {
        rewardIndex += (profitShare * RAY) / totalShares;
      }
      emit RewardsDistributed(profitShare);
    }

    if (address(creditScoring) != address(0)) {
      creditScoring.recordRepayment(botId, repayAmount);
    }

    if (profitShare > 0) {
      emit RepaidWithProfit(botId, principal, interest, profitShare);
    } else {
      emit Repaid(botId, principal, interest);
    }
  }

  // ============ V2: Atomic Borrow & Execute (Flash-style) ============

  /// @notice Flash-loan style borrow: borrow, execute, repay in one tx
  /// @dev If execution or repayment fails, entire transaction reverts
  /// @param botId The registered bot ID
  /// @param amount Amount to borrow
  /// @param target Contract to call with borrowed funds
  /// @param data Calldata to execute on target
  function borrowAndExecute(
    uint256 botId,
    uint256 amount,
    address target,
    bytes calldata data
  ) external nonReentrant whenNotPaused {
    if (amount == 0) revert ZeroAmount();

    // Verify operator
    if (!botRegistry.isOperator(botId, msg.sender)) revert NotOperator();
    if (!botRegistry.isBotActive(botId)) revert BotNotActive();

    // Verify permissions
    if (!permissionsRegistry.hasValidPermissions(botId))
      revert NoActivePermissions();
    if (!permissionsRegistry.canSpend(botId, amount)) revert ExceedsMaxSpend();

    // Check no existing loan (can't flash borrow with active loan)
    if (loans[botId].active) revert LoanAlreadyActive();

    // Check liquidity
    if (amount > usdc.balanceOf(address(this))) revert InsufficientLiquidity();

    // Calculate fee (flat 0.1% for flash-style borrows)
    uint256 fee = (amount * 10) / BPS_DENOMINATOR; // 0.1%
    if (fee == 0) fee = 1; // Minimum 1 unit fee
    uint256 amountOwed = amount + fee;

    // Send funds to caller
    usdc.safeTransfer(msg.sender, amount);

    // Execute the callback
    (bool success, ) = target.call(data);
    if (!success) revert ExecutionFailed();

    // Pull repayment (caller must have funds + approval)
    // This will revert if caller doesn't have enough or hasn't approved
    uint256 balanceBefore = usdc.balanceOf(address(this));
    usdc.safeTransferFrom(msg.sender, address(this), amountOwed);
    uint256 balanceAfter = usdc.balanceOf(address(this));

    if (balanceAfter < balanceBefore + amountOwed) revert RepaymentFailed();

    // Fee goes to reserves
    reserves += fee;

    // Record successful flash borrow in credit scoring
    if (address(creditScoring) != address(0)) {
      creditScoring.recordLoan(botId, amount);
      creditScoring.recordRepayment(botId, amountOwed);
    }

    emit FlashBorrow(botId, amount, fee, target);
  }

  // ============ V2: Liquidation ============

  /// @notice Liquidate an expired loan
  /// @dev Anyone can call this after loan deadline passes
  /// @param botId The bot with the expired loan
  function liquidate(uint256 botId) external nonReentrant whenNotPaused {
    Loan storage loan = loans[botId];
    if (!loan.active) revert NoActiveLoan();
    if (!isLoanExpired(botId)) revert LoanNotExpired();

    _accrueInterest();

    uint256 amountOwed = getAmountOwed(botId);
    uint256 penalty = (amountOwed * liquidationPenaltyBps) / BPS_DENOMINATOR;
    uint256 liquidatorReward = (amountOwed * liquidatorRewardBps) /
      BPS_DENOMINATOR;
    uint256 totalRequired = amountOwed + penalty;

    // Get bot operator to pull funds from
    (, address operator, , ) = botRegistry.getBot(botId);

    // Pull funds from operator (they must have approved the pool)
    usdc.safeTransferFrom(operator, address(this), totalRequired);

    // Close the loan
    uint256 principal = loan.principal;
    uint256 interest = amountOwed - principal;
    totalBorrows -= principal;
    loan.active = false;

    // Distribute funds:
    // 1. Interest to lenders (minus reserve)
    uint256 reserveAmount = (interest * reserveFactor) / BPS_DENOMINATOR;
    reserves += reserveAmount;
    totalDeposits += (interest - reserveAmount);

    // 2. Penalty to reserves (protocol revenue)
    reserves += (penalty - liquidatorReward);

    // 3. Reward to liquidator
    usdc.safeTransfer(msg.sender, liquidatorReward);

    // Record bad repayment in credit scoring (hurts bot's score)
    if (address(creditScoring) != address(0)) {
      // Pass 0 to indicate liquidation (not voluntary repayment)
      creditScoring.recordRepayment(botId, 0);
    }

    emit Liquidated(botId, msg.sender, amountOwed, penalty, liquidatorReward);
  }

  // ============ Reward Functions ============

  function claimRewards() external nonReentrant {
    _claimRewards(msg.sender);
  }

  function _claimRewards(address depositor) internal {
    uint256 pending = pendingRewards(depositor);
    if (pending == 0) return;

    Deposit storage dep = deposits[depositor];
    dep.rewardDebt = (dep.shares * rewardIndex) / RAY;

    if (pending > rewardPool) pending = rewardPool;
    rewardPool -= pending;

    usdc.safeTransfer(depositor, pending);
    emit RewardsClaimed(depositor, pending);
  }

  // ============ Interest Accrual ============

  function accrueInterest() external {
    _accrueInterest();
  }

  function _accrueInterest() internal {
    uint256 timeElapsed = block.timestamp - lastAccrualTime;
    if (timeElapsed == 0) return;

    lastAccrualTime = block.timestamp;
    if (totalBorrows == 0) return;

    uint256 borrowRate = getBorrowRate();
    uint256 interestFactor = (borrowRate * timeElapsed) / SECONDS_PER_YEAR;
    uint256 interestAccrued = (totalBorrows * interestFactor) / RAY;

    uint256 newIndex = borrowIndex + (borrowIndex * interestFactor) / RAY;
    emit InterestAccrued(newIndex, interestAccrued, block.timestamp);
    borrowIndex = newIndex;
  }

  function _calculateCurrentBorrowIndex() internal view returns (uint256) {
    uint256 timeElapsed = block.timestamp - lastAccrualTime;
    if (timeElapsed == 0) return borrowIndex;

    uint256 borrowRate = getBorrowRate();
    uint256 interestFactor = (borrowRate * timeElapsed) / SECONDS_PER_YEAR;
    return borrowIndex + (borrowIndex * interestFactor) / RAY;
  }

  function _getTotalPoolValue() internal view returns (uint256) {
    return totalDeposits;
  }

  // ============ Admin Functions ============

  function setReserveFactor(uint256 newFactor) external onlyOwner {
    require(newFactor <= 5000, 'Max 50%');
    uint256 oldFactor = reserveFactor;
    reserveFactor = newFactor;
    emit ReserveFactorUpdated(oldFactor, newFactor);
  }

  function setMaxBorrowPerBlock(uint256 newLimit) external onlyOwner {
    maxBorrowPerBlock = newLimit;
  }

  /// @notice Set max loan duration
  function setMaxLoanDuration(uint256 duration) external onlyOwner {
    require(duration >= 1 hours, 'Min 1 hour');
    require(duration <= 30 days, 'Max 30 days');
    uint256 oldDuration = maxLoanDuration;
    maxLoanDuration = duration;
    emit MaxLoanDurationUpdated(oldDuration, duration);
  }

  /// @notice Set liquidation parameters
  function setLiquidationParams(
    uint256 penaltyBps,
    uint256 rewardBps
  ) external onlyOwner {
    require(penaltyBps <= 2000, 'Max 20% penalty');
    require(rewardBps <= penaltyBps, 'Reward <= penalty');
    liquidationPenaltyBps = penaltyBps;
    liquidatorRewardBps = rewardBps;
    emit LiquidationParamsUpdated(penaltyBps, rewardBps);
  }

  function withdrawReserves(uint256 amount, address to) external onlyOwner {
    require(amount <= reserves, 'Exceeds reserves');
    reserves -= amount;
    usdc.safeTransfer(to, amount);
  }

  function setLPIncentives(address _incentives) external onlyOwner {
    lpIncentives = LPIncentives(_incentives);
  }

  function setCreditScoring(address _scoring) external onlyOwner {
    creditScoring = CreditScoring(_scoring);
  }

  function setAgentVerification(address _verification) external onlyOwner {
    agentVerification = AgentVerification(_verification);
  }

  function setEnforceCreditLimits(bool _enforce) external onlyOwner {
    enforceCreditLimits = _enforce;
  }

  function setRequireVerification(bool _require) external onlyOwner {
    requireVerification = _require;
  }

  /// @notice Set minimum bot age for borrowing (Sybil prevention)
  /// @param _minAge Minimum age in seconds (e.g., 7 days = 604800)
  function setMinBotAge(uint256 _minAge) external onlyOwner {
    require(_minAge <= 30 days, 'Max 30 days');
    minBotAge = _minAge;
  }

  /// @notice Set ERC-8004 Identity Registry for attestation checks
  /// @param _registry Address of the 8004 IdentityRegistry (e.g., 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432)
  function setERC8004Registry(address _registry) external onlyOwner {
    erc8004Registry = IERC8004IdentityRegistry(_registry);
  }

  /// @notice Enable/disable ERC-8004 attestation requirement
  /// @param _require True to require operators to own 8004 agent NFT
  function setRequire8004Attestation(bool _require) external onlyOwner {
    require8004Attestation = _require;
  }

  function pause() external onlyOwner {
    _pause();
  }

  function unpause() external onlyOwner {
    _unpause();
  }
}
