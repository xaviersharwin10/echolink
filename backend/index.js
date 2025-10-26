import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// --- CONFIGURATION ---
const app = express();
const PORT = 3001;
const MCP_API_BASE_URL = 'http://0.0.0.0:8080/v1'; 

// --- LLM SETUP ---
// Using ASI:One LLM
const llm = new ChatOpenAI({
  model: "asi1-mini",
  apiKey: "", //Add your ASI:One API key
  configuration: {
    baseURL: "https://api.asi1.ai/v1",
    defaultHeaders: { "X-Title": "EchoLink Protocol" }
  },
});

const ECHO_NFT_ADDRESS = '0x39bc7190911b9334560ADfEf4100f1bE515fa3e1';
const QUERY_PAYMENTS_ADDRESS = '0xFf08e351Bf16fE0703108cf9B4AeDe3a16fd0a46'; 
const PYUSD_ADDRESS = '0xCaC524BcA292aaade2df8a05cC58F0a65B1B3bB9'; 
const CHAIN_ID = '11155111'; // Sepolia Chain ID

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- CONTENT STORAGE ---
// File system storage for Echo content
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const CONTENT_DIR = path.join(UPLOADS_DIR, 'content');
const ORIGINAL_FILES_DIR = path.join(UPLOADS_DIR, 'original-files');

// Ensure directories exist
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(CONTENT_DIR)) {
  fs.mkdirSync(CONTENT_DIR, { recursive: true });
}
if (!fs.existsSync(ORIGINAL_FILES_DIR)) {
  fs.mkdirSync(ORIGINAL_FILES_DIR, { recursive: true });
}

console.log('📁 Storage directories initialized:', { UPLOADS_DIR, CONTENT_DIR, ORIGINAL_FILES_DIR });

// =======================================================
// === THE BLOCKSCOUT MCP TOOLBOX ===
// =======================================================
// Binding a comprehensive set of Blockscout MCP tools for the LLM agent
const llmWithTools = llm.bindTools([
  {
    name: "get_address_info",
    description: "Gets a general summary of a wallet address, including native currency balance and transaction count.",
    schema: {
        type: "object",
        properties: {
          chain_id: { type: "string", description: "The chain ID (e.g., '11155111' for Sepolia)." },
          address: { type: "string", description: "The wallet address (e.g., 0x...)." },
        },
        required: ["chain_id", "address"],
    },
  },
  {
    name: "get_token_transfers_by_address",
    description: "Returns a list of all ERC-20 token movements (transfers, receives) involving a specific address. CRITICAL for tracing PYUSD payments and creator earnings.",
    schema: {
        type: "object",
        properties: {
          chain_id: { type: "string", description: "The chain ID." },
          address: { type: "string", description: "The wallet address to query (user, creator, or contract)." },
          token: { type: "string", description: "Optional. Filter by a specific token contract address, e.g., the PYUSD address." },
        },
        required: ["chain_id", "address"],
    },
  },
  {
    name: "get_transaction_logs",
    description: "Returns the detailed event logs for a specific transaction hash. Use this to decode custom EchoLink payment events (QueryPaid, CreditsUsed) and verify flow.",
    schema: {
        type: "object",
        properties: {
          chain_id: { type: "string", description: "The chain ID." },
          transaction_hash: { type: "string", description: "The hash of the transaction." },
        },
        required: ["chain_id", "transaction_hash"],
    },
  },
  {
    name: "read_contract",
    description: "Executes a read-only, view function on a smart contract. Requires a JSON-encoded function ABI fragment.",
    schema: {
        type: "object",
        properties: {
          chain_id: { type: "string", description: "The chain ID." },
          address: { type: "string", description: "The smart contract address." },
          function_name: { type: "string", description: "Name of the function to call (e.g., 'ownerOf')." },
          abi: { type: "string", description: "REQUIRED: JSON-encoded single function ABI fragment. Use get_contract_abi first to find this." },
          args: { type: "string", description: "JSON-encoded array of function arguments (e.g., '[1]')." },
        },
        required: ["chain_id", "address", "function_name", "abi"],
    },
  },
  {
    name: "get_contract_abi",
    description: "Retrieves the full ABI (Application Binary Interface) for a smart contract. Use this to find the function signature needed for the 'read_contract' tool.",
    schema: {
        type: "object",
        properties: {
          chain_id: { type: "string", description: "The chain ID." },
          address: { type: "string", description: "The smart contract address." },
        },
        required: ["chain_id", "address"],
    },
  },
  {
    name: "get_address_by_ens_name",
    description: "Converts an ENS domain name (like 'vitalik.eth') to its hexadecimal Ethereum address.",
    schema: {
        type: "object",
        properties: { name: { type: "string", description: "The ENS domain name." } },
        required: ["name"],
    },
  },
]);


// =======================================================
// === HELPER FUNCTION: LOCAL MCP SERVER CALL ===
// =======================================================
async function callMcpTool(toolName, params) {
    if (toolName === 'get_address_by_ens_name') {
        params.chain_id = '1'; // Standard ENS resolution is on Mainnet
    } else if (!params.chain_id) {
        params.chain_id = CHAIN_ID; // Default to Sepolia
    }

    const query = new URLSearchParams(params).toString();
    console.log(`--- Calling Local MCP Server Tool: ${toolName} with params: ${query} ---`);
    
    try {
      const response = await fetch(`${MCP_API_BASE_URL}/${toolName}?${query}`);
      if (!response.ok) {
        const errorText = await response.text();
        // Return a structured error response for the LLM to process
        return JSON.stringify({ error: `MCP server error: ${response.statusText}`, details: errorText }); 
      }
      const data = await response.json();
      console.log('--- Received response from MCP Server ---');
      return JSON.stringify(data.data); 
    } catch (error) {
      console.error('Error calling MCP Server:', error);
      return JSON.stringify({ error: `Tool call failed: ${error.message}` });
    }
}


// =======================================================
// === API ENDPOINT: AI ANALYST CHAT ===
// =======================================================
app.post('/ask', async (req, res) => {
  const { question, connectedAddress } = req.body;
  if (!question) return res.status(400).json({ error: 'Question is required' });

  console.log(`Received question: "${question}" for address: ${connectedAddress}`);

  // ABI for getting total number of Echos
  const GET_ALL_TOKEN_IDS_ABI = JSON.stringify({
    "inputs": [],
    "name": "getAllTokenIds",
    "outputs": [
      { "internalType": "uint256[]", "name": "", "type": "uint256[]" }
    ],
    "stateMutability": "view",
    "type": "function"
  });

  // ABI for reading a single Echo's data
  const GET_ECHO_DATA_ABI = JSON.stringify({
    "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
    "name": "getEchoData",
    "outputs": [
      { "internalType": "string", "name": "name", "type": "string" },
      { "internalType": "string", "name": "description", "type": "string" },
      { "internalType": "address", "name": "creator", "type": "address" },
      { "internalType": "uint256", "name": "pricePerQuery", "type": "uint256" },
      { "internalType": "uint256", "name": "purchasePrice", "type": "uint256" },
      { "internalType": "bool", "name": "isActive", "type": "bool" },
      { "internalType": "bool", "name": "isForSale", "type": "bool" },
      { "internalType": "address", "name": "owner", "type": "address" }
    ],
    "stateMutability": "view",
    "type": "function"
  });

  // --- THE SUPER PROMPT ---
  const systemPromptContent = `You are 'Echo Analyst', a master on-chain analyst for the EchoLink Protocol. Your goal is to provide rich, insightful, and sometimes visual answers using your Blockscout MCP tools.

      **ECHO LINK CONTEXT & KEY ADDRESSES:**
      - The user is operating within the EchoLink NFT marketplace.
      - User's Connected Wallet: **${connectedAddress || 'Not Connected'}** (Referenced as 'my wallet' or 'I').
      - Network Chain ID: **${CHAIN_ID}** (Sepolia).
      - Query Payments Contract: **${QUERY_PAYMENTS_ADDRESS}** (Processes direct payments).
      - EchoLink NFT Contract (Contains Echo metadata and Tracks Echos, Token ID ownership, and Credits)., function names: getAllTokenIds, getEchoData): **${ECHO_NFT_ADDRESS}**
      - PYUSD Token Contract: **${PYUSD_ADDRESS}** (The asset of interest for all payments).
      
      **CRITICAL DATA CONVERSION PROTOCOL (MANDATORY):**
      - **PYUSD Value:** PYUSD has 6 decimal places. The raw unit returned by contracts MUST be divided by **1,000,000 (10^6)** to get the final dollar amount.
      - **Protocol Fee:** The net amount earned by the creator is **95%** of the gross payment (5% protocol fee).
      
      **CRITICAL INSTRUCTION:** For the most accurate financial data (earnings, payments), **always prioritize the 'get_token_transfers_by_address' tool, filtering by the PYUSD address.**
      - getAllTokenIds() ABI (to get all minted IDs): ${GET_ALL_TOKEN_IDS_ABI}
      - getEchoData() ABI (to get specific Echo details): ${GET_ECHO_DATA_ABI}
      
      **CRITICAL INSTRUCTION:** For the key contract addresses above, you MUST use the provided hexadecimal addresses directly.
      --- START INTERNAL PLANNING MANDATE (DO NOT OUTPUT THIS CONTENT) ---

      **INTERNAL REASONING STEPS:**
      1.  **Intent Check:** Determine the user's primary goal (e.g., "popular echo", "my balance", "trace flow", "profitability of creator").
      2.  **Popularity/Ranking (DYNAMIC DATA):** If asked about ranking, or creator earnings, you MUST perform a multi-step query:
          * Step 1: Execute \`read_contract\` on **EchoLink NFT Contract** to fetch all existing Token IDs (using the \`getAllTokenIds\` function).
          * Step 2: Iterate through the returned Token IDs. For each ID, call \`read_contract\` for the creator's address (using the \`getEchoData\` function).
          * **Step 3: Analyze each creator address by calling \`get_token_transfers_by_address\` (filtered by PYUSD and network ID) to calculate and rank total financial earnings.**
      3.  **Name-to-ID Lookup (CRITICAL FIRST STEP):** If the user provides an Echo Name (e.g., "Xavier - The biography") instead of an ID, you MUST first call \`read_contract\` on the \`EchoLink NFT Contract\` using the **getAllTokenIds() ABI** to fetch all existing Token IDs. Then, for each ID, call \`read_contract\` with the **getEchoData() ABI** to fetch its name and internally find the corresponding \`tokenId\`. Only then can you proceed with the analysis using the ID.
      4.  **Contract Status:** If asked about specific Echo data, use the \`read_contract\` tool on the \`EchoLink NFT Contract\` with the **getEchoData() ABI**.
      4.  **Flow Tracing:** If asked about payments or flow, use \`get_token_transfers_by_address\` filtering by PYUSD. For detailed event verification (e.g., CreditsUsed event), use \`get_transaction_logs\`.
      5.  **Final Synthesis:** Synthesize all verified data into a professional, direct report, applying the **CRITICAL DATA CONVERSION PROTOCOL** and adhering to the **FINAL OUTPUT MANDATE**.

      --- END INTERNAL PLANNING MANDATE ---

      **FINAL OUTPUT MANDATE:** Your response must be a synthesized, polite, and professional report, **using bold Markdown for key metrics and rankings**. For any data suitable for comparison (balances, transactions), you **MUST** output a simplified \`[CHART_DATA]\` JSON structure containing \`type\`, \`labels\`, and \`data\` arrays. You MUST NOT mention the names of the tools you use, the reasoning steps, or any internal planning.
      **Provide Visual Data When Logical:** For any question that involves comparing 2 or more items (e.g., transaction counts, token balances, creator revenue), you MUST format the data for a chart. To do this, embed a special JSON block in your answer like this:
        \`\`\`
        [CHART_DATA]
        {
          "type": "bar",
          "title": "Echo Creator Revenue Ranking",
          "labels": ["Echo ID 10", "Echo ID 5"],
          "data": [1250.75, 800.20]
        }
        [/CHART_DATA]
        \`\`\`
      Combine your text analysis and your chart data into a single, comprehensive Markdown response.

      Begin your comprehensive analysis for the user's request: "${question}"`;
  
  const messages = [new HumanMessage({ content: systemPromptContent })];

  try {
    let response = await llmWithTools.invoke(messages);
    let conversationHistory = [...messages, response];

    while (response.tool_calls && response.tool_calls.length > 0) {
      const toolMessagePromises = response.tool_calls.map(async (toolCall) => {
        // // Find the correct ABI if the LLM is calling 'read_contract'
        // if (toolCall.name === 'read_contract') {
        //      // In a real advanced app, the LLM would call get_contract_abi, 
        //      // but here we demonstrate the logic by using pre-defined ABIs based on the function name.
        //      // This is done to prevent excessive tool calls in a hackathon demo.
        //     if (toolCall.args.function_name === 'getAllTokenIds') {
        //         toolCall.args.abi = GET_ALL_TOKEN_IDS_ABI;
        //     } else if (toolCall.args.function_name === 'getEchoData') {
        //         toolCall.args.abi = GET_ECHO_DATA_ABI;
        //     } else {
        //         console.warn(`Attempted to call unknown read_contract function: ${toolCall.args.function_name}`);
        //     }
        // }
        
        const toolResponse = await callMcpTool(toolCall.name, toolCall.args);
        return new ToolMessage({
          content: toolResponse,
          tool_call_id: toolCall.id,
        });
      });

      const toolMessages = await Promise.all(toolMessagePromises);
      conversationHistory.push(...toolMessages);
      
      console.log(`Sending ${toolMessages.length} tool response(s) back to LLM...`);
      response = await llmWithTools.invoke(conversationHistory);
      conversationHistory.push(response);
    }
    
    return res.json({ answer: response.content });
  } catch (error) {
    console.error('Error in AI flow:', error);
    res.status(500).json({ error: 'Failed to process the AI request due to an internal system error.' });
  }
});

// --- MULTI-AGENT SYSTEM INTEGRATION ---
app.post('/query', async (req, res) => {
  const { query, token_id, payment_tx_hash, user_address, use_credits, is_owned } = req.body;
  
  // For owned Echos, payment_tx_hash is not required
  if (!query || !user_address) {
    return res.status(400).json({ 
      error: 'Missing required fields: query, user_address' 
    });
  }

  // For non-owned Echos, payment_tx_hash is required
  if (!is_owned && !payment_tx_hash) {
    return res.status(400).json({ 
      error: 'Missing required field: payment_tx_hash' 
    });
  }

  console.log(`🎭 Multi-Agent Query: "${query}" for user: ${user_address}`);
  if (is_owned) {
    console.log(`👑 Owned Echo - No payment required`);
  } else {
    console.log(`💳 Payment TX: ${payment_tx_hash} (${use_credits ? 'Credits' : 'Direct'})`);
  }

  try {
    // Call the Orchestrator Agent directly and wait for the complete response
    console.log('🎭 Calling orchestrator agent directly...');
    const orchestratorResponse = await axios.post('http://localhost:8004/query', {
      query,
      token_id,
      payment_tx_hash: is_owned ? null : payment_tx_hash, // Pass null for owned Echos
      user_address,
      use_credits: use_credits || false,
      is_owned: is_owned || false
    });

    console.log('✅ Orchestrator response:', orchestratorResponse.data);
    
    // The orchestrator should now return the complete result directly
    if (orchestratorResponse.data.success) {
      return res.json(orchestratorResponse.data);
    } else {
      return res.status(500).json({
        success: false,
        error: orchestratorResponse.data.error || 'Query processing failed',
        answer: ''
      });
    }

  } catch (error) {
    console.error('❌ Multi-agent query failed:', error);
    
    if (error.response) {
      return res.status(error.response.status).json({
        success: false,
        error: error.response.data.error || 'Multi-agent system error',
        answer: ''
      });
    } else {
      return res.status(500).json({
        success: false,
        error: 'Failed to connect to multi-agent system',
        answer: ''
      });
    }
  }
});


// --- CONTENT STORAGE ENDPOINTS ---

// Store Echo content
app.post('/store-content', (req, res) => {
  try {
    const { tokenId, name, description, knowledgeBase, metadata, creator, isOwned, originalFile } = req.body;
    
    console.log(`📦 Backend: Storing content for token ID: ${tokenId}`);
    console.log(`📦 Backend: Content data:`, { tokenId, name, description: description?.substring(0, 50) + '...', hasKnowledgeBase: !!knowledgeBase, hasOriginalFile: !!originalFile });
    
    const content = {
      tokenId,
      name,
      description,
      knowledgeBase,
      metadata,
      creator,
      isOwned: isOwned || false,
      createdAt: new Date().toISOString()
    };
    
    // Store content as JSON file
    const contentFilePath = path.join(CONTENT_DIR, `${tokenId}.json`);
    fs.writeFileSync(contentFilePath, JSON.stringify(content, null, 2));
    console.log(`📦 Backend: Content stored in file: ${contentFilePath}`);
    
    // Store original file if provided
    if (originalFile) {
      const fileExtension = path.extname(originalFile.fileName) || '.bin';
      const originalFilePath = path.join(ORIGINAL_FILES_DIR, `${tokenId}${fileExtension}`);
      
      // Convert base64 to buffer and write to file
      const fileBuffer = Buffer.from(originalFile.data, 'base64');
      fs.writeFileSync(originalFilePath, fileBuffer);
      
      console.log(`📁 Backend: Stored original file for Echo #${tokenId} at: ${originalFilePath}`);
    }
    
    console.log(`✅ Backend: Successfully stored content for Echo #${tokenId}`);
    
    res.json({ success: true, message: 'Content stored successfully' });
  } catch (error) {
    console.error('Error storing content:', error);
    res.status(500).json({ error: 'Failed to store content' });
  }
});

// Get Echo content by token ID
app.get('/get-content/:tokenId', (req, res) => {
  try {
    const tokenId = parseInt(req.params.tokenId);
    console.log(`🔍 Backend: Getting content for token ID: ${tokenId}`);
    
    const contentFilePath = path.join(CONTENT_DIR, `${tokenId}.json`);
    console.log(`📁 Backend: Looking for content file: ${contentFilePath}`);
    
    if (!fs.existsSync(contentFilePath)) {
      console.log(`❌ Backend: Content file not found: ${contentFilePath}`);
      return res.status(404).json({ error: 'Content not found' });
    }
    
    const contentData = fs.readFileSync(contentFilePath, 'utf8');
    const content = JSON.parse(contentData);
    
    console.log(`✅ Backend: Retrieved content from file for token ID: ${tokenId}`);
    res.json(content);
  } catch (error) {
    console.error('Error fetching content:', error);
    res.status(500).json({ error: 'Failed to fetch content' });
  }
});

// Get original file by token ID
app.get('/get-original-file/:tokenId', (req, res) => {
  try {
    const tokenId = parseInt(req.params.tokenId);
    console.log(`🔍 Backend: Getting original file for token ID: ${tokenId}`);
    
    // Look for the original file in the original-files directory
    const originalFilesDir = path.join(ORIGINAL_FILES_DIR);
    const files = fs.readdirSync(originalFilesDir);
    const originalFile = files.find(file => file.startsWith(`${tokenId}.`));
    
    if (!originalFile) {
      console.log(`❌ Backend: Original file not found for token ID: ${tokenId}`);
      return res.status(404).json({ error: 'Original file not found' });
    }
    
    const originalFilePath = path.join(ORIGINAL_FILES_DIR, originalFile);
    console.log(`📁 Backend: Serving original file: ${originalFilePath}`);
    
    // Get file extension to determine content type
    const fileExtension = path.extname(originalFile).toLowerCase();
    let contentType = 'application/octet-stream';
    
    const contentTypeMap = {
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };
    
    contentType = contentTypeMap[fileExtension] || 'application/octet-stream';
    
    // Set appropriate headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${originalFile}"`);
    
    // Send the file
    res.sendFile(originalFilePath);
    console.log(`✅ Backend: Served original file for token ID: ${tokenId}`);
  } catch (error) {
    console.error('Error fetching original file:', error);
    res.status(500).json({ error: 'Failed to fetch original file' });
  }
});

// Get all Echo content
app.get('/get-all-content', (req, res) => {
  try {
    console.log(`🔍 Backend: Getting all content from directory: ${CONTENT_DIR}`);
    
    const files = fs.readdirSync(CONTENT_DIR);
    const allContent = [];
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(CONTENT_DIR, file);
        const contentData = fs.readFileSync(filePath, 'utf8');
        const content = JSON.parse(contentData);
        allContent.push(content);
      }
    }
    
    console.log(`✅ Backend: Retrieved ${allContent.length} content items`);
    res.json(allContent);
  } catch (error) {
    console.error('Error fetching all content:', error);
    res.status(500).json({ error: 'Failed to fetch all content' });
  }
});

// Update ownership status
app.post('/update-ownership', (req, res) => {
  try {
    const { tokenId, isOwned } = req.body;
    console.log(`👑 Backend: Updating ownership for token ID: ${tokenId} to ${isOwned}`);
    
    const contentFilePath = path.join(CONTENT_DIR, `${tokenId}.json`);
    
    if (!fs.existsSync(contentFilePath)) {
      console.log(`❌ Backend: Content file not found: ${contentFilePath}`);
      return res.status(404).json({ error: 'Content not found' });
    }
    
    const contentData = fs.readFileSync(contentFilePath, 'utf8');
    const content = JSON.parse(contentData);
    
    content.isOwned = isOwned;
    content.updatedAt = new Date().toISOString();
    
    fs.writeFileSync(contentFilePath, JSON.stringify(content, null, 2));
    
    console.log(`✅ Backend: Updated ownership for Echo #${tokenId}: ${isOwned ? 'Owned' : 'Not owned'}`);
    res.json({ success: true, message: 'Ownership updated successfully' });
  } catch (error) {
    console.error('Error updating ownership:', error);
    res.status(500).json({ error: 'Failed to update ownership' });
  }
});

// Get owned content for a user
app.get('/get-owned-content/:userAddress', (req, res) => {
  try {
    const userAddress = req.params.userAddress;
    console.log(`🔍 Backend: Getting owned content for user: ${userAddress}`);
    
    const files = fs.readdirSync(CONTENT_DIR);
    const ownedContent = [];
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(CONTENT_DIR, file);
        const contentData = fs.readFileSync(filePath, 'utf8');
        const content = JSON.parse(contentData);
        
        if (content.isOwned) {
          ownedContent.push(content);
        }
      }
    }
    
    console.log(`✅ Backend: Retrieved ${ownedContent.length} owned content items`);
    res.json(ownedContent);
  } catch (error) {
    console.error('Error fetching owned content:', error);
    res.status(500).json({ error: 'Failed to fetch owned content' });
  }
});

// Search content
app.post('/search-content', (req, res) => {
  try {
    const { query } = req.body;
    console.log(`🔍 Backend: Searching content for query: ${query}`);
    
    const files = fs.readdirSync(CONTENT_DIR);
    const searchResults = [];
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(CONTENT_DIR, file);
        const contentData = fs.readFileSync(filePath, 'utf8');
        const content = JSON.parse(contentData);
        
        if (content.name.toLowerCase().includes(query.toLowerCase()) ||
            content.description.toLowerCase().includes(query.toLowerCase()) ||
            content.knowledgeBase.toLowerCase().includes(query.toLowerCase())) {
          searchResults.push(content);
        }
      }
    }
    
    console.log(`✅ Backend: Found ${searchResults.length} search results`);
    res.json(searchResults);
  } catch (error) {
    console.error('Error searching content:', error);
    res.status(500).json({ error: 'Failed to search content' });
  }
});

// --- START THE SERVER ---
app.listen(PORT, () => {
  console.log(`EchoLink backend server is running on http://localhost:${PORT}`);
});
