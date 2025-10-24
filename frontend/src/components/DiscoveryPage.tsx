import React, { useState, useMemo, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAccount } from 'wagmi';
import { ChartRenderer } from './ChartRenderer';

interface DiscoveryPageProps {
    isWidget?: boolean;
}
interface ChatMessage {
    id: string;
    sender: 'user' | 'ai' | 'system';
    text: string;
    chartData?: any;
}


export const DiscoveryPage: React.FC<DiscoveryPageProps> = ({ isWidget = false }) => {
  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]); 
  const [isLoading, setIsLoading] = useState(false);
  const { address } = useAccount(); 
  const historyEndRef = useRef<HTMLDivElement>(null);

  const examplePrompts = [
    "Analyze my activity.",
    "Compare ETH balances.",
    "Contract function?",
  ];

  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);


  const parseAiResponse = (rawAnswer: string) => {
    if (!rawAnswer) return { textAnswer: '', chartData: null };

    const chartRegex = /\[CHART_DATA\]\s*([\s\S]*?)\s*\[\/CHART_DATA\]/;
    const match = rawAnswer.match(chartRegex);

    if (match && match[1]) {
      try {
        const parsedChartData = JSON.parse(match[1]);
        const textOnly = rawAnswer.replace(chartRegex, '').trim();
        return { textAnswer: textOnly, chartData: parsedChartData };
      } catch (e) {
        console.error("Failed to parse chart JSON:", e);
      }
    }
    return { textAnswer: rawAnswer, chartData: null };
  };

  const handleAskQuestion = async (prompt?: string) => {
    const questionToAsk = prompt || question;
    
    if (!questionToAsk) {
      setChatHistory(h => [...h, { id: Date.now().toString(), sender: 'system', text: "Please enter a question or click an example." }]);
      return;
    }
    if (!address) {
      setChatHistory(h => [...h, { id: Date.now().toString(), sender: 'system', text: "Please connect your wallet to use the AI Analyst." }]);
      return;
    }

    setChatHistory(h => [...h, { id: Date.now().toString(), sender: 'user', text: questionToAsk }]);
    setQuestion(''); 
    setIsLoading(true);

    try {
      // Send the connected address along with the question
      const response = await fetch('http://localhost:3001/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: questionToAsk, connectedAddress: address }),
      });

      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      
      // 2. Parse and add AI response to history
      const { textAnswer, chartData } = parseAiResponse(data.answer);

      setChatHistory(h => [...h, { 
          id: (Date.now() + 1).toString(), 
          sender: 'ai', 
          text: textAnswer,
          chartData: chartData 
      }]);

    } catch (error) {
      console.error('Failed to fetch answer:', error);
      setChatHistory(h => [...h, { 
          id: (Date.now() + 1).toString(), 
          sender: 'system', 
          text: '### ❌ An Error Occurred\nSorry, something went wrong while communicating with the AI analyst. Please check the console and try again.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const ChatHistoryRenderer = () => (
    <div className="space-y-4 pt-2">
        {/* Initial Welcome Message */}
        {chatHistory.length === 0 && (
            <div className="flex justify-start">
                <div className="bg-purple-100 text-gray-800 p-2 rounded-lg max-w-[90%] text-sm shadow-md">
                    I'm the Echo Analyst 🤖. Ask me anything about on-chain activity or your marketplace performance!
                </div>
            </div>
        )}

        {chatHistory.map((message) => (
            <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                
                {/* AI / System Bubble */}
                {(message.sender === 'ai' || message.sender === 'system') && (
                    <div className={`p-3 rounded-xl max-w-[90%] text-sm shadow-md ${message.sender === 'ai' ? 'bg-slate-50 border border-gray-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                        {message.chartData && (
                             <div className="mb-3 bg-white border border-gray-200 rounded-lg p-2">
                                <ChartRenderer chartData={message.chartData} />
                             </div>
                        )}
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
                    </div>
                )}

                {/* User Bubble */}
                {message.sender === 'user' && (
                    <div className="bg-blue-600 text-white p-3 rounded-xl max-w-[80%] text-sm shadow-md">
                        {message.text}
                    </div>
                )}
            </div>
        ))}

        {/* Loading Indicator */}
        {isLoading && (
            <div className="flex justify-start">
                <div className="bg-gray-200 p-2 rounded-lg max-w-[90%] flex items-center space-x-2 text-sm">
                    <div className="animate-pulse w-2 h-2 bg-gray-600 rounded-full"></div>
                    <div className="animate-pulse w-2 h-2 bg-gray-600 rounded-full delay-75"></div>
                    <div className="animate-pulse w-2 h-2 bg-gray-600 rounded-full delay-150"></div>
                    <span>Analyzing Blockscout...</span>
                </div>
            </div>
        )}

        {/* Ref for auto-scrolling */}
        <div ref={historyEndRef} />
    </div>
  );


  return (
    <div className={`flex flex-col h-full p-0`}>
      
      {/* 1. HISTORY CONTAINER (Scrollable) */}
      <div className={`flex-grow overflow-y-auto p-3`}>
          <ChatHistoryRenderer />
      </div>

      {/* 2. INPUT AREA (Fixed to bottom) */}
      <div className={`border-t border-gray-200 p-3 bg-white sticky bottom-0`}>
          
          {/* Condensed Example Prompts for Widget */}
          <div className="flex items-center gap-1.5 mb-2 overflow-x-auto whitespace-nowrap pb-1">
              {examplePrompts.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => handleAskQuestion(prompt)}
                  disabled={isLoading}
                  className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs font-medium hover:bg-blue-100 hover:text-blue-700 transition-colors disabled:opacity-50 flex-shrink-0"
                >
                  {prompt}
                </button>
              ))}
          </div>

          <div className="relative">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask your question..."
              disabled={isLoading}
              onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleAskQuestion()}
              className="w-full pl-3 pr-16 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-colors"
            />
            <button
              onClick={() => handleAskQuestion()}
              disabled={isLoading}
              className="absolute top-0.5 right-0.5 bottom-0.5 bg-purple-600 text-white w-14 rounded-lg font-semibold hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center"
            >
              {isLoading ? (
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
              ) : (
                'Send'
              )}
            </button>
          </div>
      </div>
    </div>
  );
};
