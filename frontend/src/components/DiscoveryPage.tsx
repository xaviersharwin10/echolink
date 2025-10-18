import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAccount } from 'wagmi';
import { ChartRenderer } from './ChartRenderer';

export const DiscoveryPage: React.FC = () => {
  const [question, setQuestion] = useState('');
  const [rawAnswer, setRawAnswer] = useState(''); 
  const [isLoading, setIsLoading] = useState(false);
  const { address } = useAccount(); 

  const examplePrompts = [
    "Analyze my on-chain activity on Sepolia.",
    "Who is the most popular Echo creator between Token IDs 1, 2, and 3?",
    "Compare the ETH balances of vitalik.eth and uniswap.eth on mainnet.",
  ];

  const handleAskQuestion = async (prompt?: string) => {
    const questionToAsk = prompt || question;
    if (!questionToAsk) {
      alert('Please enter a question or click an example.');
      return;
    }
    if (!address) {
      alert('Please connect your wallet to use the AI Analyst.');
      return;
    }

    setIsLoading(true);
    setRawAnswer('');
    setQuestion(questionToAsk);

    try {
      // Send the connected address along with the question
      const response = await fetch('http://localhost:3001/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: questionToAsk, connectedAddress: address }),
      });

      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      setRawAnswer(data.answer);
    } catch (error) {
      console.error('Failed to fetch answer:', error);
      setRawAnswer('### ❌ An Error Occurred\nSorry, something went wrong while communicating with the AI analyst. Please check the console and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // This logic parses the AI's response to separate the text from the chart data
  const { textAnswer, chartData } = useMemo(() => {
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
  }, [rawAnswer]);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-extrabold text-gray-900">On-Chain AI Analyst</h2>
        <p className="mt-3 text-lg text-gray-500">
          Ask any question about on-chain activity. Powered by Blockscout MCP.
        </p>
      </div>
      
      <div className="relative mb-4">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g., Analyze my on-chain activity..."
          disabled={isLoading}
          onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleAskQuestion()}
          className="w-full pl-5 pr-28 py-4 text-lg border-2 border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
        />
        <button
          onClick={() => handleAskQuestion()}
          disabled={isLoading}
          className="absolute top-1/2 right-2.5 transform -translate-y-1/2 bg-blue-600 text-white py-2.5 px-6 rounded-full font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center"
        >
          {isLoading ? (
            <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
          ) : (
            'Ask'
          )}
        </button>
      </div>

      <div className="flex justify-center items-center gap-2 flex-wrap mb-8">
        <span className="text-sm text-gray-500 mr-2">Try an example:</span>
        {examplePrompts.map((prompt, i) => (
          <button
            key={i}
            onClick={() => handleAskQuestion(prompt)}
            disabled={isLoading}
            className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium hover:bg-blue-100 hover:text-blue-700 transition-colors disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="text-center py-10">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <p className="ml-4 text-gray-600 font-medium">Querying the blockchain and generating report...</p>
          </div>
        </div>
      )}

      {rawAnswer && (
        <div className="mt-6 space-y-6">
          {chartData && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <ChartRenderer chartData={chartData} />
            </div>
          )}
          <div className="bg-slate-50 border border-gray-200 rounded-xl p-6 prose prose-slate max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{textAnswer}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
};