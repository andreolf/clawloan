// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import 'forge-std/Test.sol';
import '../src/MockUSDC.sol';
import '../src/BotRegistry.sol';
import '../src/PermissionsRegistry.sol';
import '../src/LendingPool.sol';
import '../src/LPIncentives.sol';

contract LPIncentivesTest is Test {
  MockUSDC public usdc;
  BotRegistry public botRegistry;
  PermissionsRegistry public permRegistry;
  LendingPool public pool;
  LPIncentives public incentives;

  address public owner = makeAddr('owner');
  address public lender1 = makeAddr('lender1');
  address public lender2 = makeAddr('lender2');

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
    incentives = new LPIncentives();

    // Connect incentives to pool
    pool.setLPIncentives(address(incentives));
    incentives.setLendingPool(address(pool));
    incentives.launch();

    vm.stopPrank();

    // Fund lenders
    usdc.mint(lender1, 100_000e6);
    usdc.mint(lender2, 100_000e6);

    vm.prank(lender1);
    usdc.approve(address(pool), type(uint256).max);

    vm.prank(lender2);
    usdc.approve(address(pool), type(uint256).max);
  }

  function test_TrackDeposit() public {
    vm.prank(lender1);
    pool.deposit(10_000e6);

    (
      uint256 depositedAmount,
      uint256 cumulativePoints,
      uint256 lastUpdateTime,
      uint256 firstDepositTime,
      uint256 totalDeposited,
      uint256 totalWithdrawn
    ) = incentives.lpInfo(lender1);

    assertEq(depositedAmount, 10_000e6);
    assertEq(totalDeposited, 10_000e6);
    assertEq(totalWithdrawn, 0);
    assertGt(firstDepositTime, 0);
    assertGt(lastUpdateTime, 0);
  }

  function test_TrackWithdraw() public {
    vm.prank(lender1);
    pool.deposit(10_000e6);

    vm.prank(lender1);
    pool.withdraw(5_000e6);

    (uint256 depositedAmount, , , , , uint256 totalWithdrawn) = incentives
      .lpInfo(lender1);

    assertEq(depositedAmount, 5_000e6);
    assertEq(totalWithdrawn, 5_000e6);
  }

  function test_PointsAccrueOverTime() public {
    vm.prank(lender1);
    pool.deposit(10_000e6);

    // Fast forward 24 hours
    vm.warp(block.timestamp + 24 hours);

    uint256 points = incentives.getPoints(lender1);

    // With 2x early bird bonus: 10_000e6 * 24 hours * 2 = 480_000e6 points
    // (points are per hour, so 24 hours of 10k deposit at 2x = 480k points)
    assertGt(points, 0);
  }

  function test_EarlyBirdBonus() public {
    assertTrue(incentives.isEarlyBird());
    assertEq(incentives.getCurrentMultiplier(), 20000); // 2x

    // Fast forward past early bird period (30 days)
    vm.warp(block.timestamp + 31 days);

    assertFalse(incentives.isEarlyBird());
    assertEq(incentives.getCurrentMultiplier(), 10000); // 1x
  }

  function test_MultipleDepositors() public {
    vm.prank(lender1);
    pool.deposit(20_000e6);

    vm.prank(lender2);
    pool.deposit(10_000e6);

    assertEq(incentives.getLPCount(), 2);
    assertEq(incentives.totalActiveDeposits(), 30_000e6);
  }

  function test_Leaderboard() public {
    vm.prank(lender1);
    pool.deposit(20_000e6);

    vm.prank(lender2);
    pool.deposit(10_000e6);

    // Fast forward to accrue points
    vm.warp(block.timestamp + 1 days);

    // Manually accrue
    incentives.accruePoints(lender1);
    incentives.accruePoints(lender2);

    (address[] memory lps, uint256[] memory points) = incentives.getLeaderboard(
      2
    );

    // Lender1 should be first (more deposits)
    assertEq(lps[0], lender1);
    assertGt(points[0], points[1]);
  }

  function test_CreateEpoch() public {
    vm.prank(owner);
    incentives.createEpoch('Boost Week', 30000, 7 days); // 3x multiplier

    // After early bird ends, new epoch should have 3x
    vm.warp(block.timestamp + 31 days);
    assertEq(incentives.getCurrentMultiplier(), 30000);
  }

  function test_BatchAccruePoints() public {
    vm.prank(lender1);
    pool.deposit(10_000e6);

    vm.prank(lender2);
    pool.deposit(10_000e6);

    vm.warp(block.timestamp + 1 days);

    address[] memory lps = new address[](2);
    lps[0] = lender1;
    lps[1] = lender2;

    incentives.batchAccruePoints(lps);

    (, uint256 points1, , , , ) = incentives.lpInfo(lender1);
    (, uint256 points2, , , , ) = incentives.lpInfo(lender2);

    assertGt(points1, 0);
    assertGt(points2, 0);
  }

  function test_EarlyBirdTimeRemaining() public {
    assertEq(incentives.earlyBirdTimeRemaining(), 30 days);

    vm.warp(block.timestamp + 10 days);
    assertEq(incentives.earlyBirdTimeRemaining(), 20 days);

    vm.warp(block.timestamp + 25 days);
    assertEq(incentives.earlyBirdTimeRemaining(), 0);
  }

  function test_OnlyLendingPoolCanTrack() public {
    vm.prank(lender1);
    vm.expectRevert(LPIncentives.NotAuthorized.selector);
    incentives.trackDeposit(lender1, 1000e6);
  }

  function test_OwnerCanTrack() public {
    vm.prank(owner);
    incentives.trackDeposit(lender1, 1000e6);

    (uint256 depositedAmount, , , , , ) = incentives.lpInfo(lender1);
    assertEq(depositedAmount, 1000e6);
  }
}
