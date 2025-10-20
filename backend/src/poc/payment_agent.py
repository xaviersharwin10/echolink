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
