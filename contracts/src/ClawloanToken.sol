// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

/// @title ClawloanToken - Governance token for the Clawloan protocol
/// @notice ERC20 token with permit (EIP-2612) for gasless approvals
/// @dev Fixed max supply of 1B tokens
contract ClawloanToken is ERC20, ERC20Permit, Ownable {
  uint256 public constant MAX_SUPPLY = 1_000_000_000e18; // 1 billion tokens

  // Track minted amount
  uint256 public totalMinted;

  // Events
  event TokensMinted(address indexed to, uint256 amount);

  // Errors
  error ExceedsMaxSupply();
  error ZeroAddress();
  error ZeroAmount();

  constructor(
    address treasury
  ) ERC20('Clawloan', 'CLAWLOAN') ERC20Permit('Clawloan') Ownable(msg.sender) {
    if (treasury == address(0)) revert ZeroAddress();

    // Initial mint to treasury for distribution
    // 10% for initial liquidity
    uint256 initialMint = MAX_SUPPLY / 10; // 100M tokens
    _mint(treasury, initialMint);
    totalMinted = initialMint;

    emit TokensMinted(treasury, initialMint);
  }

  /// @notice Mint new tokens (owner only)
  /// @param to Address to receive tokens
  /// @param amount Amount to mint
  function mint(address to, uint256 amount) external onlyOwner {
    if (to == address(0)) revert ZeroAddress();
    if (amount == 0) revert ZeroAmount();
    if (totalMinted + amount > MAX_SUPPLY) revert ExceedsMaxSupply();

    totalMinted += amount;
    _mint(to, amount);

    emit TokensMinted(to, amount);
  }

  /// @notice Burn tokens from caller
  /// @param amount Amount to burn
  function burn(uint256 amount) external {
    if (amount == 0) revert ZeroAmount();
    _burn(msg.sender, amount);
  }

  /// @notice Get remaining mintable supply
  function remainingMintableSupply() external view returns (uint256) {
    return MAX_SUPPLY - totalMinted;
  }
}
