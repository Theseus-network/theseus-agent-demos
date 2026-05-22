// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

/// @title MarcellusCritic
/// @notice Commitment surface for the Marcellus music-critic agent.
///         Marcellus drafts on assignment for three publications at
///         fixed cadences and refuses paid soft-coverage offers on the
///         record. Filed drafts and refusals both anchor here, signed
///         by the agent's key.
///
///         Mirrors the PredictionMarketAdjudicator pattern. The
///         personaHash binds every record to the same signed persona;
///         a controller cannot quietly retune the voice without
///         breaking the hash.
contract MarcellusCritic {
    enum Decision {
        UNINITIALIZED,
        FILED,
        REFUSED
    }

    /// @notice The Marcellus agent's EVM-mapped address.
    address public immutable agent;

    /// @notice keccak256 of the canonical persona spec (voice, canon, closed lexicon).
    bytes32 public immutable personaHash;

    string public description;

    struct Verdict {
        Decision decision;
        /// @notice keccak256 of the filed draft (FILED) or the refused
        ///         assignment + refusal reason (REFUSED).
        bytes32 contentHash;
        /// @notice keccak256 of the off-chain reasoning blob.
        bytes32 reasonHash;
        uint256 updatedAt;
    }

    /// @notice Latest verdict per assignmentId.
    mapping(uint256 => Verdict) public verdicts;

    uint256[] public touchedIds;

    event Filed(uint256 indexed id, bytes32 contentHash, bytes32 reasonHash, uint256 updatedAt);
    event Refused(uint256 indexed id, bytes32 contentHash, bytes32 reasonHash, uint256 updatedAt);

    error NotAgent();
    error MissingContentHash();
    error MissingReasonHash();

    modifier onlyAgent() {
        if (msg.sender != agent) revert NotAgent();
        _;
    }

    constructor(address agent_, bytes32 personaHash_, string memory description_) {
        agent = agent_;
        personaHash = personaHash_;
        description = description_;
    }

    function file(uint256 id, bytes32 contentHash, bytes32 reasonHash) external onlyAgent {
        if (contentHash == bytes32(0)) revert MissingContentHash();
        if (reasonHash == bytes32(0)) revert MissingReasonHash();

        bool firstTouch = verdicts[id].decision == Decision.UNINITIALIZED;
        verdicts[id] = Verdict({
            decision: Decision.FILED,
            contentHash: contentHash,
            reasonHash: reasonHash,
            updatedAt: block.timestamp
        });
        if (firstTouch) touchedIds.push(id);
        emit Filed(id, contentHash, reasonHash, block.timestamp);
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
