// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import 'forge-std/Test.sol';
import '../src/ClawloanToken.sol';

contract MoltloanTokenTest is Test {
  ClawloanToken public token;
  address public owner = makeAddr('owner');
  address public treasury = makeAddr('treasury');
  address public alice = makeAddr('alice');

  function setUp() public {
    vm.prank(owner);
    token = new ClawloanToken(treasury);
  }

  function test_InitialMint() public view {
    // 10% of 1B = 100M tokens to treasury
    assertEq(token.balanceOf(treasury), 100_000_000e18);
    assertEq(token.totalMinted(), 100_000_000e18);
  }

  function test_Name() public view {
    assertEq(token.name(), 'Clawloan');
  }

  function test_Symbol() public view {
    assertEq(token.symbol(), 'CLAWLOAN');
  }

  function test_MaxSupply() public view {
    assertEq(token.MAX_SUPPLY(), 1_000_000_000e18);
  }

  function test_Mint() public {
    vm.prank(owner);
    token.mint(alice, 1000e18);

    assertEq(token.balanceOf(alice), 1000e18);
    assertEq(token.totalMinted(), 100_000_000e18 + 1000e18);
  }

  function test_Mint_RevertNotOwner() public {
    vm.prank(alice);
    vm.expectRevert();
    token.mint(alice, 1000e18);
  }

  function test_Mint_RevertExceedsMaxSupply() public {
    uint256 remaining = token.remainingMintableSupply();

    vm.prank(owner);
    vm.expectRevert(ClawloanToken.ExceedsMaxSupply.selector);
    token.mint(alice, remaining + 1);
  }

  function test_Burn() public {
    vm.prank(treasury);
    token.burn(1000e18);

    assertEq(token.balanceOf(treasury), 100_000_000e18 - 1000e18);
  }

  function test_RemainingMintableSupply() public view {
    // 1B - 100M = 900M
    assertEq(token.remainingMintableSupply(), 900_000_000e18);
  }

  function test_Permit() public {
    uint256 privateKey = 0x1234;
    address signer = vm.addr(privateKey);

    vm.prank(owner);
    token.mint(signer, 1000e18);

    bytes32 PERMIT_TYPEHASH = keccak256(
      'Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)'
    );

    uint256 nonce = token.nonces(signer);
    uint256 deadline = block.timestamp + 1 hours;

    bytes32 structHash = keccak256(
      abi.encode(PERMIT_TYPEHASH, signer, alice, 500e18, nonce, deadline)
    );

    bytes32 domainSeparator = token.DOMAIN_SEPARATOR();
    bytes32 digest = keccak256(
      abi.encodePacked('\x19\x01', domainSeparator, structHash)
    );

    (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);

    token.permit(signer, alice, 500e18, deadline, v, r, s);

    assertEq(token.allowance(signer, alice), 500e18);
  }
}
