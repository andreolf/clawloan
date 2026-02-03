// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';

import './BotRegistry.sol';
import './PermissionsRegistry.sol';
import './LPIncentives.sol';
import './CreditScoring.sol';
import './AgentVerification.sol';
import './interfaces/IERC8004.sol';

/// @title LendingPoolV3 - UUPS Upgradeable Lending Pool
/// @notice Aave V3 inspired lending pool for bot micro-loans with upgradeability
/// @dev V3 adds UUPS proxy pattern for seamless upgrades without fund migration
contract LendingPoolV3 is 
  Initializable,
  UUPSUpgradeable,
  OwnableUpgradeable,
  ReentrancyGuard,
  PausableUpgradeable 
{
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

  IERC20 public usdc;
  BotRegistry public botRegistry;
  PermissionsRegistry public permissionsRegistry;

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

  // Loan duration & liquidation
  uint256 public maxLoanDuration; // Default 24 hours
  uint256 public liquidationBonus; // Default 5%

  // LP deposits
  struct Deposit {
    uint256 shares;
    uint256 rewardDebt;
  }
  mapping(address => Deposit) public deposits;

  // Active loans (by botId)
  struct Loan {
    uint256 amount;
    uint256 borrowIndex;
    uint256 deadline; // When loan expires (for liquidation)
    address operator;
  }
  mapping(uint256 => Loan) public loans;

  // Credit system
  CreditScoring public creditScoring;
  AgentVerification public agentVerification;
  bool public enforceCreditLimits;
  bool public requireVerification;

  // Sybil prevention
  uint256 public minBotAge;

  // ERC-8004 integration
  IERC8004IdentityRegistry public erc8004Registry;
  bool public require8004Attestation;

  // ============ Events ============

  event Deposited(address indexed lp, uint256 amount, uint256 shares);
  event Withdrawn(address indexed lp, uint256 shares, uint256 amount);
  event Borrowed(uint256 indexed botId, uint256 amount, address indexed operator, uint256 deadline);
  event Repaid(uint256 indexed botId, uint256 principal, uint256 interest, uint256 rewardShare);
  event Liquidated(uint256 indexed botId, address indexed liquidator, uint256 amount, uint256 bonus);
  event RewardsClaimed(address indexed lp, uint256 amount);

  // ============ Errors ============

  error InvalidAmount();
  error InsufficientLiquidity();
  error NoActivePermissions();
  error LoanAlreadyActive();
  error NoActiveLoan();
  error UnauthorizedRepay();
  error InsufficientCreditLimit();
  error VerificationRequired();
  error LoanNotExpired();
  error LoanExpired();
  error BotTooNew();
  error No8004Attestation();

  // ============ Initializer ============

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  /// @notice Initialize the lending pool (replaces constructor)
  /// @param _usdc USDC token address
  /// @param _botRegistry BotRegistry contract
  /// @param _permissionsRegistry PermissionsRegistry contract
  function initialize(
    address _usdc,
    address _botRegistry,
    address _permissionsRegistry
  ) external initializer {
    __Ownable_init(msg.sender);
    __Pausable_init();

    usdc = IERC20(_usdc);
    botRegistry = BotRegistry(_botRegistry);
    permissionsRegistry = PermissionsRegistry(_permissionsRegistry);
    
    borrowIndex = RAY;
    lastAccrualTime = block.timestamp;
    reserveFactor = 0.1e27; // 10%
    maxLoanDuration = 24 hours;
    liquidationBonus = 0.05e27; // 5%
  }

  // ============ Upgrade Authorization ============

  /// @notice Authorize upgrade (only owner can upgrade)
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

  // ============ View Functions ============

  /// @notice Get current utilization ratio (in RAY)
  function getUtilization() public view returns (uint256) {
    if (totalDeposits == 0) return 0;
    return (totalBorrows * RAY) / totalDeposits;
  }

  /// @notice Calculate borrow rate based on utilization (in RAY)
  function getBorrowRate() public view returns (uint256) {
    uint256 utilization = getUtilization();
    if (utilization <= OPTIMAL_UTILIZATION) {
      return BASE_RATE + (utilization * SLOPE1) / OPTIMAL_UTILIZATION;
    }
    uint256 excessUtilization = utilization - OPTIMAL_UTILIZATION;
    uint256 maxExcess = RAY - OPTIMAL_UTILIZATION;
    return BASE_RATE + SLOPE1 + (excessUtilization * SLOPE2) / maxExcess;
  }

  /// @notice Calculate supply rate (borrow rate * utilization * (1 - reserve factor))
  function getSupplyRate() public view returns (uint256) {
    uint256 borrowRate = getBorrowRate();
    uint256 utilization = getUtilization();
    return (borrowRate * utilization * (RAY - reserveFactor)) / (RAY * RAY);
  }

  /// @notice Convert shares to underlying amount
  function sharesToAmount(uint256 shares) public view returns (uint256) {
    if (totalShares == 0) return shares;
    return (shares * totalDeposits) / totalShares;
  }

  /// @notice Convert amount to shares
  function amountToShares(uint256 amount) public view returns (uint256) {
    if (totalShares == 0) return amount;
    return (amount * totalShares) / totalDeposits;
  }

  /// @notice Check if a loan can be liquidated
  function canLiquidate(uint256 botId) public view returns (bool) {
    Loan memory loan = loans[botId];
    return loan.amount > 0 && block.timestamp > loan.deadline;
  }

  // ============ LP Functions ============

  /// @notice Deposit USDC and receive shares
  function deposit(uint256 amount) external nonReentrant whenNotPaused returns (uint256 shares) {
    if (amount == 0) revert InvalidAmount();
    
    _accrueInterest();
    
    shares = amountToShares(amount);
    
    Deposit storage dep = deposits[msg.sender];
    _claimRewards(msg.sender);
    
    dep.shares += shares;
    dep.rewardDebt = (dep.shares * rewardIndex) / RAY;
    
    totalShares += shares;
    totalDeposits += amount;
    
    usdc.safeTransferFrom(msg.sender, address(this), amount);
    
    emit Deposited(msg.sender, amount, shares);
  }

  /// @notice Withdraw USDC by burning shares
  function withdraw(uint256 shares) external nonReentrant returns (uint256 amount) {
    Deposit storage dep = deposits[msg.sender];
    if (shares > dep.shares) revert InvalidAmount();
    
    _accrueInterest();
    _claimRewards(msg.sender);
    
    amount = sharesToAmount(shares);
    
    uint256 available = totalDeposits - totalBorrows;
    if (amount > available) revert InsufficientLiquidity();
    
    dep.shares -= shares;
    dep.rewardDebt = (dep.shares * rewardIndex) / RAY;
    
    totalShares -= shares;
    totalDeposits -= amount;
    
    usdc.safeTransfer(msg.sender, amount);
    
    emit Withdrawn(msg.sender, shares, amount);
  }

  /// @notice Claim accumulated rewards
  function claimRewards() external nonReentrant {
    _claimRewards(msg.sender);
  }

  // ============ Bot Functions ============

  /// @notice Borrow USDC for a registered bot
  function borrow(uint256 botId, uint256 amount) external nonReentrant whenNotPaused {
    if (amount == 0) revert InvalidAmount();
    if (loans[botId].amount > 0) revert LoanAlreadyActive();
    
    // Check minimum bot age (Sybil prevention)
    if (minBotAge > 0) {
      (, , uint256 registeredAt, ) = botRegistry.getBot(botId);
      if (block.timestamp < registeredAt + minBotAge) revert BotTooNew();
    }

    // Check ERC-8004 attestation
    if (require8004Attestation && address(erc8004Registry) != address(0)) {
      if (erc8004Registry.balanceOf(msg.sender) == 0) revert No8004Attestation();
    }

    // Verify permissions
    if (!permissionsRegistry.hasValidPermissions(botId)) {
      revert NoActivePermissions();
    }
    
    // Check credit limit if enforced
    if (enforceCreditLimits && address(creditScoring) != address(0)) {
      uint256 limit = creditScoring.getRecommendedLimit(botId);
      if (amount > limit) revert InsufficientCreditLimit();
    }
    
    // Check verification if required
    if (requireVerification && address(agentVerification) != address(0)) {
      if (!agentVerification.isVerified(botId)) revert VerificationRequired();
    }
    
    _accrueInterest();
    
    uint256 available = totalDeposits - totalBorrows;
    if (amount > available) revert InsufficientLiquidity();
    
    uint256 deadline = block.timestamp + maxLoanDuration;
    
    loans[botId] = Loan({
      amount: amount,
      borrowIndex: borrowIndex,
      deadline: deadline,
      operator: msg.sender
    });
    
    totalBorrows += amount;
    
    usdc.safeTransfer(msg.sender, amount);
    
    emit Borrowed(botId, amount, msg.sender, deadline);
  }

  /// @notice Repay a loan with interest
  function repay(uint256 botId) external nonReentrant {
    Loan memory loan = loans[botId];
    if (loan.amount == 0) revert NoActiveLoan();
    if (msg.sender != loan.operator) revert UnauthorizedRepay();
    if (block.timestamp > loan.deadline) revert LoanExpired();
    
    _accrueInterest();
    
    // Calculate interest
    uint256 interest = (loan.amount * (borrowIndex - loan.borrowIndex)) / loan.borrowIndex;
    uint256 totalDue = loan.amount + interest;
    
    // Calculate reward share (5% of interest goes to LP rewards)
    uint256 reward = (interest * REVENUE_SHARE_BPS) / BPS_DENOMINATOR;
    
    // Clear loan
    delete loans[botId];
    totalBorrows -= loan.amount;
    
    // Add reward to pool
    if (reward > 0) {
      rewardPool += reward;
      if (totalShares > 0) {
        rewardIndex += (reward * RAY) / totalShares;
      }
    }
    
    // Add interest minus reward to reserves
    uint256 toReserves = (interest * reserveFactor) / RAY;
    reserves += toReserves;
    
    // Remaining interest goes to deposits
    uint256 toDeposits = interest - reward - toReserves;
    totalDeposits += toDeposits;
    
    usdc.safeTransferFrom(msg.sender, address(this), totalDue);
    
    // Record successful repayment
    if (address(creditScoring) != address(0)) {
      creditScoring.recordRepayment(botId, loan.amount);
    }
    
    emit Repaid(botId, loan.amount, interest, reward);
  }

  /// @notice Liquidate an expired loan
  function liquidate(uint256 botId) external nonReentrant {
    Loan memory loan = loans[botId];
    if (loan.amount == 0) revert NoActiveLoan();
    if (block.timestamp <= loan.deadline) revert LoanNotExpired();
    
    _accrueInterest();
    
    // Calculate interest and bonus
    uint256 interest = (loan.amount * (borrowIndex - loan.borrowIndex)) / loan.borrowIndex;
    uint256 totalDue = loan.amount + interest;
    uint256 bonus = (totalDue * liquidationBonus) / RAY;
    
    // Clear loan
    delete loans[botId];
    totalBorrows -= loan.amount;
    
    // Liquidator pays total due, receives bonus from reserves
    usdc.safeTransferFrom(msg.sender, address(this), totalDue);
    
    if (bonus > 0 && reserves >= bonus) {
      reserves -= bonus;
      usdc.safeTransfer(msg.sender, bonus);
    }
    
    // Record default
    if (address(creditScoring) != address(0)) {
      creditScoring.recordDefault(botId, loan.amount);
    }
    
    emit Liquidated(botId, msg.sender, totalDue, bonus);
  }

  // ============ Internal Functions ============

  function _accrueInterest() internal {
    uint256 elapsed = block.timestamp - lastAccrualTime;
    if (elapsed == 0) return;
    
    uint256 borrowRate = getBorrowRate();
    uint256 interestFactor = (borrowRate * elapsed) / SECONDS_PER_YEAR;
    
    borrowIndex = borrowIndex + (borrowIndex * interestFactor) / RAY;
    lastAccrualTime = block.timestamp;
  }

  function _claimRewards(address user) internal {
    Deposit storage dep = deposits[user];
    if (dep.shares == 0) return;
    
    uint256 pending = (dep.shares * rewardIndex) / RAY - dep.rewardDebt;
    if (pending > 0 && rewardPool >= pending) {
      rewardPool -= pending;
      usdc.safeTransfer(user, pending);
      emit RewardsClaimed(user, pending);
    }
    
    dep.rewardDebt = (dep.shares * rewardIndex) / RAY;
  }

  // ============ Admin Functions ============

  function setCreditScoring(address _creditScoring) external onlyOwner {
    creditScoring = CreditScoring(_creditScoring);
  }

  function setAgentVerification(address _agentVerification) external onlyOwner {
    agentVerification = AgentVerification(_agentVerification);
  }

  function setEnforceCreditLimits(bool _enforce) external onlyOwner {
    enforceCreditLimits = _enforce;
  }

  function setRequireVerification(bool _require) external onlyOwner {
    requireVerification = _require;
  }

  function setMaxLoanDuration(uint256 _duration) external onlyOwner {
    require(_duration >= 1 hours && _duration <= 7 days, 'Invalid duration');
    maxLoanDuration = _duration;
  }

  function setMinBotAge(uint256 _minAge) external onlyOwner {
    require(_minAge <= 30 days, 'Max 30 days');
    minBotAge = _minAge;
  }

  function setERC8004Registry(address _registry) external onlyOwner {
    erc8004Registry = IERC8004IdentityRegistry(_registry);
  }

  function setRequire8004Attestation(bool _require) external onlyOwner {
    require8004Attestation = _require;
  }

  function withdrawReserves(uint256 amount) external onlyOwner {
    require(amount <= reserves, 'Exceeds reserves');
    reserves -= amount;
    usdc.safeTransfer(msg.sender, amount);
  }

  function pause() external onlyOwner {
    _pause();
  }

  function unpause() external onlyOwner {
    _unpause();
  }

  /// @notice Get contract version (useful for tracking upgrades)
  function version() external pure returns (string memory) {
    return "3.0.0";
  }
}
