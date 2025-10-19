"""
Utilities Module
ASI:One LLM integration and query processing pipeline
"""

import os
from openai import OpenAI
from typing import Optional
import logging
from metta_reasoning_module import extract_relations_and_reason

logger = logging.getLogger(__name__)


class ASIOneLLM:
    """
    ASI:One LLM client (replaces OpenRouter).
    Uses OpenAI client with ASI:One base URL.
    """
    
    def __init__(self, api_key: str, model: str = "asi1-mini"):
        """
        Initialize ASI:One LLM client.
        
        Args:
            api_key: ASI:One API key
            model: Model name ("asi1-mini" or "asi1-large")
        """
        self.client = OpenAI(
            api_key=api_key,
            base_url="https://api.asi1.ai/v1"
        )
        self.model = model
        logger.info(f"ASI:One LLM initialized with model: {model}")
    
    async def generate(self, prompt: str, max_tokens: int = 2000) -> str:
        """
        Generate text using ASI:One LLM.
        
        Args:
            prompt: Input prompt
            max_tokens: Maximum tokens to generate
            
        Returns:
            Generated text
        """
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are an advanced AI assistant for the EchoLink Protocol, powered by hybrid neural and symbolic AI."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=max_tokens,
                temperature=0.7
            )
            
            answer = response.choices[0].message.content
            return answer
            
        except Exception as e:
            logger.error(f"ASI:One LLM error: {e}")
            raise


async def process_advanced_query(
    question: str,
    rag,
    metta_kb,
    llm: ASIOneLLM,
    logger_ctx=None
) -> str:
    """
    Process query through advanced 3-step pipeline.
    Ported from TypeScript advanced_ai.ts advancedQuery function.
    
    Step A: Retrieve Context (RAG)
    Step B: Deduce Logic (MeTTa)
    Step C: Generate Answer (LLM)
    
    Args:
        question: User's question
        rag: EchoLinkRAG instance
        metta_kb: MeTTaKnowledgeBase instance
        llm: ASIOneLLM instance
        logger_ctx: Optional logger context
        
    Returns:
        Final synthesized answer
    """
    log = logger_ctx if logger_ctx else logger
    
    log.info("=" * 70)
    log.info("🚀 ADVANCED AI PIPELINE ACTIVATED")
    log.info("=" * 70)
    log.info(f"📝 Question: {question}")
    
    # ------------------------------
    # STEP A: Retrieve Context (RAG)
    # ------------------------------
    log.info("📚 STEP A: Retrieving context from knowledge base...")
    
    retrieved_context = await rag.retrieve_context(question, k=3)
    
    log.info(f"✅ Retrieved context ({len(retrieved_context)} chars)")
    
    # ------------------------------
    # STEP B: Deduce Logic (MeTTa)
    # ------------------------------
    log.info("🧠 STEP B: Running symbolic reasoning (MeTTa)...")
    
    metta_deduction = "N/A"
    metta_context_desc = "Symbolic reasoning not available"
    
    try:
        # Extract relations from context and perform reasoning
        deduction_result = extract_relations_and_reason(
            context=retrieved_context,
            question=question,
            metta_kb=metta_kb
        )
        
        if deduction_result and deduction_result != "No-specific-deduction":
            metta_deduction = deduction_result
            log.info(f"✅ MeTTa deduced: {metta_deduction}")
            metta_context_desc = f"Symbolic deduction: {metta_deduction}"
        else:
            log.info("⚠️  No specific deduction from MeTTa")
            
    except Exception as e:
        log.warning(f"⚠️  MeTTa reasoning failed: {str(e)}")
    
    # ------------------------------
    # STEP C: Generate Final Answer
    # ------------------------------
    log.info("🤖 STEP C: Synthesizing answer with ASI:One LLM...")
    
    # Create super-prompt (ported from TypeScript)
    super_prompt = f"""You are an advanced AI assistant powered by a hybrid intelligence system combining neural and symbolic AI.

You have access to two types of information to answer the user's question:

1. RETRIEVED CONTEXT (from knowledge base via RAG):
{retrieved_context}

2. SYMBOLIC DEDUCTION (from MeTTa reasoning engine):
{metta_context_desc}
Deduced Answer: {metta_deduction}

USER'S QUESTION:
{question}

INSTRUCTIONS:
- Use the retrieved context as your primary source of information
- If the symbolic deduction is relevant, incorporate it to add precision and logical clarity
- Synthesize a comprehensive, well-structured answer that combines both sources
- Be clear, informative, and cite specific facts when possible
- If the symbolic deduction doesn't apply to this question, focus on the retrieved context
- Provide a natural, conversational response

YOUR ANSWER:"""
    
    final_answer = await llm.generate(super_prompt)
    
    log.info(f"✅ Final answer generated ({len(final_answer)} chars)")
    log.info("=" * 70)
    log.info("✨ PIPELINE COMPLETE")
    log.info("=" * 70)
    
    return final_answer


def create_synthesis_prompt(context: str, metta_deduction: str, question: str) -> str:
    """
    Create the synthesis prompt for LLM.
    Helper function to keep code modular.
    """
    return f"""You are an advanced AI assistant for EchoLink Protocol.

CONTEXT FROM KNOWLEDGE BASE:
{context}

LOGICAL DEDUCTION:
{metta_deduction}

QUESTION:
{question}

Provide a comprehensive answer combining the context and logical deduction."""

