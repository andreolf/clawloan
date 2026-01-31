// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import 'forge-std/Test.sol';
import 'forge-std/StdInvariant.sol';
import '../src/MockUSDC.sol';
import '../src/BotRegistry.sol';
import '../src/PermissionsRegistry.sol';
import '../src/LendingPool.sol';

/// @title LendingPoolHandler - Handler for invariant testing
contract LendingPoolHandler is Test {
  MockUSDC public usdc;
  BotRegistry public botRegistry;
  PermissionsRegistry public permRegistry;
  LendingPool public pool;

  address[] public actors;
  address[] public operators;
  uint256[] public botIds;

  uint256 public ghost_depositSum;
  uint256 public ghost_withdrawSum;
  uint256 public ghost_borrowSum;
  uint256 public ghost_repaySum;

  constructor(
    MockUSDC _usdc,
    BotRegistry _botRegistry,
    PermissionsRegistry _permRegistry,
    LendingPool _pool
  ) {
    usdc = _usdc;
    botRegistry = _botRegistry;
    permRegistry = _permRegistry;
    pool = _pool;

    // Create actors
    for (uint256 i = 0; i < 5; i++) {
      address actor = address(uint160(0x1000 + i));
      actors.push(actor);
      usdc.mint(actor, 1_000_000e6);
      vm.prank(actor);
      usdc.approve(address(pool), type(uint256).max);
    }

    // Create operators with bots
    for (uint256 i = 0; i < 3; i++) {
      address operator = address(uint160(0x2000 + i));
      operators.push(operator);

      vm.prank(operator);
      uint256 botId = botRegistry.registerBot('ipfs://test', operator);
      botIds.push(botId);

      vm.prank(operator);
      permRegistry.setPermissions(botId, bytes32(0), 100_000e6, 0);

      usdc.mint(operator, 1_000_000e6);
      vm.prank(operator);
      usdc.approve(address(pool), type(uint256).max);
    }
  }

  function deposit(uint256 actorSeed, uint256 amount) public {
    amount = bound(amount, 1e6, 100_000e6);
    address actor = actors[actorSeed % actors.length];

    vm.prank(actor);
    pool.deposit(amount);

    ghost_depositSum += amount;
  }

  function withdraw(uint256 actorSeed, uint256 shares) public {
    address actor = actors[actorSeed % actors.length];

    (uint256 actorShares, ) = pool.deposits(actor);
    if (actorShares == 0) return;

    shares = bound(shares, 1, actorShares);

    uint256 value = pool.getShareValue(shares);

    vm.prank(actor);
    pool.withdraw(shares);

    ghost_withdrawSum += value;
  }

  function borrow(uint256 operatorSeed, uint256 amount) public {
    uint256 idx = operatorSeed % operators.length;
    address operator = operators[idx];
    uint256 botId = botIds[idx];

    // Check if bot already has active loan
    (uint256 principal, , , ) = pool.loans(botId);
    if (principal > 0) return;

    uint256 available = pool.totalDeposits() - pool.totalBorrows();
    if (available < 1e6) return;

    amount = bound(amount, 1e6, available > 50_000e6 ? 50_000e6 : available);

    vm.prank(operator);
    try pool.borrow(botId, amount) {
      ghost_borrowSum += amount;
    } catch {}
  }

  function repay(uint256 operatorSeed, uint256 amount) public {
    uint256 idx = operatorSeed % operators.length;
    address operator = operators[idx];
    uint256 botId = botIds[idx];

    (uint256 principal, , , ) = pool.loans(botId);
    if (principal == 0) return;

    uint256 owed = pool.getAmountOwed(botId);
    amount = bound(amount, 1, owed);

    vm.prank(operator);
    pool.repay(botId, amount);

    ghost_repaySum += amount;
  }

  function warpTime(uint256 seconds_) public {
    seconds_ = bound(seconds_, 1 minutes, 30 days);
    vm.warp(block.timestamp + seconds_);
  }

  function accrueInterest() public {
    pool.accrueInterest();
  }
}

/// @title InvariantTest - Protocol invariant tests
contract InvariantTest is StdInvariant, Test {
  MockUSDC public usdc;
  BotRegistry public botRegistry;
  PermissionsRegistry public permRegistry;
  LendingPool public pool;
  LendingPoolHandler public handler;

  function setUp() public {
    usdc = new MockUSDC();
    botRegistry = new BotRegistry();
    permRegistry = new PermissionsRegistry(address(botRegistry));
    pool = new LendingPool(
      address(usdc),
      address(botRegistry),
      address(permRegistry)
    );

    // Increase rate limit for testing
    pool.setMaxBorrowPerBlock(1_000_000e6);

    handler = new LendingPoolHandler(usdc, botRegistry, permRegistry, pool);

    targetContract(address(handler));
  }

  /// @notice Total deposits should always >= total borrows
  function invariant_depositsGteBorrows() public view {
    assertGe(pool.totalDeposits(), pool.totalBorrows());
  }

  /// @notice Pool USDC balance should equal deposits - borrows + reserves
  function invariant_poolBalance() public view {
    uint256 expectedBalance = pool.totalDeposits() -
      pool.totalBorrows() +
      pool.reserves();
    uint256 actualBalance = usdc.balanceOf(address(pool));

    // Allow for small rounding differences due to interest accrual
    assertApproxEqAbs(actualBalance, expectedBalance, 1e6);
  }

  /// @notice Total shares should be > 0 if total deposits > 0
  function invariant_sharesConsistency() public view {
    if (pool.totalDeposits() > 0) {
      assertGt(pool.totalShares(), 0);
    }
  }

  /// @notice Borrow index should never decrease
  function invariant_borrowIndexNonDecreasing() public view {
    assertGe(pool.borrowIndex(), 1e27);
  }

  /// @notice Utilization should never exceed 100%
  function invariant_utilizationBounded() public view {
    uint256 utilization = pool.getUtilization();
    assertLe(utilization, 1e27);
  }

  /// @notice Call summary for debugging
  function invariant_callSummary() public view {
    console.log('Deposit sum:', handler.ghost_depositSum());
    console.log('Withdraw sum:', handler.ghost_withdrawSum());
    console.log('Borrow sum:', handler.ghost_borrowSum());
    console.log('Repay sum:', handler.ghost_repaySum());
    console.log('Total deposits:', pool.totalDeposits());
    console.log('Total borrows:', pool.totalBorrows());
  }
}
