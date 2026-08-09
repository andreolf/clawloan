// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

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

  // ============ Storage appended in V3.1 (drain protection) ============
  // IMPORTANT: these are appended at the END of storage to keep the upgradeable
  // layout stable. Never reorder or insert storage above this point.

  // Per-block borrow rate limit. 0 = disabled. Bounds how much can be borrowed
  // in a single block, capping the damage from any borrow-and-default drain (C-2).
  uint256 public maxBorrowPerBlock;
  uint256 public currentBlockBorrows; // amount borrowed in `lastBorrowBlock`
  uint256 public lastBorrowBlock;      // block.number of the last borrow

  // Upgrade-safe reentrancy guard. Implemented as a plain storage variable (not
  // the non-upgradeable OZ ReentrancyGuard base, whose constructor never runs in
  // a proxy and whose sequential slot shifts if inheritance order changes — audit
  // M-1). 0 (uninitialized) is treated as "not entered".
  uint256 private _reentrancyStatus;

  // ============ Operator bonds + reserve-backed credit (undercollateralized) ==
  // Per-operator USDC bond, aggregate active debt, and unbonding timer. Bonds are
  // segregated from totalDeposits: staked USDC is never lent, only slashed on
  // default. Solvency invariant maintained at all times:  totalUnbacked <= reserves
  // where totalUnbacked = Σ max(0, operatorDebt[op] - stake[op]).
  mapping(address => uint256) public stake;        // bonded USDC per operator
  mapping(address => uint256) public operatorDebt; // Σ active loan principal per operator
  mapping(address => uint256) public unbondAt;     // earliest unbond time (0 = no pending request)
  uint256 public totalStaked;                       // Σ stake
  uint256 public totalUnbacked;                     // Σ max(0, debt - stake) — LHS of the invariant
  uint256 public maxCreditLine;                     // flat per-operator credit bonus cap (reserve-backed)
  uint256 public unbondingPeriod;                   // delay between requestUnbond() and unbond()
  bool public bondsRequired;                         // true = enforce bonded limit + invariant

  // Reserved storage slots for future upgrades. Reduce this array when adding
  // new state so the overall layout stays stable across upgrades.
  uint256[36] private __gap;

  // ============ Events ============

  event Deposited(address indexed lp, uint256 amount, uint256 shares);
  event Withdrawn(address indexed lp, uint256 shares, uint256 amount);
  event Borrowed(uint256 indexed botId, uint256 amount, address indexed operator, uint256 deadline);
  event Repaid(uint256 indexed botId, uint256 principal, uint256 interest, uint256 rewardShare);
  event Liquidated(uint256 indexed botId, address indexed liquidator, uint256 amount, uint256 bonus);
  event RewardsClaimed(address indexed lp, uint256 amount);
  event Bonded(address indexed operator, uint256 amount, uint256 newStake);
  event UnbondRequested(address indexed operator, uint256 readyAt);
  event Unbonded(address indexed operator, uint256 amount, uint256 newStake);
  event Slashed(address indexed operator, uint256 amount, uint256 fromReserves);

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
  error NotOperator();
  error BotNotActive();
  error ExceedsMaxSpend();
  error ExceedsBorrowRateLimit();
  error ReentrantCall();
  error ExceedsBondedLimit();
  error ExceedsSystemCredit();
  error InsufficientStake();
  error UnbondNotReady();

  // ============ Reentrancy Guard (upgrade-safe, storage-based) ============

  uint256 private constant _ENTERED = 2;
  uint256 private constant _NOT_ENTERED = 1;

  modifier nonReentrant() {
    if (_reentrancyStatus == _ENTERED) revert ReentrantCall();
    _reentrancyStatus = _ENTERED;
    _;
    _reentrancyStatus = _NOT_ENTERED;
  }

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
    maxBorrowPerBlock = 50_000e6; // 50k USDC/block default; owner-tunable, 0 disables

    // Operator-bond underwriting (undercollateralized-but-solvent). Launch with
    // bonds required; borrow limit = stake + creditLine, capped by reserves.
    bondsRequired = true;
    maxCreditLine = 100e6; // flat 100 USDC reserve-backed credit bonus per operator
    unbondingPeriod = 7 days;

    // NOTE: initialize() does NOT run when upgrading an already-deployed proxy.
    // After upgrading an existing V3 proxy, the owner MUST call
    // setMaxBorrowPerBlock(...) and the bond setters to configure this module.
  }

  // ============ Bond underwriting: internal helpers ============

  /// @dev Unbacked exposure = the portion of debt not covered by the operator's own bond.
  function _unbacked(uint256 debt, uint256 s) internal pure returns (uint256) {
    return debt > s ? debt - s : 0;
  }

  /// @dev Reserve-backed credit bonus for a bot: the existing credit-tier
  ///      recommendation, flat-capped at maxCreditLine. Sybil resistance comes
  ///      from the require8004Attestation / minBotAge gates in borrow().
  function _creditLine(uint256 botId) internal view returns (uint256) {
    if (address(creditScoring) == address(0)) return 0;
    uint256 rec = creditScoring.getRecommendedLimit(botId);
    return rec > maxCreditLine ? maxCreditLine : rec;
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

    // Authorization: only the bot's operator may borrow on its behalf, and the
    // bot must be active. (C-2: V3 previously had no caller-authorization check.)
    if (!botRegistry.isOperator(botId, msg.sender)) revert NotOperator();
    if (!botRegistry.isBotActive(botId)) revert BotNotActive();

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

    // Enforce the permissioned per-bot spend cap (C-2: V3 previously omitted this).
    if (!permissionsRegistry.canSpend(botId, amount)) revert ExceedsMaxSpend();

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

    // Per-block borrow rate limit: bounds how much can be drained in one block
    // (C-2 defense-in-depth). 0 = disabled.
    if (maxBorrowPerBlock > 0) {
      if (block.number != lastBorrowBlock) {
        lastBorrowBlock = block.number;
        currentBlockBorrows = 0;
      }
      currentBlockBorrows += amount;
      if (currentBlockBorrows > maxBorrowPerBlock) revert ExceedsBorrowRateLimit();
    }

    // Operator-bond underwriting: limit = stake + creditLine, and the system-wide
    // unbacked exposure must stay within reserves (solvency invariant). Debt is
    // always tracked; the checks are only enforced when bondsRequired.
    {
      uint256 s = stake[msg.sender];
      uint256 newDebt = operatorDebt[msg.sender] + amount;
      uint256 delta = _unbacked(newDebt, s) - _unbacked(operatorDebt[msg.sender], s);
      if (bondsRequired) {
        if (newDebt > s + _creditLine(botId)) revert ExceedsBondedLimit();
        if (totalUnbacked + delta > reserves) revert ExceedsSystemCredit();
      }
      operatorDebt[msg.sender] = newDebt;
      totalUnbacked += delta;
    }

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

    // Bond accounting: release the operator's debt and update the invariant LHS.
    {
      uint256 s = stake[loan.operator];
      uint256 beforeU = _unbacked(operatorDebt[loan.operator], s);
      operatorDebt[loan.operator] -= loan.amount;
      totalUnbacked -= (beforeU - _unbacked(operatorDebt[loan.operator], s));
    }

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

  /// @notice Liquidate an expired loan, recovering LP funds from the operator's
  ///         bond and (for the unbacked portion) from reserves.
  /// @dev Loans are undercollateralized: the operator posts a bond and may borrow
  ///      up to stake + creditLine, where the beyond-stake ("unbacked") portion is
  ///      pre-funded system-wide by reserves (invariant: totalUnbacked <= reserves).
  ///      On default we (1) realize the principal loss, then recover it by slashing
  ///      the operator's stake and drawing the residual from reserves — so LP
  ///      principal is preserved whenever the invariant held (bondsRequired). Any
  ///      shortfall (only possible in legacy/bonds-off mode) stays socialized to
  ///      LPs. Interest on a defaulted loan is forgone yield, not a principal loss.
  ///      Anyone may call this once the loan has expired.
  function liquidate(uint256 botId) external nonReentrant {
    Loan memory loan = loans[botId];
    if (loan.amount == 0) revert NoActiveLoan();
    if (block.timestamp <= loan.deadline) revert LoanNotExpired();

    _accrueInterest();

    uint256 principal = loan.amount;
    address op = loan.operator;
    uint256 stakeBefore = stake[op];
    uint256 beforeU = _unbacked(operatorDebt[op], stakeBefore);

    // Clear the loan and remove it from outstanding borrows.
    delete loans[botId];
    totalBorrows -= principal;

    // Realize the loss of the defaulted principal against LP deposits...
    if (principal <= totalDeposits) {
      totalDeposits -= principal;
    } else {
      totalDeposits = 0;
    }

    // ...then recover it: slash the operator's bond back into LP deposits.
    uint256 slash = stakeBefore >= principal ? principal : stakeBefore;
    if (slash > 0) {
      stake[op] = stakeBefore - slash;
      totalStaked -= slash;
      totalDeposits += slash;
    }

    // Cover the unbacked residual from reserves (capped; the invariant guarantees
    // reserves suffice when bondsRequired). Any uncovered remainder stays a
    // socialized LP loss (legacy mode only).
    uint256 residual = principal - slash;
    uint256 fromReserves = residual <= reserves ? residual : reserves;
    if (fromReserves > 0) {
      reserves -= fromReserves;
      totalDeposits += fromReserves;
    }

    // Bond accounting: release the operator's debt and update the invariant LHS.
    operatorDebt[op] -= principal;
    totalUnbacked -= (beforeU - _unbacked(operatorDebt[op], stake[op]));

    // Record the default (resets streak, increments defaults, lowers tier).
    if (address(creditScoring) != address(0)) {
      creditScoring.recordDefault(botId, principal);
    }

    emit Slashed(op, slash, fromReserves);
    emit Liquidated(botId, msg.sender, principal, slash);
  }

  // ============ Bond underwriting: operator functions ============

  /// @notice Bond (stake) USDC to unlock borrowing capacity. Cancels any pending unbond.
  function bond(uint256 amount) external nonReentrant whenNotPaused {
    if (amount == 0) revert InvalidAmount();
    stake[msg.sender] += amount;
    totalStaked += amount;
    unbondAt[msg.sender] = 0; // bonding cancels a pending unbond request
    usdc.safeTransferFrom(msg.sender, address(this), amount);
    emit Bonded(msg.sender, amount, stake[msg.sender]);
  }

  /// @notice Start the unbonding timer. Stake can be withdrawn after unbondingPeriod.
  function requestUnbond() external {
    if (stake[msg.sender] == 0) revert InsufficientStake();
    unbondAt[msg.sender] = block.timestamp + unbondingPeriod;
    emit UnbondRequested(msg.sender, unbondAt[msg.sender]);
  }

  /// @notice Withdraw bonded USDC after the unbonding delay, if it keeps the
  ///         operator within their limit and preserves the solvency invariant.
  function unbond(uint256 amount) external nonReentrant {
    if (amount == 0) revert InvalidAmount();
    if (amount > stake[msg.sender]) revert InsufficientStake();
    uint256 ready = unbondAt[msg.sender];
    if (ready == 0 || block.timestamp < ready) revert UnbondNotReady();

    uint256 newStake = stake[msg.sender] - amount;
    uint256 debt = operatorDebt[msg.sender];
    // Reducing stake raises unbacked exposure; both the per-operator limit and
    // the global invariant must still hold afterwards.
    uint256 delta = _unbacked(debt, newStake) - _unbacked(debt, stake[msg.sender]);
    if (debt > newStake + maxCreditLine) revert ExceedsBondedLimit();
    if (totalUnbacked + delta > reserves) revert ExceedsSystemCredit();

    stake[msg.sender] = newStake;
    totalStaked -= amount;
    totalUnbacked += delta;
    usdc.safeTransfer(msg.sender, amount);
    emit Unbonded(msg.sender, amount, newStake);
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

  /// @notice Set the per-block borrow rate limit (0 disables it)
  function setMaxBorrowPerBlock(uint256 _max) external onlyOwner {
    maxBorrowPerBlock = _max;
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
    // Reserves committed as credit backing cannot be withdrawn (keeps the
    // solvency invariant totalUnbacked <= reserves intact).
    require(reserves - amount >= totalUnbacked, 'Would break solvency invariant');
    reserves -= amount;
    usdc.safeTransfer(msg.sender, amount);
  }

  /// @notice Flat per-operator reserve-backed credit bonus (beyond their bond).
  function setMaxCreditLine(uint256 _max) external onlyOwner {
    maxCreditLine = _max;
  }

  /// @notice Delay between requestUnbond() and unbond().
  function setUnbondingPeriod(uint256 _period) external onlyOwner {
    unbondingPeriod = _period;
  }

  /// @notice Toggle bond enforcement. Off = legacy credit-limit gating (grace
  ///         window for upgrading a live pool); on = bonded limit + invariant.
  function setBondsRequired(bool _required) external onlyOwner {
    bondsRequired = _required;
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
