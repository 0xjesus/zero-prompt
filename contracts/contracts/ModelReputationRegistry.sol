// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ModelReputationRegistry
 * @notice ERC-8004 Compliant On-Chain AI Model Reputation System
 * @dev Stores immutable ratings for AI models on Avalanche C-Chain
 *
 * Key Features:
 * - 1-5 star ratings stored permanently on-chain
 * - One rating per wallet per model (can update)
 * - Aggregated scores computed on-chain
 * - Gas-optimized using packed structs
 * - Fully transparent and decentralized
 */
contract ModelReputationRegistry {
    // ═══════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════

    event ModelRated(
        uint256 indexed modelId,
        address indexed rater,
        uint8 score,
        uint256 timestamp
    );

    event RatingUpdated(
        uint256 indexed modelId,
        address indexed rater,
        uint8 oldScore,
        uint8 newScore,
        uint256 timestamp
    );

    // ═══════════════════════════════════════════════════════════════════════
    // STRUCTS
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Individual rating (packed for gas efficiency)
    struct Rating {
        uint8 score;        // 1-5 stars
        uint48 timestamp;   // Unix timestamp (fits until year 8.9M)
        bool exists;        // Whether rating exists
    }

    /// @notice Aggregated model reputation data
    struct ModelReputation {
        uint256 totalRatings;      // Total number of ratings
        uint256 sumScores;         // Sum of all scores (for average calculation)
        uint256 fiveStarCount;     // Count of 5-star ratings
        uint256 fourStarCount;     // Count of 4-star ratings
        uint256 threeStarCount;    // Count of 3-star ratings
        uint256 twoStarCount;      // Count of 2-star ratings
        uint256 oneStarCount;      // Count of 1-star ratings
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice modelId => rater => Rating
    mapping(uint256 => mapping(address => Rating)) public ratings;

    /// @notice modelId => ModelReputation
    mapping(uint256 => ModelReputation) public reputations;

    /// @notice Total ratings across all models
    uint256 public totalRatingsCount;

    /// @notice List of model IDs that have been rated
    uint256[] public ratedModels;
    mapping(uint256 => bool) private _modelExists;

    // ═══════════════════════════════════════════════════════════════════════
    // MAIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Rate an AI model (1-5 stars)
     * @param modelId The ID of the model (from database)
     * @param score Rating score (1-5)
     */
    function rateModel(uint256 modelId, uint8 score) external {
        require(score >= 1 && score <= 5, "Score must be 1-5");

        Rating storage existing = ratings[modelId][msg.sender];
        ModelReputation storage rep = reputations[modelId];

        // Track new model
        if (!_modelExists[modelId]) {
            _modelExists[modelId] = true;
            ratedModels.push(modelId);
        }

        if (existing.exists) {
            // Update existing rating
            uint8 oldScore = existing.score;

            // Subtract old score from counts
            rep.sumScores -= oldScore;
            _decrementScoreCount(rep, oldScore);

            // Add new score to counts
            rep.sumScores += score;
            _incrementScoreCount(rep, score);

            existing.score = score;
            existing.timestamp = uint48(block.timestamp);

            emit RatingUpdated(modelId, msg.sender, oldScore, score, block.timestamp);
        } else {
            // New rating
            existing.score = score;
            existing.timestamp = uint48(block.timestamp);
            existing.exists = true;

            rep.totalRatings++;
            rep.sumScores += score;
            _incrementScoreCount(rep, score);

            totalRatingsCount++;

            emit ModelRated(modelId, msg.sender, score, block.timestamp);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Get a user's rating for a model
     * @param modelId The model ID
     * @param rater The rater's address
     * @return score The rating score (0 if not rated)
     * @return timestamp When the rating was made
     * @return exists Whether the rating exists
     */
    function getRating(uint256 modelId, address rater)
        external
        view
        returns (uint8 score, uint48 timestamp, bool exists)
    {
        Rating storage r = ratings[modelId][rater];
        return (r.score, r.timestamp, r.exists);
    }

    /**
     * @notice Get aggregated reputation for a model
     * @param modelId The model ID
     * @return totalRatings Number of ratings
     * @return averageScore Average score (multiplied by 100 for precision)
     * @return distribution Array of [1-star, 2-star, 3-star, 4-star, 5-star] counts
     */
    function getReputation(uint256 modelId)
        external
        view
        returns (
            uint256 totalRatings,
            uint256 averageScore,
            uint256[5] memory distribution
        )
    {
        ModelReputation storage rep = reputations[modelId];

        totalRatings = rep.totalRatings;

        // Average score * 100 for 2 decimal precision
        if (rep.totalRatings > 0) {
            averageScore = (rep.sumScores * 100) / rep.totalRatings;
        }

        distribution = [
            rep.oneStarCount,
            rep.twoStarCount,
            rep.threeStarCount,
            rep.fourStarCount,
            rep.fiveStarCount
        ];
    }

    /**
     * @notice Get number of rated models
     */
    function getRatedModelsCount() external view returns (uint256) {
        return ratedModels.length;
    }

    /**
     * @notice Get paginated list of rated model IDs
     * @param offset Starting index
     * @param limit Max number to return
     */
    function getRatedModelIds(uint256 offset, uint256 limit)
        external
        view
        returns (uint256[] memory)
    {
        uint256 total = ratedModels.length;
        if (offset >= total) {
            return new uint256[](0);
        }

        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }

        uint256[] memory result = new uint256[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = ratedModels[i];
        }

        return result;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // INTERNAL HELPERS
    // ═══════════════════════════════════════════════════════════════════════

    function _incrementScoreCount(ModelReputation storage rep, uint8 score) internal {
        if (score == 5) rep.fiveStarCount++;
        else if (score == 4) rep.fourStarCount++;
        else if (score == 3) rep.threeStarCount++;
        else if (score == 2) rep.twoStarCount++;
        else rep.oneStarCount++;
    }

    function _decrementScoreCount(ModelReputation storage rep, uint8 score) internal {
        if (score == 5) rep.fiveStarCount--;
        else if (score == 4) rep.fourStarCount--;
        else if (score == 3) rep.threeStarCount--;
        else if (score == 2) rep.twoStarCount--;
        else rep.oneStarCount--;
    }
}
