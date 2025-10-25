# EchoLink Architecture - Workflow-Based System Diagrams

## SYSTEM OVERVIEW
EchoLink is a decentralized knowledge marketplace integrating ASI Alliance (uAgents + MeTTa + ASI:One), PayPal PYUSD payments, and Blockscout MCP analytics. This document shows the complete workflows demonstrating how all components interact.

---

## WORKFLOW 1: CREATOR MINTS AN ECHO

### Scenario: Creator Uploads Knowledge and Mints Echo NFT

```
┌──────────────────────────────────────────────────────────────────┐
│                    CREATOR MINTS ECHO WORKFLOW                   │
└──────────────────────────────────────────────────────────────────┘

[Creator] → [CreatorStudio (Frontend)] → Step 1: Upload Knowledge File
              ↓
            [Express Backend] → Step 2: Store file in uploads/original-files/
              ↓
            [CreatorStudio UI] → Step 3: Configure Echo Details
                ├─ Name: "Xavier Biography"
                ├─ Description: "Life story of Xavier"
                ├─ Price per Query: 0.1 PYUSD
                ├─ Purchase Price: 50 PYUSD
                ├─ For Sale: Yes/No
                └─ Free Echo: Yes/No
              ↓
            [Backend triggers ingestion] → Step 4: Start Knowledge Processing
              ↓
            [Python ingest.py script] → Step 5: REBEL Model extracts triples
                ├─ Input: Uploaded file (PDF/video/text)
                └─ Output: Triples (subject, relation, object)
              ↓
            [MeTTa Builder] → Step 6: Convert triples to MeTTa atoms
                └─ Format: (relation subject object)
              ↓
            [FAISS Indexer] → Step 7: Create vector embeddings
                └─ Model: all-MiniLM-L6-v2
              ↓
            [knowledge_bases/ storage] → Step 8: Save knowledge files
                ├─ fact_index_{tokenId}.faiss
                ├─ fact_mapping_{tokenId}.json
                └─ knowledge_base_{tokenId}.db
              ↓
            [Wallet Connection] → Step 9: Creator connects wallet
              ↓
            [EchoNFT Contract] → Step 10: Call mintEcho(tokenId, ...)
                ├─ Validates inputs
                ├─ Mints ERC-721 NFT
                └─ Stores Echo data on-chain
              ↓
            [Blockchain Network] → Step 11: Transaction confirmed
              ↓
            [EchoGallery (Frontend)] → Step 12: Echo appears in marketplace
                └─ ✅ Echo Successfully Created

COMPONENTS USED:
✓ Frontend: CreatorStudio, Wallet Connection
✓ Backend: Express.js, File Storage
✓ Knowledge Processing: REBEL Model, MeTTa, FAISS
✓ Smart Contract: EchoNFT (ERC-721)
✓ Blockchain: Base Sepolia
```

---

## WORKFLOW 2: USER QUERIES OWNED ECHO

### Scenario: User Queries an Echo They Own (Unlimited Access)

```
┌──────────────────────────────────────────────────────────────────┐
│              QUERY OWNED ECHO WORKFLOW                           │
└──────────────────────────────────────────────────────────────────┘

[User] → [ChatInterface (Frontend)] → Step 1: Open owned Echo
              ↓
            [Check ownership status] → Step 2: Frontend detects ownership
              ↓
            [Display "Unlimited Access"] → Step 3: Show special UI
                ├─ Hide payment method selector
                ├─ Show "Your Echo" badge
                └─ Button: "Send (Unlimited Access)"
              ↓
            [User sends query] → Step 4: Types query and clicks send
              ↓
            [POST /query endpoint] → Step 5: Frontend sends request
                Body: { query, token_id, is_owned: true }
              ↓
            [Express Backend] → Step 6: Receives request
              ↓
            [Orchestrator Agent (Port 8004)] → Step 7: Routes query
                ├─ Checks is_owned flag
                ├─ Decision: Skip payment validation
                └─ Route: Directly to Knowledge Agent
              ↓
            [Knowledge Agent (Port 8006)] → Step 8: Start knowledge processing
              ↓
            [Load MeTTa Knowledge Graph] → Step 9: Load for token_id
                File: knowledge_bases/knowledge_base_{tokenId}.db
              ↓
            [FAISS Vector Search] → Step 10: Find relevant facts
                ├─ Query: User's question
                ├─ Search: Similarity search in fact_index_{tokenId}.faiss
                └─ Results: Top 5 similar facts
              ↓
            [MeTTa Reasoning] → Step 11: Execute query predicates
                ├─ Extract entities from triples
                ├─ Query: !(query relation entity)
                ├─ Query-inverse: !(query-inverse relation entity)
                └─ Results: Structured entity-relation-value tuples
              ↓
            [ASI:One LLM] → Step 12: Synthesize natural language response
                ├─ Input: Facts + MeTTa results
                ├─ Prompt: Optimized synthesis prompt
                └─ Output: Natural language answer
              ↓
            [Response flows back] → Step 13: Return complete answer
                Knowledge Agent → Orchestrator → Backend → Frontend
              ↓
            [ChatInterface displays answer] → Step 14: User sees response
                └─ ✅ Query Completed - Unlimited Access

COMPONENTS USED:
✓ Frontend: ChatInterface
✓ Backend: Express.js /query endpoint
✓ Agents: Orchestrator Agent, Knowledge Agent
✓ Knowledge: MeTTa Graph, FAISS Index, Knowledge Storage
✓ LLM: ASI:One
✓ Smart Contract: (Not used - ownership bypass)
```

---

## WORKFLOW 3: USER QUERIES PAID ECHO (Credits)

### Scenario: User Pays with Credits to Query Echo

```
┌──────────────────────────────────────────────────────────────────┐
│           QUERY PAID ECHO WORKFLOW (CREDITS)                     │
└──────────────────────────────────────────────────────────────────┘

[User] → [ChatInterface] → Step 1: Open non-owned Echo
              ↓
            [Payment Method Selector] → Step 2: User selects "Credits"
              ↓
            [Check credit balance] → Step 3: Frontend displays balance
                Example: "You have 100 credits"
              ↓
            [User clicks "Send (10 credits)"] → Step 4: Initiate query
              ↓
            [Wallet Connection] → Step 5: Submit payment transaction
              ↓
            [EchoNFT Contract] → Step 6: Call useCreditsForQuery(tokenId, credits)
                ├─ Validates user has enough credits
                ├─ Deducts credits from balance
                ├─ Deducts protocol fee (5%)
                ├─ Emits CreditsUsed event
                └─ Returns transaction hash
              ↓
            [Blockchain Network] → Step 7: Transaction confirmed
              ↓
            [Frontend receives tx_hash] → Step 8: Payment confirmed
              ↓
            [POST /query endpoint] → Step 9: Send query with payment
                Body: { query, token_id, payment_tx_hash, use_credits: true }
              ↓
            [Express Backend] → Step 10: Receive query request
              ↓
            [Orchestrator Agent] → Step 11: Route to payment validation
                ├─ Checks is_owned: false
                └─ Route: Payment Agent
              ↓
            [Payment Agent (Port 8005)] → Step 12: Validate payment
                ├─ Load payment transaction from blockchain (Web3.py)
                ├─ Check: Transaction exists
                ├─ Check: Transaction confirmed
                ├─ Check: Correct amount
                ├─ Check: Correct sender
                ├─ Check: CreditsUsed event emitted
                └─ Result: Validation confirmed
              ↓
            [Orchestrator Agent] → Step 13: Payment validated, proceed
              ↓
            [Knowledge Agent] → Step 14: Process query
                ├─ Load MeTTa graph
                ├─ Vector search
                ├─ MeTTa reasoning
                └─ LLM synthesis
              ↓
            [Response returned] → Step 15: Complete answer to user
                └─ ✅ Query Completed - Credits Deducted

COMPONENTS USED:
✓ Frontend: ChatInterface, Wallet Connection
✓ Backend: Express.js
✓ Agents: Orchestrator Agent, Payment Agent, Knowledge Agent
✓ Smart Contract: EchoNFT (useCreditsForQuery)
✓ Blockchain: Web3.py validation
✓ Knowledge Processing: MeTTa, FAISS, ASI:One LLM
```

---

## WORKFLOW 4: USER BUYS AN ECHO NFT

### Scenario: User Purchases Entire Echo NFT

```
┌──────────────────────────────────────────────────────────────────┐
│              PURCHASE ECHO WORKFLOW                              │
└──────────────────────────────────────────────────────────────────┘

[User] → [EchoGallery] → Step 1: Browse marketplace
              ↓
            [View Echo details] → Step 2: Find Echo to purchase
              ↓
            [Click "Buy Echo" button] → Step 3: Initiate purchase
              ↓
            [Check PYUSD balance] → Step 4: Verify sufficient funds
                Example: "You have 60 PYUSD, Echo costs 50 PYUSD"
              ↓
            [Approve PYUSD spending] → Step 5: Frontend calls approve()
                ├─ Spender: EchoNFT contract address
                ├─ Amount: purchase_price (e.g., 50 PYUSD)
                └─ Token: PYUSD ERC-20
              ↓
            [PYUSD Token Contract] → Step 6: Approve transaction
                └─ Blockchain: Transaction confirmed
              ↓
            [Frontend detects approval] → Step 7: Approval confirmed
              ↓
            [Refetch allowance] → Step 8: Verify approval
              ↓
            [Call buyEcho(tokenId)] → Step 9: Submit purchase
              ↓
            [EchoNFT Contract] → Step 10: Execute purchase
                ├─ Check: Echo is for sale
                ├─ Check: Not already owned
                ├─ Check: User has PYUSD allowance
                ├─ Transfer: PYUSD from user to contract
                ├─ Update: echoOwners[tokenId] = buyer
                ├─ Update: userOwnedEchos[buyer].push(tokenId)
                ├─ Emit: EchoPurchased event
                └─ Return: Success
              ↓
            [Blockchain confirmation] → Step 11: Transaction confirmed
              ↓
            [Frontend updates UI] → Step 12: Show ownership
                ├─ Display "You Own This" badge
                ├─ Enable "Chat (Unlimited)" button
                └─ Hide "Buy Echo" button
              ↓
            [MyEchos page] → Step 13: Echo appears in owned list
                └─ ✅ Echo Successfully Purchased - Unlimited Access

COMPONENTS USED:
✓ Frontend: EchoGallery, Wallet Connection
✓ Smart Contracts: PYUSD Token (approve), EchoNFT (buyEcho)
✓ Blockchain: Base Sepolia
✓ UI Updates: Real-time ownership status
```

---

## WORKFLOW 5: AI ANALYTICS WITH BLOCKSCOUT MCP

### Scenario: User Asks AI Analyst About Echo Performance

```
┌──────────────────────────────────────────────────────────────────┐
│           AI ANALYTICS WORKFLOW (BLOCKSCOUT MCP)                 │
└──────────────────────────────────────────────────────────────────┘

[User] → [AI Analyst Chatbot] → Step 1: User asks question
              Example: "What's the highest performing Echo?"
              ↓
            [POST /ask endpoint] → Step 2: Send analytics request
                Body: { question, connectedAddress }
              ↓
            [Express Backend] → Step 3: Receive request
              ↓
            [ASI:One LLM] → Step 4: Bind Blockscout MCP tools
                ├─ Tool: get_address_info
                ├─ Tool: get_token_transfers_by_address
                ├─ Tool: read_contract
                ├─ Tool: get_transaction_logs
                └─ Tool: get_address_by_ens_name
              ↓
            [LLM analyzes question] → Step 5: Decide which tools to use
                ├─ Reads system prompt
                ├─ Understands EchoLink context
                └─ Plans tool usage strategy
              ↓
            [LLM calls Blockscout MCP tools] → Step 6: Execute tools
                Example:
                ├─ read_contract(ECHO_NFT_ADDRESS, "getTotalEchoes")
                ├─ read_contract(ECHO_NFT_ADDRESS, "getEchoData", tokenId)
                └─ get_address_info(creator_addresses)
              ↓
            [Blockscout MCP Server] → Step 7: Query blockchain
                ├─ Endpoint: http://localhost:8080/v1/
                └─ Tools: MCP protocol
              ↓
            [Blockchain Network] → Step 8: Return on-chain data
                ├─ Contract state
                ├─ Transaction history
                └─ Address information
              ↓
            [MCP Server returns data] → Step 9: Structured data to LLM
              ↓
            [LLM processes data] → Step 10: Analyze and compute
                ├─ Count total Echos
                ├─ Iterate through token IDs
                ├─ Get creator addresses
                ├─ Check transaction activity
                └─ Rank by performance
              ↓
            [LLM generates insights] → Step 11: Create response
                ├─ Natural language analysis
                ├─ Charts/visualizations (JSON)
                └─ Professional report
              ↓
            [Backend returns answer] → Step 12: Complete response
              ↓
            [Frontend displays answer] → Step 13: Show insights
                ├─ Text analysis
                └─ Charts/graphs
              ↓
            [User sees results] → Step 14: Analytics complete
                └─ ✅ AI Analysis Complete

COMPONENTS USED:
✓ Frontend: AI Analyst Chatbot
✓ Backend: Express.js /ask endpoint
✓ LLM: ASI:One with Blockscout MCP tools
✓ MCP Server: Blockscout MCP (Port 8080)
✓ Blockchain: Multi-chain data access
✓ Note: NOT used for payment validation - only analytics
```

---

## WORKFLOW 6: PURCHASE CREDITS

### Scenario: User Buys Credits for Queries

```
┌──────────────────────────────────────────────────────────────────┐
│              PURCHASE CREDITS WORKFLOW                           │
└──────────────────────────────────────────────────────────────────┘

[User] → [CreditManager (Frontend)] → Step 1: Open credit page
              ↓
            [View current balance] → Step 2: Check credits
                Example: "You have 50 credits"
              ↓
            [Enter purchase amount] → Step 3: User inputs amount
                Example: "100 credits = 10 PYUSD"
              ↓
            [Check PYUSD balance] → Step 4: Frontend verifies
                Example: "Balance: 15 PYUSD (Sufficient)"
              ↓
            [Click "Purchase Credits"] → Step 5: Initiate purchase
              ↓
            [Check PYUSD allowance] → Step 6: Frontend checks
                ├─ Allowance sufficient? No
                └─ Need approval: Yes
              ↓
            [Approve PYUSD] → Step 7: Frontend calls approve()
                ├─ Spender: EchoNFT contract
                ├─ Amount: credits * 0.1 PYUSD
                └─ Submit transaction
              ↓
            [PYUSD Token Contract] → Step 8: Approve transaction
                └─ Blockchain confirmation
              ↓
            [Frontend detects approval] → Step 9: Approval confirmed
              ↓
            [Refetch allowance] → Step 10: Verify approval
              ↓
            [Call purchaseCredits(amount)] → Step 11: Submit purchase
              ↓
            [EchoNFT Contract] → Step 12: Execute credit purchase
                ├─ Transfer: PYUSD from user to contract
                ├─ Mint: Add credits to userCredits[user]
                ├─ Update: credit balance
                ├─ Emit: CreditsPurchased event
                └─ Return: Success
              ↓
            [Blockchain confirmation] → Step 13: Transaction confirmed
              ↓
            [Frontend refreshes] → Step 14: Update UI
                ├─ Display new credit balance
                └─ Show success message
              ↓
            [User can now use credits] → Step 15: Credits available
                └─ ✅ Credits Successfully Purchased

COMPONENTS USED:
✓ Frontend: CreditManager, Wallet Connection
✓ Smart Contracts: PYUSD Token (approve), EchoNFT (purchaseCredits)
✓ Blockchain: Base Sepolia
✓ UI: Real-time balance updates
```

---

## INTEGRATION OVERVIEW

### ASI Alliance Integration
- **uAgents Framework**: 3 agents (Orchestrator, Payment, Knowledge)
- **MeTTa Reasoning**: Full knowledge graph with query predicates
- **ASI:One LLM**: Natural language understanding and synthesis
- **Agentverse**: Registered and discoverable agents
- **Chat Protocol**: Implemented in Knowledge Agent

### PayPal PYUSD Integration
- **Credit System**: Buy credits, use for queries
- **Direct Payments**: Pay-per-query with PYUSD
- **Purchase System**: Buy entire Echo NFT
- **Protocol Fees**: 5% on all transactions
- **Smart Contracts**: EchoNFT and QueryPayments

### Blockscout MCP Integration
- **AI Analytics**: Answer questions about blockchain data
- **MCP Tools**: read_contract, get_address_info, etc.
- **NOT used for payment validation**: Only for AI analyst endpoint
- **Usage**: AI Analyst chatbot queries on-chain data

---

## KEY SYSTEM FEATURES

### 1. Multi-Agent Orchestration
- Orchestrator coordinates workflow
- Payment Agent validates transactions
- Knowledge Agent processes queries
- Agent-to-agent messaging

### 2. Flexible Payment Options
- Credits: Subscription-like model
- Direct PYUSD: Pay per query
- Purchase: Own entire Echo
- Free Echos: Optional free access

### 3. Advanced Knowledge Processing
- REBEL extracts structured knowledge
- MeTTa enables symbolic reasoning
- FAISS provides semantic search
- ASI:One synthesizes responses

### 4. Ownership-Based Access
- Owned Echos: Unlimited queries
- Paid Echos: Payment per query
- Free Echos: No payment required

---

**Built for ETHOnline 2025**  