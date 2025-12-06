// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ModelReputationRegistry
 * @dev ERC-8004 compliant reputation registry for AI models
 *
 * This contract implements the Reputation Registry from ERC-8004 "Trustless Agents"
 * to track and aggregate user feedback for AI models accessed via ZeroPrompt.
 *
 * Key Features:
 * - Users can rate models (1-5 stars) after using them
 * - Aggregate reputation scores are computed on-chain
 * - Feedback can be tagged for categorization (speed, quality, accuracy)
 * - Models are identified by their openrouterId hash
 */
contract ModelReputationRegistry {
    // ═══════════════════════════════════════════════════════════════════════
    // STRUCTS
    // ═══════════════════════════════════════════════════════════════════════

    struct Feedback {
        address reviewer;
        uint8 score;           // 1-5 stars
        bytes32 tag1;          // Primary tag (e.g., "quality", "speed")
        bytes32 tag2;          // Secondary tag (optional)
        string comment;        // Optional comment URI (IPFS/Arweave)
        uint256 timestamp;
        bool revoked;
    }

    struct ReputationSummary {
        uint256 totalRatings;
        uint256 sumScores;
        uint256 fiveStarCount;
        uint256 fourStarCount;
        uint256 threeStarCount;
        uint256 twoStarCount;
        uint256 oneStarCount;
        uint256 lastUpdated;
    }

    struct ModelInfo {
        bytes32 modelId;       // keccak256(openrouterId)
        string openrouterId;   // e.g., "anthropic/claude-3.5-sonnet"
        bool registered;
        uint256 registeredAt;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════════════

    address public owner;

    // Model registry
    mapping(bytes32 => ModelInfo) public models;
    bytes32[] public modelIds;

    // Reputation data
    mapping(bytes32 => ReputationSummary) public reputations;
    mapping(bytes32 => mapping(address => Feedback[])) public feedbacks;
    mapping(bytes32 => address[]) public reviewers;

    // User tracking
    mapping(address => bytes32[]) public userRatedModels;
    mapping(bytes32 => mapping(address => bool)) public hasRated;

    // ═══════════════════════════════════════════════════════════════════════
    // EVENTS (ERC-8004 Compliant)
    // ═══════════════════════════════════════════════════════════════════════

    event ModelRegistered(bytes32 indexed modelId, string openrouterId);

    event NewFeedback(
        bytes32 indexed modelId,
        address indexed reviewer,
        uint8 score,
        bytes32 indexed tag1,
        bytes32 tag2,
        string comment
    );

    event FeedbackRevoked(
        bytes32 indexed modelId,
        address indexed reviewer,
        uint64 indexed feedbackIndex
    );

    // ═══════════════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════════════

    error NotOwner();
    error InvalidScore();
    error ModelNotRegistered();
    error ModelAlreadyRegistered();
    error AlreadyRated();
    error NoFeedbackToRevoke();
    error FeedbackAlreadyRevoked();

    // ═══════════════════════════════════════════════════════════════════════
    // MODIFIERS
    // ═══════════════════════════════════════════════════════════════════════

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier validScore(uint8 score) {
        if (score < 1 || score > 5) revert InvalidScore();
        _;
    }

    modifier modelExists(bytes32 modelId) {
        if (!models[modelId].registered) revert ModelNotRegistered();
        _;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════

    constructor() {
        owner = msg.sender;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Register a new AI model in the registry
     * @param openrouterId The OpenRouter model ID (e.g., "anthropic/claude-3.5-sonnet")
     */
    function registerModel(string calldata openrouterId) external onlyOwner returns (bytes32) {
        bytes32 modelId = keccak256(bytes(openrouterId));

        if (models[modelId].registered) revert ModelAlreadyRegistered();

        models[modelId] = ModelInfo({
            modelId: modelId,
            openrouterId: openrouterId,
            registered: true,
            registeredAt: block.timestamp
        });

        modelIds.push(modelId);

        emit ModelRegistered(modelId, openrouterId);
        return modelId;
    }

    /**
     * @notice Batch register multiple models
     * @param openrouterIds Array of OpenRouter model IDs
     */
    function registerModels(string[] calldata openrouterIds) external onlyOwner returns (bytes32[] memory) {
        bytes32[] memory ids = new bytes32[](openrouterIds.length);

        for (uint256 i = 0; i < openrouterIds.length; i++) {
            bytes32 modelId = keccak256(bytes(openrouterIds[i]));

            if (!models[modelId].registered) {
                models[modelId] = ModelInfo({
                    modelId: modelId,
                    openrouterId: openrouterIds[i],
                    registered: true,
                    registeredAt: block.timestamp
                });

                modelIds.push(modelId);
                emit ModelRegistered(modelId, openrouterIds[i]);
            }

            ids[i] = modelId;
        }

        return ids;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // FEEDBACK FUNCTIONS (ERC-8004 Reputation Registry)
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Submit feedback for a model (ERC-8004 compliant)
     * @param modelId The model identifier (keccak256 of openrouterId)
     * @param score Rating from 1-5
     * @param tag1 Primary categorization tag
     * @param tag2 Secondary categorization tag (optional)
     * @param comment Optional comment or URI to detailed feedback
     */
    function giveFeedback(
        bytes32 modelId,
        uint8 score,
        bytes32 tag1,
        bytes32 tag2,
        string calldata comment
    ) external validScore(score) modelExists(modelId) {
        // Check if user already rated this model
        if (hasRated[modelId][msg.sender]) revert AlreadyRated();

        // Store feedback
        Feedback memory fb = Feedback({
            reviewer: msg.sender,
            score: score,
            tag1: tag1,
            tag2: tag2,
            comment: comment,
            timestamp: block.timestamp,
            revoked: false
        });

        feedbacks[modelId][msg.sender].push(fb);

        // Track reviewer
        if (feedbacks[modelId][msg.sender].length == 1) {
            reviewers[modelId].push(msg.sender);
        }

        // Update reputation summary
        ReputationSummary storage rep = reputations[modelId];
        rep.totalRatings++;
        rep.sumScores += score;
        rep.lastUpdated = block.timestamp;

        // Update star counts
        if (score == 5) rep.fiveStarCount++;
        else if (score == 4) rep.fourStarCount++;
        else if (score == 3) rep.threeStarCount++;
        else if (score == 2) rep.twoStarCount++;
        else if (score == 1) rep.oneStarCount++;

        // Mark as rated
        hasRated[modelId][msg.sender] = true;
        userRatedModels[msg.sender].push(modelId);

        emit NewFeedback(modelId, msg.sender, score, tag1, tag2, comment);
    }

    /**
     * @notice Revoke previous feedback
     * @param modelId The model identifier
     * @param feedbackIndex Index of the feedback to revoke
     */
    function revokeFeedback(bytes32 modelId, uint64 feedbackIndex) external modelExists(modelId) {
        Feedback[] storage userFeedbacks = feedbacks[modelId][msg.sender];

        if (feedbackIndex >= userFeedbacks.length) revert NoFeedbackToRevoke();
        if (userFeedbacks[feedbackIndex].revoked) revert FeedbackAlreadyRevoked();

        Feedback storage fb = userFeedbacks[feedbackIndex];
        fb.revoked = true;

        // Update reputation summary
        ReputationSummary storage rep = reputations[modelId];
        rep.totalRatings--;
        rep.sumScores -= fb.score;
        rep.lastUpdated = block.timestamp;

        // Update star counts
        if (fb.score == 5) rep.fiveStarCount--;
        else if (fb.score == 4) rep.fourStarCount--;
        else if (fb.score == 3) rep.threeStarCount--;
        else if (fb.score == 2) rep.twoStarCount--;
        else if (fb.score == 1) rep.oneStarCount--;

        // Allow re-rating
        hasRated[modelId][msg.sender] = false;

        emit FeedbackRevoked(modelId, msg.sender, feedbackIndex);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Get reputation summary for a model (ERC-8004 compliant)
     * @param modelId The model identifier
     */
    function getSummary(bytes32 modelId) external view returns (
        uint256 totalRatings,
        uint256 averageScore,  // Scaled by 100 (e.g., 450 = 4.50 stars)
        uint256 fiveStarCount,
        uint256 fourStarCount,
        uint256 threeStarCount,
        uint256 twoStarCount,
        uint256 oneStarCount
    ) {
        ReputationSummary storage rep = reputations[modelId];

        totalRatings = rep.totalRatings;
        averageScore = rep.totalRatings > 0 ? (rep.sumScores * 100) / rep.totalRatings : 0;
        fiveStarCount = rep.fiveStarCount;
        fourStarCount = rep.fourStarCount;
        threeStarCount = rep.threeStarCount;
        twoStarCount = rep.twoStarCount;
        oneStarCount = rep.oneStarCount;
    }

    /**
     * @notice Get model info by openrouterId string
     * @param openrouterId The OpenRouter model ID string
     */
    function getModelByOpenrouterId(string calldata openrouterId) external view returns (
        bytes32 modelId,
        bool registered,
        uint256 registeredAt,
        uint256 totalRatings,
        uint256 averageScore
    ) {
        modelId = keccak256(bytes(openrouterId));
        ModelInfo storage info = models[modelId];
        ReputationSummary storage rep = reputations[modelId];

        registered = info.registered;
        registeredAt = info.registeredAt;
        totalRatings = rep.totalRatings;
        averageScore = rep.totalRatings > 0 ? (rep.sumScores * 100) / rep.totalRatings : 0;
    }

    /**
     * @notice Read feedback from a specific reviewer (ERC-8004 compliant)
     * @param modelId The model identifier
     * @param reviewer The reviewer address
     * @param index Feedback index
     */
    function readFeedback(bytes32 modelId, address reviewer, uint64 index) external view returns (
        uint8 score,
        bytes32 tag1,
        bytes32 tag2,
        string memory comment,
        uint256 timestamp,
        bool revoked
    ) {
        Feedback storage fb = feedbacks[modelId][reviewer][index];
        return (fb.score, fb.tag1, fb.tag2, fb.comment, fb.timestamp, fb.revoked);
    }

    /**
     * @notice Get all feedbacks for a model from a reviewer
     */
    function getAllFeedbacks(bytes32 modelId, address reviewer) external view returns (Feedback[] memory) {
        return feedbacks[modelId][reviewer];
    }

    /**
     * @notice Get reviewers list for a model
     */
    function getReviewers(bytes32 modelId) external view returns (address[] memory) {
        return reviewers[modelId];
    }

    /**
     * @notice Get total registered models count
     */
    function getModelCount() external view returns (uint256) {
        return modelIds.length;
    }

    /**
     * @notice Get models rated by a user
     */
    function getUserRatedModels(address user) external view returns (bytes32[] memory) {
        return userRatedModels[user];
    }

    /**
     * @notice Check if user has rated a model
     */
    function userHasRated(bytes32 modelId, address user) external view returns (bool) {
        return hasRated[modelId][user];
    }

    /**
     * @notice Get model ID from openrouterId string
     */
    function getModelId(string calldata openrouterId) external pure returns (bytes32) {
        return keccak256(bytes(openrouterId));
    }
}
