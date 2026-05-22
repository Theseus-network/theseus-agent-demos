// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

/// @title ApertureArtist
/// @notice Commitment surface for an Aperture visual-artist agent. Each
///         Aperture has a permanent visual fingerprint (palette,
///         composition rules, density cap, refusal set) committed at
///         mint and anchored here. The agent signs every published
///         canvas and every refused commission onto this contract.
///
///         Mirrors the PredictionMarketAdjudicator pattern.
contract ApertureArtist {
    enum Decision {
        UNINITIALIZED,
        PUBLISHED,
        REFUSED
    }

    /// @notice The Aperture agent's EVM-mapped address. Only this address can write.
    address public immutable agent;

    /// @notice keccak256 of the canonical visual-fingerprint spec.
    ///         Immutable — the fingerprint cannot be retuned after mint.
    bytes32 public immutable fingerprintHash;

    string public description;

    struct Verdict {
        Decision decision;
        /// @notice keccak256 of the canvas blob (PUBLISHED) or the
        ///         refused commission prompt + clause (REFUSED).
        bytes32 contentHash;
        /// @notice keccak256 of the off-chain reasoning blob.
        bytes32 reasonHash;
        uint256 updatedAt;
    }

    /// @notice Latest verdict per commissionId or canvasId.
    mapping(uint256 => Verdict) public verdicts;

    /// @notice Append-only log of every id the agent has ever posted on.
    uint256[] public touchedIds;

    event Published(uint256 indexed id, bytes32 contentHash, bytes32 reasonHash, uint256 updatedAt);
    event Refused(uint256 indexed id, bytes32 contentHash, bytes32 reasonHash, uint256 updatedAt);

    error NotAgent();
    error MissingContentHash();
    error MissingReasonHash();

    modifier onlyAgent() {
        if (msg.sender != agent) revert NotAgent();
        _;
    }

    constructor(address agent_, bytes32 fingerprintHash_, string memory description_) {
        agent = agent_;
        fingerprintHash = fingerprintHash_;
        description = description_;
    }

    function publish(uint256 id, bytes32 contentHash, bytes32 reasonHash) external onlyAgent {
        if (contentHash == bytes32(0)) revert MissingContentHash();
        if (reasonHash == bytes32(0)) revert MissingReasonHash();

        bool firstTouch = verdicts[id].decision == Decision.UNINITIALIZED;
        verdicts[id] = Verdict({
            decision: Decision.PUBLISHED,
            contentHash: contentHash,
            reasonHash: reasonHash,
            updatedAt: block.timestamp
        });
        if (firstTouch) touchedIds.push(id);
        emit Published(id, contentHash, reasonHash, block.timestamp);
    }

    function refuse(uint256 id, bytes32 contentHash, bytes32 reasonHash) external onlyAgent {
        if (contentHash == bytes32(0)) revert MissingContentHash();
        if (reasonHash == bytes32(0)) revert MissingReasonHash();

        bool firstTouch = verdicts[id].decision == Decision.UNINITIALIZED;
        verdicts[id] = Verdict({
            decision: Decision.REFUSED,
            contentHash: contentHash,
            reasonHash: reasonHash,
            updatedAt: block.timestamp
        });
        if (firstTouch) touchedIds.push(id);
        emit Refused(id, contentHash, reasonHash, block.timestamp);
    }

    function inspect(uint256 id) external view returns (Verdict memory) {
        return verdicts[id];
    }

    function touchedIdCount() external view returns (uint256) {
        return touchedIds.length;
    }
}
