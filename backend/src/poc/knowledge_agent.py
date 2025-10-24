"""
EchoLink Knowledge Agent
Specialized agent for MeTTa reasoning and vector database lookup
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
    KnowledgeQueryRequest, 
    KnowledgeQueryResponse,
    HealthResponse
)

# Core dependencies
try:
    from hyperon import MeTTa
    from sentence_transformers import SentenceTransformer
    import faiss
    import numpy as np
    from utils import ASIOneLLM
except ImportError as e:
    print(f"Warning: Some dependencies not available: {e}")
    MeTTa = None
    SentenceTransformer = None
    faiss = None
    np = None
    ASIOneLLM = None

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
# Intelligent Query Engine
# ============================================================================

class IntelligentQueryEngine:
    """Lightweight, intelligent query engine with dynamic semantic search"""
    
    def __init__(self):
        self.initialized = False
        self.llm = None
        self.metta = None
        self.vectorizer = None
        self.faiss_index = None
        self.fact_mapping = {}
        self.knowledge_base_path = None
        
    async def initialize(self):
        """Initialize the query engine components"""
        if self.initialized:
            return
            
        try:
            logger.info("🧠 Initializing Knowledge Agent components...")
            
            # Initialize LLM
            self.llm = ASIOneLLM(api_key="")
            logger.info("✅ LLM initialized")
            
            # Initialize MeTTa
            self.metta = MeTTa()
            logger.info("✅ MeTTa initialized")
            
            # Initialize sentence transformer
            self.vectorizer = SentenceTransformer('all-MiniLM-L6-v2')
            logger.info("✅ Vectorizer initialized")
            
            # Find the most recent knowledge base
            self.knowledge_base_path = self._find_latest_knowledge_base()
            if self.knowledge_base_path:
                await self._load_knowledge_base()
                logger.info("✅ Knowledge base loaded")
            else:
                logger.warning("⚠️ No knowledge base found")
            
            self.initialized = True
            logger.info("🎉 Knowledge Agent fully initialized")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize Knowledge Agent: {e}")
            raise
    
    def _find_latest_knowledge_base(self) -> Optional[Path]:
        """Find the most recent knowledge base directory"""
        base_path = Path(".")
        knowledge_dirs = list(base_path.glob("knowledge_base_*.db"))
        
        if not knowledge_dirs:
            return None
            
        # Sort by modification time and return the most recent
        latest = max(knowledge_dirs, key=lambda p: p.stat().st_mtime)
        return latest.parent
    
    async def _load_knowledge_base(self):
        """Load the FAISS index and fact mapping"""
        try:
            # Load FAISS index
            faiss_files = list(self.knowledge_base_path.glob("fact_index_*.faiss"))
            if faiss_files:
                latest_faiss = max(faiss_files, key=lambda p: p.stat().st_mtime)
                self.faiss_index = faiss.read_index(str(latest_faiss))
                logger.info(f"📚 Loaded FAISS index: {latest_faiss.name}")
            
            # Load fact mapping
            mapping_files = list(self.knowledge_base_path.glob("fact_mapping_*.json"))
            if mapping_files:
                latest_mapping = max(mapping_files, key=lambda p: p.stat().st_mtime)
                with open(latest_mapping, 'r') as f:
                    self.fact_mapping = json.load(f)
                logger.info(f"🗂️ Loaded fact mapping: {latest_mapping.name}")
                
        except Exception as e:
            logger.error(f"❌ Failed to load knowledge base: {e}")
            self.faiss_index = None
            self.fact_mapping = {}
    
    async def process_query(self, query: str, token_id: str) -> Dict[str, Any]:
        """Process a knowledge query using MeTTa reasoning and vector search"""
        start_time = time.time()
        
        try:
            if not self.initialized:
                await self.initialize()
            
            logger.info(f"🔍 Processing query for token {token_id}: {query}")
            
            # Step 1: Vector similarity search
            relevant_facts = await self._vector_search(query)
            logger.info(f"📊 Found {len(relevant_facts)} relevant facts")
            
            # Early return if no relevant facts found (same as intelligent_agent.py)
            if not relevant_facts:
                return {
                    "success": True,
                    "answer": "I couldn't find relevant information for your query in the knowledge base.",
                    "token_id": token_id,
                    "processing_time_ms": (time.time() - start_time) * 1000
                }
            
            # Step 2: MeTTa reasoning
            reasoning_result = await self._metta_reasoning(query, relevant_facts)
            logger.info(f"🧠 MeTTa reasoning completed")
            
            # Step 3: LLM synthesis
            final_answer = await self._llm_synthesis(query, relevant_facts, reasoning_result)
            logger.info(f"✨ LLM synthesis completed")
            
            processing_time = (time.time() - start_time) * 1000
            
            return {
                "success": True,
                "answer": final_answer,
                "token_id": token_id,
                "processing_time_ms": processing_time
            }
            
        except Exception as e:
            logger.error(f"❌ Query processing failed: {e}")
            return {
                "success": False,
                "answer": f"Error processing query: {str(e)}",
                "token_id": token_id,
                "error": str(e),
                "processing_time_ms": (time.time() - start_time) * 1000
            }
    
    async def _vector_search(self, query: str, top_k: int = 5) -> List[str]:
        """Perform vector similarity search"""
        if not self.faiss_index or not self.fact_mapping:
            return []
        
        try:
            # Encode query
            query_vector = self.vectorizer.encode([query])
            
            # Search FAISS index
            scores, indices = self.faiss_index.search(query_vector, top_k)
            logger.info(f"🔍 Vector search results: {len(scores[0])} candidates")
            
            # Retrieve relevant facts
            relevant_facts = []
            for i, (score, idx) in enumerate(zip(scores[0], indices[0])):
                logger.info(f"  {i+1}. Score: {score:.3f}, Index: {idx}")
                if score > 0.2:  # Threshold for relevance
                    if 'facts' in self.fact_mapping and idx < len(self.fact_mapping['facts']):
                        fact = self.fact_mapping['facts'][idx]
                        relevant_facts.append(fact)
                        logger.info(f"    ✅ Added fact: {fact[:100]}...")
                    else:
                        logger.warning(f"    ❌ Index {idx} out of bounds or no facts array")
                else:
                    logger.info(f"    ⚠️ Score {score:.3f} below threshold 0.3")
            
            return relevant_facts
            
        except Exception as e:
            logger.error(f"❌ Vector search failed: {e}")
            return []
    
    async def _metta_reasoning(self, query: str, facts: List[str]) -> str:
        """Perform MeTTa reasoning on the query and facts"""
        try:
            if not self.metta:
                return "MeTTa reasoning not available"
            
            # Prepare MeTTa program
            metta_program = f"""
            ; Query: {query}
            ; Facts: {json.dumps(facts[:3])}  ; Limit to top 3 facts for reasoning
            
            ; Simple reasoning pattern
            (if (and (contains-fact $facts $query) (relevant $fact $query))
                (then (answer $query $fact)))
            """
            
            # Execute MeTTa reasoning
            result = self.metta.run(metta_program)
            
            if result:
                return str(result)
            else:
                return "No specific reasoning pattern matched"
                
        except Exception as e:
            logger.error(f"❌ MeTTa reasoning failed: {e}")
            return f"MeTTa reasoning error: {str(e)}"
    
    async def _llm_synthesis(self, query: str, facts: List[str], reasoning: str) -> str:
        """Synthesize final answer using LLM"""
        try:
            if not self.llm:
                return "LLM not available for synthesis"
            
            # Prepare context
            context = {
                "query": query,
                "relevant_facts": facts[:10],  # Limit to top 5 facts
                "reasoning": reasoning
            }
            
            # Create prompt
            prompt = f"""
            Based on the following information, provide a comprehensive answer to the user's query.
            
            Query: {query}
            
            Relevant Facts:
            {json.dumps(facts[:5], indent=2)}
            
            Reasoning Analysis:
            {reasoning}
            
            Please provide a clear, accurate, and helpful answer based on the cavailable information.
            """
            
            # Get LLM response
            response = await self.llm.generate(prompt)
            
            return response if response else "I couldn't generate a response based on the available information."
            
        except Exception as e:
            logger.error(f"❌ LLM synthesis failed: {e}")
            return f"Error generating response: {str(e)}"

# ============================================================================
# Knowledge Agent Protocol
# ============================================================================

knowledge_protocol = Protocol("KnowledgeProcessing")

@knowledge_protocol.on_message(model=KnowledgeQueryRequest)
async def handle_knowledge_query(ctx: Context, sender: str, msg: KnowledgeQueryRequest):
    """Handle knowledge processing requests"""
    ctx.logger.info(f"🧠 Knowledge query received for token {msg.token_id}")
    ctx.logger.info(f"📋 Query ID: {msg.query_id}")
    ctx.logger.info(f"❓ Query: {msg.query[:100]}...")
    
    try:
        # Initialize query engine if not already done
        if not hasattr(ctx, 'query_engine'):
            ctx.query_engine = IntelligentQueryEngine()
            await ctx.query_engine.initialize()
        
        # Process the query
        result = await ctx.query_engine.process_query(msg.query, msg.token_id)
        
        # Send response back to sender
        await ctx.send(
            sender,
            KnowledgeQueryResponse(
                success=result["success"],
                answer=result["answer"],
                query_id=msg.query_id,
                token_id=msg.token_id,
                processing_time_ms=result.get("processing_time_ms"),
                error=result.get("error")
            )
        )
        
        ctx.logger.info(f"✅ Knowledge query processed successfully")
        
    except Exception as e:
        ctx.logger.error(f"❌ Knowledge query failed: {e}")
        await ctx.send(
            sender,
            KnowledgeQueryResponse(
                success=False,
                answer=f"Error processing knowledge query: {str(e)}",
                query_id=msg.query_id,
                token_id=msg.token_id,
                error=str(e)
            )
        )

@knowledge_protocol.on_message(model=HealthResponse)
async def handle_health_check(ctx: Context, sender: str, msg: HealthResponse):
    """Handle health check requests"""
    ctx.logger.info(f"🏥 Health check from {sender}: {msg.status}")
    
    # Return health status
    await ctx.send(
        sender,
        HealthResponse(
            status="healthy",
            agent_name="EchoLink Knowledge Agent",
            agent_address=knowledge_agent.address,
            timestamp=int(time.time()),
            uptime_seconds=time.time() - ctx.start_time
        )
    )

# ============================================================================
# Knowledge Agent Setup
# ============================================================================

# Create Knowledge Agent
knowledge_agent = Agent(
    name="EchoLinkKnowledgeAgent",
    port=8006,
    seed="knowledge-agent-seed-phrase-here",
    mailbox=True,
    publish_agent_details=True
)

# Include the knowledge protocol
knowledge_agent.include(knowledge_protocol)

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
            welcome_msg = """Welcome to EchoLink Knowledge Agent! 🧠

I specialize in MeTTa reasoning and vector database lookup for knowledge queries.

To ask a question, include a token ID:
- Format: [token:YOUR_TOKEN_ID] Your question
- Example: [token:test_007] What is the capital of France?

How can I help you with your knowledge query?"""
            await ctx.send(sender, create_text_chat(welcome_msg))
            continue
            
        elif isinstance(item, TextContent):
            ctx.logger.info(f"📝 Text message from {sender}: {item.text[:100]}...")
            
            try:
                # Initialize query engine if not already done
                if not hasattr(ctx, 'query_engine'):
                    ctx.query_engine = IntelligentQueryEngine()
                    await ctx.query_engine.initialize()
                
                # Extract token ID from message
                token_id = ctx.query_engine.extract_token_id(item.text)
                
                if not token_id:
                    response = "Please include a token ID in your message.\n\nFormat: [token:YOUR_TOKEN_ID] Your question"
                    await ctx.send(sender, create_text_chat(response))
                    continue
                
                # Process the query using existing functionality
                result = await ctx.query_engine.process_query(item.text, token_id)
                
                if result["success"]:
                    response_text = f"Token: {token_id}\n\n{result['answer']}"
                else:
                    response_text = f"Error processing query: {result.get('error', 'Unknown error')}"
                
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
knowledge_agent.include(chat_proto, publish_manifest=True)

@knowledge_agent.on_event("startup")
async def startup(ctx: Context):
    """Initialize the knowledge agent"""
    ctx.start_time = time.time()
    
    ctx.logger.info("=" * 60)
    ctx.logger.info("🧠 EchoLink Knowledge Agent Starting Up")
    ctx.logger.info("=" * 60)
    ctx.logger.info(f"Agent Address: {knowledge_agent.address}")
    ctx.logger.info("Capabilities:")
    ctx.logger.info("  ✅ MeTTa reasoning")
    ctx.logger.info("  ✅ Vector similarity search")
    ctx.logger.info("  ✅ LLM synthesis")
    ctx.logger.info("  ✅ Knowledge base management")
    ctx.logger.info("=" * 60)

if __name__ == "__main__":
    knowledge_agent.run()
