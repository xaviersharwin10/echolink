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

  // Updated Example Prompts
  const examplePrompts = [
    "Highest performing Echo?",
    "Total platform value?",
    "Top creator earnings?",
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
        {chatHistory.length === 0 && (
            <div className="flex justify-start">
                <div className="bg-white text-gray-800 p-4 rounded-2xl max-w-[90%] text-sm shadow-lg border border-gray-200">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-gradient-to-r from-violet-100 via-purple-100 to-indigo-100 rounded-full flex items-center justify-center">
                        <span className="text-xl">🤖</span>
                      </div>
                    </div>
                    <div>
                      <div className="font-bold text-gray-900 mb-1 tracking-wide bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-700 bg-clip-text text-transparent">
                        EchoLink Analyst
                      </div>
                      <div className="text-gray-600 text-xs leading-relaxed">
                        Powered by <span className="font-semibold text-gray-800">Blockscout</span> • Ask me anything about your Echos or on-chain activity!!
                      </div>
                    </div>
                  </div>
                </div>
            </div>
        )}

        {chatHistory.map((message) => (
            <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                
                {/* AI / System Bubble */}
                {(message.sender === 'ai' || message.sender === 'system') && (
                    <div className={`p-3 rounded-xl max-w-[90%] text-sm shadow-md ${message.sender === 'ai' ? 'bg-slate-100' : 'bg-red-50 text-red-800 border border-red-200'}`}>
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
                    <div className="bg-violet-600 text-white p-3 rounded-xl max-w-[80%] text-sm shadow-md">
                        {message.text}
                    </div>
                )}
            </div>
        ))}

        {/* Loading Indicator */}
        {isLoading && (
            <div className="flex justify-start">
                <div className="bg-slate-100 p-3 rounded-xl max-w-[90%] flex items-center space-x-2 text-sm">
                    <div className="animate-pulse w-2 h-2 bg-gray-600 rounded-full"></div>
                    <div className="animate-pulse w-2 h-2 bg-gray-600 rounded-full" style={{animationDelay: '0.2s'}}></div>
                    <div className="animate-pulse w-2 h-2 bg-gray-600 rounded-full" style={{animationDelay: '0.4s'}}></div>
                    <span className="text-gray-700">Echo Analyst is thinking...</span>
                </div>
            </div>
        )}

        {/* Ref for auto-scrolling */}
        <div ref={historyEndRef} />
    </div>
  );


  return (
    <div className={`flex flex-col h-full p-0 bg-white`}>
      
      {/* 1. HISTORY CONTAINER (Scrollable) */}
      <div className={`flex-grow overflow-y-auto p-3`}>
          <ChatHistoryRenderer />
      </div>

      {/* 2. INPUT AREA (Fixed to bottom) */}
      <div className={`border-t border-gray-200 p-3 bg-slate-50 sticky bottom-0`}>
          
          {/* Example Prompts - Updated */}
          <div className="flex items-center gap-1.5 mb-2 overflow-x-auto whitespace-nowrap pb-1">
              {examplePrompts.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => handleAskQuestion(prompt)}
                  disabled={isLoading}
                  className="px-2.5 py-0.5 bg-gradient-to-r from-violet-100 via-purple-100 to-indigo-100 text-purple-800 rounded-full text-xs font-medium hover:from-violet-200 hover:via-purple-200 hover:to-indigo-200 transition-colors disabled:opacity-50 flex-shrink-0"
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
              placeholder="Ask about Echos, creators, value..."
              disabled={isLoading}
              onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleAskQuestion()}
              className="w-full pl-3 pr-16 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-colors bg-white"
            />
            <button
              onClick={() => handleAskQuestion()}
              disabled={isLoading}
              className="absolute top-0.5 right-0.5 bottom-0.5 bg-violet-600 text-white w-14 rounded-lg font-semibold hover:from-violet-700 hover:via-purple-700 hover:to-indigo-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center"
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

export const FloatingChatbot = () => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <>
            {/* 1. Pop-up Window */}
            {isOpen && (
                <div 
                  className="fixed bottom-24 right-6 w-full max-w-lg h-[700px] bg-white border border-gray-300 rounded-xl shadow-2xl z-50 overflow-hidden transition-all duration-300 transform scale-100 flex flex-col"
                  style={{ maxHeight: 'calc(100vh - 100px)' }}
                >
                  <div className="flex justify-between items-center p-3 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-700 text-white shadow-md flex-shrink-0">
                    <div className="flex items-center space-x-2">
                 <img
                   src="/echolink_logo.png"
                   alt="EchoLink Logo"
                   className="h-9 w-9 object-contain bg-white/20 rounded-lg p-1"
                 />
                      <h4 className="text-lg font-semibold">AI Analyst (Blockscout)</h4>
                    </div>
                    <button 
                      onClick={() => setIsOpen(false)}
                      className="text-white hover:text-purple-200 transition-colors p-1 rounded-full hover:bg-purple-700"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  {/* This div now correctly fills the remaining space and becomes scrollable */}
                  <div className="flex-grow overflow-y-auto min-h-0">
                    <DiscoveryPage isWidget={true} /> 
                  </div>
                </div>
            )}
            
            {/* 2. Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-6 right-6 p-3.5 bg-violet-600 text-white rounded-full shadow-xl hover:from-violet-700 hover:via-purple-700 hover:to-indigo-800 transition-all duration-300 z-50 transform hover:scale-105"
                title="Open Echo Analyst"
            >
                {isOpen ? (
                    // Close Icon (X)
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                ) : (
                    // Chat Icon
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-3.86 8.25-8.625 8.25a8.625 8.625 0 01-8.625-8.25C3.75 7.444 7.61 3.75 12.375 3.75c4.765 0 8.625 3.694 8.625 8.25z" />
                    </svg>
                )}
            </button>
        </>
    );
}

export default FloatingChatbot;