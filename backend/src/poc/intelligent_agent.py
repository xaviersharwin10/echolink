"""
EchoLink Intelligent uAgent
Complete implementation with both Chat Protocol and REST API support
Supports both AgentVerse chat interface and direct HTTP calls
"""

import os
import json
import logging
import time
from pathlib import Path
from typing import Optional, Dict, Any, List
from datetime import datetime
from uuid import uuid4

# uAgents framework
from uagents import Agent, Context, Model, Protocol

# Chat protocol imports
from uagents_core.contrib.protocols.chat import (
    ChatAcknowledgement,
    ChatMessage,
    EndSessionContent,
    StartSessionContent,
    TextContent,
    chat_protocol_spec,
)

# Core dependencies
from hyperon import MeTTa
from sentence_transformers import SentenceTransformer
import faiss
import numpy as np

# Import utilities
from utils import ASIOneLLM
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
# REST API Models
# ============================================================================

class QueryRequest(Model):
    """REST API request model for queries"""
    query: str
    token_id: Optional[str] = None
    payment_tx_hash: str
    user_address: str
    use_credits: Optional[bool] = False  # Whether to use credits instead of direct payment

class QueryResponse(Model):
    """REST API response model"""
    success: bool
    answer: str
    token_id: Optional[str] = None
    timestamp: int
    error: Optional[str] = None
    processing_time_ms: Optional[float] = None

class HealthResponse(Model):
    """Health check response model"""
    status: str
    agent_name: str
    agent_address: str
    timestamp: int
    uptime_seconds: float

# ============================================================================
# Helper Functions
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
# Intelligent Query Engine
# ============================================================================

class IntelligentQueryEngine:
    """Lightweight, intelligent query engine with dynamic semantic search"""
    
    def __init__(self):
        self.sentence_model = None
        self.fact_index = {}  # Store multiple indices by token_id
        self.fact_mapping = {}  # Store multiple mappings by token_id
        self.knowledge_graphs = {}  # Cache loaded knowledge graphs
        self.llm = None
        self.initialized = False
        
        logger.info("Intelligent Query Engine initialized")
    
    async def initialize(self):
        """Initialize the query engine"""
        if self.initialized:
            logger.info("Query engine already initialized")
            return
            
        logger.info("🤖 Initializing Intelligent Query Engine...")
        
        try:
            # Load sentence transformer
            logger.info("Loading SentenceTransformer model...")
            self.sentence_model = SentenceTransformer('all-MiniLM-L6-v2')
            logger.info("✅ SentenceTransformer loaded")
            
            # Initialize ASI:One LLM
            logger.info("Initializing ASI:One LLM...")
            self.llm = ASIOneLLM(api_key="")
            logger.info("✅ ASI:One LLM initialized")
            
            self.initialized = True
            logger.info("✅ Intelligent Query Engine ready")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize query engine: {e}")
            raise
    
    def extract_token_id(self, text: str) -> Optional[str]:
        """Extract token ID from text using various patterns"""
        import re
        
        # Pattern 1: [token:xxx] or (token:xxx)
        match = re.search(r'[\[\(]token:(\w+)[\]\)]', text.lower())
        if match:
            return match.group(1)
        
        # Pattern 2: token: xxx or token xxx
        match = re.search(r'token[:\s]+(\w+)', text.lower())
        if match:
            return match.group(1)
        
        # Pattern 3: Look for "test_007" or similar patterns
        match = re.search(r'\b(test_\d+|[a-z]+_\d+)\b', text.lower())
        if match:
            return match.group(1)
        
        return None
    
    def load_knowledge_base(self, token_id: str) -> bool:
        """Load knowledge base for a specific token ID"""
        if token_id in self.knowledge_graphs:
            logger.info(f"Knowledge base already loaded for token {token_id}")
            return True
        
        knowledge_path = f"knowledge_base_0{token_id}.db"
        if not os.path.exists(knowledge_path):
            logger.error(f"Knowledge base not found: {knowledge_path}")
            return False
        
        try:
            logger.info(f"Loading knowledge base for token {token_id}...")
            
            # Load knowledge graph
            with open(knowledge_path, 'r') as f:
                knowledge_data = json.load(f)
            
            # Create MeTTa interpreter and load atoms
            metta = MeTTa()
            for atom in knowledge_data['atoms']:
                try:
                    metta.run(atom)
                except Exception as e:
                    logger.warning(f"Failed to load atom '{atom}': {e}")
            
            self.knowledge_graphs[token_id] = metta
            logger.info(f"✅ Knowledge base loaded: {len(knowledge_data['atoms'])} atoms")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load knowledge base: {e}")
            return False
    
    def load_fact_index(self, token_id: str) -> bool:
        """Load fact embeddings index for a specific token ID"""
        if token_id in self.fact_index:
            logger.info(f"Fact index already loaded for token {token_id}")
            return True
            
        fact_path = f"fact_index_0{token_id}.faiss"
        mapping_path = f"fact_mapping_0{token_id}.json"
        
        if not os.path.exists(fact_path) or not os.path.exists(mapping_path):
            logger.error(f"Fact index not found for token {token_id}")
            return False
        
        try:
            logger.info(f"Loading fact embeddings index for token {token_id}...")
            
            # Load FAISS index
            self.fact_index[token_id] = faiss.read_index(fact_path)
            
            # Load fact mapping
            with open(mapping_path, 'r') as f:
                self.fact_mapping[token_id] = json.load(f)
            
            logger.info(f"✅ Fact embeddings loaded: {self.fact_mapping[token_id]['count']} facts")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load fact index: {e}")
            return False
    
    def find_relevant_facts(self, question: str, token_id: str, top_k: int = 10) -> List[Dict]:
        """Find most relevant facts using semantic similarity"""
        logger.info(f"🔍 Finding relevant facts for: '{question}'")
        
        if token_id not in self.fact_index:
            logger.error(f"Fact index not loaded for token {token_id}")
            return []
        
        # Embed the question
        question_embedding = self.sentence_model.encode([question])
        faiss.normalize_L2(question_embedding)
        
        # Search for most relevant facts
        scores, indices = self.fact_index[token_id].search(question_embedding, top_k)
        
        relevant_facts = []
        for i, (score, idx) in enumerate(zip(scores[0], indices[0])):
            if score > 0.3:  # Similarity threshold
                fact_text = self.fact_mapping[token_id]['facts'][idx]
                triple = self.fact_mapping[token_id]['triples'][idx]
                relevant_facts.append({
                    'fact_text': fact_text,
                    'triple': triple,
                    'score': float(score)
                })
                logger.info(f"  {i+1}. [{score:.3f}] {fact_text}")
        
        logger.info(f"✅ Found {len(relevant_facts)} relevant facts")
        return relevant_facts
    
    def generate_metta_queries(self, relevant_facts: List[Dict], question: str) -> List[str]:
        """Generate MeTTa queries dynamically from relevant facts"""
        logger.info(f"🎯 Generating dynamic MeTTa queries...")
        
        metta_queries = []
        
        # Extract entities and relations from relevant facts
        entities = set()
        relations = set()
        
        for fact in relevant_facts:
            triple = fact['triple']
            entities.add(triple['subject'])
            relations.add(triple['relation'])
        
        logger.info(f"📊 Found entities: {list(entities)[:5]}")
        logger.info(f"📊 Found relations: {list(relations)[:5]}")
        
        # Generate queries for top entities and relations
        for entity in list(entities)[:5]:
            for relation in list(relations)[:3]:
                query = f"!(query {relation} {entity})"
                metta_queries.append(query)
        
        # Add inverse queries for "who/what" questions
        if 'who' in question.lower() or 'which' in question.lower():
            for relation in list(relations)[:3]:
                for entity in list(entities)[:2]:
                    inverse_query = f"!(query-inverse {relation} {entity})"
                    metta_queries.append(inverse_query)
        
        logger.info(f"✅ Generated {len(metta_queries)} dynamic queries")
        return metta_queries
    
    def execute_metta_queries(self, token_id: str, queries: List[str]) -> List[Dict]:
        """Execute multiple MeTTa queries and collect results"""
        logger.info(f"🧠 Executing {len(queries)} MeTTa queries...")
        
        if token_id not in self.knowledge_graphs:
            logger.error(f"Knowledge graph not loaded for token {token_id}")
            return []
        
        results = []
        metta = self.knowledge_graphs[token_id]
        
        for query in queries:
            try:
                result = metta.run(query)
                
                if result and len(result) > 0:
                    if isinstance(result[0], list) and len(result[0]) > 0:
                        answer = str(result[0][0])
                    else:
                        answer = str(result[0])
                    
                    if answer and answer != '[]' and 'Empty' not in answer:
                        parts = query.replace('!(query ', '').replace('!(query-inverse ', '').replace(')', '').split(' ')
                        if len(parts) >= 2:
                            relation = parts[0]
                            entity = parts[1]
                            results.append({
                                'entity': entity,
                                'relation': relation,
                                'value': answer.replace('[', '').replace(']', '').strip()
                            })
                
            except Exception as e:
                logger.warning(f"Query failed: {e}")
                continue
        
        logger.info(f"✅ Collected {len(results)} results from MeTTa queries")
        return results
    
    async def synthesize_answer(self, precise_result: str, original_question: str) -> str:
        """Synthesize natural answer using ASI:One LLM"""
        logger.info("🤖 Synthesizing natural answer...")
        
        synthesis_prompt = f"""You are an intelligent assistant providing natural answers based on facts.

Question: {original_question}
Facts: {precise_result}

Provide a natural, conversational answer incorporating these facts.

Answer:"""
        
        try:
            answer = await self.llm.generate(synthesis_prompt)
            logger.info("✅ Answer synthesized")
            return answer
        except Exception as e:
            logger.error(f"Answer synthesis failed: {e}")
            return f"Based on the information: {precise_result}"
    
    async def process_query(self, question: str, explicit_token_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Process query through the complete pipeline
        Returns dict with success, answer, token_id, and optional error
        """
        start_time = time.time()
        
        logger.info("=" * 60)
        logger.info(f"❓ Query: {question}")
        
        # Extract token ID
        token_id = explicit_token_id or self.extract_token_id(question)
        if not token_id:
            return {
                "success": False,
                "answer": "",
                "token_id": None,
                "error": "Please specify a token ID. Format: [token:YOUR_TOKEN_ID] or pass token_id parameter."
            }
        
        logger.info(f"🆔 Token ID: {token_id}")
        
        # Remove token ID from question
        import re
        clean_question = re.sub(r'[\[\(]token:\w+[\]\)]', '', question, flags=re.IGNORECASE)
        clean_question = re.sub(r'token[:\s]+\w+', '', clean_question, flags=re.IGNORECASE)
        clean_question = clean_question.strip()
        
        # Load knowledge base
        if not self.load_knowledge_base(token_id):
            return {
                "success": False,
                "answer": "",
                "token_id": token_id,
                "error": f"Knowledge base not found for token '{token_id}'."
            }
        
        if not self.load_fact_index(token_id):
            return {
                "success": False,
                "answer": "",
                "token_id": token_id,
                "error": f"Fact index not found for token '{token_id}'."
            }
        
        # Find relevant facts
        relevant_facts = self.find_relevant_facts(clean_question, token_id, top_k=15)
        if not relevant_facts:
            return {
                "success": True,
                "answer": "I couldn't find relevant information for your query in the knowledge base.",
                "token_id": token_id,
                "error": None
            }
        
        # Generate and execute MeTTa queries
        metta_queries = self.generate_metta_queries(relevant_facts, clean_question)
        metta_results = self.execute_metta_queries(token_id, metta_queries)
        
        # Format results
        if metta_results:
            entity_groups = {}
            for r in metta_results:
                entity = r['entity']
                if entity not in entity_groups:
                    entity_groups[entity] = []
                entity_groups[entity].append(f"{r['relation']}: {r['value']}")
            
            all_deductions = []
            for entity, facts in entity_groups.items():
                entity_readable = entity.replace('-', ' ').title()
                fact_str = ', '.join(facts[:5])
                all_deductions.append(f"{entity_readable}: {fact_str}")
            
            precise_result = " | ".join(all_deductions[:10])
        else:
            precise_result = "No specific information found in the knowledge graph."
        
        # Synthesize answer
        natural_answer = await self.synthesize_answer(precise_result, clean_question)
        
        processing_time = (time.time() - start_time) * 1000  # Convert to ms
        
        logger.info(f"✅ Answer: {natural_answer[:100]}...")
        logger.info(f"⏱️  Processing time: {processing_time:.2f}ms")
        logger.info("=" * 60)
        
        return {
            "success": True,
            "answer": natural_answer,
            "token_id": token_id,
            "error": None,
            "processing_time_ms": processing_time
        }

# ============================================================================
# Agent Setup
# ============================================================================

# Get configuration from environment
AGENT_PORT = int(os.getenv("AGENT_PORT", "8002"))
AGENT_HOST = os.getenv("AGENT_HOST", "localhost")

agent = Agent(
    name=os.getenv("AGENT_NAME", "echolink-intelligent-agent"),
    seed=os.getenv("AGENT_SEED", "echolink-intelligent-seed-phrase-1234567890"),
    port=AGENT_PORT,
    # endpoint=[f"http://{AGENT_HOST}:{AGENT_PORT}/submit"],
    mailbox=True,
    publish_agent_details=True
)

# Track startup time for uptime calculation
startup_time = time.time()

# Initialize query engine
query_engine = IntelligentQueryEngine()

# Initialize payment validator
payment_validator = None

# Create chat protocol
chat_proto = Protocol(spec=chat_protocol_spec)

# ============================================================================
# REST API Handlers
# ============================================================================

@agent.on_rest_get("/health", HealthResponse)
async def handle_health_check(ctx: Context) -> HealthResponse:
    """Health check endpoint"""
    ctx.logger.info("🏥 Health check requested")
    
    uptime = time.time() - startup_time
    
    return HealthResponse(
        status="healthy" if query_engine.initialized else "initializing",
        agent_name=ctx.agent.name,
        agent_address=ctx.agent.address,
        timestamp=int(time.time()),
        uptime_seconds=uptime
    )

@agent.on_rest_post("/query", QueryRequest, QueryResponse)
async def handle_rest_query(ctx: Context, req: QueryRequest) -> QueryResponse:
    """
    REST endpoint for processing queries with PYUSD payment validation
    
    Request:
        {
            "query": "What is the capital of France?",
            "token_id": "test_007",  // Optional, can be embedded in query
            "payment_tx_hash": "0x...",  // Required: PYUSD transaction hash
            "user_address": "0x..."  // Required: User's wallet address
        }
    
    Response:
        {
            "success": true,
            "answer": "The capital of France is Paris.",
            "token_id": "test_007",
            "timestamp": 1234567890,
            "error": null,
            "processing_time_ms": 1234.56
        }
    """
    ctx.logger.info(f"📡 REST Query received: {req.query}")
    ctx.logger.info(f"💰 Payment validation required for tx: {req.payment_tx_hash[:20]}...")
    
    # Validate payment first (if validator is available and not using credits)
    if payment_validator and not req.use_credits:
        ctx.logger.info("🔐 Validating PYUSD payment...")
        try:
            is_valid, message = await payment_validator.validate_payment(
                req.payment_tx_hash, 
                req.user_address,
                logger_ctx=ctx.logger
            )
            
            if not is_valid:
                ctx.logger.warning(f"❌ Payment validation failed: {message}")
                return QueryResponse(
                    success=False,
                    answer="",
                    token_id=req.token_id,
                    timestamp=int(time.time()),
                    error=f"Payment validation failed: {message}",
                    processing_time_ms=None
                )
            
            ctx.logger.info(f"✅ Payment validation successful: {message}")
            
        except Exception as e:
            ctx.logger.error(f"❌ Payment validation error: {e}")
            return QueryResponse(
                success=False,
                answer="",
                token_id=req.token_id,
                timestamp=int(time.time()),
                error=f"Payment validation error: {str(e)}",
                processing_time_ms=None
            )
    elif req.use_credits:
        ctx.logger.info("💳 Using credit-based payment - skipping direct payment validation")
        # TODO: Add credit validation logic here
        # For now, we'll proceed without validation
    else:
        ctx.logger.warning("⚠️  Payment validation disabled - proceeding without validation")
    
    # Ensure query engine is initialized
    if not query_engine.initialized:
        ctx.logger.warning("Query engine not initialized, initializing now...")
        try:
            await query_engine.initialize()
        except Exception as e:
            ctx.logger.error(f"Failed to initialize query engine: {e}")
            return QueryResponse(
                success=False,
                answer="",
                token_id=req.token_id,
                timestamp=int(time.time()),
                error="Query engine initialization failed. Please try again.",
                processing_time_ms=None
            )
    
    try:
        # Process the query
        result = await query_engine.process_query(req.query, req.token_id)
        
        ctx.logger.info(f"✅ REST Query processed successfully")
        
        return QueryResponse(
            success=result["success"],
            answer=result["answer"],
            token_id=result["token_id"],
            timestamp=int(time.time()),
            error=result["error"],
            processing_time_ms=result.get("processing_time_ms")
        )
        
    except Exception as e:
        ctx.logger.error(f"❌ REST Query failed: {e}", exc_info=True)
        
        return QueryResponse(
            success=False,
            answer="",
            token_id=req.token_id,
            timestamp=int(time.time()),
            error=f"Internal error: {str(e)}",
            processing_time_ms=None
        )

# ============================================================================
# Chat Protocol Handlers
# ============================================================================

@chat_proto.on_message(ChatMessage)
async def handle_message(ctx: Context, sender: str, msg: ChatMessage):
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
            welcome_msg = """Welcome to EchoLink Intelligent Agent! 🤖

I use semantic routing and MeTTa reasoning to answer your questions.

To ask a question, include a token ID:
- Format: [token:YOUR_TOKEN_ID] Your question
- Example: [token:test_007] What is the capital of France?

How can I help you?"""
            await ctx.send(sender, create_text_chat(welcome_msg))
            continue
            
        elif isinstance(item, TextContent):
            user_query = item.text.strip()
            ctx.logger.info(f"💬 Query: {user_query}")
            
            try:
                # Ensure query engine is initialized
                if not query_engine.initialized:
                    await query_engine.initialize()
                
                # Process the query
                result = await query_engine.process_query(user_query)
                
                # Send response
                if result["success"]:
                    await ctx.send(sender, create_text_chat(result["answer"]))
                else:
                    error_msg = result.get("error", "Unknown error occurred")
                    await ctx.send(sender, create_text_chat(f"❌ {error_msg}"))
                
                ctx.logger.info("✅ Chat response sent")
                
            except Exception as e:
                ctx.logger.error(f"❌ Error: {e}", exc_info=True)
                error_msg = f"I encountered an error processing your query: {str(e)}"
                await ctx.send(sender, create_text_chat(error_msg))
                
        elif isinstance(item, EndSessionContent):
            ctx.logger.info(f"👋 End session from {sender}")
            goodbye_msg = "Thank you for using EchoLink! Feel free to return anytime. 👋"
            await ctx.send(sender, create_text_chat(goodbye_msg, end_session=True))
            
        else:
            ctx.logger.warning(f"⚠️ Unexpected content type from {sender}")

@chat_proto.on_message(ChatAcknowledgement)
async def handle_ack(ctx: Context, sender: str, msg: ChatAcknowledgement):
    """Handle chat acknowledgements"""
    ctx.logger.info(f"✅ Ack from {sender} for {msg.acknowledged_msg_id}")

# Include protocol
agent.include(chat_proto, publish_manifest=True)

# ============================================================================
# Startup Handler
# ============================================================================

@agent.on_event("startup")
async def startup(ctx: Context):
    """Initialize the agent"""
    global payment_validator
    
    logger.info("=" * 60)
    logger.info("🚀 EchoLink Intelligent Agent Starting...")
    logger.info("=" * 60)
    
    try:
        # Initialize query engine
        await query_engine.initialize()
        
        # Initialize payment validator
        if PaymentValidator:
            logger.info("🔐 Initializing PYUSD Payment Validator...")
            web3_provider = os.getenv("WEB3_PROVIDER_URL","https://eth-sepolia.g.alchemy.com/v2/472NtbGQX-PS0AyJjYV5qBMx9mfg78Le")
            pyusd_address = os.getenv("PYUSD_CONTRACT_ADDRESS", "0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9")
            min_amount = float(os.getenv("MIN_PAYMENT_AMOUNT", "0.01"))
            
            if not web3_provider:
                logger.warning("⚠️  WEB3_PROVIDER_URL not set - payment validation will be disabled")
                payment_validator = None
            else:
                payment_validator = PaymentValidator(
                    provider_url=web3_provider,
                    pyusd_address=pyusd_address,
                    min_amount=min_amount
                )
                logger.info("✅ Payment Validator initialized")
        else:
            logger.warning("⚠️  PaymentValidator not available - payment validation disabled")
            payment_validator = None
        
        logger.info("=" * 60)
        logger.info("✨ EchoLink Intelligent Agent Ready!")
        logger.info("=" * 60)
        logger.info(f"📡 Agent Address: {agent.address}")
        logger.info(f"🌐 HTTP Port: {agent._port}")
        logger.info(f"🔗 REST Endpoint: http://{AGENT_HOST}:{AGENT_PORT}/submit")
        logger.info("=" * 60)
        logger.info("📋 Available REST Endpoints:")
        logger.info(f"   GET  http://{AGENT_HOST}:{AGENT_PORT}/health")
        logger.info(f"   POST http://{AGENT_HOST}:{AGENT_PORT}/query")
        logger.info("=" * 60)
        logger.info("💬 Chat Protocol: Enabled (AgentVerse compatible)")
        logger.info(f"💰 Payment Validation: {'Enabled' if payment_validator else 'Disabled'}")
        logger.info("=" * 60)
        
    except Exception as e:
        logger.error(f"❌ Startup failed: {e}")
        raise

# ============================================================================
# Main
# ============================================================================

if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("🔑 Agent Configuration:")
    logger.info(f"   Name: {agent.name}")
    logger.info(f"   Address: {agent.address}")
    logger.info(f"   Port: {AGENT_PORT}")
    logger.info(f"   Host: {AGENT_HOST}")
    logger.info("=" * 60)
    agent.run()