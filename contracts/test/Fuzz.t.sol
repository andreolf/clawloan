// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import 'forge-std/Test.sol';
import '../src/MockUSDC.sol';
import '../src/BotRegistry.sol';
import '../src/PermissionsRegistry.sol';
import '../src/LendingPool.sol';

/// @title FuzzTest - Fuzz testing for edge cases
/// @notice Property-based testing for critical functions
contract FuzzTest is Test {
  MockUSDC public usdc;
  BotRegistry public botRegistry;
  PermissionsRegistry public permRegistry;
  LendingPool public pool;

  address public owner = makeAddr('owner');
  address public lender = makeAddr('lender');
  address public operator = makeAddr('operator');

  uint256 public botId;

  function setUp() public {
    vm.startPrank(owner);

    usdc = new MockUSDC();
    botRegistry = new BotRegistry();
    permRegistry = new PermissionsRegistry(address(botRegistry));
    pool = new LendingPool(
      address(usdc),
      address(botRegistry),
      address(permRegistry)
    );

    vm.stopPrank();

    // Setup operator with bot
    vm.prank(operator);
    botId = botRegistry.registerBot('ipfs://test', operator);

    vm.prank(operator);
    permRegistry.setPermissions(botId, bytes32(0), type(uint128).max, 0);

    // Unlimited approvals
    vm.prank(lender);
    usdc.approve(address(pool), type(uint256).max);

    vm.prank(operator);
    usdc.approve(address(pool), type(uint256).max);
  }

  // ============ Deposit Fuzz Tests ============

  function testFuzz_Deposit_SharesCalculation(uint256 amount) public {
    // Bound to reasonable amounts (1 USDC to 10B USDC)
    amount = bound(amount, 1e6, 10_000_000_000e6);

    usdc.mint(lender, amount);

    vm.prank(lender);
    pool.deposit(amount);

    (uint256 shares, ) = pool.deposits(lender);

    // First depositor: shares == amount
    assertEq(shares, amount);
    assertEq(pool.totalDeposits(), amount);
    assertEq(pool.totalShares(), amount);
  }

  function testFuzz_DepositWithdraw_Invariant(
    uint256 depositAmount,
    uint256 withdrawRatio
  ) public {
    depositAmount = bound(depositAmount, 1e6, 1_000_000_000e6);
    withdrawRatio = bound(withdrawRatio, 1, 100); // 1-100%

    usdc.mint(lender, depositAmount);

    vm.prank(lender);
    pool.deposit(depositAmount);

    uint256 withdrawShares = (depositAmount * withdrawRatio) / 100;
    if (withdrawShares == 0) withdrawShares = 1;

    vm.prank(lender);
    pool.withdraw(withdrawShares);

    (uint256 remainingShares, ) = pool.deposits(lender);
    assertEq(remainingShares, depositAmount - withdrawShares);
  }

  function testFuzz_MultipleDepositors(
    uint256 amount1,
    uint256 amount2
  ) public {
    amount1 = bound(amount1, 1e6, 1_000_000_000e6);
    amount2 = bound(amount2, 1e6, 1_000_000_000e6);

    address lender2 = makeAddr('lender2');

    usdc.mint(lender, amount1);
    usdc.mint(lender2, amount2);

    vm.prank(lender2);
    usdc.approve(address(pool), type(uint256).max);

    vm.prank(lender);
    pool.deposit(amount1);

    vm.prank(lender2);
    pool.deposit(amount2);

    assertEq(pool.totalDeposits(), amount1 + amount2);
  }

  // ============ Borrow Fuzz Tests ============

  function testFuzz_Borrow_ValidAmount(
    uint256 depositAmount,
    uint256 borrowRatio
  ) public {
    depositAmount = bound(depositAmount, 10_000e6, 1_000_000_000e6);
    borrowRatio = bound(borrowRatio, 1, 90); // 1-90% utilization

    usdc.mint(lender, depositAmount);
    vm.prank(lender);
    pool.deposit(depositAmount);

    uint256 borrowAmount = (depositAmount * borrowRatio) / 100;
    if (borrowAmount == 0) borrowAmount = 1e6;

    // Ensure within rate limit
    vm.prank(owner);
    pool.setMaxBorrowPerBlock(depositAmount);

    vm.prank(operator);
    pool.borrow(botId, borrowAmount);

    assertEq(pool.totalBorrows(), borrowAmount);
  }

  // ============ Interest Rate Fuzz Tests ============

  function testFuzz_UtilizationRate(uint256 deposits, uint256 borrows) public {
    deposits = bound(deposits, 1e6, 1_000_000_000e6);
    borrows = bound(borrows, 0, deposits - 1); // Can't borrow more than deposits

    usdc.mint(lender, deposits);
    vm.prank(lender);
    pool.deposit(deposits);

    if (borrows > 0) {
      vm.prank(owner);
      pool.setMaxBorrowPerBlock(deposits);

      vm.prank(operator);
      pool.borrow(botId, borrows);
    }

    uint256 utilization = pool.getUtilization();

    // Utilization should be between 0 and 1e27 (0% to 100%)
    assertLe(utilization, 1e27);
  }

  function testFuzz_BorrowRate_Bounded(
    uint256 deposits,
    uint256 borrowRatio
  ) public {
    deposits = bound(deposits, 100e6, 1_000_000_000e6);
    borrowRatio = bound(borrowRatio, 0, 99);

    usdc.mint(lender, deposits);
    vm.prank(lender);
    pool.deposit(deposits);

    if (borrowRatio > 0) {
      uint256 borrows = (deposits * borrowRatio) / 100;
      if (borrows > 0) {
        vm.prank(owner);
        pool.setMaxBorrowPerBlock(deposits);

        vm.prank(operator);
        pool.borrow(botId, borrows);
      }
    }

    uint256 borrowRate = pool.getBorrowRate();

    // Borrow rate should be between 2% (base) and ~81% (max)
    assertGe(borrowRate, 0.02e27); // 2% min
    assertLe(borrowRate, 1e27); // 100% theoretical max
  }

  // ============ Time-based Fuzz Tests ============

  function testFuzz_InterestAccrual(uint256 timeElapsed) public {
    timeElapsed = bound(timeElapsed, 1 minutes, 365 days);

    usdc.mint(lender, 10_000e6);
    vm.prank(lender);
    pool.deposit(10_000e6);

    usdc.mint(operator, 10_000e6);
    vm.prank(operator);
    pool.borrow(botId, 1000e6);

    uint256 initialOwed = pool.getAmountOwed(botId);

    vm.warp(block.timestamp + timeElapsed);

    uint256 finalOwed = pool.getAmountOwed(botId);

    // Interest should always increase over time
    assertGe(finalOwed, initialOwed);
  }

  // ============ Share Value Fuzz Tests ============

  function testFuzz_ShareValue_NonZero(uint256 shares) public {
    shares = bound(shares, 1, 1_000_000_000e6);

    usdc.mint(lender, shares);
    vm.prank(lender);
    pool.deposit(shares);

    uint256 value = pool.getShareValue(shares);

    // Share value should equal deposit for first depositor
    assertEq(value, shares);
  }

  // ============ Permission Fuzz Tests ============

  function testFuzz_Permissions_MaxSpend(
    uint256 maxSpend,
    uint256 borrowAttempt
  ) public {
    maxSpend = bound(maxSpend, 1e6, 10_000e6);
    borrowAttempt = bound(borrowAttempt, maxSpend + 1, maxSpend * 2);

    // Set new permissions with specific max spend
    vm.prank(operator);
    permRegistry.setPermissions(botId, bytes32(0), maxSpend, 0);

    usdc.mint(lender, borrowAttempt * 2);
    vm.prank(lender);
    pool.deposit(borrowAttempt * 2);

    vm.prank(owner);
    pool.setMaxBorrowPerBlock(borrowAttempt * 2);

    // Should revert when exceeding max spend
    vm.prank(operator);
    vm.expectRevert(LendingPool.ExceedsMaxSpend.selector);
    pool.borrow(botId, borrowAttempt);
  }

  function testFuzz_Permissions_Expiry(uint256 expiryOffset) public {
    expiryOffset = bound(expiryOffset, 1 hours, 365 days);

    uint256 expiry = block.timestamp + expiryOffset;

    vm.prank(operator);
    permRegistry.setPermissions(botId, bytes32(0), 10_000e6, expiry);

    // Before expiry: should be valid
    assertTrue(permRegistry.hasValidPermissions(botId));

    // After expiry: should be invalid
    vm.warp(expiry + 1);
    assertFalse(permRegistry.hasValidPermissions(botId));
  }
}
