// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * Registry to anchor prompt metadata and ownership on-chain, with allowed payment tokens.
 */
contract ZeroPromptRegistry {
    struct PromptRecord {
        address owner;
        address paymentToken;
        string uri;
        uint256 createdAt;
        uint256 updatedAt;
    }

    address public owner;
    mapping(bytes32 => PromptRecord) private records;
    mapping(address => bool) public allowedTokens;

    event PromptRegistered(bytes32 indexed promptId, address indexed owner, address paymentToken, string uri);
    event PromptUpdated(bytes32 indexed promptId, address indexed owner, string uri);
    event AllowedTokenUpdated(address indexed token, bool allowed);

    error PromptExists();
    error NotOwner();
    error PromptMissing();
    error TokenNotAllowed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address[] memory initialAllowed) {
        owner = msg.sender;
        for (uint256 i = 0; i < initialAllowed.length; i++) {
            allowedTokens[initialAllowed[i]] = true;
            emit AllowedTokenUpdated(initialAllowed[i], true);
        }
    }

    function setAllowedToken(address token, bool allowed) external onlyOwner {
        allowedTokens[token] = allowed;
        emit AllowedTokenUpdated(token, allowed);
    }

    function registerPrompt(bytes32 promptId, string calldata uri, address paymentToken) external {
        if (records[promptId].owner != address(0)) {
            revert PromptExists();
        }
        if (!allowedTokens[paymentToken]) {
            revert TokenNotAllowed();
        }

        records[promptId] = PromptRecord({
            owner: msg.sender,
            paymentToken: paymentToken,
            uri: uri,
            createdAt: block.timestamp,
            updatedAt: block.timestamp
        });

        emit PromptRegistered(promptId, msg.sender, paymentToken, uri);
    }

    function updatePrompt(bytes32 promptId, string calldata uri) external {
        PromptRecord storage record = records[promptId];
        if (record.owner == address(0)) {
            revert PromptMissing();
        }
        if (record.owner != msg.sender) {
            revert NotOwner();
        }

        record.uri = uri;
        record.updatedAt = block.timestamp;

        emit PromptUpdated(promptId, msg.sender, uri);
    }

    function getPrompt(bytes32 promptId) external view returns (PromptRecord memory) {
        return records[promptId];
    }
}
