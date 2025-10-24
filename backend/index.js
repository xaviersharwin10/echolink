import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import axios from 'axios';

dotenv.config();

// --- CONFIGURATION ---
const app = express();
const PORT = 3001;
const MCP_API_BASE_URL = 'http://0.0.0.0:8080/v1'; 

// --- LLM SETUP ---
// Using ASI:One LLM
const llm = new ChatOpenAI({
  model: "asi1-mini",
  apiKey: "",
  configuration: {
    baseURL: "https://api.asi1.ai/v1",
    defaultHeaders: { "X-Title": "EchoLink Protocol" }
  },
});

const ECHO_NFT_ADDRESS = '0x287b5a9EB0cAbDBD1860BCEF5f847C2958129FF4';
const QUERY_PAYMENTS_ADDRESS = '0xFf08e351Bf16fE0703108cf9B4AeDe3a16fd0a46'; 
const PYUSD_ADDRESS = '0xCaC524BcA292aaade2df8a05cC58F0a65B1B3bB9'; 

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// --- THE BLOCKSCOUT MCP TOOLBOX ---
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
    description: "Executes a read-only, view function on a smart contract. Requires a JSON-encoded function ABI.",
    schema: {
        type: "object",
        properties: {
          chain_id: { type: "string", description: "The chain ID." },
          address: { type: "string", description: "The smart contract address." },
          function_name: { type: "string", description: "Name of the function to call (e.g., 'ownerOf')." },
          abi: { type: "string", description: "REQUIRED: JSON-encoded single function ABI fragment (e.g., from ECHO_NFT_ABI)." },
          args: { type: "string", description: "JSON-encoded array of function arguments (e.g., '[1]')." },
        },
        required: ["chain_id", "address", "function_name", "abi"],
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


// --- HELPER FUNCTION TO CALL YOUR LOCAL MCP SERVER ---
async function callMcpTool(toolName, params) {
    if (toolName === 'get_address_by_ens_name') {
        params.chain_id = '1'; // ENS resolution always happens on Mainnet
    }
    const query = new URLSearchParams(params).toString();
    console.log(`--- Calling Local MCP Server Tool: ${toolName} with params: ${query} ---`);
    
    try {
      const response = await fetch(`${MCP_API_BASE_URL}/${toolName}?${query}`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`MCP server responded with an error: ${response.statusText} - ${errorText}`);
      }
      const data = await response.json();
      console.log('--- Received response from MCP Server ---');
      return JSON.stringify(data.data); 
    } catch (error) {
      console.error('Error calling MCP Server:', error);
      return `Error: Tool call failed. ${error.message}`;
    }
}

// --- MULTI-AGENT SYSTEM INTEGRATION ---
app.post('/query', async (req, res) => {
  const { query, token_id, payment_tx_hash, user_address, use_credits } = req.body;
  
  if (!query || !payment_tx_hash || !user_address) {
    return res.status(400).json({ 
      error: 'Missing required fields: query, payment_tx_hash, user_address' 
    });
  }

  console.log(`🎭 Multi-Agent Query: "${query}" for user: ${user_address}`);
  console.log(`💳 Payment TX: ${payment_tx_hash} (${use_credits ? 'Credits' : 'Direct'})`);

  try {
    // Call the Orchestrator Agent directly and wait for the complete response
    console.log('🎭 Calling orchestrator agent directly...');
    const orchestratorResponse = await axios.post('http://localhost:8004/query', {
      query,
      token_id,
      payment_tx_hash,
      user_address,
      use_credits: use_credits || false
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

// --- AI ANALYST ENDPOINT (Blockscout MCP Interface) ---
app.post('/ask', async (req, res) => {
  const { question, connectedAddress } = req.body;
  if (!question) return res.status(400).json({ error: 'Question is required' });

  console.log(`Received question: "${question}" for address: ${connectedAddress}`);

  // ABI for the crucial getAllEchoes() function needed for dynamic ranking
  const GET_ALL_ECHOS_ABI = JSON.stringify({
    "inputs": [],
    "name": "getAllEchoes",
    "outputs": [
      {"internalType": "uint256[]", "name": "tokenIds", "type": "uint256[]"},
      {"internalType": "string[]", "name": "names", "type": "string[]"},
      {"internalType": "string[]", "name": "descriptions", "type": "string[]"},
      {"internalType": "address[]", "name": "creators", "type": "address[]"},
      {"internalType": "uint256[]", "name": "pricesPerQuery", "type": "uint256[]"},
      {"internalType": "bool[]", "name": "activeStatuses", "type": "bool[]"}
    ],
    "stateMutability": "view",
    "type": "function"
  });

  // ABI for reading a single Echo's data
  const GET_ECHO_DATA_ABI = JSON.stringify({
    "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
    "name": "getEchoData",
    "outputs": [
      {"internalType": "string", "name": "name", "type": "string"},
      {"internalType": "string", "name": "description", "type": "string"},
      {"internalType": "address", "name": "creator", "type": "address"},
      {"internalType": "uint256", "name": "pricePerQuery", "type": "uint256"},
      {"internalType": "bool", "name": "isActive", "type": "bool"}
    ],
    "stateMutability": "view",
    "type": "function"
  });

  // --- THE SUPER PROMPT ---
  const systemPromptContent = `You are 'Echo Analyst', a master on-chain analyst for the EchoLink Protocol. Your goal is to provide rich, insightful, and sometimes visual answers using your Blockscout MCP tools.

      **ECHO LINK CONTEXT & KEY ADDRESSES:**
      - The user is operating within the EchoLink NFT marketplace.
      - User's Connected Wallet: **${connectedAddress || 'Not Connected'}** (Referenced as 'my wallet' or 'I').
      - EchoLink NFT Contract: **${ECHO_NFT_ADDRESS}** (Tracks Echos, Token ID ownership, and Credits).
      - Query Payments Contract: **${QUERY_PAYMENTS_ADDRESS}** (Processes direct payments).
      - PYUSD Token Contract: **${PYUSD_ADDRESS}** (The asset of interest for all payments).
      
      **CRITICAL DATA CONVERSION PROTOCOL (MANDATORY):**
      - **PYUSD Value:** PYUSD has 6 decimal places. To get the readable PYUSD amount from raw contract data (wei), you must divide the raw unit by 1,000,000 (10^6).
      - **Protocol Fee:** The net amount earned by the creator is 95% of the gross payment (5% fee).
      
      **CRITICAL ABIs (Use with read_contract tool):**
      - getAllEchoes() ABI: ${GET_ALL_ECHOS_ABI}
      - getEchoData() ABI: ${GET_ECHO_DATA_ABI}
      
      **CRITICAL INSTRUCTION:** For the key contract addresses above, you MUST use the provided hexadecimal addresses directly.
      
      
      --- START INTERNAL PLANNING MANDATE (DO NOT OUTPUT THIS CONTENT) ---

      **INTERNAL REASONING STEPS:**
      1.  **Intent Check:** Determine the user's primary goal (e.g., "popular echo", "my balance", "trace flow").
      2.  **Popularity/Ranking (DYNAMIC DATA):** If asked about popularity, ranking, or creator earnings, you MUST perform a multi-step query:
          * Step 1: Execute \`read_contract\` on **EchoLink NFT Contract** using the **getAllEchoes() ABI** to fetch the current list of all minted Echos and their creators.
          * Step 2: Iterate through the fetched Echo list. For each creator's address, use \`get_address_info\` to retrieve the associated transaction count (TX count is the proxy for popularity).
          * Step 3: Compare and rank the Echos based on the collected activity data.
      3.  **Name-to-ID Lookup (CRITICAL FIRST STEP):** If the user provides an Echo Name (e.g., "Xavier - The biography") instead of an ID, you MUST first call \`read_contract\` on the \`EchoLink NFT Contract\` using the \`getAllEchoes() ABI\`. You must then internally parse the result to find the corresponding \`tokenId\` before proceeding with any analysis.
      4.  **Contract Status:** If asked about specific Echo data, use the \`read_contract\` tool on the \`EchoLink NFT Contract\` with the **getEchoData() ABI**.
      5.  **Flow Tracing:** If asked about payments or flow, use \`get_token_transfers_by_address\` filtering by PYUSD and the relevant contract address.
      6.  **Final Synthesis:** Synthesize all verified data into a professional, direct report.

      --- END INTERNAL PLANNING MANDATE ---

      **FINAL OUTPUT MANDATE:** Your response must be a synthesized, polite, and professional report, **using bold Markdown for key metrics and rankings**, and beginning directly with the answer. For any data suitable for comparison (balances, transactions), you **MUST** output a simplified \`[CHART_DATA]\` JSON structure containing only \`type\`, \`labels\`, and \`data\` arrays. You MUST NOT mention the names of the tools you use, the reasoning steps, or any internal planning.
      **Provide Visual Data When Logical:** For any question that involves comparing 2 or more items (e.g., transaction counts, token balances), you MUST format the data for a chart. To do this, embed a special JSON block in your answer like this:
        \`\`\`
        [CHART_DATA]
        {
          "type": "bar",
          "title": "Creator Transaction Activity",
          "labels": ["Creator A Address", "Creator B Address"],
          "data": [150, 85]
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
    // Send a safe, general error response
    res.status(500).json({ error: 'Failed to process the AI request due to an internal system error.' });
  }
});

// --- START THE SERVER ---
app.listen(PORT, () => {
  console.log(`EchoLink backend server is running on http://localhost:${PORT}`);
});
