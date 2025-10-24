"""
EchoLink Payment Agent
Specialized agent for handling payment validation (both credit and direct payments)
"""

import os
import json
import logging
import time
from typing import Optional, Dict, Any
from datetime import datetime
from uuid import uuid4

# uAgents framework
from uagents import Agent, Context, Protocol

# Chat protocol imports
from uagents_core.contrib.protocols.chat import (
    ChatAcknowledgement,
    ChatMessage,
    EndSessionContent,
    StartSessionContent,
    TextContent,
    chat_protocol_spec,
)

# Import shared models
from models import (
    PaymentValidationRequest, 
    PaymentValidationResponse, 
    PaymentConfirmed,
    HealthResponse
)

# Import payment validator
try:
    from blockchain import PaymentValidator
except:
    PaymentValidator = None

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============================================================================
# Chat Protocol Helper Functions
# ============================================================================

def create_text_chat(text: str, end_session: bool = False) -> ChatMessage:
    """Create a text chat message."""
    content = [TextContent(type="text", text=text)]
    if end_session:
        content.append(EndSessionContent(type="end-session"))
    return ChatMessage(
        timestamp=datetime.utcnow(),
        msg_id=uuid4(),
        content=content,
    )

# ============================================================================
# Payment Agent Protocol
# ============================================================================

payment_protocol = Protocol("PaymentValidation")

@payment_protocol.on_message(model=PaymentValidationRequest)
async def handle_payment_validation(ctx: Context, sender: str, msg: PaymentValidationRequest):
    """Handle payment validation requests"""
    ctx.logger.info(f"💳 Payment validation request received for query {msg.query_id}")
    ctx.logger.info(f"📋 TX Hash: {msg.payment_tx_hash[:20]}...")
    ctx.logger.info(f"👤 User: {msg.user_address}")
    ctx.logger.info(f"💳 Payment Type: {'Credits' if msg.use_credits else 'Direct PYUSD'}")
    
    try:
        # Initialize payment validator if not already done
        if not hasattr(ctx, 'payment_validator'):
            if PaymentValidator:
                web3_provider = os.getenv("WEB3_PROVIDER_URL", "")
                pyusd_address = os.getenv("PYUSD_CONTRACT_ADDRESS", "0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9")
                min_amount = float(os.getenv("MIN_PAYMENT_AMOUNT", "0.01"))
                
                ctx.payment_validator = PaymentValidator(
                    provider_url=web3_provider,
                    pyusd_address=pyusd_address,
                    min_amount=min_amount
                )
                ctx.logger.info("✅ Payment Validator initialized")
            else:
                ctx.logger.warning("⚠️ PaymentValidator not available")
                ctx.payment_validator = None
        
        # Validate payment based on type
        if msg.use_credits:
            ctx.logger.info("🔍 Validating credit transaction...")
            is_valid, message = await ctx.payment_validator.validate_credit_transaction(
                msg.payment_tx_hash,
                msg.user_address,
                logger_ctx=ctx.logger
            )
            payment_type = "credit"
        else:
            ctx.logger.info("🔍 Validating direct PYUSD payment...")
            is_valid, message = await ctx.payment_validator.validate_payment(
                msg.payment_tx_hash,
                msg.user_address,
                logger_ctx=ctx.logger
            )
            payment_type = "direct"
        
        if is_valid:
            ctx.logger.info(f"✅ Payment validation successful: {message}")
            
            # Extract amount from message if possible
            validated_amount = 0.1  # Default amount, could be extracted from message
            
            # Emit PaymentConfirmed message
            payment_confirmed = PaymentConfirmed(
                query_id=msg.query_id,
                user_address=msg.user_address,
                payment_tx_hash=msg.payment_tx_hash,
                validated_amount=validated_amount,
                payment_type=payment_type,
                timestamp=int(time.time())
            )
            
            # Send success response back to sender
            await ctx.send(
                sender,
                PaymentValidationResponse(
                    success=True,
                    message=message,
                    query_id=msg.query_id,
                    validated_amount=validated_amount
                )
            )
        else:
            ctx.logger.error(f"❌ Payment validation failed: {message}")
            await ctx.send(
                sender,
                PaymentValidationResponse(
                    success=False,
                    message=message,
                    query_id=msg.query_id,
                    error=message
                )
            )
            
    except Exception as e:
        ctx.logger.error(f"❌ Payment validation error: {str(e)}")
        await ctx.send(
            sender,
            PaymentValidationResponse(
                success=False,
                message="Payment validation failed",
                query_id=msg.query_id,
                error=str(e)
            )
        )

@payment_protocol.on_message(model=HealthResponse)
async def handle_health_check(ctx: Context, sender: str, msg: HealthResponse):
    """Handle health check requests"""
    ctx.logger.info(f"🏥 Health check from {sender}: {msg.status}")
    
    # Return health status
    await ctx.send(
        sender,
        HealthResponse(
            status="healthy",
            agent_name="EchoLink Payment Agent",
            agent_address=payment_agent.address,
            timestamp=int(time.time()),
            uptime_seconds=time.time() - ctx.start_time
        )
    )

# ============================================================================
# Payment Agent Setup
# ============================================================================

# Create Payment Agent
payment_agent = Agent(
    name="EchoLinkPaymentAgent",
    port=8005,
    seed="payment-agent-seed-phrase-here",
    mailbox=True,
    publish_agent_details=True
)

# Include the payment protocol
payment_agent.include(payment_protocol)

# ============================================================================
# Chat Protocol Implementation
# ============================================================================

# Create chat protocol
chat_proto = Protocol(spec=chat_protocol_spec)

@chat_proto.on_message(ChatMessage)
async def handle_chat_message(ctx: Context, sender: str, msg: ChatMessage):
    """Handle incoming chat messages"""
    ctx.logger.info(f"📨 Chat message from {sender}")
    ctx.storage.set(str(ctx.session), sender)
    
    # Send acknowledgement
    await ctx.send(
        sender,
        ChatAcknowledgement(
            timestamp=datetime.utcnow(),
            acknowledged_msg_id=msg.msg_id
        ),
    )
    
    # Process message content
    for item in msg.content:
        if isinstance(item, StartSessionContent):
            ctx.logger.info(f"🎬 Start session from {sender}")
            welcome_msg = """Welcome to EchoLink Payment Agent! 💳

I handle payment validation for both credit transactions and direct PYUSD payments.

To validate a payment, provide the transaction details:
- Format: [tx:TRANSACTION_HASH] [user:USER_ADDRESS] [type:CREDIT|PYUSD]
- Example: [tx:0x123...] [user:0xabc...] [type:CREDIT]

How can I help you with payment validation?"""
            await ctx.send(sender, create_text_chat(welcome_msg))
            continue
            
        elif isinstance(item, TextContent):
            ctx.logger.info(f"📝 Text message from {sender}: {item.text[:100]}...")
            
            try:
                # Extract transaction details from message
                import re
                
                # Extract transaction hash
                tx_match = re.search(r'\[tx:([^\]]+)\]', item.text)
                tx_hash = tx_match.group(1) if tx_match else None
                
                # Extract user address
                user_match = re.search(r'\[user:([^\]]+)\]', item.text)
                user_address = user_match.group(1) if user_match else None
                
                # Extract payment type
                type_match = re.search(r'\[type:([^\]]+)\]', item.text)
                payment_type = type_match.group(1).upper() if type_match else None
                
                if not tx_hash or not user_address or not payment_type:
                    response = """Please include all required payment details in your message.

Format: [tx:TRANSACTION_HASH] [user:USER_ADDRESS] [type:CREDIT|PYUSD]
Example: [tx:0x123...] [user:0xabc...] [type:CREDIT]"""
                    await ctx.send(sender, create_text_chat(response))
                    continue
                
                # Create payment validation request
                validation_request = PaymentValidationRequest(
                    query_id="chat_query",
                    payment_tx_hash=tx_hash,
                    user_address=user_address,
                    use_credits=(payment_type == "CREDIT")
                )
                
                # Process the payment validation using existing functionality
                await handle_payment_validation(ctx, sender, validation_request)
                
            except Exception as e:
                ctx.logger.error(f"Error processing chat message: {e}")
                error_response = f"Sorry, I encountered an error: {str(e)}"
                await ctx.send(sender, create_text_chat(error_response))
                
        elif isinstance(item, EndSessionContent):
            ctx.logger.info(f"👋 End session from {sender}")
            await ctx.send(sender, create_text_chat("Goodbye! 👋", end_session=True))

@chat_proto.on_message(ChatAcknowledgement)
async def handle_chat_ack(ctx: Context, sender: str, msg: ChatAcknowledgement):
    """Handle chat acknowledgements"""
    ctx.logger.info(f"✅ Ack from {sender} for {msg.acknowledged_msg_id}")

# Include chat protocol
payment_agent.include(chat_proto, publish_manifest=True)

@payment_agent.on_event("startup")
async def startup(ctx: Context):
    """Initialize the payment agent"""
    ctx.start_time = time.time()
    
    ctx.logger.info("=" * 60)
    ctx.logger.info("💳 EchoLink Payment Agent Starting Up")
    ctx.logger.info("=" * 60)
    ctx.logger.info(f"Agent Address: {payment_agent.address}")
    ctx.logger.info("Capabilities:")
    ctx.logger.info("  ✅ Credit transaction validation")
    ctx.logger.info("  ✅ Direct PYUSD payment validation")
    ctx.logger.info("  ✅ Payment confirmation messaging")
    ctx.logger.info("=" * 60)

if __name__ == "__main__":
    payment_agent.run()
