// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import 'forge-std/Test.sol';
import 'forge-std/StdInvariant.sol';
import '@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol';
import '../src/MockUSDC.sol';
import '../src/BotRegistry.sol';
import '../src/PermissionsRegistry.sol';
import '../src/CreditScoring.sol';
import '../src/LendingPoolV3.sol';

/// @title LendingPoolV3Handler
/// @notice Randomized actions over the bond-underwriting model: deposit/withdraw,
///         bond/unbond, borrow/repay/liquidate, plus time warps. Every action is
///         wrapped in try/catch so legitimate reverts (e.g. hitting a limit) don't
///         stop the run — the point is that NO sequence can break solvency.
contract LendingPoolV3Handler is Test {
  MockUSDC public usdc;
  BotRegistry public botRegistry;
  PermissionsRegistry public permRegistry;
  LendingPoolV3 public pool;

  address[] public lps;
  address[] public operators;
  uint256[] public botIds;

  constructor(
    MockUSDC _usdc,
    BotRegistry _botRegistry,
    PermissionsRegistry _permRegistry,
    LendingPoolV3 _pool
  ) {
    usdc = _usdc;
    botRegistry = _botRegistry;
    permRegistry = _permRegistry;
    pool = _pool;

    // 4 LPs seed liquidity.
    for (uint256 i = 0; i < 4; i++) {
      address lp = address(uint160(0x3000 + i));
      lps.push(lp);
      usdc.mint(lp, 1_000_000e6);
      vm.startPrank(lp);
      usdc.approve(address(pool), type(uint256).max);
      pool.deposit(200_000e6);
      vm.stopPrank();
    }

    // 3 operators, each with a bot (large spend cap) and an initial small bond.
    for (uint256 i = 0; i < 3; i++) {
      address op = address(uint160(0x4000 + i));
      operators.push(op);
      usdc.mint(op, 1_000_000e6);
      vm.startPrank(op);
      usdc.approve(address(pool), type(uint256).max);
      uint256 id = botRegistry.registerBot('ipfs://op', op);
      permRegistry.setPermissions(id, bytes32(0), 100_000e6, 0);
      pool.bond(5_000e6);
      vm.stopPrank();
      botIds.push(id);
    }
  }

  function deposit(uint256 s, uint256 amount) public {
    address lp = lps[s % lps.length];
    amount = bound(amount, 1e6, 100_000e6);
    vm.prank(lp);
    try pool.deposit(amount) {} catch {}
  }

  function withdraw(uint256 s, uint256 shares) public {
    address lp = lps[s % lps.length];
    (uint256 sh, ) = pool.deposits(lp);
    if (sh == 0) return;
    shares = bound(shares, 1, sh);
    vm.prank(lp);
    try pool.withdraw(shares) {} catch {}
  }

  function bondMore(uint256 s, uint256 amount) public {
    address op = operators[s % operators.length];
    amount = bound(amount, 1e6, 50_000e6);
    vm.prank(op);
    try pool.bond(amount) {} catch {}
  }

  function requestUnbond(uint256 s) public {
    address op = operators[s % operators.length];
    vm.prank(op);
    try pool.requestUnbond() {} catch {}
  }

  function unbond(uint256 s, uint256 amount) public {
    address op = operators[s % operators.length];
    uint256 st = pool.stake(op);
    if (st == 0) return;
    amount = bound(amount, 1, st);
    vm.prank(op);
    try pool.unbond(amount) {} catch {}
  }

  function borrow(uint256 s, uint256 amount) public {
    uint256 idx = s % operators.length;
    (uint256 principal, , , ) = pool.loans(botIds[idx]);
    if (principal > 0) return;
    amount = bound(amount, 1e6, 60_000e6);
    vm.prank(operators[idx]);
    try pool.borrow(botIds[idx], amount) {} catch {}
  }

  function repay(uint256 s) public {
    uint256 idx = s % operators.length;
    (uint256 principal, , , ) = pool.loans(botIds[idx]);
    if (principal == 0) return;
    vm.prank(operators[idx]);
    try pool.repay(botIds[idx]) {} catch {}
  }

  function liquidate(uint256 s) public {
    uint256 idx = s % operators.length;
    (uint256 principal, , , ) = pool.loans(botIds[idx]);
    if (principal == 0) return;
    // anyone can call
    try pool.liquidate(botIds[idx]) {} catch {}
  }

  function warp(uint256 secs) public {
    secs = bound(secs, 1 hours, 20 days);
    vm.warp(block.timestamp + secs);
  }
}

/// @title InvariantV3Test
/// @notice Solvency invariants for the operator-bond / reserve-backed credit model.
contract InvariantV3Test is StdInvariant, Test {
  MockUSDC public usdc;
  BotRegistry public botRegistry;
  PermissionsRegistry public permRegistry;
  CreditScoring public creditScoring;
  LendingPoolV3 public pool;
  LendingPoolV3Handler public handler;

  function setUp() public {
    usdc = new MockUSDC();
    botRegistry = new BotRegistry();
    permRegistry = new PermissionsRegistry(address(botRegistry));
    creditScoring = new CreditScoring(address(botRegistry));

    LendingPoolV3 impl = new LendingPoolV3();
    bytes memory initData = abi.encodeWithSelector(
      LendingPoolV3.initialize.selector,
      address(usdc),
      address(botRegistry),
      address(permRegistry)
    );
    pool = LendingPoolV3(address(new ERC1967Proxy(address(impl), initData)));

    creditScoring.authorizeCaller(address(pool));
    pool.setCreditScoring(address(creditScoring));
    pool.setMaxBorrowPerBlock(0); // don't let the per-block cap mask bond behavior

    handler = new LendingPoolV3Handler(usdc, botRegistry, permRegistry, pool);
    targetContract(address(handler));
  }

  /// @notice THE solvency invariant: unbacked exposure is always covered by reserves.
  function invariant_unbackedWithinReserves() public view {
    assertLe(pool.totalUnbacked(), pool.reserves());
  }

  /// @notice Staked USDC is never lent out — the pool always physically holds at
  ///         least totalStaked (so every operator can be repaid their bond).
  function invariant_stakeFullyBacked() public view {
    assertGe(usdc.balanceOf(address(pool)), pool.totalStaked());
  }

  /// @notice The pool never lends more than it holds in deposits.
  function invariant_depositsGteBorrows() public view {
    assertGe(pool.totalDeposits(), pool.totalBorrows());
  }

  /// @notice Contract solvency: physical USDC covers every off-book obligation
  ///         (idle deposits + all stakes + reserves), allowing rounding drift.
  function invariant_contractSolvent() public view {
    uint256 obligations = (pool.totalDeposits() - pool.totalBorrows()) +
      pool.totalStaked() +
      pool.reserves();
    assertGe(usdc.balanceOf(address(pool)) + 1e6, obligations);
  }
}
