// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import 'forge-std/Test.sol';
import '@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol';
import '../src/MockUSDC.sol';
import '../src/BotRegistry.sol';
import '../src/PermissionsRegistry.sol';
import '../src/CreditScoring.sol';
import '../src/LendingPoolV3.sol';

/// @title LendingPoolV3SecurityTest
/// @notice Covers audit C-2 (caller auth, spend cap, rate limit) plus the operator
///         bond / reserve-backed credit underwriting model and its solvency
///         invariant (totalUnbacked <= reserves). Deploys V3 behind an ERC1967 proxy.
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

    LendingPoolV3 impl = new LendingPoolV3();
    bytes memory initData = abi.encodeWithSelector(
      LendingPoolV3.initialize.selector,
      address(usdc),
      address(botRegistry),
      address(permRegistry)
    );
    pool = LendingPoolV3(address(new ERC1967Proxy(address(impl), initData)));
    vm.stopPrank();

    // Lender liquidity.
    usdc.mint(lender, 1_000_000e6);
    vm.startPrank(lender);
    usdc.approve(address(pool), type(uint256).max);
    pool.deposit(500_000e6);
    vm.stopPrank();

    // Operator: fund, register a bot (10k spend cap), and bond 50k so ordinary
    // borrows in these tests are fully backed.
    usdc.mint(operator, 200_000e6);
    vm.startPrank(operator);
    usdc.approve(address(pool), type(uint256).max);
    botId = botRegistry.registerBot('ipfs://bot', operator);
    permRegistry.setPermissions(botId, bytes32(0), 10_000e6, 0);
    pool.bond(50_000e6);
    vm.stopPrank();
  }

  // ---- C-2: caller authorization ----

  function test_Borrow_RevertsIfCallerNotOperator() public {
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
    vm.prank(operator);
    vm.expectRevert(LendingPoolV3.ExceedsMaxSpend.selector);
    pool.borrow(botId, 20_000e6); // cap is 10k (checked before the bond limit)
  }

  function test_Borrow_HappyPathWithinCapAndBond() public {
    uint256 before = usdc.balanceOf(operator);
    vm.prank(operator);
    pool.borrow(botId, 5_000e6);
    assertEq(usdc.balanceOf(operator) - before, 5_000e6);
    (uint256 amount, , , address op) = pool.loans(botId);
    assertEq(amount, 5_000e6);
    assertEq(op, operator);
    assertEq(pool.operatorDebt(operator), 5_000e6);
    assertEq(pool.totalUnbacked(), 0, 'fully bonded => no unbacked exposure');
  }

  // ---- C-2: per-block borrow rate limit ----

  function test_Borrow_RateLimitEnforcedAcrossBotsInSameBlock() public {
    vm.prank(owner);
    pool.setMaxBorrowPerBlock(12_000e6);
    uint256 botId2 = _registerBondedBot(makeAddr('op2'), 10_000e6, 50_000e6);

    vm.prank(operator);
    pool.borrow(botId, 8_000e6);

    vm.prank(makeAddr('op2'));
    vm.expectRevert(LendingPoolV3.ExceedsBorrowRateLimit.selector);
    pool.borrow(botId2, 8_000e6);
  }

  function test_Borrow_RateLimitResetsNextBlock() public {
    vm.prank(owner);
    pool.setMaxBorrowPerBlock(12_000e6);
    uint256 botId2 = _registerBondedBot(makeAddr('op2'), 10_000e6, 50_000e6);

    vm.prank(operator);
    pool.borrow(botId, 8_000e6);
    vm.roll(block.number + 1);

    vm.prank(makeAddr('op2'));
    pool.borrow(botId2, 8_000e6);
    (uint256 amount, , , ) = pool.loans(botId2);
    assertEq(amount, 8_000e6);
  }

  // ---- Bond underwriting: limits ----

  function test_Borrow_RevertsBeyondBondWithoutCredit() public {
    // creditScoring unset => creditLine 0. Operator bonded 50k; borrowing 60k
    // exceeds stake + creditLine. Disable the rate limit so the bond check binds.
    vm.prank(owner);
    pool.setMaxBorrowPerBlock(0);
    vm.prank(operator);
    permRegistry.setPermissions(botId, bytes32(0), 100_000e6, 0);
    vm.prank(operator);
    vm.expectRevert(LendingPoolV3.ExceedsBondedLimit.selector);
    pool.borrow(botId, 60_000e6);
  }

  function test_Bond_EnablesBorrowUpToStake() public {
    address op = makeAddr('freshOp');
    uint256 id = _registerBotOnly(op, 10_000e6); // no bond yet

    vm.prank(op);
    vm.expectRevert(LendingPoolV3.ExceedsBondedLimit.selector);
    pool.borrow(id, 5_000e6); // stake 0, creditLine 0

    usdc.mint(op, 5_000e6);
    vm.startPrank(op);
    usdc.approve(address(pool), type(uint256).max);
    pool.bond(5_000e6);
    pool.borrow(id, 5_000e6); // now within stake
    vm.stopPrank();
    (uint256 amount, , , ) = pool.loans(id);
    assertEq(amount, 5_000e6);
  }

  // ---- Bond underwriting: solvency invariant ----

  function test_Borrow_UnbackedRevertsWhenReservesEmpty() public {
    _wireCredit(); // creditLine = min(getRecommendedLimit=10e6, maxCreditLine)
    address op = makeAddr('creditOp');
    uint256 id = _registerBotOnly(op, 10_000e6); // stake 0

    // Within bonded limit (creditLine = $10 = 10e6) but unbacked, reserves are 0.
    vm.prank(op);
    vm.expectRevert(LendingPoolV3.ExceedsSystemCredit.selector);
    pool.borrow(id, 5e6); // 5 USDC <= creditLine, but exceeds reserves (0)
  }

  function test_Borrow_UnbackedAllowedUpToReservesThenReverts() public {
    uint256 r = _seedReserves();
    assertGt(r, 0, 'reserves seeded');
    _wireCredit();

    address op = makeAddr('creditOp');
    uint256 id = _registerBotOnly(op, 10_000e6); // stake 0
    vm.prank(op);
    pool.borrow(id, r); // unbacked == reserves => boundary allowed
    assertEq(pool.totalUnbacked(), r);

    address op2 = makeAddr('creditOp2');
    uint256 id2 = _registerBotOnly(op2, 10_000e6);
    vm.prank(op2);
    vm.expectRevert(LendingPoolV3.ExceedsSystemCredit.selector);
    pool.borrow(id2, 1); // one wei over reserves
  }

  // ---- Liquidation: bond + reserve recovery ----

  function test_Liquidate_FullyBonded_NoLPLoss() public {
    vm.prank(operator);
    pool.borrow(botId, 5_000e6);
    uint256 depositsBefore = pool.totalDeposits();

    vm.warp(block.timestamp + 25 hours);
    vm.prank(attacker);
    pool.liquidate(botId);

    (uint256 amount, , , ) = pool.loans(botId);
    assertEq(amount, 0, 'loan cleared');
    assertEq(pool.totalBorrows(), 0);
    // Slashing the bond fully recovers the principal: LPs lose nothing.
    assertEq(pool.totalDeposits(), depositsBefore, 'LP principal preserved');
    assertEq(pool.stake(operator), 45_000e6, 'bond slashed by principal');
    assertEq(pool.operatorDebt(operator), 0);
  }

  function test_Liquidate_UnbackedResidualCoveredByReserves() public {
    uint256 r = _seedReserves();
    _wireCredit();
    address op = makeAddr('creditOp');
    uint256 id = _registerBotOnly(op, 10_000e6); // stake 0, unbacked borrow
    vm.prank(op);
    pool.borrow(id, r);

    uint256 depositsBefore = pool.totalDeposits();
    vm.warp(block.timestamp + 25 hours);
    vm.prank(attacker);
    pool.liquidate(id);

    // Unbacked principal fully covered by reserves => no LP loss; reserves drained.
    assertEq(pool.totalDeposits(), depositsBefore, 'LP principal preserved');
    assertEq(pool.reserves(), 0);
    assertEq(pool.totalUnbacked(), 0);
  }

  function test_Liquidate_RevertsIfNotExpired() public {
    vm.prank(operator);
    pool.borrow(botId, 5_000e6);
    vm.prank(attacker);
    vm.expectRevert(LendingPoolV3.LoanNotExpired.selector);
    pool.liquidate(botId);
  }

  function test_Liquidate_RecordsDefaultInCreditScoring() public {
    CreditScoring credit = _wireCredit();
    vm.prank(operator);
    pool.borrow(botId, 5_000e6);
    vm.warp(block.timestamp + 25 hours);
    vm.prank(attacker);
    pool.liquidate(botId);
    (, , uint256 defaults, , , , , ) = credit.creditHistory(botId);
    assertEq(defaults, 1, 'default recorded, not a repayment');
  }

  // ---- Unbonding ----

  function test_Unbond_RespectsTimer() public {
    vm.startPrank(operator);
    pool.requestUnbond();
    vm.expectRevert(LendingPoolV3.UnbondNotReady.selector);
    pool.unbond(10_000e6);
    vm.stopPrank();

    vm.warp(block.timestamp + pool.unbondingPeriod());
    uint256 before = usdc.balanceOf(operator);
    vm.prank(operator);
    pool.unbond(10_000e6);
    assertEq(usdc.balanceOf(operator) - before, 10_000e6);
    assertEq(pool.stake(operator), 40_000e6);
  }

  function test_Unbond_CannotBreakInvariant() public {
    // Operator has 5k active debt. Unbonding the whole 50k bond would leave the
    // debt far above stake + creditLine ($100), so the bonded-limit guard rejects
    // it (protecting LPs from a stake-then-run withdrawal).
    vm.prank(operator);
    pool.borrow(botId, 5_000e6);

    vm.prank(operator);
    pool.requestUnbond();
    vm.warp(block.timestamp + pool.unbondingPeriod());

    vm.prank(operator);
    vm.expectRevert(LendingPoolV3.ExceedsBondedLimit.selector);
    pool.unbond(50_000e6);
  }

  // ---- Regression: bond() must keep totalUnbacked in sync ----

  function test_Bond_KeepsTotalUnbackedInSync() public {
    uint256 r = _seedReserves();
    _wireCredit();

    // Fresh operator, no stake: borrow r unbacked (totalUnbacked == r).
    address op = makeAddr('creditOp');
    uint256 id = _registerBotOnly(op, 10_000e6);
    vm.prank(op);
    pool.borrow(id, r);
    assertEq(pool.totalUnbacked(), r);

    // Operator bonds enough to fully back the debt -> unbacked must drop to 0.
    usdc.mint(op, r);
    vm.startPrank(op);
    usdc.approve(address(pool), type(uint256).max);
    pool.bond(r);
    vm.stopPrank();
    assertEq(pool.totalUnbacked(), 0, 'bond must clear now-backed exposure');

    // Repay closes the loan and leaves no phantom exposure.
    usdc.mint(op, 1_000e6); // for interest
    vm.warp(block.timestamp + 1 hours);
    vm.prank(op);
    pool.repay(id);
    assertEq(pool.totalUnbacked(), 0, 'no residual after repay');

    // withdrawReserves must NOT be bricked: owner can withdraw the full reserves.
    uint256 reservesNow = pool.reserves();
    vm.prank(owner);
    pool.withdrawReserves(reservesNow);
    assertEq(pool.reserves(), 0);
  }

  // ---- Reserve withdrawal guard ----

  function test_WithdrawReserves_CannotBreakInvariant() public {
    uint256 r = _seedReserves();
    _wireCredit();
    address op = makeAddr('creditOp');
    uint256 id = _registerBotOnly(op, 10_000e6);
    vm.prank(op);
    pool.borrow(id, r); // totalUnbacked == reserves == r

    vm.prank(owner);
    vm.expectRevert('Would break solvency invariant');
    pool.withdrawReserves(1);
  }

  // ---- access control ----

  function test_SetMaxBorrowPerBlock_OnlyOwner() public {
    vm.prank(attacker);
    vm.expectRevert();
    pool.setMaxBorrowPerBlock(1);
  }

  function test_BondSetters_OnlyOwner() public {
    vm.startPrank(attacker);
    vm.expectRevert();
    pool.setMaxCreditLine(1);
    vm.expectRevert();
    pool.setBondsRequired(false);
    vm.stopPrank();
  }

  // ---- helpers ----

  function _registerBotOnly(address op, uint256 cap) internal returns (uint256 id) {
    vm.startPrank(op);
    id = botRegistry.registerBot('ipfs://b', op);
    permRegistry.setPermissions(id, bytes32(0), cap, 0);
    vm.stopPrank();
  }

  function _registerBondedBot(address op, uint256 cap, uint256 bondAmt) internal returns (uint256 id) {
    usdc.mint(op, bondAmt);
    vm.startPrank(op);
    usdc.approve(address(pool), type(uint256).max);
    id = botRegistry.registerBot('ipfs://b', op);
    permRegistry.setPermissions(id, bytes32(0), cap, 0);
    pool.bond(bondAmt);
    vm.stopPrank();
  }

  function _wireCredit() internal returns (CreditScoring credit) {
    vm.startPrank(owner);
    credit = new CreditScoring(address(botRegistry));
    credit.authorizeCaller(address(pool));
    pool.setCreditScoring(address(credit));
    vm.stopPrank();
  }

  /// @dev Generate protocol reserves via a fully-bonded borrow + interest + repay,
  ///      then advance a block so the per-block rate-limit counter resets.
  function _seedReserves() internal returns (uint256) {
    vm.startPrank(operator);
    uint256 seedBot = botRegistry.registerBot('ipfs://seed', operator);
    permRegistry.setPermissions(seedBot, bytes32(0), 50_000e6, 0);
    pool.borrow(seedBot, 50_000e6);
    vm.stopPrank();

    vm.warp(block.timestamp + 23 hours);
    vm.prank(operator);
    pool.repay(seedBot);

    vm.roll(block.number + 1);
    return pool.reserves();
  }
}
