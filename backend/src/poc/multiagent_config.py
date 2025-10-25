"""
EchoLink Multi-Agent System Configuration
"""

import os
from pathlib import Path

# Agent Communication
PAYMENT_AGENT_ADDRESS = os.getenv("PAYMENT_AGENT_ADDRESS", "agent1qgmcaux67tuhrkl9cwhns0npxclvksy66yarp32j4f8zkedrhqjys597p08")
KNOWLEDGE_AGENT_ADDRESS = os.getenv("KNOWLEDGE_AGENT_ADDRESS", "agent1q2x577ul5d6r20c4alcx64pcersrusm7j4pekkce05cu22kpxz9hux72t3t")
ORCHESTRATOR_AGENT_ADDRESS = os.getenv("ORCHESTRATOR_AGENT_ADDRESS", "agent1qwvu2g779cjyna0dzcs2klw6w2s6v323xkqguypzj05vdk0xrdc3wkjp3wq")

# Blockchain Configuration
WEB3_PROVIDER_URL = os.getenv("WEB3_PROVIDER_URL", "")
PYUSD_CONTRACT_ADDRESS = os.getenv("PYUSD_CONTRACT_ADDRESS", "0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9")
ECHO_NFT_CONTRACT_ADDRESS = os.getenv("ECHO_NFT_CONTRACT_ADDRESS", "0x39bc7190911b9334560ADfEf4100f1bE515fa3e1")
MIN_PAYMENT_AMOUNT = float(os.getenv("MIN_PAYMENT_AMOUNT", "0.01"))

# Agent Ports
PAYMENT_AGENT_PORT = int(os.getenv("PAYMENT_AGENT_PORT", "8005"))
KNOWLEDGE_AGENT_PORT = int(os.getenv("KNOWLEDGE_AGENT_PORT", "8006"))
ORCHESTRATOR_AGENT_PORT = int(os.getenv("ORCHESTRATOR_AGENT_PORT", "8004"))

# LLM Configuration
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "openai/gpt-4o")

# Database Configuration
KNOWLEDGE_BASE_PATH = Path(os.getenv("KNOWLEDGE_BASE_PATH", "./knowledge_base"))
VECTOR_INDEX_PATH = Path(os.getenv("VECTOR_INDEX_PATH", "./fact_index"))
FACT_MAPPING_PATH = Path(os.getenv("FACT_MAPPING_PATH", "./fact_mapping"))

# Logging
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

# Agent Seeds (for development)
PAYMENT_AGENT_SEED = "payment-agent-seed-phrase-here"
KNOWLEDGE_AGENT_SEED = "knowledge-agent-seed-phrase-here"
ORCHESTRATOR_AGENT_SEED = "orchestrator-agent-seed-phrase-here"
