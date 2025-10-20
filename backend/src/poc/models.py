"""
EchoLink Multi-Agent System Shared Models
All Model classes used across the agent system
"""

import time
from typing import Optional
from uagents import Model

# ============================================================================
# Payment Agent Models
# ============================================================================

class PaymentValidationRequest(Model):
    """Request for payment validation"""
    payment_tx_hash: str
    user_address: str
    use_credits: bool
    token_id: Optional[str] = None
    query_id: str  # Unique identifier for this query

class PaymentValidationResponse(Model):
    """Response from payment validation"""
    success: bool
    message: str
    query_id: str
    validated_amount: Optional[float] = None
    error: Optional[str] = None

class PaymentConfirmed(Model):
    """Message emitted when payment is confirmed"""
    query_id: str
    user_address: str
    payment_tx_hash: str
    validated_amount: float
    payment_type: str  # "credit" or "direct"
    timestamp: int

# ============================================================================
# Knowledge Agent Models
# ============================================================================

class KnowledgeQueryRequest(Model):
    """Request for knowledge processing"""
    query: str
    token_id: str
    query_id: str
    user_address: str

class KnowledgeQueryResponse(Model):
    """Response from knowledge processing"""
    success: bool
    answer: str
    query_id: str
    token_id: str
    processing_time_ms: Optional[float] = None
    error: Optional[str] = None

# ============================================================================
# Orchestrator Agent Models
# ============================================================================

class QueryRequest(Model):
    """Main query request from user"""
    query: str
    token_id: Optional[str] = None
    payment_tx_hash: str
    user_address: str
    use_credits: Optional[bool] = False

class QueryResponse(Model):
    """Final response to user"""
    success: bool
    answer: str
    token_id: Optional[str] = None
    timestamp: int
    error: Optional[str] = None
    processing_time_ms: Optional[float] = None

class HealthResponse(Model):
    """Health check response"""
    status: str
    agent_name: str
    agent_address: str
    timestamp: int
    uptime_seconds: float

# ============================================================================
# Query Status Models
# ============================================================================

class QueryStatus(Model):
    """Query status for polling"""
    query_id: str
    status: str  # "pending", "processing", "completed", "failed"
    progress: str
    result: Optional[QueryResponse] = None
    error: Optional[str] = None
    timestamp: int

class QueryStatusRequest(Model):
    """Request for query status"""
    query_id: str

# ============================================================================
# Agent Discovery Models
# ============================================================================

class AgentDiscovery(Model):
    """Agent discovery message"""
    agent_name: str
    agent_address: str
    capabilities: list[str]
    timestamp: int

class AgentDiscoveryResponse(Model):
    """Response to agent discovery"""
    discovered: bool
    agent_address: Optional[str] = None
    message: str

# ============================================================================
# REST API Response Models
# ============================================================================

class QueryInitiationResponse(Model):
    """Response when initiating a query"""
    query_id: str
    status: str
    message: Optional[str] = None
    error: Optional[str] = None

class QueryStatusResponse(Model):
    """Response for query status polling"""
    query_id: str
    status: str
    progress: str
    timestamp: int
    result: Optional[QueryResponse] = None
    error: Optional[str] = None
