#!/bin/bash

# EchoLink Multi-Agent System Startup Script
# This script starts all three specialized agents

echo "🚀 Starting EchoLink Multi-Agent System"
echo "========================================"

# Set environment variables for agent communication
export PAYMENT_AGENT_ADDRESS="agent1qgmcaux67tuhrkl9cwhns0npxclvksy66yarp32j4f8zkedrhqjys597p08"
export KNOWLEDGE_AGENT_ADDRESS="agent1q2x577ul5d6r20c4alcx64pcersrusm7j4pekkce05cu22kpxz9hux72t3t"
export WEB3_PROVIDER_URL="https://eth-sepolia.g.alchemy.com/v2/"
export PYUSD_CONTRACT_ADDRESS="0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9"
export MIN_PAYMENT_AMOUNT="0.01"

# Function to start an agent
start_agent() {
    local agent_name=$1
    local agent_file=$2
    local port=$3
    
    echo "🔄 Starting $agent_name on port $port..."
    
    # Start the agent in the background#
    python $agent_file &
    local pid=$!
    
    # Store the PID for cleanup
    echo $pid > "${agent_name}_pid.txt"
    
    echo "✅ $agent_name started with PID $pid"
    sleep 2
}

# Start Payment Agent (Port 8001)
start_agent "PaymentAgent" "payment_agent.py" "8005"

# Start Knowledge Agent (Port 8002)
start_agent "KnowledgeAgent" "knowledge_agent.py" "8006"

# Start Orchestrator Agent (Port 8000)
start_agent "OrchestratorAgent" "orchestrator_agent.py" "8004"

echo ""
echo "🎉 All agents started successfully!"
echo "========================================"
echo "📡 Orchestrator Agent: http://localhost:8004"
echo "💳 Payment Agent: http://localhost:8005"
echo "🧠 Knowledge Agent: http://localhost:8006"
echo ""
echo "🔗 REST API Endpoints:"
echo "  POST http://localhost:8000/query - Main query endpoint"
echo "  GET  http://localhost:8000/health - Health check"
echo ""
echo "📋 To stop all agents, run: ./stop_multi_agent_system.sh"
echo ""

# Keep the script running
echo "Press Ctrl+C to stop all agents..."
trap 'echo "🛑 Stopping all agents..."; ./stop_multi_agent_system.sh; exit' INT

# Wait for user input
while true; do
    sleep 1
done
