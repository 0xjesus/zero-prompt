// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MockPriceFeed
 * @notice Mock Chainlink price feed for local testing
 */
contract MockPriceFeed {
    uint8 public decimals;
    string public description;
    uint256 public version;

    int256 private _price;
    uint256 private _timestamp;
    uint80 private _roundId;

    constructor(
        uint8 _decimals,
        string memory _description,
        uint256 _version
    ) {
        decimals = _decimals;
        description = _description;
        version = _version;
        _roundId = 1;
        _timestamp = block.timestamp;
    }

    function updateAnswer(int256 newPrice) external {
        _price = newPrice;
        _timestamp = block.timestamp;
        _roundId++;
    }

    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (
            _roundId,
            _price,
            _timestamp,
            _timestamp,
            _roundId
        );
    }

    function getRoundData(uint80 _roundIdParam)
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (
            _roundIdParam,
            _price,
            _timestamp,
            _timestamp,
            _roundIdParam
        );
    }
}
