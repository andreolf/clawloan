// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import 'forge-std/Test.sol';
import '@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol';
import '../src/MockUSDC.sol';
import '../src/BotRegistry.sol';
import '../src/PermissionsRegistry.sol';
import '../src/LendingPoolV3.sol';

/// @title LendingPoolV3SecurityTest
/// @notice Regression tests for audit finding C-2: V3 borrow() must authorize the
///         caller (isOperator), enforce the permissioned spend cap (canSpend), and
///         bound per-block borrows (rate limit). Deploys V3 behind an ERC1967 proxy.
contract LendingPoolV3SecurityTest is Test {
  MockUSDC public usdc;
  BotRegistry public botRegistry;
  PermissionsRegistry public permRegistry;
  LendingPoolV3 public pool;

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

    // Deploy V3 implementation + proxy (initialized atomically).
    LendingPoolV3 impl = new LendingPoolV3();
    bytes memory initData = abi.encodeWithSelector(
      LendingPoolV3.initialize.selector,
      address(usdc),
      address(botRegistry),
      address(permRegistry)
    );
    ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
    pool = LendingPoolV3(address(proxy));

    vm.stopPrank();

    // Fund the pool with lender liquidity.
    usdc.mint(lender, 1_000_000e6);
    vm.startPrank(lender);
    usdc.approve(address(pool), type(uint256).max);
    pool.deposit(500_000e6);
    vm.stopPrank();

    // Operator registers a bot and grants it a spend cap of 10k USDC.
    vm.prank(operator);
    botId = botRegistry.registerBot('ipfs://bot', operator);
    vm.prank(operator);
    permRegistry.setPermissions(botId, bytes32(0), 10_000e6, 0);
  }

  // ---- C-2: caller authorization ----

  function test_Borrow_RevertsIfCallerNotOperator() public {
    // Attacker tries to borrow against someone else's bot.
    vm.prank(attacker);
    vm.expectRevert(LendingPoolV3.NotOperator.selector);
    pool.borrow(botId, 1_000e6);
  }

  function test_Borrow_RevertsIfBotInactive() public {
    vm.prank(operator);
    botRegistry.deactivateBot(botId);

    vm.prank(operator);
    vm.expectRevert(LendingPoolV3.BotNotActive.selector);
    pool.borrow(botId, 1_000e6);
  }

  // ---- C-2: permissioned spend cap ----

  function test_Borrow_RevertsIfExceedsMaxSpend() public {
    // Cap is 10k; borrowing 20k must revert even though liquidity exists.
    vm.prank(operator);
    vm.expectRevert(LendingPoolV3.ExceedsMaxSpend.selector);
    pool.borrow(botId, 20_000e6);
  }

  function test_Borrow_HappyPathWithinCap() public {
    uint256 before = usdc.balanceOf(operator);
    vm.prank(operator);
    pool.borrow(botId, 5_000e6);
    assertEq(usdc.balanceOf(operator) - before, 5_000e6);
    (uint256 amount, , , address op) = pool.loans(botId);
    assertEq(amount, 5_000e6);
    assertEq(op, operator);
  }

  // ---- C-2: per-block borrow rate limit ----

  function test_Borrow_RateLimitEnforcedAcrossBotsInSameBlock() public {
    // Owner sets a 12k/block cap. Two bots each with a 10k spend cap try to
    // borrow 8k each in the same block => second borrow exceeds 12k and reverts.
    vm.prank(owner);
    pool.setMaxBorrowPerBlock(12_000e6);

    uint256 botId2 = _registerBotWithCap(makeAddr('op2'), 10_000e6);

    vm.prank(operator);
    pool.borrow(botId, 8_000e6); // block total = 8k, ok

    vm.prank(makeAddr('op2'));
    vm.expectRevert(LendingPoolV3.ExceedsBorrowRateLimit.selector);
    pool.borrow(botId2, 8_000e6); // block total would be 16k > 12k
  }

  function test_Borrow_RateLimitResetsNextBlock() public {
    vm.prank(owner);
    pool.setMaxBorrowPerBlock(12_000e6);

    uint256 botId2 = _registerBotWithCap(makeAddr('op2'), 10_000e6);

    vm.prank(operator);
    pool.borrow(botId, 8_000e6);

    // Advance one block; the per-block counter resets.
    vm.roll(block.number + 1);

    vm.prank(makeAddr('op2'));
    pool.borrow(botId2, 8_000e6); // fresh block, ok
    (uint256 amount, , , ) = pool.loans(botId2);
    assertEq(amount, 8_000e6);
  }

  function test_Borrow_RateLimitDisabledByDefaultValueZero() public {
    // With the limit set to 0, the per-block check is skipped entirely.
    vm.prank(owner);
    pool.setMaxBorrowPerBlock(0);

    vm.prank(operator);
    pool.borrow(botId, 10_000e6); // full cap in one go, ok
    (uint256 amount, , , ) = pool.loans(botId);
    assertEq(amount, 10_000e6);
  }

  // ---- access control on the new setter ----

  function test_SetMaxBorrowPerBlock_OnlyOwner() public {
    vm.prank(attacker);
    vm.expectRevert();
    pool.setMaxBorrowPerBlock(1);
  }

  // ---- helper ----

  function _registerBotWithCap(address op, uint256 cap) internal returns (uint256 id) {
    vm.prank(op);
    id = botRegistry.registerBot('ipfs://bot2', op);
    vm.prank(op);
    permRegistry.setPermissions(id, bytes32(0), cap, 0);
  }
}
