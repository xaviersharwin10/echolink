// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// We need the interface for the ERC20 token (PYUSD)
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract QueryPayments is Ownable {
    IERC20 public pyusdToken;

    // The fee that the protocol takes on each transaction
    uint256 public protocolFeePercent = 5; // e.g., 5%

    // The event that will be emitted on every successful payment
    event QueryPaid(
        address indexed user,
        address indexed creator,
        uint256 indexed tokenId,
        uint256 amount
    );

    /**
     * @param _pyusdAddress The on-chain address of the PYUSD token.
     */
    constructor(address _pyusdAddress) Ownable() {
        pyusdToken = IERC20(_pyusdAddress);
    }

    /**
     * @dev Processes the payment for a single query.
     * The user (msg.sender) must have first approved this contract
     * to spend their PYUSD.
     */
    function processQueryPayment(address creator, uint256 amount, uint256 tokenId) public {
        require(creator != address(0), "Creator address cannot be zero");
        require(amount > 0, "Amount must be greater than zero");

        uint256 userBalance = pyusdToken.balanceOf(msg.sender);
        require(userBalance >= amount, "Insufficient PYUSD balance");

        uint256 allowance = pyusdToken.allowance(msg.sender, address(this));
        require(allowance >= amount, "PYUSD allowance is too low");

        // Calculate protocol fee
        uint256 fee = (amount * protocolFeePercent) / 100;
        uint256 creatorPayment = amount - fee;

        // Transfer the total amount from the user to this contract
        pyusdToken.transferFrom(msg.sender, address(this), amount);

        // Pay the creator
        pyusdToken.transfer(creator, creatorPayment);

        // The rest (the fee) is kept in this contract, to be withdrawn by the owner

        emit QueryPaid(msg.sender, creator, tokenId, amount);
    }

    // Function for the owner to withdraw the collected fees
    function withdrawFees() public onlyOwner {
        uint256 balance = pyusdToken.balanceOf(address(this));
        pyusdToken.transfer(owner(), balance);
    }
}