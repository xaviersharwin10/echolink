# EchoLink - Decentralized Knowledge Marketplace 🌐🧠

**EchoLink** is a revolutionary decentralized knowledge marketplace that combines blockchain technology with advanced AI agents to enable knowledge creators to monetize their expertise through interactive Echo NFTs. Built for **ETHOnline 2025**.

## 🌟 Overview

EchoLink: Decentralized Knowledge Marketplace. Mint your content (books, papers) as AI Echo NFTs powered by ASI uAgents and MeTTa graphs. Earn PYUSD micro-payments directly from users who query your Echo for verifiable insights, with all usage transparently tracked on Blockscout. Built for ETHOnline 2025.

The platform delivers a scalable real-world solution for knowledge monetization, combining blockchain ownership, multi-agent AI systems, and seamless payments to create new economic opportunities in the creator economy.

### Core Integrations

**🤖 ASI Alliance Integration (uAgents + MeTTa + ASI:One)**
- **Multi-Agent Architecture**: Three specialized agents (Orchestrator, Payment, Knowledge) working in concert to deliver seamless query processing
- **MeTTa Knowledge Graphs**: Advanced structured reasoning with entity-relation-value triples enables deep semantic understanding
- **ASI:One Integration**: Natural human-agent interaction through Web3-native language model synthesis
- **Agentverse Deployment**: All agents registered and discoverable on Agentverse for seamless integration
- **Chat Protocol**: Direct conversational interface enabling users to interact with AI agents naturally

**💳 PayPal PYUSD Payment System**
- **Microtransactions**: Pay-per-query model enables granular monetization of knowledge
- **Subscription Model**: Credit system (1 PYUSD = 100 credits, 1 credit = 0.01 PYUSD) for flexible access
- **One-Time Purchase**: Buy full Echo NFTs for unlimited lifetime access
- **Smart Contract Integration**: Direct PYUSD transfers with ERC-20 compatibility and transparent fees
- **Consumer Experience**: Rainbow wallet integration with one-click payments and instant processing

**🔍 Blockscout Analytics Platform**
- **AI-Powered Analytics**: Model Context Protocol (MCP) chatbot provides intelligent blockchain insights
- **Transaction Tracking**: Real-time notifications and status updates via Blockscout SDK
- **Explorer Integration**: Direct access to verified transaction data and contract interactions
- **Performance Metrics**: Comprehensive analytics on Echo performance, creator earnings, and platform activity

**⛓️ Blockchain Infrastructure**
- Ethereum Sepolia testnet deployment with full mainnet readiness
- ERC-721 EchoNFT contract for ownership and access control
- ERC-20 PYUSD integration for standardized payments

## ✨ Key Features

### 🤖 Multi-Agent AI System (ASI Alliance)
EchoLink implements a production-grade multi-agent architecture demonstrating advanced agent collaboration:

- **Orchestrator Agent** (Deployed on Agentverse): Intelligently routes incoming queries to appropriate specialized agents based on context and ownership status
- **Payment Agent** (Deployed on Agentverse): Validates blockchain transactions in real-time, checking PYUSD transfers and credit usage with secure Web3.py verification
- **Knowledge Agent** (Deployed on Agentverse): Processes natural language queries through multi-stage reasoning: FAISS vector search → MeTTa predicate queries → ASI:One synthesis
- **Agent Communication**: Secure agent-to-agent messaging via Fetch.ai Almanac enables seamless coordination
- **Human-Agent Interaction**: ASI:One Chat Protocol provides intuitive conversational interface, making advanced AI reasoning accessible to all users

### 🧠 MeTTa Knowledge Graph Reasoning
EchoLink leverages MeTTa for sophisticated symbolic reasoning over knowledge:

- **REBEL Extraction**: Extracts precise triples (subject-relation-object) from PDF, video, audio, and text documents
- **MeTTa Representation**: Converts triples into MeTTa atoms for symbolic reasoning and inference
- **Dual Search Strategy**: Combines FAISS vector embeddings for semantic similarity with MeTTa query predicates for logical inference
- **Complex Reasoning**: Execute queries like `!(query relation entity)` and inverse queries for comprehensive fact retrieval
- **Source Provenance**: Every piece of knowledge maintains attribution and traceability to original content

### 💳 PayPal PYUSD Payment Integration
EchoLink demonstrates transformative use of PYUSD for knowledge commerce:

**Flexible Payment Models**
- **Pay-Per-Query**: Direct microtransactions for one-time knowledge access (e.g., 0.1 PYUSD per query)
- **Credit Subscriptions**: Buy credits in bulk (1 PYUSD = 100 credits) for frequent users
- **Full Ownership**: Purchase entire Echo NFT for unlimited lifetime access (one-time purchase model)

**Technical Implementation**
- **Smart Contract Integration**: Direct PYUSD ERC-20 transfers in EchoNFT contract with transferFrom and allowance patterns
- **Payment Validation**: On-chain verification ensures secure, immutable payment tracking
- **Protocol Economics**: Transparent 5% fee supports platform sustainability while rewarding creators
- **Consumer Experience**: Seamless Rainbow wallet integration with automatic transaction tracking via Blockscout SDK

**Real-World Value**
- Enables microtransactions previously impractical with high gas fees
- Supports global knowledge commerce without currency barriers
- Creates sustainable economics for knowledge creators and platform

### 🎨 Creator Tools
- Upload multiple file formats (TXT, PDF, DOCX, MP4, MOV, MP3, WAV)
- Automatic video/audio transcription using local Whisper model
- Knowledge extraction using REBEL model
- MeTTa knowledge graph creation
- Vector embeddings with FAISS
- Automatic Echo NFT minting on blockchain

### 🎯 Ownership & Access Control
- **Owned Echos**: Unlimited queries for owners (bypass payment validation)
- **Paid Access**: Pay-per-query or credit-based access for non-owners
- **Smart Contract**: On-chain ownership tracking with EchoNFT ERC-721 contract
- **Transferable Ownership**: Echo NFTs can be sold or transferred

### 📊 Blockscout Analytics & Monitoring
EchoLink provides comprehensive blockchain analytics powered by Blockscout:

**AI-Powered Insights**
- **MCP Chatbot**: Intelligent AI analyst powered by Blockscout Model Context Protocol
- **Natural Language Queries**: Ask questions like "What's the highest performing Echo?" and get AI-reasoned answers
- **On-Chain Intelligence**: Uses MCP tools (read_contract, get_address_info, get_token_transfers) for comprehensive blockchain analysis

**Leaderboard Analytics**
- **Real-Time Rankings**: Dynamic leaderboard showing top-performing Echos and creators based on on-chain data
- **Blockscout Integration**: Fetches event logs (QueryPaid, CreditsUsed) directly from Blockscout MCP/API
- **Creator Statistics**: Tracks earnings, query volume, and transaction history for each creator
- **Price Distribution**: Visualizes knowledge pricing tiers across all Echos

**User Experience**
- **Transaction Tracking**: Real-time notifications via Blockscout SDK keep users informed of payment status
- **Explorer Integration**: Seamless links to Blockscout explorer for transaction verification
- **Performance Dashboards**: Visual analytics on Echo performance, creator earnings, and platform activity

**Developer Benefits**
- **Open Source**: Fully composable with other Web3 primitives
- **Multi-Chain Ready**: MCP server provides unified interface across blockchain networks
- **Production-Ready**: Enterprise-grade analytics for monitoring and optimization

## 🏗️ Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                       ECHOLINK SYSTEM                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Frontend (React + TypeScript)                              │
│  ├── EchoDashboard (User dashboard)                         │
│  ├── CreatorStudio (Mint Echo NFTs)                         │
│  ├── EchoGallery (Browse marketplace)                       │
│  ├── CreditManager (Buy credits)                            │
│  └── AI Analyst (Blockscout MCP chatbot)                    │
│                                                              │
│  Backend (Express.js + TypeScript)                          │
│  ├── Creator Studio Server (File upload & processing)       │
│  └── Agent Services (Orchestrator, Payment, Knowledge)      │
│                                                              │
│  Smart Contracts (Solidity)                                 │
│  ├── EchoNFT (ERC-721 with access control)                  │
│  └── QueryPayments (Payment handling)                       │
│                                                              │
│  AI/Knowledge Processing                                    │
│  ├── REBEL Model (Triple extraction)                        │
│  ├── MeTTa (Symbolic reasoning)                             │
│  ├── FAISS (Vector embeddings)                              │
│  └── ASI:One LLM (Natural language synthesis)               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Multi-Agent Architecture (ASI Alliance Integration)

```
                    [User via ASI:One Chat Protocol]
                              ↓
                    [EchoLink Frontend]
                              ↓
┌─────────────────────────────────────────────────────────┐
│  Agentverse (Discovery & Hosting)                       │
└─────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────┐
│           Orchestrator Agent (Registered)               │
│  - Receives queries from frontend                       │
│  - Routes to appropriate specialized agent              │
│  - Coordinates multi-agent workflows                    │
└──────────┬──────────────────────────────┬───────────────┘
           │                              │
     ┌─────▼───────┐              ┌───────▼────────┐
     │  Payment    │              │   Knowledge    │
     │   Agent     │              │     Agent      │
     │(Registered) │              │  (Registered)  │
     └─────┬───────┘              └───────┬────────┘
           │                              │
           │ Validates blockchain         │
           │ transactions (Web3.py)       │ Loads MeTTa Graph
           │                              │
           │                              ├─→ FAISS Vector Search
           │                              ├─→ MeTTa Query Predicates
           │                              └─→ ASI:One LLM Synthesis
           │
     [PYUSD Smart Contract]       [Knowledge Storage]
     
Fetch.ai Almanac: Secure agent-to-agent messaging
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v18 or higher)
- **Python** (v3.9 or higher)
- **MetaMask** or compatible Web3 wallet
- **Base Sepolia** testnet connection
- **PYUSD** tokens (testnet)

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd EchoLink/echolink-protocol
```

2. **Install Frontend Dependencies**
```bash
cd frontend
npm install
```

3. **Install Backend Dependencies**
```bash
cd ../backend
npm install
```

4. **Install Smart Contract Dependencies**
```bash
cd ../contracts
npm install
```

5. **Set Up Python Environment (for AI processing)**
```bash
cd ../backend/src/poc
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Environment Setup

Create `.env` files in the respective directories:

**Backend (.env)**
```
CREATOR_STUDIO_PORT=8000
PYTHON_PATH=./src/poc/venv/bin/python
```

**Frontend (.env)**
```
REACT_APP_ECHO_NFT_CONTRACT=<deployed_contract_address>
REACT_APP_PYUSD_CONTRACT=<pyusd_contract_address>
REACT_APP_CHAIN_ID=84532  # Base Sepolia
```

### Running the Application

1. **Start the Backend**
```bash
cd backend
npm run dev  # or npm start
# open a new terminal
cd backend
npm run creator-studio
```

2. **Start the Frontend**
```bash
cd frontend
npm start
```

3. **Deploy Smart Contracts** (if not already deployed)
```bash
cd contracts
npx hardhat compile
npm run deploy
npm run deploy:query-payments
```

4. **Start AI Agents** (if using local agents)
```bash
cd backend/src/poc
source venv/bin/activate
./start_multi_agent_system.sh


Update the relevant api keys in knowledge_agent.py, intelligent_agent.py, multiagent_config.py, backend/index.js
```

## 📖 Usage Guide

### For Creators: Minting an Echo

1. Navigate to **"🎨 Create"** tab
2. Upload your knowledge file (PDF, video, audio, text)
3. Fill in Echo details:
   - Name and description
   - Price per query (in PYUSD)
   - Purchase price (optional)
   - Set as free or paid
4. Click **"Mint Echo"** and approve wallet transactions
5. Wait for knowledge processing (background)
6. Your Echo appears in the marketplace!

### For Users: Querying an Echo

1. Browse **"💬 Explore"** gallery
2. Select an Echo you want to query
3. **If you own it**: Unlimited access
4. **If you don't own it**: Pay with credits or PYUSD
5. Type your question and get AI-powered answers
6. Answers are synthesized from the knowledge graph

### For Users: Buying an Echo

1. Find an Echo in the gallery
2. Click **"Buy Echo"**
3. Approve PYUSD spending
4. Confirm purchase transaction
5. Enjoy unlimited access to the Echo!

### For Users: Managing Credits

1. Go to **"💳 Credits"** tab
2. View your current credit balance
3. Buy credits with PYUSD (1 PYUSD = 100 credits)
4. Use credits to query paid Echos

## 🛠️ Technologies Used

### Frontend
- **React** + **TypeScript**
- **Wagmi** + **RainbowKit** (Web3 integration)
- **TailwindCSS** (styling)
- **Blockscout SDK** (transaction tracking and notifications)

### Backend
- **Express.js** (API server)
- **Multer** (file uploads)
- **PDF-Parse, Mammoth** (document processing)
- **FFmpeg** (video/audio processing)
- **OpenAI Whisper** (transcription)

### Smart Contracts
- **Solidity** (contract language)
- **Hardhat** (development framework)
- **OpenZeppelin** (security libraries)
- **ERC-721** (EchoNFT contract)
- **ERC-20** (PYUSD integration)

### AI Alliance Stack 🚀
- **uAgents**: Multi-agent framework for autonomous agents
- **Agentverse**: Agent discovery, listing, and hosting platform
- **MeTTa**: Symbolic reasoning with knowledge graphs
- **ASI:One**: Web3-native LLM for natural language synthesis
- **Fetch.ai Almanac**: Agent-to-agent communication and discovery
- **Chat Protocol**: Human-agent interaction interface
- **FAISS**: Vector embeddings and similarity search
- **REBEL**: Triple extraction (subject-relation-object)

### PayPal PYUSD 💳
- **PYUSD Token**: Stablecoin for payments and transactions
- **ERC-20 Standard**: Compatible with all Ethereum wallets
- **Smart Contract Integration**: Direct PYUSD transfers in EchoNFT contract
- **Credit System**: Flexible payment model (PYUSD ↔ Credits conversion)

### Blockscout Integration 🔍
- **Blockscout MCP**: AI analyst chatbot powered by Model Context Protocol
- **Blockscout SDK**: Transaction tracking, popup notifications, explorer integration
- **MCP Tools**: get_address_info, read_contract, get_token_transfers, get_transaction_logs
- **Real-time Analytics**: On-chain data insights and performance metrics

### Blockchain
- **Ethereum Sepolia** (testnet)
- **Web3.py** (blockchain interaction)
- **RainbowKit** (wallet connection)


## 🚀 Business Model & Scalability

EchoLink is designed as a sustainable, scalable business:

**Revenue Streams**
- **Protocol Fees**: 5% fee on all transactions (queries, purchases, credit sales)
- **Creator Monetization**: Creators set their own prices per query and purchase
- **Premium Features**: Future monetization of advanced analytics and tools

**Market Opportunity**
- $100B+ creator economy looking for new monetization models
- Growing demand for AI-powered knowledge tools
- Web3 adoption creating demand for blockchain-native solutions

**Scalability**
- Agent-based architecture scales horizontally
- MeTTa knowledge graphs enable efficient query processing
- PYUSD integration eliminates currency conversion barriers
- Open-source composability enables ecosystem growth

## 🔮 Future Enhancements

EchoLink will continue evolving with cutting-edge features:

**🤖 AI-Powered Recommendations**
- **Smart Discovery**: Intelligent Echo recommendations powered by Blockscout MCP analysis
- **Usage-Based Suggestions**: AI agent analyzes on-chain activity to recommend relevant Echos based on user query patterns
- **Trend Detection**: Identify trending knowledge domains and suggest popular Echos
- **Personalized Feed**: Deliver curated Echo suggestions based on user interests and browsing history

**📈 Advanced Analytics**
- **Predictive Insights**: ML models to forecast Echo performance and creator earnings
- **Cross-Chain Support**: Extend to multiple blockchain networks for broader accessibility
- **Enhanced Search**: Natural language search across all Echos with semantic understanding

**🔐 Enterprise Features**
- **Team Collaboration**: Shared workspace for teams to collaborate on Echo creation
- **API Access**: Developer APIs for custom integrations and automations
- **Advanced Access Control**: Granular permissions and enterprise-level security

## 🎉 Acknowledgments

EchoLink is built with cutting-edge technologies from leading Web3 and AI platforms:

- **🤖 ASI Alliance**: uAgents framework, MeTTa symbolic reasoning, ASI:One LLM, Agentverse platform
- **💳 PayPal**: PYUSD stablecoin for frictionless global payments
- **🔍 Blockscout**: MCP for AI analytics and SDK for transaction tracking
- **⛓️ OpenZeppelin**: Battle-tested smart contract security patterns
- **🌐 Fetch.ai**: Decentralized agent communication and discovery
- **🧠 SingularityNET**: MeTTa knowledge representation and reasoning

---

**Built with ❤️**

