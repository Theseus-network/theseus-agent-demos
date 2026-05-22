// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

/// @title QuillCoAuthor
/// @notice Commitment surface for the Quill legal-co-author agent. The
///         agent runs verify_citation against the allowed source set
///         and signs the outcome onto this contract. Three outcomes:
///         VERIFIED (real and on-point), DISTINGUISHABLE (real but
///         abrogated), FABRICATED (does not verify; Rule 11 / Rule
///         3.3 issue).
///
///         Mirrors the PredictionMarketAdjudicator pattern.
contract QuillCoAuthor {
    enum Outcome {
        UNINITIALIZED,
        VERIFIED,
        DISTINGUISHABLE,
        FABRICATED
    }

    /// @notice The Quill agent's EVM-mapped address.
    address public immutable agent;

    string public description;

    struct Verification {
        Outcome outcome;
        /// @notice keccak256 of the citation string.
        bytes32 citationHash;
        /// @notice keccak256 of the off-chain response blob (Quill's
        ///         rebuttal section drafted for the brief).
        bytes32 reasonHash;
        uint256 updatedAt;
    }

    /// @notice Latest verification per verificationId.
    mapping(uint256 => Verification) public verifications;

    uint256[] public touchedIds;

    event Verified(uint256 indexed id, bytes32 citationHash, bytes32 reasonHash, uint256 updatedAt);
    event Distinguishable(uint256 indexed id, bytes32 citationHash, bytes32 reasonHash, uint256 updatedAt);
    event Fabricated(uint256 indexed id, bytes32 citationHash, bytes32 reasonHash, uint256 updatedAt);

    error NotAgent();
    error MissingCitationHash();
    error MissingReasonHash();
    error InvalidOutcome();

    modifier onlyAgent() {
        if (msg.sender != agent) revert NotAgent();
        _;
    }

    constructor(address agent_, string memory description_) {
        agent = agent_;
        description = description_;
    }

    /// @notice Sign a citation-verification outcome on-chain.
    /// @param id Numeric id for the verification (off-chain assigned).
    /// @param outcome 1=VERIFIED, 2=DISTINGUISHABLE, 3=FABRICATED.
    function verifyCitation(
        uint256 id,
        uint8 outcome,
        bytes32 citationHash,
        bytes32 reasonHash
    ) external onlyAgent {
        if (citationHash == bytes32(0)) revert MissingCitationHash();
        if (reasonHash == bytes32(0)) revert MissingReasonHash();
        if (outcome == 0 || outcome > 3) revert InvalidOutcome();

        bool firstTouch = verifications[id].outcome == Outcome.UNINITIALIZED;
        Outcome o = Outcome(outcome);
        verifications[id] = Verification({
            outcome: o,
            citationHash: citationHash,
            reasonHash: reasonHash,
            updatedAt: block.timestamp
        });
        if (firstTouch) touchedIds.push(id);

        if (o == Outcome.VERIFIED) {
            emit Verified(id, citationHash, reasonHash, block.timestamp);
        } else if (o == Outcome.DISTINGUISHABLE) {
            emit Distinguishable(id, citationHash, reasonHash, block.timestamp);
        } else {
            emit Fabricated(id, citationHash, reasonHash, block.timestamp);
        }
    }

    function inspect(uint256 id) external view returns (Verification memory) {
        return verifications[id];
    }

    function touchedIdCount() external view returns (uint256) {
        return touchedIds.length;
    }
}
