# EchoLink Architecture - Complete System Diagram

## 🔷 Complete System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          ECHOLINK ECOSYSTEM                                  │
│                    Decentralized Knowledge Marketplace                       │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                             PRESENTATION LAYER                               │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌──────────────────────────────────────────────────────┐
        │              React Frontend (Web App)                │
        │  • EchoGallery     • CreatorStudio    • ChatInterface│
        │  • EchoDashboard   • MyEchos          • CreditManager│
        └──────────────────────────────────────────────────────┘
                              │
                              │ WebSocket / REST API
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           COMMUNICATION LAYER                                │
└─────────────────────────────────────────────────────────────────────────────┘
        ┌──────────────────────────────────────────────────────┐
        │                 Express.js Backend                    │
        │  • REST API Endpoints                                 │
        │  • ASI:One LLM Integration                            │
        │  • File Upload & Content Storage                      │
        └──────────────────────────────────────────────────────┘
                              │
                              │ Agent Messages
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ASI ALLIANCE INTEGRATION                              │
│                        uAgents Framework + MeTTa                              │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┴─────────────────────┐
        │                                           │
        ▼                                           ▼
┌──────────────────────┐                ┌──────────────────────┐
│  Orchestrator Agent  │                │   Payment Agent      │
│  (Port 8004)         │                │   (Port 8005)        │
│                      │                │                      │
│  Coordinates workflow│                │  Validates Payments  │
│  Manages query flow  │                │  Checks Credits      │
│  Handles ownership   │◄───────────────┤  Processes TXNs      │
└──────────────────────┘                └──────────────────────┘
        │                                           │
        │                                           │ Blockscout MCP
        │                                           ▼
        │                                 ┌──────────────────────┐
        │                                 │  Blockscout MCP      │
        │                                 │  Server (Python)     │
        │                                 │  • get_transaction   │
        │                                 │  • get_account       │
        │                                 │  • Hybrid Validation │
        └──────────┬──────────────────────┴──────────────────────┘
                   │
                   │ Knowledge Query
                   ▼
        ┌──────────────────────────────────────────┐
        │      Knowledge Agent (Port 8006)         │
        │                                          │
        │  1. Loads MeTTa Knowledge Graph          │
        │  2. Executes Vector Search (FAISS)       │
        │  3. Performs MeTTa Reasoning             │
        │  4. Queries Structured Atoms             │
        │  5. Synthesizes with LLM                 │
        └──────────────────────────────────────────┘
                   │
                   │ Chat Protocol
                   ▼
        ┌──────────────────────────────────────────┐
        │          Agentverse Discovery             │
        │    Registered & Discoverable Agents      │
        └──────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                        PAYMENT & BLOCKCHAIN LAYER                             │
│                        PayPal PYUSD Integration                               │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┴─────────────────────┐
        │                                           │
        ▼                                           ▼
┌──────────────────────┐                ┌──────────────────────┐
│   EchoNFT Contract  │                │  QueryPayments       │
│   (ERC-721)         │                │   Contract           │
│                     │                │                      │
│  • Mint Echos       │                │  • Direct PYUSD      │
│  • Credit System    │                │  • Price per Query   │
│  • Purchase System  │                │  • Protocol Fees     │
│  • Ownership Mgmt   │                │  • Instant Payment   │
└──────────────────────┘                └──────────────────────┘
        │                                           │
        │                                           │
        └───────────────────┬───────────────────────┘
                            │
                            ▼
                ┌──────────────────────┐
                │   PayPal PYUSD       │
                │   (ERC-20 Token)     │
                │                      │
                │  • Stable Payment    │
                │  • Global Reach      │
                │  • Seamless UX       │
                └──────────────────────┘
                            │
                            │ Web3.py / viem
                            ▼
                ┌──────────────────────┐
                │   Blockchains        │
                │   • Base Sepolia     │
                │   • Polygon          │
                └──────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                          KNOWLEDGE PROCESSING                                │
│                           MeTTa + REBEL + FAISS                              │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┴─────────────────────┐
        │                                           │
        ▼                                           ▼
┌──────────────────────┐                ┌──────────────────────┐
│   Knowledge Ingestion│                │   MeTTa Knowledge    │
│   Pipeline           │                │   Graph              │
│                      │                │                      │
│  • REBEL Model       │                │  • Structured Atoms  │
│    (Triple Extract)  │                │  • Query Predicates  │
│  • MeTTa Builder     │                │  • Reasoning Rules   │
│  • FAISS Index       │                │  • Memory Store      │
│  • Fact Mapping      │                │                      │
└──────────────────────┘                └──────────────────────┘
        │                                           │
        │                                           │
        └───────────────────┬───────────────────────┘
                            │
                            ▼
                ┌──────────────────────┐
                │  knowledge_bases/    │
                │  • fact_index_*.faiss│
                │  • fact_mapping_*.json│
                │  • knowledge_base_*.db│
                └──────────────────────┘
```

## 🔷 Component Responsibilities

### **Frontend Layer (React)**
- **EchoDashboard**: Landing page with featured Echos
- **EchoGallery**: Browse and purchase Echos
- **CreatorStudio**: Upload knowledge, configure Echo, mint NFT
- **ChatInterface**: Query Echo with AI, handle payments
- **CreditManager**: Purchase and manage credits
- **MyEchos**: View owned Echos with unlimited access

### **Backend Layer (Express.js)**
- **REST API**: Content storage, file upload, Echo metadata
- **ASI:One LLM**: Natural language query understanding
- **File Storage**: Local disk storage for Echo content
- **Content Management**: Serve original files and metadata

### **ASI Alliance Integration**

#### **Orchestrator Agent (Port 8004)**
- Coordinates payment validation → knowledge processing
- Manages query workflow
- Handles owned Echo bypass logic
- Routes requests to appropriate agents

#### **Payment Agent (Port 8005)**
- **PYUSD Payment Validation**: Web3 validation of PYUSD transfers
- **Credit System**: Validates credit purchases and usage
- **Hybrid Validation**: Combines Blockscout MCP + Web3.py
- **Transaction Parsing**: Extracts payment details from blockchain

#### **Knowledge Agent (Port 8006)**
- **MeTTa Loading**: Loads knowledge graph per token ID
- **Vector Search**: FAISS similarity search on embeddings
- **MeTTa Reasoning**: Executes `query` and `query-inverse` predicates
- **LLM Synthesis**: Generates natural language responses
- **Chat Protocol**: Implements ASI:One chat interface

#### **Blockscout MCP Integration**
- **Payment Context**: Fetches transaction and account data
- **Risk Analysis**: Blockchain data for payment validation
- **API Abstraction**: MCP protocol for agent communication
- **Hybrid Approach**: Combines MCP quick checks with Web3 deep validation

### **Payment Layer**

#### **EchoNFT Contract (ERC-721)**
- **Minting**: Creates unique Echo NFT with knowledge base
- **Credit System**: Users can purchase credits for unlimited queries
- **Purchase System**: Buy Echo NFT for permanent ownership
- **Protocol Fees**: Deducts fees on credit usage
- **Ownership**: Tracks who owns each Echo

#### **QueryPayments Contract**
- **Direct Payments**: Pay-per-query with PYUSD
- **Price Setting**: Creators set price per query
- **Protocol Fees**: Deducts fees on each payment
- **Instant Access**: No approval needed for one-time payments

#### **PayPal PYUSD**
- **Stable Currency**: Dollar-pegged stablecoin
- **ERC-20 Standard**: Compatible with all Ethereum tools
- **Cross-Chain**: Deployed on multiple chains
- **Bridge Support**: Move between chains easily

### **Knowledge Processing**

#### **Ingestion Pipeline**
1. **REBEL Model**: Extracts triples (subject, relation, object) from text
2. **MeTTa Builder**: Converts triples to MeTTa atoms
3. **Query Predicates**: Adds `query` and `query-inverse` rules
4. **FAISS Index**: Creates vector embeddings for semantic search
5. **Fact Mapping**: Maps facts to embeddings
6. **Storage**: Saves to `knowledge_bases/` directory

#### **Query Processing**
1. **Vector Search**: Find top K relevant facts via FAISS
2. **MeTTa Reasoning**: Execute queries on knowledge graph
3. **Structured Results**: Extract entity-relation-value tuples
4. **LLM Synthesis**: Generate natural language response
5. **Response Return**: Send answer to frontend

## 🔷 Data Flow

### **Echo Creation Flow**
```
Creator → Frontend → Backend API → File Storage
                     ↓
               Ingestion Script
                     ↓
            REBEL Triple Extraction
                     ↓
            MeTTa Knowledge Graph
                     ↓
            FAISS Vector Index
                     ↓
          knowledge_bases/ storage
                     ↓
              Smart Contract Mint
```

### **Query Flow (Owned Echo)**
```
User Query → ChatInterface → Backend → Orchestrator Agent
                                      ↓
                        Check is_owned = true
                                      ↓
                                  Skip Payment
                                      ↓
                            Knowledge Agent
                                      ↓
                      Load MeTTa Knowledge Graph
                                      ↓
                      Vector Search (FAISS)
                                      ↓
                      MeTTa Reasoning (Predicates)
                                      ↓
                            LLM Synthesis
                                      ↓
                              Return Answer
```

### **Query Flow (Paid Echo)**
```
User Query → ChatInterface → Backend → Orchestrator Agent
                                      ↓
                             Payment Agent
                                      ↓
                    Blockscout MCP (Quick Check)
                                      ↓
                     Web3.py (Deep Validation)
                                      ↓
                    Validate PYUSD Transfer
                                      ↓
                            Knowledge Agent
                                      ↓
                   (Same as Owned Echo Flow)
```

### **Payment Flow (PYUSD Credits)**
```
User → Frontend → EchoNFT Contract → approvePYUSD()
                                    ↓
                              useCreditsForQuery()
                                    ↓
                      Deduct Credits + Protocol Fee
                                    ↓
                             Approve Query Access
```

## 🔷 ASI Alliance Technologies

### **uAgents Framework**
- Lightweight agent framework from Fetch.ai
- Asynchronous message passing
- Agent registration on Agentverse
- Discoverable via ASI:One

### **MeTTa Knowledge Graphs**
- Structured symbolic reasoning
- Query predicates for dynamic queries
- Atom-based knowledge representation
- Memory-efficient graph storage

### **ASI:One LLM**
- Web3-native large language model
- Chat Protocol implementation
- Natural language understanding
- Agent-to-human communication

### **Agentverse**
- Agent marketplace and discovery
- Hosting and orchestration
- Agent metadata and capabilities
- Search and find agents

### **Blockscout MCP**
- Model Context Protocol server
- Blockchain data access for AI
- Payment validation integration
- Multi-chain support

## 🔷 Sponsor Integration Summary

### **ASI Alliance**
✅ **uAgents Framework**: 3 communicating agents  
✅ **MeTTa Reasoning**: Full knowledge graph + dynamic queries  
✅ **ASI:One Integration**: LLM + Chat Protocol  
✅ **Agentverse**: Registered and discoverable  
✅ **Multi-Agent System**: Orchestrated workflow  

### **PayPal PYUSD**
✅ **PYUSD Integration**: ERC-20 token payments  
✅ **Credit System**: Subscription-like model  
✅ **Purchase System**: One-time Echo purchases  
✅ **Payment Contracts**: Secure smart contracts  
✅ **Protocol Fees**: Revenue generation  

### **Blockscout**
✅ **MCP Integration**: Blockscout MCP server  
✅ **Hybrid Validation**: MCP + Web3 combination  
✅ **Payment Context**: Transaction analysis  
✅ **Agent Communication**: MCP protocol usage  

## 🔷 Key Differentiators

1. **Production-Ready**: Full payment flows, not just demos
2. **Multi-Sponsor**: Deeply integrates 3 major sponsors
3. **Real Use Case**: Solves actual knowledge monetization problem
4. **Superior UX**: Clean interface, intuitive workflows
5. **Technical Depth**: Advanced MeTTa reasoning + payment validation
6. **Scalable Architecture**: Microservices, modular design

---

**Built for ETHOnline 2025**  
