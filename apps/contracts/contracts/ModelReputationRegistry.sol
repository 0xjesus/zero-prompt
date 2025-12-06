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
 * - Models are identified by their database ID (agentId)
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

    struct AgentInfo {
        uint256 agentId;       // Database model.id
        string openrouterId;   // Reference: "anthropic/claude-3.5-sonnet"
        bool registered;
        uint256 registeredAt;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════════════

    address public owner;

    // Agent registry (using database ID as key)
    mapping(uint256 => AgentInfo) public agents;
    uint256[] public agentIds;

    // Reputation data
    mapping(uint256 => ReputationSummary) public reputations;
    mapping(uint256 => mapping(address => Feedback[])) public feedbacks;
    mapping(uint256 => address[]) public reviewers;

    // User tracking
    mapping(address => uint256[]) public userRatedAgents;
    mapping(uint256 => mapping(address => bool)) public hasRated;

    // ═══════════════════════════════════════════════════════════════════════
    // EVENTS (ERC-8004 Compliant)
    // ═══════════════════════════════════════════════════════════════════════

    event AgentRegistered(uint256 indexed agentId, string openrouterId);

    event NewFeedback(
        uint256 indexed agentId,
        address indexed reviewer,
        uint8 score,
        bytes32 indexed tag1,
        bytes32 tag2,
        string comment
    );

    event FeedbackRevoked(
        uint256 indexed agentId,
        address indexed reviewer,
        uint64 indexed feedbackIndex
    );

    // ═══════════════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════════════

    error NotOwner();
    error InvalidScore();
    error AgentNotRegistered();
    error AgentAlreadyRegistered();
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

    modifier agentExists(uint256 agentId) {
        if (!agents[agentId].registered) revert AgentNotRegistered();
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
     * @param agentId The database model.id
     * @param openrouterId The OpenRouter model ID for reference (e.g., "anthropic/claude-3.5-sonnet")
     */
    function registerAgent(uint256 agentId, string calldata openrouterId) external onlyOwner {
        if (agents[agentId].registered) revert AgentAlreadyRegistered();

        agents[agentId] = AgentInfo({
            agentId: agentId,
            openrouterId: openrouterId,
            registered: true,
            registeredAt: block.timestamp
        });

        agentIds.push(agentId);

        emit AgentRegistered(agentId, openrouterId);
    }

    /**
     * @notice Batch register multiple agents
     * @param _agentIds Array of database model IDs
     * @param openrouterIds Array of OpenRouter model IDs
     */
    function registerAgents(uint256[] calldata _agentIds, string[] calldata openrouterIds) external onlyOwner {
        require(_agentIds.length == openrouterIds.length, "Array length mismatch");

        for (uint256 i = 0; i < _agentIds.length; i++) {
            uint256 agentId = _agentIds[i];

            if (!agents[agentId].registered) {
                agents[agentId] = AgentInfo({
                    agentId: agentId,
                    openrouterId: openrouterIds[i],
                    registered: true,
                    registeredAt: block.timestamp
                });

                agentIds.push(agentId);
                emit AgentRegistered(agentId, openrouterIds[i]);
            }
        }
    }

    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // FEEDBACK FUNCTIONS (ERC-8004 Reputation Registry)
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Submit feedback for an agent (ERC-8004 compliant)
     * @param agentId The database model.id
     * @param score Rating from 1-5
     * @param tag1 Primary categorization tag
     * @param tag2 Secondary categorization tag (optional)
     * @param comment Optional comment or URI to detailed feedback
     */
    function giveFeedback(
        uint256 agentId,
        uint8 score,
        bytes32 tag1,
        bytes32 tag2,
        string calldata comment
    ) external validScore(score) agentExists(agentId) {
        // Check if user already rated this agent
        if (hasRated[agentId][msg.sender]) revert AlreadyRated();

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

        feedbacks[agentId][msg.sender].push(fb);

        // Track reviewer
        if (feedbacks[agentId][msg.sender].length == 1) {
            reviewers[agentId].push(msg.sender);
        }

        // Update reputation summary
        ReputationSummary storage rep = reputations[agentId];
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
        hasRated[agentId][msg.sender] = true;
        userRatedAgents[msg.sender].push(agentId);

        emit NewFeedback(agentId, msg.sender, score, tag1, tag2, comment);
    }

    /**
     * @notice Revoke previous feedback
     * @param agentId The database model.id
     * @param feedbackIndex Index of the feedback to revoke
     */
    function revokeFeedback(uint256 agentId, uint64 feedbackIndex) external agentExists(agentId) {
        Feedback[] storage userFeedbacks = feedbacks[agentId][msg.sender];

        if (feedbackIndex >= userFeedbacks.length) revert NoFeedbackToRevoke();
        if (userFeedbacks[feedbackIndex].revoked) revert FeedbackAlreadyRevoked();

        Feedback storage fb = userFeedbacks[feedbackIndex];
        fb.revoked = true;

        // Update reputation summary
        ReputationSummary storage rep = reputations[agentId];
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
        hasRated[agentId][msg.sender] = false;

        emit FeedbackRevoked(agentId, msg.sender, feedbackIndex);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Get reputation summary for an agent (ERC-8004 compliant)
     * @param agentId The database model.id
     */
    function getSummary(uint256 agentId) external view returns (
        uint256 totalRatings,
        uint256 averageScore,  // Scaled by 100 (e.g., 450 = 4.50 stars)
        uint256 fiveStarCount,
        uint256 fourStarCount,
        uint256 threeStarCount,
        uint256 twoStarCount,
        uint256 oneStarCount
    ) {
        ReputationSummary storage rep = reputations[agentId];

        totalRatings = rep.totalRatings;
        averageScore = rep.totalRatings > 0 ? (rep.sumScores * 100) / rep.totalRatings : 0;
        fiveStarCount = rep.fiveStarCount;
        fourStarCount = rep.fourStarCount;
        threeStarCount = rep.threeStarCount;
        twoStarCount = rep.twoStarCount;
        oneStarCount = rep.oneStarCount;
    }

    /**
     * @notice Get agent info
     * @param agentId The database model.id
     */
    function getAgent(uint256 agentId) external view returns (
        string memory openrouterId,
        bool registered,
        uint256 registeredAt,
        uint256 totalRatings,
        uint256 averageScore
    ) {
        AgentInfo storage info = agents[agentId];
        ReputationSummary storage rep = reputations[agentId];

        openrouterId = info.openrouterId;
        registered = info.registered;
        registeredAt = info.registeredAt;
        totalRatings = rep.totalRatings;
        averageScore = rep.totalRatings > 0 ? (rep.sumScores * 100) / rep.totalRatings : 0;
    }

    /**
     * @notice Read feedback from a specific reviewer (ERC-8004 compliant)
     * @param agentId The database model.id
     * @param reviewer The reviewer address
     * @param index Feedback index
     */
    function readFeedback(uint256 agentId, address reviewer, uint64 index) external view returns (
        uint8 score,
        bytes32 tag1,
        bytes32 tag2,
        string memory comment,
        uint256 timestamp,
        bool revoked
    ) {
        Feedback storage fb = feedbacks[agentId][reviewer][index];
        return (fb.score, fb.tag1, fb.tag2, fb.comment, fb.timestamp, fb.revoked);
    }

    /**
     * @notice Get all feedbacks for an agent from a reviewer
     */
    function getAllFeedbacks(uint256 agentId, address reviewer) external view returns (Feedback[] memory) {
        return feedbacks[agentId][reviewer];
    }

    /**
     * @notice Get reviewers list for an agent
     */
    function getReviewers(uint256 agentId) external view returns (address[] memory) {
        return reviewers[agentId];
    }

    /**
     * @notice Get total registered agents count
     */
    function getAgentCount() external view returns (uint256) {
        return agentIds.length;
    }

    /**
     * @notice Get agents rated by a user
     */
    function getUserRatedAgents(address user) external view returns (uint256[] memory) {
        return userRatedAgents[user];
    }

    /**
     * @notice Check if user has rated an agent
     */
    function userHasRated(uint256 agentId, address user) external view returns (bool) {
        return hasRated[agentId][user];
    }

    /**
     * @notice Get all registered agent IDs
     */
    function getAllAgentIds() external view returns (uint256[] memory) {
        return agentIds;
    }
}
