// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import 'forge-std/Test.sol';
import '../src/MockUSDC.sol';
import '../src/BotRegistry.sol';
import '../src/PermissionsRegistry.sol';
import '../src/LendingPool.sol';

contract LendingPoolTest is Test {
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

    // Setup lender with USDC
    usdc.mint(lender, 100_000e6);
    vm.prank(lender);
    usdc.approve(address(pool), type(uint256).max);

    // Setup bot
    vm.prank(operator);
    botId = botRegistry.registerBot('ipfs://test', operator);

    // Setup permissions
    vm.prank(operator);
    permRegistry.setPermissions(botId, bytes32(0), 10_000e6, 0);

    // Give operator USDC for repayment
    usdc.mint(operator, 50_000e6);
    vm.prank(operator);
    usdc.approve(address(pool), type(uint256).max);
  }

  // ============ Deposit Tests ============

  function test_Deposit() public {
    vm.prank(lender);
    pool.deposit(1000e6);

    assertEq(pool.totalDeposits(), 1000e6);
    assertEq(pool.totalShares(), 1000e6);

    (uint256 shares, ) = pool.deposits(lender);
    assertEq(shares, 1000e6);
  }

  function test_Deposit_MultipleDepositors() public {
    address lender2 = makeAddr('lender2');
    usdc.mint(lender2, 50_000e6);
    vm.prank(lender2);
    usdc.approve(address(pool), type(uint256).max);

    vm.prank(lender);
    pool.deposit(1000e6);

    vm.prank(lender2);
    pool.deposit(2000e6);

    assertEq(pool.totalDeposits(), 3000e6);
  }

  function test_Deposit_RevertZeroAmount() public {
    vm.prank(lender);
    vm.expectRevert(LendingPool.ZeroAmount.selector);
    pool.deposit(0);
  }

  // ============ Withdraw Tests ============

  function test_Withdraw() public {
    vm.prank(lender);
    pool.deposit(1000e6);

    uint256 balanceBefore = usdc.balanceOf(lender);

    vm.prank(lender);
    pool.withdraw(1000e6);

    assertEq(usdc.balanceOf(lender), balanceBefore + 1000e6);
    assertEq(pool.totalDeposits(), 0);
  }

  function test_Withdraw_Partial() public {
    vm.prank(lender);
    pool.deposit(1000e6);

    vm.prank(lender);
    pool.withdraw(400e6);

    (uint256 shares, ) = pool.deposits(lender);
    assertEq(shares, 600e6);
  }

  function test_Withdraw_RevertInsufficientShares() public {
    vm.prank(lender);
    pool.deposit(1000e6);

    vm.prank(lender);
    vm.expectRevert(LendingPool.InsufficientShares.selector);
    pool.withdraw(2000e6);
  }

  // ============ Borrow Tests ============

  function test_Borrow() public {
    // Lender deposits
    vm.prank(lender);
    pool.deposit(10_000e6);

    // Bot borrows
    vm.prank(operator);
    pool.borrow(botId, 1000e6);

    assertEq(pool.totalBorrows(), 1000e6);
    assertEq(usdc.balanceOf(operator), 50_000e6 + 1000e6);
  }

  function test_Borrow_RevertNotOperator() public {
    vm.prank(lender);
    pool.deposit(10_000e6);

    vm.prank(lender);
    vm.expectRevert(LendingPool.NotOperator.selector);
    pool.borrow(botId, 1000e6);
  }

  function test_Borrow_RevertExceedsMaxSpend() public {
    vm.prank(lender);
    pool.deposit(100_000e6);

    vm.prank(operator);
    vm.expectRevert(LendingPool.ExceedsMaxSpend.selector);
    pool.borrow(botId, 20_000e6); // Max is 10k
  }

  function test_Borrow_RevertInsufficientLiquidity() public {
    vm.prank(lender);
    pool.deposit(500e6);

    vm.prank(operator);
    vm.expectRevert(LendingPool.InsufficientLiquidity.selector);
    pool.borrow(botId, 1000e6);
  }

  function test_Borrow_RevertLoanAlreadyActive() public {
    vm.prank(lender);
    pool.deposit(10_000e6);

    vm.prank(operator);
    pool.borrow(botId, 500e6);

    vm.prank(operator);
    vm.expectRevert(LendingPool.LoanAlreadyActive.selector);
    pool.borrow(botId, 500e6);
  }

  // ============ Repay Tests ============

  function test_Repay() public {
    vm.prank(lender);
    pool.deposit(10_000e6);

    vm.prank(operator);
    pool.borrow(botId, 1000e6);

    // Fast forward 30 days
    vm.warp(block.timestamp + 30 days);

    uint256 owed = pool.getAmountOwed(botId);
    assertGt(owed, 1000e6); // Should have accrued interest

    vm.prank(operator);
    pool.repay(botId, owed);

    assertEq(pool.totalBorrows(), 0);
  }

  function test_RepayWithProfit() public {
    vm.prank(lender);
    pool.deposit(10_000e6);

    vm.prank(operator);
    pool.borrow(botId, 1000e6);

    vm.warp(block.timestamp + 7 days);

    uint256 owed = pool.getAmountOwed(botId);
    uint256 profit = 100e6; // Bot earned 100 USDC profit
    uint256 profitShare = (profit * 500) / 10000; // 5% = 5 USDC

    vm.prank(operator);
    pool.repayWithProfit(botId, owed, profit);

    // Check reward pool increased
    assertGt(pool.rewardPool(), 0);
  }

  function test_Repay_RevertNoActiveLoan() public {
    vm.prank(operator);
    vm.expectRevert(LendingPool.NoActiveLoan.selector);
    pool.repay(botId, 1000e6);
  }

  // ============ Interest Rate Tests ============

  function test_GetUtilization_Zero() public view {
    assertEq(pool.getUtilization(), 0);
  }

  function test_GetUtilization_AfterBorrow() public {
    vm.prank(lender);
    pool.deposit(10_000e6);

    vm.prank(operator);
    pool.borrow(botId, 2000e6);

    // 2000 / 10000 = 20% = 0.2e27
    uint256 util = pool.getUtilization();
    assertEq(util, 0.2e27);
  }

  function test_GetBorrowRate_BelowOptimal() public {
    vm.prank(lender);
    pool.deposit(10_000e6);

    vm.prank(operator);
    pool.borrow(botId, 2000e6);

    uint256 rate = pool.getBorrowRate();
    // At 20% util: BASE (2%) + SLOPE1 (4%) * 0.2/0.8 = 2% + 1% = 3%
    // = 0.03e27
    assertGt(rate, 0.02e27);
    assertLt(rate, 0.1e27);
  }

  function test_GetSupplyRate() public {
    vm.prank(lender);
    pool.deposit(10_000e6);

    vm.prank(operator);
    pool.borrow(botId, 5000e6);

    uint256 supplyRate = pool.getSupplyRate();
    assertGt(supplyRate, 0);
  }

  // ============ Admin Tests ============

  function test_SetReserveFactor() public {
    vm.prank(owner);
    pool.setReserveFactor(2000); // 20%

    assertEq(pool.reserveFactor(), 2000);
  }

  function test_SetReserveFactor_RevertMax50() public {
    vm.prank(owner);
    vm.expectRevert();
    pool.setReserveFactor(6000); // 60%
  }

  function test_Pause() public {
    vm.prank(owner);
    pool.pause();

    vm.prank(lender);
    vm.expectRevert();
    pool.deposit(1000e6);
  }

  // ============ Fuzz Tests ============

  function testFuzz_Deposit(uint256 amount) public {
    vm.assume(amount > 0 && amount <= 100_000e6);

    vm.prank(lender);
    pool.deposit(amount);

    assertEq(pool.totalDeposits(), amount);
  }

  function testFuzz_DepositWithdraw(
    uint256 depositAmount,
    uint256 withdrawShares
  ) public {
    vm.assume(depositAmount > 0 && depositAmount <= 100_000e6);
    vm.assume(withdrawShares > 0 && withdrawShares <= depositAmount);

    vm.prank(lender);
    pool.deposit(depositAmount);

    vm.prank(lender);
    pool.withdraw(withdrawShares);

    (uint256 remainingShares, ) = pool.deposits(lender);
    assertEq(remainingShares, depositAmount - withdrawShares);
  }
}
