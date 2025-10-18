// index.js - The EchoLink Backend (Supercharged AI Analyst)

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, ToolMessage } from "@langchain/core/messages";

dotenv.config();

// --- CONFIGURATION ---
const app = express();
const PORT = 3001;
const MCP_API_BASE_URL = 'http://127.0.0.1:8000/v1'; 

// --- LLM SETUP ---
// if (!process.env.OPENROUTER_API_KEY) {
//   throw new Error("Please set OPENROUTER_API_KEY in your .env file");
// }
const llm = new ChatOpenAI({
  model: "openai/gpt-4o",
  apiKey: "",
  configuration: {
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: { "X-Title": "EchoLink Protocol" }
  },
});

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// --- THE EXPANDED AI TOOLBOX (Maps directly to MCP server tools) ---
const llmWithTools = llm.bindTools([
  {
    name: "get_address_by_ens_name",
    description: "Converts an ENS domain name (e.g., 'vitalik.eth') to its hexadecimal Ethereum address. Always use this first if the user provides a name instead of an address.",
    schema: {
        type: "object",
        properties: {
          name: { type: "string", description: "The ENS domain name." },
        },
        required: ["name"],
    },
  },
  {
    name: "get_address_info",
    description: "Gets a full summary of a wallet address, including ETH balance, transaction count, and contract info. This is the best tool for a general overview.",
    schema: {
        type: "object",
        properties: {
          chain_id: { type: "string", description: "The ID of the chain (e.g., '11155111' for Sepolia, '1' for Mainnet)." },
          address: { type: "string", description: "The wallet address (e.g., 0x...)." },
        },
        required: ["chain_id", "address"],
    },
  },
  {
    name: "get_tokens_by_address",
    description: "Returns a detailed list of all ERC20 tokens and their balances for a specific address. Use this for questions about specific token holdings.",
    schema: {
        type: "object",
        properties: {
          chain_id: { type: "string", description: "The ID of the chain (e.g., '11155111' for Sepolia, '1' for Mainnet)." },
          address: { type: "string", description: "The wallet address (e.g., 0x...)." },
        },
        required: ["chain_id", "address"],
    },
  },
  {
    name: "get_transactions_by_address",
    description: "Gets the list of the most recent transactions for a given address. Use this to analyze recent activity.",
    schema: {
        type: "object",
        properties: {
          chain_id: { type: "string", description: "The ID of the chain (e.g., '11155111' for Sepolia, '1' for Mainnet)." },
          address: { type: "string", description: "The wallet address (e.g., 0x...)." },
        },
        required: ["chain_id", "address"],
    },
  }
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

// --- API ENDPOINT ---
app.post('/ask', async (req, res) => {
  const { question, connectedAddress } = req.body;
  if (!question) return res.status(400).json({ error: 'Question is required' });

  console.log(`Received question: "${question}" for address: ${connectedAddress}`);

  // --- THE SUPER PROMPT ---
  const messages = [
    new HumanMessage({
      content: `You are 'Echo Analyst', a master on-chain analyst for the EchoLink Protocol. Your goal is to provide rich, insightful, and sometimes visual answers using your Blockscout MCP tools.

      **CONTEXT:**
      - You are inside the EchoLink app. An "Echo" is a knowledge NFT. A "creator" is the wallet that minted it.
      - The user's connected wallet address is: **${connectedAddress || 'Not Connected'}**. When the user says "I", "me", or "my wallet", they are referring to this address.

      **YOUR THOUGHT PROCESS:**
      1.  **Identify the Goal:** Understand what the user wants. Is it a simple lookup, a comparison, or a general analysis?
      2.  **Use Context:** If the question involves "me" or "my", use the provided connected wallet address as the target for your tool calls.
      3.  **Plan Multi-Step Analysis:** For complex questions like "Who is the most popular Echo creator?", you must form a plan. For example:
          - Step A: "I need to find the creator addresses for a few popular Echos." (You may have to assume some, like Token IDs 1, 2, 3).
          - Step B: "Now I will call \`get_address_info\` for each of these creator addresses to get their transaction counts."
          - Step C: "After I have all the transaction counts, I will compare them and declare a winner."
      4.  **Provide Visual Data When Logical:** For any question that involves comparing 2 or more items (e.g., transaction counts, token balances), you MUST format the data for a chart. To do this, embed a special JSON block in your answer like this:
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
      5.  **Synthesize the Final Answer:** Combine your text analysis and your chart data into a single, comprehensive Markdown response. Explain your findings clearly.
      6.  **Determine the Chain:** Identify the correct \`chain_id\`. Look for keywords like 'mainnet' (use '1'), 'base' (use '8453'), etc. If the user doesn't specify, **default to Sepolia (chain_id: '11155111')**.

      Begin your analysis for the user's request: "${question}"`,
    }),
  ];

  try {
    let response = await llmWithTools.invoke(messages);
    let conversationHistory = [...messages, response];

    while (response.tool_calls && response.tool_calls.length > 0) {
      const toolCall = response.tool_calls[0];
      const toolResponse = await callMcpTool(toolCall.name, toolCall.args);
      conversationHistory.push(new ToolMessage({
        content: toolResponse,
        tool_call_id: toolCall.id,
      }));
      
      console.log('Sending tool response back to LLM...');
      response = await llmWithTools.invoke(conversationHistory);
      conversationHistory.push(response);
    }
    
    return res.json({ answer: response.content });
  } catch (error) {
    console.error('Error in AI flow:', error);
    res.status(500).json({ error: 'Failed to process the AI request.' });
  }
});

// --- START THE SERVER ---
app.listen(PORT, () => {
  console.log(`EchoLink backend server is running on http://localhost:${PORT}`);
});