// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Import the necessary, battle-tested contracts from OpenZeppelin
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract EchoNFT is ERC721, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIdCounter;

    // A struct to hold data about each Echo. For now, it's just the
    // hash of the knowledge content for on-chain verification.
    struct EchoData {
        string knowledgeHash;
        address creator;
    }

    // Mapping from a tokenId to its associated data
    mapping(uint256 => EchoData) public echoData;

    // The constructor sets the Name and Symbol for our NFT collection
    constructor() ERC721("EchoLink Knowledge Echo", "ECHO") Ownable() {}

    /**
     * @dev Mints a new Echo NFT. Can only be called by the contract owner.
     * The owner will be our backend server, ensuring Echos are only created
     * through our official process. This is a key security feature.
     */
    function safeMint(
        address creator,
        string memory knowledgeHash
    )
        public
        onlyOwner // This ensures only our backend can call this
        returns (uint256)
    {
        _tokenIdCounter.increment();
        uint256 tokenId = _tokenIdCounter.current();

        _safeMint(creator, tokenId); // Mints the NFT to the creator's address

        // Store the associated data on-chain
        echoData[tokenId] = EchoData({
            knowledgeHash: knowledgeHash,
            creator: creator
        });

        return tokenId;
    }

    function getEchoData(
        uint256 tokenId
    ) public view returns (string memory knowledgeHash, address creator) {
        EchoData memory data = echoData[tokenId];
        return (data.knowledgeHash, data.creator);
    }
}
