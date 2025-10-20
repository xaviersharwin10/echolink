"""
PYUSD Payment Validation Module
Validates blockchain transactions for paid queries
"""

import json
from web3 import Web3
from typing import Tuple
import logging
import time


logger = logging.getLogger(__name__)

# PYUSD ERC-20 ABI (minimal - just what we need)
PYUSD_ABI = json.loads('''[
    {
        "constant": true,
        "inputs": [{"name": "_owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "balance", "type": "uint256"}],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "", "type": "uint8"}],
        "type": "function"
    }
]''')


class PaymentValidator:
    """
    Validates PYUSD payments on-chain before processing queries.
    Ensures tx exists, is confirmed, correct amount, and correct sender.
    """
    
    def __init__(self, provider_url: str = None, pyusd_address: str = None, min_amount: float = 0.01):
        """
        Initialize payment validator.
        
        Args:
            provider_url: Web3 provider URL (e.g., Infura, Alchemy)
            pyusd_address: PYUSD token contract address
            min_amount: Minimum payment amount in PYUSD
        """
        import os
        self.w3 = Web3(Web3.HTTPProvider(""))
        self.pyusd_address = Web3.to_checksum_address("0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9")
        self.min_amount = min_amount
        self.min_confirmations = 1
        
        # PYUSD contract instance
        self.pyusd_contract = self.w3.eth.contract(
            address=self.pyusd_address,
            abi=PYUSD_ABI
        )
        
        # Get decimals
        try:
            self.decimals = self.pyusd_contract.functions.decimals().call()
        except:
            self.decimals = 6  # PYUSD uses 6 decimals
        
        logger.info(f"Payment validator initialized for PYUSD at {pyusd_address}")
        logger.info(f"Min amount: {min_amount} PYUSD")
    
    async def validate_payment(
        self,
        tx_hash: str,
        user_address: str,
        logger_ctx=None
    ) -> Tuple[bool, str]:
        """
        Validate a PYUSD payment transaction.
        
        Args:
            tx_hash: Transaction hash to validate
            user_address: Expected sender address
            logger_ctx: Optional logger context
            
        Returns:
            Tuple of (is_valid: bool, message: str)
        """
        log = logger_ctx if logger_ctx else logger
        
        log.info("=" * 50)
        log.info("🔐 PYUSD PAYMENT VALIDATION STARTED")
        log.info("=" * 50)
        log.info(f"📋 Transaction Hash: {tx_hash}")
        log.info(f"👤 User Address: {user_address}")
        log.info(f"💰 Min Amount Required: {self.min_amount} PYUSD")
        log.info(f"🔢 Min Confirmations: {self.min_confirmations}")
        
        try:
            # Step 1: Check if transaction exists
            log.info("🔍 Step 1: Checking transaction existence...")
            
            try:
                tx = self.w3.eth.get_transaction(tx_hash)
                log.info("✅ Transaction found on blockchain")
            except Exception as e:
                log.error(f"❌ Transaction not found: {str(e)}")
                return False, f"Transaction not found: {str(e)}"
            
            if not tx:
                log.error("❌ Transaction is None")
                return False, "Transaction not found"
            
            # Step 2: Check transaction confirmations
            log.info("⏳ Step 2: Checking transaction confirmations...")
            time.sleep(30)
            current_block = self.w3.eth.block_number
            tx_block = tx.get('blockNumber')
            
            log.info(f"📊 Current block: {current_block}")
            log.info(f"📊 Transaction block: {tx_block}")
            
            if not tx_block:
                log.error("❌ Transaction not yet mined")
                return False, "Transaction not yet mined"
            
            confirmations = current_block - tx_block
            log.info(f"✅ Confirmations: {confirmations}")
            
            if confirmations < self.min_confirmations:
                log.error(f"❌ Insufficient confirmations: {confirmations}/{self.min_confirmations}")
                return False, f"Insufficient confirmations ({confirmations}/{self.min_confirmations})"
            
            # Step 3: Check transaction receipt and status
            log.info("📄 Step 3: Checking transaction receipt...")
            receipt = self.w3.eth.get_transaction_receipt(tx_hash)
            if not receipt:
                log.error("❌ Transaction receipt not found")
                return False, "Transaction receipt not found"
            
            if receipt.status != 1:
                log.error("❌ Transaction failed or reverted")
                return False, "Transaction failed or reverted"
            
            log.info("✅ Transaction receipt valid and successful")
            
            # Step 4: Verify sender matches user address
            log.info("👤 Step 4: Verifying sender address...")
            tx_from = tx['from']
            user_checksum = Web3.to_checksum_address(user_address)
            
            log.info(f"📋 Transaction from: {tx_from}")
            log.info(f"📋 Expected user: {user_checksum}")
            
            if tx_from.lower() != user_checksum.lower():
                log.error(f"❌ Sender mismatch: {tx_from} != {user_checksum}")
                return False, f"Sender mismatch: {tx_from} != {user_checksum}"
            
            log.info("✅ Sender address verified")
            
            # Step 5: Check for PYUSD transfer events
            log.info("💰 Step 5: Analyzing PYUSD transfer events...")
            transfer_found = False
            amount_paid = 0
            
            log.info(f"📋 PYUSD Contract Address: {self.pyusd_address}")
            log.info(f"📋 Total logs in transaction: {len(receipt.logs)}")
            
            for i, log_entry in enumerate(receipt.logs):
                log.info(f"🔍 Log {i+1}: Address {log_entry.address}")
                
                # Check if it's a Transfer event from PYUSD contract
                if log_entry.address.lower() == self.pyusd_address.lower():
                    log.info("✅ Found PYUSD contract log entry")
                    
                    # Transfer event has 3 topics: event sig, from, to
                    if len(log_entry.topics) >= 3:
                        log.info(f"📋 Topics count: {len(log_entry.topics)}")
                        
                        # Decode amount from data
                        amount_wei = int.from_bytes(log_entry.data, byteorder='big')
                        amount_paid = amount_wei / (10 ** self.decimals)
                        transfer_found = True
                        
                        log.info(f"✅ PYUSD transfer found: {amount_paid} PYUSD")
                        log.info(f"📊 Amount in wei: {amount_wei}")
                        log.info(f"📊 Decimals: {self.decimals}")
                        break
                    else:
                        log.warning(f"⚠️  PYUSD log has insufficient topics: {len(log_entry.topics)}")
            
            if not transfer_found:
                log.error("❌ No PYUSD transfer found in transaction logs")
                return False, "No PYUSD transfer found in transaction"
            
            # Step 6: Verify payment amount
            log.info("💵 Step 6: Verifying payment amount...")
            log.info(f"📊 Amount paid: {amount_paid} PYUSD")
            log.info(f"📊 Minimum required: {self.min_amount} PYUSD")
            
            if amount_paid < self.min_amount:
                log.error(f"❌ Insufficient amount: {amount_paid} < {self.min_amount} PYUSD")
                return False, f"Insufficient amount: {amount_paid} < {self.min_amount} PYUSD"
            
            log.info("=" * 50)
            log.info("✅ PYUSD PAYMENT VALIDATION SUCCESSFUL")
            log.info("=" * 50)
            log.info(f"💰 Amount: {amount_paid} PYUSD")
            log.info(f"👤 From: {user_address[:10]}...")
            log.info(f"🔢 Confirmations: {confirmations}")
            log.info("=" * 50)
            
            return True, f"Payment validated: {amount_paid} PYUSD"
            
        except Exception as e:
            log.error("=" * 50)
            log.error("❌ PYUSD PAYMENT VALIDATION FAILED")
            log.error("=" * 50)
            log.error(f"🚨 Error: {str(e)}")
            log.error("=" * 50)
            return False, f"Validation error: {str(e)}"
    
    async def validate_credit_transaction(
        self,
        tx_hash: str,
        user_address: str,
        logger_ctx=None
    ) -> Tuple[bool, str]:
        """
        Validate a credit usage transaction from the EchoNFT contract.
        
        Args:
            tx_hash: Transaction hash to validate
            user_address: Expected user address
            logger_ctx: Optional logger context
            
        Returns:
            Tuple of (is_valid: bool, message: str)
        """
        log = logger_ctx if logger_ctx else logger
        
        log.info("=" * 50)
        log.info("💳 CREDIT TRANSACTION VALIDATION STARTED")
        log.info("=" * 50)
        log.info(f"📋 Transaction Hash: {tx_hash}")
        log.info(f"👤 User Address: {user_address}")
        
        try:
            # Step 1: Check if transaction exists
            log.info("🔍 Step 1: Checking transaction existence...")
            
            try:
                tx = self.w3.eth.get_transaction(tx_hash)
                log.info("✅ Transaction found on blockchain")
            except Exception as e:
                log.error(f"❌ Transaction not found: {str(e)}")
                return False, f"Transaction not found: {str(e)}"
            
            if not tx:
                log.error("❌ Transaction is None")
                return False, "Transaction not found"
            
            # Step 2: Check transaction confirmations
            log.info("⏳ Step 2: Checking transaction confirmations...")
            time.sleep(30)
            current_block = self.w3.eth.block_number
            tx_block = tx.get('blockNumber')
            
            log.info(f"📊 Current block: {current_block}")
            log.info(f"📊 Transaction block: {tx_block}")
            
            if not tx_block:
                log.error("❌ Transaction not yet mined")
                return False, "Transaction not yet mined"
            
            confirmations = current_block - tx_block
            log.info(f"✅ Confirmations: {confirmations}")
            
            if confirmations < self.min_confirmations:
                log.error(f"❌ Insufficient confirmations: {confirmations}/{self.min_confirmations}")
                return False, f"Insufficient confirmations ({confirmations}/{self.min_confirmations})"
            
            # Step 3: Check transaction receipt and status
            log.info("📄 Step 3: Checking transaction receipt...")
            receipt = self.w3.eth.get_transaction_receipt(tx_hash)
            if not receipt:
                log.error("❌ Transaction receipt not found")
                return False, "Transaction receipt not found"
            
            if receipt.status != 1:
                log.error("❌ Transaction failed or reverted")
                return False, "Transaction failed or reverted"
            
            log.info("✅ Transaction receipt valid and successful")
            
            # Step 4: Verify sender matches user address
            log.info("👤 Step 4: Verifying sender address...")
            tx_from = tx['from']
            user_checksum = Web3.to_checksum_address(user_address)
            
            log.info(f"📋 Transaction from: {tx_from}")
            log.info(f"📋 Expected user: {user_checksum}")
            
            if tx_from.lower() != user_checksum.lower():
                log.error(f"❌ Sender mismatch: {tx_from} != {user_checksum}")
                return False, f"Sender mismatch: {tx_from} != {user_checksum}"
            
            log.info("✅ Sender address verified")
            
            # Step 5: Check for CreditsUsed event from EchoNFT contract
            log.info("💳 Step 5: Analyzing CreditsUsed event...")
            credits_used_found = False
            
            # CreditsUsed event signature: CreditsUsed(address indexed user, uint256 indexed echoId, uint256 creditsUsed)
            credits_used_topic = self.w3.keccak(text="CreditsUsed(address,uint256,uint256)").hex()
            
            log.info(f"📋 Looking for CreditsUsed event topic: {credits_used_topic}")
            log.info(f"📋 Total logs in transaction: {len(receipt.logs)}")
            
            for i, log_entry in enumerate(receipt.logs):
                log.info(f"🔍 Log {i+1}: Address {log_entry.address}")
                
                # Check if it's a CreditsUsed event from EchoNFT contract
                if (log_entry.address.lower() == "0x7f10Df09c2d91C8C6A8B8e1ECeAD336eE39C3c9f".lower() and 
                    len(log_entry.topics) >= 3 and 
                    log_entry.topics[0].hex() == credits_used_topic):
                    
                    log.info("✅ Found CreditsUsed event")
                    
                    # Decode the event data
                    # topics[1] = user address (indexed)
                    # topics[2] = echoId (indexed) 
                    # data = creditsUsed (not indexed)
                    
                    event_user = "0x" + log_entry.topics[1].hex()[-40:]  # Last 20 bytes
                    event_echo_id = int(log_entry.topics[2].hex(), 16)
                    credits_used = int.from_bytes(log_entry.data, byteorder='big')
                    
                    log.info(f"✅ CreditsUsed event details:")
                    log.info(f"   User: {event_user}")
                    log.info(f"   Echo ID: {event_echo_id}")
                    log.info(f"   Credits Used: {credits_used}")
                    
                    # Verify the user matches
                    if event_user.lower() != user_checksum.lower():
                        log.error(f"❌ Event user mismatch: {event_user} != {user_checksum}")
                        return False, f"Event user mismatch: {event_user} != {user_checksum}"
                    
                    credits_used_found = True
                    break
            
            if not credits_used_found:
                log.error("❌ No CreditsUsed event found in transaction logs")
                return False, "No CreditsUsed event found in transaction"
            
            log.info("=" * 50)
            log.info("✅ CREDIT TRANSACTION VALIDATION SUCCESSFUL")
            log.info("=" * 50)
            log.info(f"👤 User: {user_address[:10]}...")
            log.info(f"🔢 Confirmations: {confirmations}")
            log.info("=" * 50)
            
            return True, f"Credit transaction validated successfully"
            
        except Exception as e:
            log.error("=" * 50)
            log.error("❌ CREDIT TRANSACTION VALIDATION FAILED")
            log.error("=" * 50)
            log.error(f"🚨 Error: {str(e)}")
            log.error("=" * 50)
            return False, f"Credit validation error: {str(e)}"

    def get_balance(self, address: str) -> float:
        """Get PYUSD balance for an address"""
        try:
            checksum_addr = Web3.to_checksum_address(address)
            balance_wei = self.pyusd_contract.functions.balanceOf(checksum_addr).call()
            balance = balance_wei / (10 ** self.decimals)
            return balance
        except Exception as e:
            logger.error(f"Error getting balance: {e}")
            return 0.0

