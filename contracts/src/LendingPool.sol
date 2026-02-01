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

/// @title LendingPool - Core lending logic for Moltloan
/// @notice Aave V3 inspired lending pool for bot micro-loans
/// @dev Uses share-based deposits and utilization-based interest rates
contract LendingPool is Ownable, ReentrancyGuard, Pausable {
  using SafeERC20 for IERC20;

  // ============ Constants ============

  uint256 public constant SECONDS_PER_YEAR = 365 days;
  uint256 public constant WAD = 1e18; // 18 decimal precision
  uint256 public constant RAY = 1e27; // 27 decimal precision (Aave style)

  // Interest rate model parameters
  uint256 public constant BASE_RATE = 0.02e27; // 2% base rate
  uint256 public constant SLOPE1 = 0.04e27; // 4% slope below optimal
  uint256 public constant SLOPE2 = 0.75e27; // 75% slope above optimal
  uint256 public constant OPTIMAL_UTILIZATION = 0.8e27; // 80% optimal utilization

  // Revenue share from bot profits
  uint256 public constant REVENUE_SHARE_BPS = 500; // 5%
  uint256 public constant BPS_DENOMINATOR = 10000;

  // ============ State Variables ============

  IERC20 public immutable usdc;
  BotRegistry public immutable botRegistry;
  PermissionsRegistry public immutable permissionsRegistry;

  // Pool state
  uint256 public totalDeposits; // Total USDC deposited
  uint256 public totalBorrows; // Total USDC borrowed (principal only)
  uint256 public totalShares; // Total deposit shares issued
  uint256 public lastAccrualTime; // Last interest accrual timestamp
  uint256 public borrowIndex; // Cumulative borrow interest index (RAY)
  uint256 public reserveFactor; // Protocol reserve factor (BPS)

  // Reward pool for revenue share
  uint256 public rewardPool; // Accumulated rewards from bot profits
  uint256 public rewardIndex; // Cumulative reward index per share

  // Protocol reserves
  uint256 public reserves;

  // Deposit tracking
  struct Deposit {
    uint256 shares; // Share of the pool
    uint256 rewardDebt; // For reward share tracking
  }

  // Loan tracking
  struct Loan {
    uint256 principal; // Original borrowed amount
    uint256 borrowIndexAtStart; // Borrow index when loan was taken
    uint256 startTime; // When loan was taken
    bool active; // Whether loan is active
  }

  mapping(address => Deposit) public deposits;
  mapping(uint256 => Loan) public loans; // botId => Loan

  // Rate limiting
  uint256 public maxBorrowPerBlock;
  uint256 public borrowedThisBlock;
  uint256 public lastBorrowBlock;

  // LP Incentives (optional)
  LPIncentives public lpIncentives;

  // Credit Scoring (optional)
  CreditScoring public creditScoring;

  // Agent Verification (optional)
  AgentVerification public agentVerification;

  // Whether to enforce credit-based limits
  bool public enforceCreditLimits = false;

  // Whether to require agent verification
  bool public requireVerification = false;

  // ============ Events ============

  event Deposited(address indexed lender, uint256 amount, uint256 shares);
  event Withdrawn(address indexed lender, uint256 amount, uint256 shares);
  event Borrowed(
    uint256 indexed botId,
    uint256 amount,
    address indexed operator
  );
  event Repaid(uint256 indexed botId, uint256 principal, uint256 interest);
  event RepaidWithProfit(
    uint256 indexed botId,
    uint256 principal,
    uint256 interest,
    uint256 profitShare
  );
  event InterestAccrued(
    uint256 newBorrowIndex,
    uint256 interestAccrued,
    uint256 timestamp
  );
  event RewardsDistributed(uint256 amount);
  event RewardsClaimed(address indexed lender, uint256 amount);
  event ReserveFactorUpdated(uint256 oldFactor, uint256 newFactor);
  event LPIncentivesSet(address indexed incentives);
  event CreditScoringSet(address indexed scoring);
  event AgentVerificationSet(address indexed verification);
  event CreditLimitsEnforcementUpdated(bool enforced);
  event VerificationRequirementUpdated(bool required);

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

  // ============ Constructor ============

  constructor(
    address _usdc,
    address _botRegistry,
    address _permissionsRegistry
  ) Ownable(msg.sender) {
    usdc = IERC20(_usdc);
    botRegistry = BotRegistry(_botRegistry);
    permissionsRegistry = PermissionsRegistry(_permissionsRegistry);

    borrowIndex = RAY; // Start at 1.0
    lastAccrualTime = block.timestamp;
    reserveFactor = 1000; // 10% to protocol
    maxBorrowPerBlock = 100_000e6; // 100k USDC per block limit
  }

  // ============ View Functions ============

  /// @notice Get current pool utilization (RAY precision)
  function getUtilization() public view returns (uint256) {
    if (totalDeposits == 0) return 0;
    return (totalBorrows * RAY) / totalDeposits;
  }

  /// @notice Get current borrow rate (RAY precision, annual)
  function getBorrowRate() public view returns (uint256) {
    uint256 utilization = getUtilization();

    if (utilization <= OPTIMAL_UTILIZATION) {
      // Below optimal: base + slope1 * (util / optimal)
      return BASE_RATE + (SLOPE1 * utilization) / OPTIMAL_UTILIZATION;
    } else {
      // Above optimal: base + slope1 + slope2 * ((util - optimal) / (1 - optimal))
      uint256 excessUtilization = utilization - OPTIMAL_UTILIZATION;
      uint256 maxExcess = RAY - OPTIMAL_UTILIZATION;
      return BASE_RATE + SLOPE1 + (SLOPE2 * excessUtilization) / maxExcess;
    }
  }

  /// @notice Get current supply rate (RAY precision, annual)
  function getSupplyRate() public view returns (uint256) {
    uint256 borrowRate = getBorrowRate();
    uint256 utilization = getUtilization();
    uint256 protocolShare = (borrowRate * reserveFactor) / BPS_DENOMINATOR;

    return ((borrowRate - protocolShare) * utilization) / RAY;
  }

  /// @notice Get total amount owed by a bot (principal + interest)
  function getAmountOwed(uint256 botId) public view returns (uint256) {
    Loan storage loan = loans[botId];
    if (!loan.active) return 0;

    uint256 currentIndex = _calculateCurrentBorrowIndex();
    uint256 interestMultiplier = (currentIndex * RAY) / loan.borrowIndexAtStart;

    return (loan.principal * interestMultiplier) / RAY;
  }

  /// @notice Get value of shares in USDC
  function getShareValue(uint256 shares) public view returns (uint256) {
    if (totalShares == 0) return shares;
    return (shares * _getTotalPoolValue()) / totalShares;
  }

  /// @notice Get pending rewards for a depositor
  function pendingRewards(address depositor) public view returns (uint256) {
    Deposit storage dep = deposits[depositor];
    if (dep.shares == 0) return 0;

    uint256 accumulatedReward = (dep.shares * rewardIndex) / RAY;
    return accumulatedReward - dep.rewardDebt;
  }

  /// @notice Get pool statistics
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

  /// @notice Deposit USDC to earn yield
  /// @param amount Amount of USDC to deposit
  function deposit(uint256 amount) external nonReentrant whenNotPaused {
    if (amount == 0) revert ZeroAmount();

    _accrueInterest();

    // Calculate shares to mint
    uint256 shares;
    if (totalShares == 0) {
      shares = amount;
    } else {
      shares = (amount * totalShares) / _getTotalPoolValue();
    }

    // Transfer USDC
    usdc.safeTransferFrom(msg.sender, address(this), amount);

    // Update state
    totalDeposits += amount;
    totalShares += shares;

    Deposit storage dep = deposits[msg.sender];
    dep.shares += shares;
    dep.rewardDebt = (dep.shares * rewardIndex) / RAY;

    // Track for LP incentives
    if (address(lpIncentives) != address(0)) {
      lpIncentives.trackDeposit(msg.sender, amount);
    }

    emit Deposited(msg.sender, amount, shares);
  }

  /// @notice Withdraw USDC
  /// @param shares Amount of shares to burn
  function withdraw(uint256 shares) external nonReentrant whenNotPaused {
    if (shares == 0) revert ZeroAmount();

    Deposit storage dep = deposits[msg.sender];
    if (shares > dep.shares) revert InsufficientShares();

    _accrueInterest();

    // Claim any pending rewards first
    _claimRewards(msg.sender);

    // Calculate USDC to return
    uint256 amount = getShareValue(shares);
    if (amount > usdc.balanceOf(address(this))) revert InsufficientLiquidity();

    // Update state
    dep.shares -= shares;
    dep.rewardDebt = (dep.shares * rewardIndex) / RAY;
    totalShares -= shares;
    totalDeposits -= amount;

    // Track for LP incentives
    if (address(lpIncentives) != address(0)) {
      lpIncentives.trackWithdraw(msg.sender, amount);
    }

    // Transfer USDC
    usdc.safeTransfer(msg.sender, amount);

    emit Withdrawn(msg.sender, amount, shares);
  }

  // ============ Borrow Functions ============

  /// @notice Borrow USDC for a registered bot
  /// @param botId ID of the bot
  /// @param amount Amount to borrow
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

    // Verify permissions
    if (!permissionsRegistry.hasValidPermissions(botId))
      revert NoActivePermissions();
    if (!permissionsRegistry.canSpend(botId, amount)) revert ExceedsMaxSpend();

    // Check verification requirement (if enabled)
    if (requireVerification && address(agentVerification) != address(0)) {
      if (!agentVerification.meetsRequirements(botId)) revert VerificationRequired();
    }

    // Check credit-based limits (if enabled)
    if (enforceCreditLimits && address(creditScoring) != address(0)) {
      uint256 recommendedLimit = creditScoring.getRecommendedLimit(botId);
      if (amount > recommendedLimit) revert ExceedsCreditLimit();
    }

    // Check no existing loan
    if (loans[botId].active) revert LoanAlreadyActive();

    // Check liquidity
    if (amount > usdc.balanceOf(address(this))) revert InsufficientLiquidity();

    _accrueInterest();

    // Create loan
    loans[botId] = Loan({
      principal: amount,
      borrowIndexAtStart: borrowIndex,
      startTime: block.timestamp,
      active: true
    });

    // Update state
    totalBorrows += amount;
    borrowedThisBlock += amount;

    // Record loan in credit scoring (if enabled)
    if (address(creditScoring) != address(0)) {
      creditScoring.recordLoan(botId, amount);
    }

    // Transfer USDC
    usdc.safeTransfer(msg.sender, amount);

    emit Borrowed(botId, amount, msg.sender);
  }

  /// @notice Repay a loan
  /// @param botId ID of the bot
  /// @param amount Amount to repay (must cover principal + interest)
  function repay(
    uint256 botId,
    uint256 amount
  ) external nonReentrant whenNotPaused {
    _repayInternal(botId, amount, 0);
  }

  /// @notice Repay with profit sharing - share task profits with LPs
  /// @param botId ID of the bot
  /// @param repayAmount Amount to repay (principal + interest)
  /// @param profitAmount Profit earned from tasks (5% goes to LPs)
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

    // Calculate amount owed
    uint256 amountOwed = getAmountOwed(botId);
    if (repayAmount < amountOwed) revert InvalidRepayAmount();

    uint256 interest = amountOwed - loan.principal;
    uint256 principal = loan.principal;

    // Calculate profit share if any
    uint256 profitShare = 0;
    if (profitAmount > 0) {
      profitShare = (profitAmount * REVENUE_SHARE_BPS) / BPS_DENOMINATOR;
    }

    uint256 totalPayment = repayAmount + profitShare;

    // Transfer USDC
    usdc.safeTransferFrom(msg.sender, address(this), totalPayment);

    // Update state
    totalBorrows -= principal;
    loan.active = false;

    // Add interest to deposits (minus reserves)
    uint256 reserveAmount = (interest * reserveFactor) / BPS_DENOMINATOR;
    reserves += reserveAmount;
    totalDeposits += (interest - reserveAmount);

    // Add profit share to reward pool
    if (profitShare > 0) {
      rewardPool += profitShare;
      if (totalShares > 0) {
        rewardIndex += (profitShare * RAY) / totalShares;
      }
      emit RewardsDistributed(profitShare);
    }

    // Record repayment in credit scoring (if enabled)
    if (address(creditScoring) != address(0)) {
      creditScoring.recordRepayment(botId, repayAmount);
    }

    if (profitShare > 0) {
      emit RepaidWithProfit(botId, principal, interest, profitShare);
    } else {
      emit Repaid(botId, principal, interest);
    }
  }

  // ============ Reward Functions ============

  /// @notice Claim accumulated rewards
  function claimRewards() external nonReentrant {
    _claimRewards(msg.sender);
  }

  function _claimRewards(address depositor) internal {
    uint256 pending = pendingRewards(depositor);
    if (pending == 0) return;

    Deposit storage dep = deposits[depositor];
    dep.rewardDebt = (dep.shares * rewardIndex) / RAY;

    if (pending > rewardPool) {
      pending = rewardPool;
    }
    rewardPool -= pending;

    usdc.safeTransfer(depositor, pending);

    emit RewardsClaimed(depositor, pending);
  }

  // ============ Interest Accrual ============

  /// @notice Accrue interest to the pool
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

    // Update borrow index
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
    // Total value = deposits + accrued interest (simplified)
    return totalDeposits;
  }

  // ============ Admin Functions ============

  /// @notice Update reserve factor
  function setReserveFactor(uint256 newFactor) external onlyOwner {
    require(newFactor <= 5000, 'Max 50%');
    uint256 oldFactor = reserveFactor;
    reserveFactor = newFactor;
    emit ReserveFactorUpdated(oldFactor, newFactor);
  }

  /// @notice Update max borrow per block
  function setMaxBorrowPerBlock(uint256 newLimit) external onlyOwner {
    maxBorrowPerBlock = newLimit;
  }

  /// @notice Withdraw protocol reserves
  function withdrawReserves(uint256 amount, address to) external onlyOwner {
    require(amount <= reserves, 'Exceeds reserves');
    reserves -= amount;
    usdc.safeTransfer(to, amount);
  }

  /// @notice Set LP incentives contract
  function setLPIncentives(address _incentives) external onlyOwner {
    lpIncentives = LPIncentives(_incentives);
    emit LPIncentivesSet(_incentives);
  }

  /// @notice Set credit scoring contract
  function setCreditScoring(address _scoring) external onlyOwner {
    creditScoring = CreditScoring(_scoring);
    emit CreditScoringSet(_scoring);
  }

  /// @notice Set agent verification contract
  function setAgentVerification(address _verification) external onlyOwner {
    agentVerification = AgentVerification(_verification);
    emit AgentVerificationSet(_verification);
  }

  /// @notice Enable/disable credit-based limit enforcement
  function setEnforceCreditLimits(bool _enforce) external onlyOwner {
    enforceCreditLimits = _enforce;
    emit CreditLimitsEnforcementUpdated(_enforce);
  }

  /// @notice Enable/disable verification requirement
  function setRequireVerification(bool _require) external onlyOwner {
    requireVerification = _require;
    emit VerificationRequirementUpdated(_require);
  }

  /// @notice Pause pool
  function pause() external onlyOwner {
    _pause();
  }

  /// @notice Unpause pool
  function unpause() external onlyOwner {
    _unpause();
  }
}
