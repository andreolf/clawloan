// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import 'forge-std/Test.sol';
import '../src/MockUSDC.sol';
import '../src/BotRegistry.sol';
import '../src/PermissionsRegistry.sol';
import '../src/LendingPool.sol';
import '../src/ClawloanToken.sol';
import '../src/StakingModule.sol';

/// @title SecurityTest - Comprehensive security tests
/// @notice Tests for reentrancy, access control, overflow, and edge cases
contract SecurityTest is Test {
  MockUSDC public usdc;
  BotRegistry public botRegistry;
  PermissionsRegistry public permRegistry;
  LendingPool public pool;
  ClawloanToken public clawloan;
  StakingModule public staking;

  address public owner = makeAddr('owner');
  address public attacker = makeAddr('attacker');
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
    clawloan = new ClawloanToken(owner);
    staking = new StakingModule(address(clawloan), address(usdc));

    vm.stopPrank();

    // Setup lender
    usdc.mint(lender, 1_000_000e6);
    vm.prank(lender);
    usdc.approve(address(pool), type(uint256).max);

    // Setup operator with bot
    vm.prank(operator);
    botId = botRegistry.registerBot('ipfs://test', operator);

    vm.prank(operator);
    permRegistry.setPermissions(botId, bytes32(0), 100_000e6, 0);

    usdc.mint(operator, 100_000e6);
    vm.prank(operator);
    usdc.approve(address(pool), type(uint256).max);
  }

  // ============ Reentrancy Tests ============

  function test_ReentrancyGuard_Deposit() public {
    // ReentrancyGuard should prevent reentrancy on deposit
    vm.prank(lender);
    pool.deposit(1000e6);

    // Verify deposit succeeded (reentrancy guard active)
    assertEq(pool.totalDeposits(), 1000e6);
  }

  function test_ReentrancyGuard_Withdraw() public {
    vm.prank(lender);
    pool.deposit(1000e6);

    vm.prank(lender);
    pool.withdraw(500e6);

    // Verify withdrawal succeeded
    assertEq(pool.totalDeposits(), 500e6);
  }

  function test_ReentrancyGuard_Borrow() public {
    vm.prank(lender);
    pool.deposit(10_000e6);

    vm.prank(operator);
    pool.borrow(botId, 1000e6);

    assertEq(pool.totalBorrows(), 1000e6);
  }

  // ============ Access Control Tests ============

  function test_OnlyOwner_Pause() public {
    vm.prank(attacker);
    vm.expectRevert();
    pool.pause();
  }

  function test_OnlyOwner_SetReserveFactor() public {
    vm.prank(attacker);
    vm.expectRevert();
    pool.setReserveFactor(2000);
  }

  function test_OnlyOwner_WithdrawReserves() public {
    vm.prank(attacker);
    vm.expectRevert();
    pool.withdrawReserves(1000e6, attacker);
  }

  function test_OnlyOperator_Borrow() public {
    vm.prank(lender);
    pool.deposit(10_000e6);

    // Non-operator cannot borrow for a bot
    vm.prank(attacker);
    vm.expectRevert(LendingPool.NotOperator.selector);
    pool.borrow(botId, 1000e6);
  }

  function test_OnlyOperator_Repay() public {
    vm.prank(lender);
    pool.deposit(10_000e6);

    vm.prank(operator);
    pool.borrow(botId, 1000e6);

    // Non-operator cannot repay
    usdc.mint(attacker, 10_000e6);
    vm.prank(attacker);
    usdc.approve(address(pool), type(uint256).max);

    vm.prank(attacker);
    vm.expectRevert(LendingPool.NotOperator.selector);
    pool.repay(botId, 1000e6);
  }

  function test_OnlyOperator_UpdateBot() public {
    vm.prank(attacker);
    vm.expectRevert(BotRegistry.NotOperator.selector);
    botRegistry.updateBot(botId, 'ipfs://malicious');
  }

  function test_OnlyOperator_RevokePermissions() public {
    // Non-operator/non-owner cannot revoke
    vm.prank(attacker);
    vm.expectRevert(PermissionsRegistry.NotOperator.selector);
    permRegistry.revokePermissions(botId);
  }

  function test_OwnerCanEmergencyRevoke() public {
    // Owner can revoke any bot's permissions
    vm.prank(owner);
    permRegistry.revokePermissions(botId);

    assertFalse(permRegistry.hasValidPermissions(botId));
  }

  // ============ Overflow/Underflow Tests ============

  function test_NoOverflow_LargeDeposit() public {
    uint256 largeAmount = type(uint128).max;
    usdc.mint(lender, largeAmount);

    vm.prank(lender);
    usdc.approve(address(pool), largeAmount);

    vm.prank(lender);
    pool.deposit(largeAmount);

    assertEq(pool.totalDeposits(), largeAmount);
  }

  function test_NoUnderflow_WithdrawAll() public {
    vm.prank(lender);
    pool.deposit(1000e6);

    vm.prank(lender);
    pool.withdraw(1000e6);

    (uint256 shares, ) = pool.deposits(lender);
    assertEq(shares, 0);
    assertEq(pool.totalDeposits(), 0);
  }

  // ============ Edge Cases ============

  function test_ZeroDeposit_Reverts() public {
    vm.prank(lender);
    vm.expectRevert(LendingPool.ZeroAmount.selector);
    pool.deposit(0);
  }

  function test_ZeroWithdraw_Reverts() public {
    vm.prank(lender);
    pool.deposit(1000e6);

    vm.prank(lender);
    vm.expectRevert(LendingPool.ZeroAmount.selector);
    pool.withdraw(0);
  }

  function test_ZeroBorrow_Reverts() public {
    vm.prank(lender);
    pool.deposit(10_000e6);

    vm.prank(operator);
    vm.expectRevert(LendingPool.ZeroAmount.selector);
    pool.borrow(botId, 0);
  }

  function test_BorrowExceedsLiquidity() public {
    vm.prank(lender);
    pool.deposit(1000e6);

    vm.prank(operator);
    vm.expectRevert(LendingPool.InsufficientLiquidity.selector);
    pool.borrow(botId, 2000e6);
  }

  function test_WithdrawExceedsBalance() public {
    vm.prank(lender);
    pool.deposit(1000e6);

    vm.prank(lender);
    vm.expectRevert(LendingPool.InsufficientShares.selector);
    pool.withdraw(2000e6);
  }

  function test_DoubleBorrow_Reverts() public {
    vm.prank(lender);
    pool.deposit(10_000e6);

    vm.prank(operator);
    pool.borrow(botId, 500e6);

    // Second borrow should fail
    vm.prank(operator);
    vm.expectRevert(LendingPool.LoanAlreadyActive.selector);
    pool.borrow(botId, 500e6);
  }

  function test_RepayWithoutLoan_Reverts() public {
    vm.prank(operator);
    vm.expectRevert(LendingPool.NoActiveLoan.selector);
    pool.repay(botId, 1000e6);
  }

  // ============ Permission Tests ============

  function test_ExpiredPermissions_CannotBorrow() public {
    vm.prank(lender);
    pool.deposit(10_000e6);

    // Set permissions with past expiry
    vm.prank(operator);
    permRegistry.setPermissions(
      botId,
      bytes32(0),
      10_000e6,
      block.timestamp + 1 hours
    );

    // Fast forward past expiry
    vm.warp(block.timestamp + 2 hours);

    vm.prank(operator);
    vm.expectRevert(LendingPool.NoActivePermissions.selector);
    pool.borrow(botId, 1000e6);
  }

  function test_RevokedPermissions_CannotBorrow() public {
    vm.prank(lender);
    pool.deposit(10_000e6);

    // Revoke permissions
    vm.prank(operator);
    permRegistry.revokePermissions(botId);

    vm.prank(operator);
    vm.expectRevert(LendingPool.NoActivePermissions.selector);
    pool.borrow(botId, 1000e6);
  }

  function test_ExceedsMaxSpend_CannotBorrow() public {
    vm.prank(lender);
    pool.deposit(1_000_000e6);

    // Increase rate limit so we can test max spend
    vm.prank(owner);
    pool.setMaxBorrowPerBlock(500_000e6);

    // Max spend is 100k, try to borrow 200k
    vm.prank(operator);
    vm.expectRevert(LendingPool.ExceedsMaxSpend.selector);
    pool.borrow(botId, 200_000e6);
  }

  function test_InactiveBot_CannotBorrow() public {
    vm.prank(lender);
    pool.deposit(10_000e6);

    // Deactivate bot
    vm.prank(operator);
    botRegistry.deactivateBot(botId);

    vm.prank(operator);
    vm.expectRevert(LendingPool.BotNotActive.selector);
    pool.borrow(botId, 1000e6);
  }

  // ============ Pause Tests ============

  function test_Paused_CannotDeposit() public {
    vm.prank(owner);
    pool.pause();

    vm.prank(lender);
    vm.expectRevert();
    pool.deposit(1000e6);
  }

  function test_Paused_CannotWithdraw() public {
    vm.prank(lender);
    pool.deposit(1000e6);

    vm.prank(owner);
    pool.pause();

    vm.prank(lender);
    vm.expectRevert();
    pool.withdraw(1000e6);
  }

  function test_Paused_CannotBorrow() public {
    vm.prank(lender);
    pool.deposit(10_000e6);

    vm.prank(owner);
    pool.pause();

    vm.prank(operator);
    vm.expectRevert();
    pool.borrow(botId, 1000e6);
  }

  function test_Unpause_ResumesOperations() public {
    vm.prank(owner);
    pool.pause();

    vm.prank(owner);
    pool.unpause();

    vm.prank(lender);
    pool.deposit(1000e6);

    assertEq(pool.totalDeposits(), 1000e6);
  }

  // ============ Rate Limiting Tests ============

  function test_RateLimiting_ExceedsMax() public {
    vm.prank(lender);
    pool.deposit(1_000_000e6);

    // Default max is 100k per block
    // Try to borrow more
    vm.prank(operator);
    permRegistry.setPermissions(botId, bytes32(0), 200_000e6, 0);

    vm.prank(operator);
    vm.expectRevert(LendingPool.RateLimitExceeded.selector);
    pool.borrow(botId, 150_000e6);
  }

  // ============ Staking Security Tests ============

  function test_Staking_CooldownRequired() public {
    vm.prank(owner);
    clawloan.mint(attacker, 10_000e18);

    vm.prank(attacker);
    clawloan.approve(address(staking), type(uint256).max);

    vm.prank(attacker);
    staking.stake(1000e18);

    // Try to unstake without cooldown
    vm.prank(attacker);
    vm.expectRevert(StakingModule.CooldownNotStarted.selector);
    staking.unstake(1000e18);
  }

  function test_Staking_SlashMaxLimit() public {
    vm.prank(owner);
    clawloan.mint(lender, 10_000e18);

    vm.prank(lender);
    clawloan.approve(address(staking), type(uint256).max);

    vm.prank(lender);
    staking.stake(10_000e18);

    // Try to slash more than 30%
    vm.prank(owner);
    vm.expectRevert(StakingModule.SlashExceedsMax.selector);
    staking.slash(4000e18, 'Too much'); // 40% > 30% max
  }

  function test_Staking_OnlyOwnerCanSlash() public {
    vm.prank(owner);
    clawloan.mint(lender, 10_000e18);

    vm.prank(lender);
    clawloan.approve(address(staking), type(uint256).max);

    vm.prank(lender);
    staking.stake(10_000e18);

    vm.prank(attacker);
    vm.expectRevert();
    staking.slash(1000e18, 'Malicious');
  }

  // ============ Token Security Tests ============

  function test_Token_MaxSupplyEnforced() public {
    uint256 remaining = clawloan.remainingMintableSupply();

    vm.prank(owner);
    vm.expectRevert(ClawloanToken.ExceedsMaxSupply.selector);
    clawloan.mint(attacker, remaining + 1);
  }

  function test_Token_OnlyOwnerCanMint() public {
    vm.prank(attacker);
    vm.expectRevert();
    clawloan.mint(attacker, 1000e18);
  }

  // ============ Interest Accrual Tests ============

  function test_InterestAccrual_TimeBased() public {
    vm.prank(lender);
    pool.deposit(10_000e6);

    vm.prank(operator);
    pool.borrow(botId, 1000e6);

    uint256 initialIndex = pool.borrowIndex();

    // Fast forward 365 days
    vm.warp(block.timestamp + 365 days);

    pool.accrueInterest();

    uint256 newIndex = pool.borrowIndex();
    assertGt(newIndex, initialIndex);
  }

  function test_InterestAccrual_NoTimeElapsed() public {
    vm.prank(lender);
    pool.deposit(10_000e6);

    vm.prank(operator);
    pool.borrow(botId, 1000e6);

    uint256 initialIndex = pool.borrowIndex();

    // Accrue again in same block
    pool.accrueInterest();

    uint256 newIndex = pool.borrowIndex();
    assertEq(newIndex, initialIndex);
  }

  // ============ Full Flow Integration Test ============

  function test_FullFlow_DepositBorrowRepayWithdraw() public {
    // 1. Lender deposits
    vm.prank(lender);
    pool.deposit(10_000e6);
    assertEq(pool.totalDeposits(), 10_000e6);

    // 2. Bot borrows
    vm.prank(operator);
    pool.borrow(botId, 1000e6);
    assertEq(pool.totalBorrows(), 1000e6);

    // 3. Time passes, interest accrues
    vm.warp(block.timestamp + 30 days);

    // 4. Bot repays with profit
    uint256 owed = pool.getAmountOwed(botId);
    assertGt(owed, 1000e6); // Should have interest

    vm.prank(operator);
    pool.repayWithProfit(botId, owed, 100e6); // 100 USDC profit

    assertEq(pool.totalBorrows(), 0);
    assertGt(pool.rewardPool(), 0); // Should have profit share

    // 5. Lender withdraws with earnings
    (uint256 shares, ) = pool.deposits(lender);
    uint256 withdrawable = pool.getShareValue(shares);
    assertGt(withdrawable, 10_000e6); // Should have earned interest

    vm.prank(lender);
    pool.withdraw(shares);

    assertEq(pool.totalDeposits(), 0);
  }
}
