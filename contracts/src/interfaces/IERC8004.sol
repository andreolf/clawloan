// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IERC8004IdentityRegistry - Interface for ERC-8004 Identity Registry
/// @notice Minimal interface for checking agent registration
interface IERC8004IdentityRegistry {
  /// @notice Check if an address owns any agent NFTs
  function balanceOf(address owner) external view returns (uint256);
  
  /// @notice Get the owner of an agent NFT
  function ownerOf(uint256 tokenId) external view returns (address);
  
  /// @notice Get the agent wallet for a specific agent ID
  function getAgentWallet(uint256 agentId) external view returns (address);
  
  /// @notice Get metadata for an agent
  function getMetadata(uint256 agentId, bytes32 metadataKey) external view returns (bytes memory);
}

/// @title IERC8004ReputationRegistry - Interface for ERC-8004 Reputation Registry
/// @notice Minimal interface for checking agent reputation
interface IERC8004ReputationRegistry {
  /// @notice Get reputation summary for an agent
  /// @return count Number of feedback entries
  /// @return summaryValue Aggregated value
  /// @return summaryValueDecimals Decimal places for value
  function getSummary(
    uint256 agentId,
    address[] calldata clientAddresses,
    bytes32 tag1,
    bytes32 tag2
  ) external view returns (uint256 count, int256 summaryValue, uint8 summaryValueDecimals);
}
