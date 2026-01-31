// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

/// @title MockUSDC - A mock USDC token for testing
/// @notice Standard ERC20 with 6 decimals and public mint for testing
/// @dev Use only for local development and testing
contract MockUSDC is ERC20, Ownable {
  uint8 private constant DECIMALS = 6;

  constructor() ERC20('Mock USDC', 'USDC') Ownable(msg.sender) {}

  function decimals() public pure override returns (uint8) {
    return DECIMALS;
  }

  /// @notice Mint tokens to any address (for testing only)
  /// @param to Address to receive tokens
  /// @param amount Amount to mint (6 decimals)
  function mint(address to, uint256 amount) external {
    _mint(to, amount);
  }

  /// @notice Burn tokens from caller
  /// @param amount Amount to burn
  function burn(uint256 amount) external {
    _burn(msg.sender, amount);
  }
}
