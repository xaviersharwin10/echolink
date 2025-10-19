// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Import the necessary, battle-tested contracts from OpenZeppelin
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract EchoNFT is ERC721, Ownable {
    // Track used token IDs to prevent duplicates
    mapping(uint256 => bool) private _usedTokenIds;

    // PYUSD token address for payments
    IERC20 public immutable pyusdToken;

    // Array to track all token IDs
    uint256[] private _allTokenIds;

    // A struct to hold data about each Echo
    struct EchoData {
        string name;
        string description;
        address creator;
        uint256 pricePerQuery; // Price in PYUSD (with 6 decimals)
        bool isActive; // Whether the Echo is active for queries
    }

    // Credit system for users
    struct UserCredits {
        uint256 balance; // Credits balance
        uint256 lastUpdated; // Last update timestamp
    }

    // Mapping from a tokenId to its associated data
    mapping(uint256 => EchoData) public echoData;
    
    // Mapping from user address to their credit balance
    mapping(address => UserCredits) public userCredits;
    
    // Events
    event EchoCreated(uint256 indexed tokenId, address indexed creator, string name, uint256 pricePerQuery);
    event CreditsPurchased(address indexed user, uint256 amount, uint256 credits);
    event CreditsUsed(address indexed user, uint256 indexed echoId, uint256 creditsUsed);
    event EchoUpdated(uint256 indexed tokenId, string name, string description, uint256 pricePerQuery);

    // The constructor sets the Name and Symbol for our NFT collection
    constructor(address _pyusdToken) ERC721("EchoLink Knowledge Echo", "ECHO") Ownable() {
        pyusdToken = IERC20(_pyusdToken);
    }

    /**
     * @dev Mints a new Echo NFT with a specific token ID. Can only be called by the contract owner.
     * The owner will be our backend server, ensuring Echos are only created
     * through our official process. This is a key security feature.
     */
    function safeMint(
        uint256 tokenId,
        address creator,
        string memory name,
        string memory description,
        uint256 pricePerQuery
    )
        public
        onlyOwner // This ensures only our backend can call this
        returns (uint256)
    {
        require(!_usedTokenIds[tokenId], "Token ID already exists");
        require(tokenId > 0, "Token ID must be greater than 0");

        // Mark token ID as used
        _usedTokenIds[tokenId] = true;

        // Add to token IDs array
        _allTokenIds.push(tokenId);

        _safeMint(creator, tokenId); // Mints the NFT to the creator's address

        // Store the associated data on-chain
        echoData[tokenId] = EchoData({
            name: name,
            description: description,
            creator: creator,
            pricePerQuery: pricePerQuery,
            isActive: true
        });

        emit EchoCreated(tokenId, creator, name, pricePerQuery);
        return tokenId;
    }

    /**
     * @dev Updates Echo metadata. Can only be called by the Echo creator.
     */
    function updateEcho(
        uint256 tokenId,
        string memory name,
        string memory description,
        uint256 pricePerQuery
    ) public {
        require(ownerOf(tokenId) == msg.sender, "Only Echo owner can update");
        require(echoData[tokenId].isActive, "Echo is not active");
        
        echoData[tokenId].name = name;
        echoData[tokenId].description = description;
        echoData[tokenId].pricePerQuery = pricePerQuery;
        
        emit EchoUpdated(tokenId, name, description, pricePerQuery);
    }

    /**
     * @dev Toggles Echo active status. Can only be called by the Echo creator.
     */
    function toggleEchoActive(uint256 tokenId) public {
        require(ownerOf(tokenId) == msg.sender, "Only Echo owner can toggle");
        echoData[tokenId].isActive = !echoData[tokenId].isActive;
    }

    function getEchoData(
        uint256 tokenId
    ) public view returns (string memory name, string memory description, address creator, uint256 pricePerQuery, bool isActive) {
        EchoData memory data = echoData[tokenId];
        return (data.name, data.description, data.creator, data.pricePerQuery, data.isActive);
    }

    /**
     * @dev Get all echoes with their data
     */
    function getAllEchoes() public view returns (
        uint256[] memory tokenIds,
        string[] memory names,
        string[] memory descriptions,
        address[] memory creators,
        uint256[] memory pricesPerQuery,
        bool[] memory activeStatuses
    ) {
        uint256 length = _allTokenIds.length;
        
        tokenIds = new uint256[](length);
        names = new string[](length);
        descriptions = new string[](length);
        creators = new address[](length);
        pricesPerQuery = new uint256[](length);
        activeStatuses = new bool[](length);
        
        for (uint256 i = 0; i < length; i++) {
            uint256 tokenId = _allTokenIds[i];
            EchoData memory data = echoData[tokenId];
            
            tokenIds[i] = tokenId;
            names[i] = data.name;
            descriptions[i] = data.description;
            creators[i] = data.creator;
            pricesPerQuery[i] = data.pricePerQuery;
            activeStatuses[i] = data.isActive;
        }
        
        return (tokenIds, names, descriptions, creators, pricesPerQuery, activeStatuses);
    }

    /**
     * @dev Purchase credits with PYUSD. 1 PYUSD = 100 credits (1 credit = 0.01 PYUSD)
     */
    function purchaseCredits(uint256 pyusdAmount) public {
        require(pyusdAmount > 0, "Amount must be greater than 0");
        
        // Transfer PYUSD from user to contract
        require(pyusdToken.transferFrom(msg.sender, address(this), pyusdAmount), "PYUSD transfer failed");
        
        // Calculate credits (1 PYUSD = 100 credits, assuming 6 decimals)
        uint256 credits = pyusdAmount / 10000; // 10000 = 0.01 PYUSD in wei (6 decimals)
        
        // Add credits to user balance
        userCredits[msg.sender].balance += credits;
        userCredits[msg.sender].lastUpdated = block.timestamp;
        
        emit CreditsPurchased(msg.sender, pyusdAmount, credits);
    }

    /**
     * @dev Use credits to pay for a query. Can only be called by the contract owner (backend).
     */
    function useCreditsForQuery(
        address user,
        uint256 echoId,
        uint256 creditsToUse
    ) public onlyOwner {
        require(userCredits[user].balance >= creditsToUse, "Insufficient credits");
        require(echoData[echoId].isActive, "Echo is not active");
        
        // Deduct credits
        userCredits[user].balance -= creditsToUse;
        userCredits[user].lastUpdated = block.timestamp;
        
        // Transfer equivalent PYUSD to Echo creator
        uint256 pyusdAmount = creditsToUse * 10000; // Convert credits back to PYUSD
        require(pyusdToken.transfer(echoData[echoId].creator, pyusdAmount), "PYUSD transfer to creator failed");
        
        emit CreditsUsed(user, echoId, creditsToUse);
    }

    /**
     * @dev Get user's credit balance
     */
    function getUserCredits(address user) public view returns (uint256 balance, uint256 lastUpdated) {
        UserCredits memory credits = userCredits[user];
        return (credits.balance, credits.lastUpdated);
    }

    /**
     * @dev Withdraw contract's PYUSD balance (only owner)
     */
    function withdrawPYUSD() public onlyOwner {
        uint256 balance = pyusdToken.balanceOf(address(this));
        require(balance > 0, "No PYUSD to withdraw");
        require(pyusdToken.transfer(owner(), balance), "PYUSD transfer failed");
    }
}