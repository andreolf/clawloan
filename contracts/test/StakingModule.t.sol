// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import 'forge-std/Test.sol';
import '../src/ClawloanToken.sol';
import '../src/MockUSDC.sol';
import '../src/StakingModule.sol';

contract StakingModuleTest is Test {
  ClawloanToken public clawloan;
  MockUSDC public usdc;
  StakingModule public staking;

  address public owner = makeAddr('owner');
  address public treasury = makeAddr('treasury');
  address public alice = makeAddr('alice');
  address public bob = makeAddr('bob');

  function setUp() public {
    vm.startPrank(owner);

    clawloan = new ClawloanToken(treasury);
    usdc = new MockUSDC();
    staking = new StakingModule(address(clawloan), address(usdc));

    vm.stopPrank();

    // Setup alice with CLAWLOAN tokens
    vm.prank(owner);
    clawloan.mint(alice, 10_000e18);

    vm.prank(alice);
    clawloan.approve(address(staking), type(uint256).max);

    // Setup bob with CLAWLOAN tokens
    vm.prank(owner);
    clawloan.mint(bob, 10_000e18);

    vm.prank(bob);
    clawloan.approve(address(staking), type(uint256).max);
  }

  // ============ Stake Tests ============

  function test_Stake() public {
    vm.prank(alice);
    staking.stake(1000e18);

    (uint256 amount, , ) = staking.stakes(alice);
    assertEq(amount, 1000e18);
    assertEq(staking.totalStaked(), 1000e18);
  }

  function test_Stake_Multiple() public {
    vm.prank(alice);
    staking.stake(1000e18);

    vm.prank(bob);
    staking.stake(2000e18);

    assertEq(staking.totalStaked(), 3000e18);
  }

  function test_Stake_RevertZeroAmount() public {
    vm.prank(alice);
    vm.expectRevert(StakingModule.ZeroAmount.selector);
    staking.stake(0);
  }

  // ============ Cooldown Tests ============

  function test_Cooldown() public {
    vm.prank(alice);
    staking.stake(1000e18);

    vm.prank(alice);
    staking.cooldown();

    (uint256 cooldownStart, , , ) = staking.getCooldownStatus(alice);
    assertEq(cooldownStart, block.timestamp);
  }

  function test_Cooldown_RevertNoStake() public {
    vm.prank(alice);
    vm.expectRevert(StakingModule.InsufficientStake.selector);
    staking.cooldown();
  }

  // ============ Unstake Tests ============

  function test_Unstake() public {
    vm.prank(alice);
    staking.stake(1000e18);

    vm.prank(alice);
    staking.cooldown();

    // Fast forward past cooldown
    vm.warp(block.timestamp + 10 days + 1);

    uint256 balanceBefore = clawloan.balanceOf(alice);

    vm.prank(alice);
    staking.unstake(1000e18);

    assertEq(clawloan.balanceOf(alice), balanceBefore + 1000e18);
    assertEq(staking.totalStaked(), 0);
  }

  function test_Unstake_Partial() public {
    vm.prank(alice);
    staking.stake(1000e18);

    vm.prank(alice);
    staking.cooldown();

    vm.warp(block.timestamp + 10 days + 1);

    vm.prank(alice);
    staking.unstake(400e18);

    (uint256 amount, , ) = staking.stakes(alice);
    assertEq(amount, 600e18);
  }

  function test_Unstake_RevertCooldownNotStarted() public {
    vm.prank(alice);
    staking.stake(1000e18);

    vm.prank(alice);
    vm.expectRevert(StakingModule.CooldownNotStarted.selector);
    staking.unstake(1000e18);
  }

  function test_Unstake_RevertCooldownNotComplete() public {
    vm.prank(alice);
    staking.stake(1000e18);

    vm.prank(alice);
    staking.cooldown();

    // Only 5 days, need 10
    vm.warp(block.timestamp + 5 days);

    vm.prank(alice);
    vm.expectRevert(StakingModule.CooldownNotComplete.selector);
    staking.unstake(1000e18);
  }

  function test_Unstake_RevertWindowClosed() public {
    vm.prank(alice);
    staking.stake(1000e18);

    vm.prank(alice);
    staking.cooldown();

    // 10 days + 2 days window + 1 day = too late
    vm.warp(block.timestamp + 13 days);

    vm.prank(alice);
    vm.expectRevert(StakingModule.UnstakeWindowClosed.selector);
    staking.unstake(1000e18);
  }

  // ============ Reward Tests ============

  function test_DistributeRewards() public {
    vm.prank(alice);
    staking.stake(1000e18);

    // Distribute 100 USDC rewards
    usdc.mint(owner, 100e6);
    vm.prank(owner);
    usdc.approve(address(staking), 100e6);

    vm.prank(owner);
    staking.distributeRewards(100e6);

    uint256 pending = staking.pendingRewards(alice);
    assertEq(pending, 100e6);
  }

  function test_ClaimRewards() public {
    vm.prank(alice);
    staking.stake(1000e18);

    usdc.mint(owner, 100e6);
    vm.prank(owner);
    usdc.approve(address(staking), 100e6);

    vm.prank(owner);
    staking.distributeRewards(100e6);

    uint256 balanceBefore = usdc.balanceOf(alice);

    vm.prank(alice);
    staking.claimRewards();

    assertEq(usdc.balanceOf(alice), balanceBefore + 100e6);
  }

  function test_RewardDistribution_ProRata() public {
    // Alice stakes 1000, Bob stakes 2000
    vm.prank(alice);
    staking.stake(1000e18);

    vm.prank(bob);
    staking.stake(2000e18);

    // Distribute 300 USDC
    usdc.mint(owner, 300e6);
    vm.prank(owner);
    usdc.approve(address(staking), 300e6);

    vm.prank(owner);
    staking.distributeRewards(300e6);

    // Alice should get 1/3 = 100 USDC
    // Bob should get 2/3 = 200 USDC
    assertEq(staking.pendingRewards(alice), 100e6);
    assertEq(staking.pendingRewards(bob), 200e6);
  }

  // ============ Slashing Tests ============

  function test_Slash() public {
    vm.prank(alice);
    staking.stake(1000e18);

    vm.prank(owner);
    staking.slash(100e18, 'Protocol shortfall');

    assertEq(staking.totalSlashed(), 100e18);
  }

  function test_Slash_RevertExceedsMax() public {
    vm.prank(alice);
    staking.stake(1000e18);

    // Max is 30% = 300e18
    vm.prank(owner);
    vm.expectRevert(StakingModule.SlashExceedsMax.selector);
    staking.slash(400e18, 'Too much');
  }

  function test_Slash_RevertDisabled() public {
    vm.prank(alice);
    staking.stake(1000e18);

    vm.prank(owner);
    staking.toggleSlashing(false);

    vm.prank(owner);
    vm.expectRevert(StakingModule.SlashingDisabled.selector);
    staking.slash(100e18, 'Disabled');
  }

  // ============ Admin Tests ============

  function test_Pause() public {
    vm.prank(owner);
    staking.pause();

    vm.prank(alice);
    vm.expectRevert();
    staking.stake(1000e18);
  }

  function test_CanUnstake() public {
    vm.prank(alice);
    staking.stake(1000e18);

    assertFalse(staking.canUnstake(alice));

    vm.prank(alice);
    staking.cooldown();

    // Before cooldown
    vm.warp(block.timestamp + 5 days);
    assertFalse(staking.canUnstake(alice));

    // In window
    vm.warp(block.timestamp + 6 days); // 11 days total
    assertTrue(staking.canUnstake(alice));

    // After window
    vm.warp(block.timestamp + 3 days); // 14 days total
    assertFalse(staking.canUnstake(alice));
  }
}
