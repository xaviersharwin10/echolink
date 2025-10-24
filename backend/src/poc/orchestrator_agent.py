"""
EchoLink Orchestrator Agent
Coordinates Payment Agent and Knowledge Agent to provide complete query processing
"""

import os
import json
import logging
import time
import asyncio
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
    KnowledgeQueryRequest, 
    KnowledgeQueryResponse,
    QueryRequest,
    QueryResponse,
    HealthResponse,
    QueryStatus,
    QueryStatusRequest,
    QueryInitiationResponse,
    QueryStatusResponse
)

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
# Orchestrator Agent State Management
# ============================================================================

# Global state for tracking pending queries
pending_queries: Dict[str, Dict[str, Any]] = {}

# Agent addresses (will be set during startup)
PAYMENT_AGENT_ADDRESS = None
KNOWLEDGE_AGENT_ADDRESS = None

# ============================================================================
# Orchestrator Agent Protocol
# ============================================================================

orchestrator_protocol = Protocol("QueryOrchestration")

@orchestrator_protocol.on_message(model=QueryRequest)
async def handle_query_request(ctx: Context, sender: str, msg: QueryRequest):
    """Handle main query requests and orchestrate the workflow"""
    query_id = str(uuid4())
    start_time = time.time()
    
    ctx.logger.info("=" * 60)
    ctx.logger.info("🎭 ORCHESTRATOR: New Query Request")
    ctx.logger.info("=" * 60)
    ctx.logger.info(f"📋 Query ID: {query_id}")
    ctx.logger.info(f"❓ Query: {msg.query[:100]}...")
    ctx.logger.info(f"🎫 Token ID: {msg.token_id}")
    ctx.logger.info(f"👤 User: {msg.user_address}")
    ctx.logger.info(f"💳 Payment Type: {'Credits' if msg.use_credits else 'Direct PYUSD'}")
    ctx.logger.info(f"🔗 TX Hash: {msg.payment_tx_hash[:20]}...")
    
    # Initialize query state
    pending_queries[query_id] = {
        "status": "pending",
        "progress": "Starting payment validation...",
        "start_time": start_time,
        "sender": sender,
        "original_request": msg,
        "payment_validated": False,
        "knowledge_processed": False,
        "result": None,
        "error": None
    }
    
    try:
        # Step 1: Validate Payment
        ctx.logger.info("🔄 Step 1: Initiating payment validation...")
        
        payment_request = PaymentValidationRequest(
            payment_tx_hash=msg.payment_tx_hash,
            user_address=msg.user_address,
            use_credits=msg.use_credits,
            token_id=msg.token_id,
            query_id=query_id
        )
        
        # Send payment validation request to Payment Agent
        if PAYMENT_AGENT_ADDRESS:
            await ctx.send(PAYMENT_AGENT_ADDRESS, payment_request)
        else:
            raise Exception("Payment Agent address not configured")
        
        ctx.logger.info("✅ Payment validation request sent")
        
    except Exception as e:
        ctx.logger.error(f"❌ Failed to initiate payment validation: {e}")
        pending_queries[query_id]["status"] = "failed"
        pending_queries[query_id]["error"] = str(e)
        pending_queries[query_id]["result"] = QueryResponse(
            success=False,
            answer="",
            token_id=msg.token_id,
            timestamp=int(time.time()),
            error=f"Failed to initiate payment validation: {str(e)}",
            processing_time_ms=(time.time() - start_time) * 1000
        )

@orchestrator_protocol.on_message(model=PaymentValidationResponse)
async def handle_payment_validation_response(ctx: Context, sender: str, msg: PaymentValidationResponse):
    """Handle payment validation responses"""
    query_id = msg.query_id
    ctx.logger.info(f"💳 Payment validation response for query {query_id}: {msg.success}")
    
    if query_id not in pending_queries:
        ctx.logger.error(f"❌ Unknown query ID: {query_id}")
        return
    
    query_state = pending_queries[query_id]
    
    if not msg.success:
        ctx.logger.error(f"❌ Payment validation failed: {msg.error}")
        query_state["status"] = "failed"
        query_state["error"] = msg.error
        query_state["result"] = QueryResponse(
            success=False,
            answer="",
            token_id=query_state["original_request"].token_id,
            timestamp=int(time.time()),
            error=f"Payment validation failed: {msg.error}",
            processing_time_ms=(time.time() - query_state["start_time"]) * 1000
        )
        return
    
    # Payment validation successful, proceed to knowledge processing
    ctx.logger.info("✅ Payment validation successful, initiating knowledge processing...")
    query_state["payment_validated"] = True
    query_state["progress"] = "Payment validated, processing knowledge query..."
    
    try:
        knowledge_request = KnowledgeQueryRequest(
            query=query_state["original_request"].query,
            token_id=query_state["original_request"].token_id or "default",
            query_id=query_id,
            user_address=query_state["original_request"].user_address
        )
        
        # Send knowledge query request to Knowledge Agent
        if KNOWLEDGE_AGENT_ADDRESS:
            await ctx.send(KNOWLEDGE_AGENT_ADDRESS, knowledge_request)
        else:
            raise Exception("Knowledge Agent address not configured")
        
        ctx.logger.info("✅ Knowledge processing request sent")
        
    except Exception as e:
        ctx.logger.error(f"❌ Failed to initiate knowledge processing: {e}")
        query_state["status"] = "failed"
        query_state["error"] = str(e)
        query_state["result"] = QueryResponse(
            success=False,
            answer="",
            token_id=query_state["original_request"].token_id,
            timestamp=int(time.time()),
            error=f"Failed to initiate knowledge processing: {str(e)}",
            processing_time_ms=(time.time() - query_state["start_time"]) * 1000
        )

@orchestrator_protocol.on_message(model=KnowledgeQueryResponse)
async def handle_knowledge_query_response(ctx: Context, sender: str, msg: KnowledgeQueryResponse):
    """Handle knowledge query responses"""
    query_id = msg.query_id
    ctx.logger.info(f"🧠 Knowledge query response for query {query_id}: {msg.success}")
    
    if query_id not in pending_queries:
        ctx.logger.error(f"❌ Unknown query ID: {query_id}")
        return
    
    query_state = pending_queries[query_id]
    
    if not msg.success:
        ctx.logger.error(f"❌ Knowledge processing failed: {msg.error}")
        query_state["status"] = "failed"
        query_state["error"] = msg.error
        query_state["result"] = QueryResponse(
            success=False,
            answer="",
            token_id=query_state["original_request"].token_id,
            timestamp=int(time.time()),
            error=f"Knowledge processing failed: {msg.error}",
            processing_time_ms=(time.time() - query_state["start_time"]) * 1000
        )
        return
    
    # Knowledge processing successful, complete the query
    ctx.logger.info("✅ Knowledge processing successful, completing query...")
    query_state["knowledge_processed"] = True
    query_state["status"] = "completed"
    query_state["progress"] = "Query completed successfully"
    
    processing_time = (time.time() - query_state["start_time"]) * 1000
    
    query_state["result"] = QueryResponse(
        success=True,
        answer=msg.answer,
        token_id=query_state["original_request"].token_id,
        timestamp=int(time.time()),
        processing_time_ms=processing_time
    )
    
    ctx.logger.info("=" * 60)
    ctx.logger.info("🎉 ORCHESTRATOR: Query Processing Complete")
    ctx.logger.info("=" * 60)
    ctx.logger.info(f"⏱️ Total Processing Time: {processing_time:.2f}ms")
    ctx.logger.info(f"📊 Answer Length: {len(msg.answer)} characters")
    ctx.logger.info(f"🔍 Query ID: {msg.query_id}")
    ctx.logger.info(f"📝 Answer Preview: {msg.answer[:200]}...")
    ctx.logger.info("=" * 60)
    
    # Debug: Check if result is properly stored
    ctx.logger.info(f"🔍 Stored result in pending_queries: {query_id}")
    ctx.logger.info(f"🔍 Query state status: {query_state['status']}")
    ctx.logger.info(f"🔍 Query state result: {query_state['result'] is not None}")

@orchestrator_protocol.on_message(model=HealthResponse)
async def handle_health_check(ctx: Context, sender: str, msg: HealthResponse):
    """Handle health check requests"""
    ctx.logger.info(f"🏥 Health check from {sender}: {msg.status}")
    
    # Return health status
    await ctx.send(
        sender,
        HealthResponse(
            status="healthy",
            agent_name="EchoLink Orchestrator Agent",
            agent_address=orchestrator_agent.address,
            timestamp=int(time.time()),
            uptime_seconds=time.time() - ctx.start_time
        )
    )

# ============================================================================
# Orchestrator Agent Setup
# ============================================================================

# Create Orchestrator Agent
orchestrator_agent = Agent(
    name="EchoLinkOrchestratorAgent",
    port=8004,
    seed="orchestrator-agent-seed-phrase-here",
    mailbox=True,
    publish_agent_details=True
)

# Include the orchestrator protocol
orchestrator_agent.include(orchestrator_protocol)

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
            welcome_msg = """Welcome to EchoLink Orchestrator Agent! 🎭

I coordinate payment validation and knowledge processing to provide complete query processing.

To ask a question, include a token ID and payment details:
- Format: [token:YOUR_TOKEN_ID] Your question [payment:TX_HASH]
- Example: [token:test_007] What is the capital of France? [payment:0x123...]

How can I help you with your query?"""
            await ctx.send(sender, create_text_chat(welcome_msg))
            continue
            
        elif isinstance(item, TextContent):
            ctx.logger.info(f"📝 Text message from {sender}: {item.text[:100]}...")
            
            try:
                # Extract token ID and payment details from message
                import re
                
                # Extract token ID
                token_match = re.search(r'\[token:([^\]]+)\]', item.text)
                token_id = token_match.group(1) if token_match else None
                
                # Extract payment hash
                payment_match = re.search(r'\[payment:([^\]]+)\]', item.text)
                payment_tx_hash = payment_match.group(1) if payment_match else None
                
                if not token_id or not payment_tx_hash:
                    response = """Please include both token ID and payment hash in your message.

Format: [token:YOUR_TOKEN_ID] Your question [payment:TX_HASH]
Example: [token:test_007] What is the capital of France? [payment:0x123...]"""
                    await ctx.send(sender, create_text_chat(response))
                    continue
                
                # Create query request
                query_request = QueryRequest(
                    query=item.text,
                    token_id=token_id,
                    payment_tx_hash=payment_tx_hash,
                    user_address="chat_user",  # Default for chat
                    use_credits=False
                )
                
                # Process the query using existing functionality
                result = await handle_rest_query(ctx, query_request)
                
                if result.success:
                    response_text = f"Token: {token_id}\nPayment: {payment_tx_hash}\n\n{result.answer}"
                else:
                    response_text = f"Error processing query: {result.error}"
                
                await ctx.send(sender, create_text_chat(response_text))
                
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
orchestrator_agent.include(chat_proto, publish_manifest=True)

# ============================================================================
# REST API Support
# ============================================================================

@orchestrator_agent.on_rest_post("/query", QueryRequest, QueryResponse)
async def handle_rest_query(ctx: Context, req: QueryRequest) -> QueryResponse:
    """
    REST endpoint for complete query processing with multi-agent orchestration
    
    Waits for the complete workflow and returns the final result.
    """
    ctx.logger.info(f"📡 REST Query received: {req.query}")
    ctx.logger.info(f"💰 Payment validation required for tx: {req.payment_tx_hash[:20]}...")
    
    query_id = str(uuid4())
    start_time = time.time()
    
    # Initialize query state
    pending_queries[query_id] = {
        "status": "pending",
        "progress": "Starting payment validation...",
        "start_time": start_time,
        "sender": None,  # REST request, no sender
        "original_request": req,
        "payment_validated": False,
        "knowledge_processed": False,
        "result": None,
        "error": None
    }
    
    try:
        # Step 1: Validate Payment
        ctx.logger.info("🔄 Step 1: Initiating payment validation...")
        
        payment_request = PaymentValidationRequest(
            payment_tx_hash=req.payment_tx_hash,
            user_address=req.user_address,
            use_credits=req.use_credits,
            token_id=req.token_id,
            query_id=query_id
        )
        
        # Send payment validation request to Payment Agent
        if PAYMENT_AGENT_ADDRESS:
            await ctx.send(PAYMENT_AGENT_ADDRESS, payment_request)
        else:
            raise Exception("Payment Agent address not configured")
        
        ctx.logger.info("✅ Payment validation request sent")
        
        # Wait for the complete workflow to finish
        max_wait_time = 100  # 60 seconds max
        wait_interval = 0.5  # Check every 500ms
        elapsed_time = 0
        
        while elapsed_time < max_wait_time:
            await asyncio.sleep(wait_interval)
            elapsed_time += wait_interval
            
            query_state = pending_queries[query_id]
            
            if query_state["status"] == "completed" and query_state["result"]:
                ctx.logger.info("🎉 Query completed successfully, returning result")
                return query_state["result"]
            elif query_state["status"] == "failed":
                ctx.logger.error(f"❌ Query failed: {query_state['error']}")
                return QueryResponse(
                    success=False,
                    answer="",
                    token_id=req.token_id,
                    timestamp=int(time.time()),
                    error=query_state["error"],
                    processing_time_ms=(time.time() - start_time) * 1000
                )
        
        # Timeout
        ctx.logger.error("⏰ Query processing timeout")
        return QueryResponse(
            success=False,
            answer="",
            token_id=req.token_id,
            timestamp=int(time.time()),
            error="Query processing timeout",
            processing_time_ms=(time.time() - start_time) * 1000
        )
        
    except Exception as e:
        ctx.logger.error(f"❌ Failed to process query: {e}")
        return QueryResponse(
            success=False,
            answer="",
            token_id=req.token_id,
            timestamp=int(time.time()),
            error=f"Failed to process query: {str(e)}",
            processing_time_ms=(time.time() - start_time) * 1000
        )

@orchestrator_agent.on_rest_get("/query/status/{query_id}", QueryStatusResponse)
async def handle_query_status(ctx: Context, query_id: str) -> QueryStatusResponse:
    """
    REST endpoint for checking query status
    """
    ctx.logger.info(f"🔍 Status check for query: {query_id}")
    
    if query_id not in pending_queries:
        ctx.logger.warning(f"❌ Query ID not found: {query_id}")
        return QueryStatusResponse(
            query_id=query_id,
            status="not_found",
            progress="Query ID not found",
            timestamp=int(time.time()),
            error="Query ID not found"
        )
    
    query_state = pending_queries[query_id]
    ctx.logger.info(f"📊 Query state: status={query_state['status']}, has_result={query_state.get('result') is not None}")
    
    if query_state.get('result'):
        ctx.logger.info(f"📝 Result preview: {query_state['result'].answer[:100]}...")
    
    return QueryStatusResponse(
        query_id=query_id,
        status=query_state["status"],
        progress=query_state["progress"],
        timestamp=int(time.time()),
        result=query_state["result"],
        error=query_state["error"]
    )

@orchestrator_agent.on_rest_get("/health", HealthResponse)
async def handle_rest_health(ctx: Context) -> HealthResponse:
    """REST health check endpoint"""
    return HealthResponse(
        status="healthy",
        agent_name="EchoLink Orchestrator Agent",
        agent_address=orchestrator_agent.address,
        timestamp=int(time.time()),
        uptime_seconds=time.time() - ctx.start_time
    )

@orchestrator_agent.on_event("startup")
async def startup(ctx: Context):
    """Initialize the orchestrator agent"""
    global PAYMENT_AGENT_ADDRESS, KNOWLEDGE_AGENT_ADDRESS
    
    ctx.start_time = time.time()
    
    # Configure agent addresses
    PAYMENT_AGENT_ADDRESS = os.getenv("PAYMENT_AGENT_ADDRESS", "agent1qgmcaux67tuhrkl9cwhns0npxclvksy66yarp32j4f8zkedrhqjys597p08")
    KNOWLEDGE_AGENT_ADDRESS = os.getenv("KNOWLEDGE_AGENT_ADDRESS", "agent1q2x577ul5d6r20c4alcx64pcersrusm7j4pekkce05cu22kpxz9hux72t3t")
    
    ctx.logger.info("=" * 60)
    ctx.logger.info("🎭 EchoLink Orchestrator Agent Starting Up")
    ctx.logger.info("=" * 60)
    ctx.logger.info(f"Agent Address: {orchestrator_agent.address}")
    ctx.logger.info("Capabilities:")
    ctx.logger.info("  ✅ Payment validation coordination")
    ctx.logger.info("  ✅ Knowledge processing coordination")
    ctx.logger.info("  ✅ REST API endpoints")
    ctx.logger.info("  ✅ Multi-agent workflow orchestration")
    ctx.logger.info("  ✅ Query state tracking")
    ctx.logger.info("  ✅ Polling-based status updates")
    ctx.logger.info("=" * 60)
    ctx.logger.info("🔗 Agent Addresses:")
    ctx.logger.info(f"  💳 Payment Agent: {PAYMENT_AGENT_ADDRESS}")
    ctx.logger.info(f"  🧠 Knowledge Agent: {KNOWLEDGE_AGENT_ADDRESS}")
    ctx.logger.info("=" * 60)

if __name__ == "__main__":
    orchestrator_agent.run()
