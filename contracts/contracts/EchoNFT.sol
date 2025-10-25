// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Import the necessary, battle-tested contracts from OpenZeppelin
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract EchoNFT is ERC721, Ownable, ReentrancyGuard {
    // Track used token IDs to prevent duplicates
    mapping(uint256 => bool) private _usedTokenIds;

    // PYUSD token address for payments
    IERC20 public immutable pyusdToken;

    // The fee that the protocol takes on each transaction
    uint256 public protocolFeePercent = 5; // e.g., 5%

    // Array to track all token IDs
    uint256[] private _allTokenIds;

    // A struct to hold data about each Echo
    struct EchoData {
        string name;
        string description;
        address creator;
        uint256 pricePerQuery; // Price in PYUSD (with 6 decimals)
        uint256 purchasePrice; // Price to buy entire Echo (with 6 decimals)
        bool isActive; // Whether the Echo is active for queries
        bool isForSale; // Whether the Echo can be purchased
        address owner; // Current owner of the Echo (for purchased Echos)
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
    
    // Ownership tracking for purchased Echos
    mapping(address => uint256[]) public userOwnedEchos;
    mapping(uint256 => address) public echoOwners;
    
    // Events
    event EchoCreated(uint256 indexed tokenId, address indexed creator, string name, uint256 pricePerQuery);
    event CreditsPurchased(address indexed user, uint256 amount, uint256 credits);
    event CreditsUsed(address indexed user, uint256 indexed echoId, uint256 creditsUsed);
    event EchoUpdated(uint256 indexed tokenId, string name, string description, uint256 pricePerQuery);
    event EchoPurchased(uint256 indexed tokenId, address indexed buyer, address indexed seller, uint256 price);
    event EchoListedForSale(uint256 indexed tokenId, uint256 price, bool forSale);

    // The constructor sets the Name and Symbol for our NFT collection
    constructor(address _pyusdToken) ERC721("EchoLink Knowledge Echo", "ECHO") Ownable() {
        pyusdToken = IERC20(_pyusdToken);
    }

    /**
     * @dev Mints a new Echo NFT with a specific token ID. Can be called by anyone.
     * This allows users to create Echo NFTs directly from the frontend.
     */
    function safeMint(
        uint256 tokenId,
        address creator,
        string memory name,
        string memory description,
        uint256 pricePerQuery,
        uint256 purchasePrice,
        bool isForSale
    )
        public
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
            purchasePrice: purchasePrice,
            isActive: true,
            isForSale: isForSale,
            owner: creator // Creator is initial owner
        });

        emit EchoCreated(tokenId, creator, name, pricePerQuery);
        return tokenId;
    }

    /**
     * @dev Updates Echo metadata. Can only be called by the Echo owner.
     */
    function updateEcho(
        uint256 tokenId,
        string memory name,
        string memory description,
        uint256 pricePerQuery,
        uint256 purchasePrice,
        bool isForSale
    ) public {
        require(echoData[tokenId].owner == msg.sender, "Only Echo owner can update");
        require(echoData[tokenId].isActive, "Echo is not active");
        
        echoData[tokenId].name = name;
        echoData[tokenId].description = description;
        echoData[tokenId].pricePerQuery = pricePerQuery;
        echoData[tokenId].purchasePrice = purchasePrice;
        echoData[tokenId].isForSale = isForSale;
        
        emit EchoUpdated(tokenId, name, description, pricePerQuery);
    }

    /**
     * @dev Buy an entire Echo NFT. Transfers ownership and gives unlimited access.
     */
    function buyEcho(uint256 tokenId) public nonReentrant {
        require(echoData[tokenId].isForSale, "Echo is not for sale");
        require(echoData[tokenId].isActive, "Echo is not active");
        require(echoData[tokenId].owner != msg.sender, "Cannot buy your own Echo");
        
        uint256 purchasePrice = echoData[tokenId].purchasePrice;
        require(purchasePrice > 0, "Purchase price not set");
        
        // Check user has enough PYUSD
        require(pyusdToken.balanceOf(msg.sender) >= purchasePrice, "Insufficient PYUSD balance");
        require(pyusdToken.allowance(msg.sender, address(this)) >= purchasePrice, "Insufficient PYUSD allowance");
        
        address currentOwner = echoData[tokenId].owner;
        
        // Calculate protocol fee
        uint256 fee = (purchasePrice * protocolFeePercent) / 100;
        uint256 sellerPayment = purchasePrice - fee;
        
        // Transfer PYUSD from buyer to contract
        require(pyusdToken.transferFrom(msg.sender, address(this), purchasePrice), "PYUSD transfer failed");
        
        // Pay the seller (after protocol fee)
        require(pyusdToken.transfer(currentOwner, sellerPayment), "PYUSD transfer to seller failed");
        
        // Update ownership
        echoData[tokenId].owner = msg.sender;
        echoData[tokenId].isForSale = false; // Remove from sale after purchase
        
        // Update ownership tracking
        echoOwners[tokenId] = msg.sender;
        userOwnedEchos[msg.sender].push(tokenId);
        
        // Remove from previous owner's list (if they had purchased it)
        if (currentOwner != echoData[tokenId].creator) {
            // Remove from previous owner's owned list
            uint256[] storage prevOwnerEchos = userOwnedEchos[currentOwner];
            for (uint256 i = 0; i < prevOwnerEchos.length; i++) {
                if (prevOwnerEchos[i] == tokenId) {
                    prevOwnerEchos[i] = prevOwnerEchos[prevOwnerEchos.length - 1];
                    prevOwnerEchos.pop();
                    break;
                }
            }
        }
        
        emit EchoPurchased(tokenId, msg.sender, currentOwner, purchasePrice);
    }

    /**
     * @dev List or unlist an Echo for sale. Can only be called by the Echo owner.
     */
    function setEchoForSale(uint256 tokenId, bool forSale) public {
        require(echoData[tokenId].owner == msg.sender, "Only Echo owner can set sale status");
        require(echoData[tokenId].isActive, "Echo is not active");
        
        echoData[tokenId].isForSale = forSale;
        
        emit EchoListedForSale(tokenId, echoData[tokenId].purchasePrice, forSale);
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
    ) public view returns (string memory name, string memory description, address creator, uint256 pricePerQuery, uint256 purchasePrice, bool isActive, bool isForSale, address owner) {
        EchoData memory data = echoData[tokenId];
        return (data.name, data.description, data.creator, data.pricePerQuery, data.purchasePrice, data.isActive, data.isForSale, data.owner);
    }

    /**
     * @dev Get total number of Echos
     */
    function getTotalEchoes() public view returns (uint256) {
        return _allTokenIds.length;
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
     * @dev Use credits to pay for a query. Can be called by any user to use their own credits.
     */
    function useCreditsForQuery(
        uint256 echoId,
        uint256 creditsToUse
    ) public nonReentrant {
        require(userCredits[msg.sender].balance >= creditsToUse, "Insufficient credits");
        require(echoData[echoId].isActive, "Echo is not active");
        
        // Deduct credits
        userCredits[msg.sender].balance -= creditsToUse;
        userCredits[msg.sender].lastUpdated = block.timestamp;
        
        // Convert credits to PYUSD
        uint256 totalPyusdAmount = creditsToUse * 10000; // Convert credits back to PYUSD
        
        // Calculate protocol fee
        uint256 fee = (totalPyusdAmount * protocolFeePercent) / 100;
        uint256 creatorPayment = totalPyusdAmount - fee;
        
        // Transfer PYUSD to Echo creator (after protocol fee)
        require(pyusdToken.transfer(echoData[echoId].creator, creatorPayment), "PYUSD transfer to creator failed");
        
        // The protocol fee remains in the contract (to be withdrawn by owner)
        
        emit CreditsUsed(msg.sender, echoId, creditsToUse);
    }

    /**
     * @dev Get user's credit balance
     */
    function getUserCredits(address user) public view returns (uint256 balance, uint256 lastUpdated) {
        UserCredits memory credits = userCredits[user];
        return (credits.balance, credits.lastUpdated);
    }

    /**
     * @dev Get number of Echos owned by a user
     */
    function getUserOwnedEchoCount(address user) public view returns (uint256) {
        return userOwnedEchos[user].length;
    }

    /**
     * @dev Check if user owns a specific Echo
     */
    function isEchoOwner(address user, uint256 tokenId) public view returns (bool) {
        return echoData[tokenId].owner == user;
    }

    /**
     * @dev Update protocol fee percentage (only owner)
     */
    function setProtocolFeePercent(uint256 _feePercent) public onlyOwner {
        require(_feePercent <= 20, "Fee cannot exceed 20%"); // Maximum 20% fee
        protocolFeePercent = _feePercent;
    }

    /**
     * @dev Withdraw contract's PYUSD balance (only owner)
     */
    function withdrawPYUSD() public onlyOwner {
        uint256 balance = pyusdToken.balanceOf(address(this));
        require(balance > 0, "No PYUSD to withdraw");
        require(pyusdToken.transfer(owner(), balance), "PYUSD transfer failed");
    }

    /**
     * @dev Get all token IDs that exist
     */
    function getAllTokenIds() public view returns (uint256[] memory) {
        return _allTokenIds;
    }
}