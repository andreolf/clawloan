// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import 'forge-std/Test.sol';
import '../src/MockUSDC.sol';

contract MockUSDCTest is Test {
  MockUSDC public usdc;
  address public alice = makeAddr('alice');
  address public bob = makeAddr('bob');

  function setUp() public {
    usdc = new MockUSDC();
  }

  function test_Decimals() public view {
    assertEq(usdc.decimals(), 6);
  }

  function test_Name() public view {
    assertEq(usdc.name(), 'Mock USDC');
  }

  function test_Symbol() public view {
    assertEq(usdc.symbol(), 'USDC');
  }

  function test_Mint() public {
    usdc.mint(alice, 1000e6);
    assertEq(usdc.balanceOf(alice), 1000e6);
  }

  function test_MintMultiple() public {
    usdc.mint(alice, 1000e6);
    usdc.mint(alice, 500e6);
    assertEq(usdc.balanceOf(alice), 1500e6);
  }

  function test_Burn() public {
    usdc.mint(alice, 1000e6);

    vm.prank(alice);
    usdc.burn(300e6);

    assertEq(usdc.balanceOf(alice), 700e6);
  }

  function test_Transfer() public {
    usdc.mint(alice, 1000e6);

    vm.prank(alice);
    usdc.transfer(bob, 400e6);

    assertEq(usdc.balanceOf(alice), 600e6);
    assertEq(usdc.balanceOf(bob), 400e6);
  }

  function testFuzz_Mint(address to, uint256 amount) public {
    vm.assume(to != address(0));
    vm.assume(amount < type(uint256).max / 2);

    usdc.mint(to, amount);
    assertEq(usdc.balanceOf(to), amount);
  }
}
