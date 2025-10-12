// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Alternative version without onlyOwner restriction for easier frontend testing
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract EchoNFTPublic is ERC721, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIdCounter;

    struct EchoData {
        string knowledgeHash;
        address creator;
    }

    mapping(uint256 => EchoData) public echoData;

    constructor() ERC721("EchoLink Knowledge Echo", "ECHO") Ownable() {}

    /**
     * @dev Mints a new Echo NFT. Can be called by anyone!
     * This version removes the onlyOwner restriction for easier testing.
     * For production, consider adding proper access control or fees.
     */
    function safeMint(address creator, string memory knowledgeHash)
        public
        returns (uint256)
    {
        _tokenIdCounter.increment();
        uint256 tokenId = _tokenIdCounter.current();

        _safeMint(creator, tokenId);

        echoData[tokenId] = EchoData({
            knowledgeHash: knowledgeHash,
            creator: creator
        });

        return tokenId;
    }
}

