import React, { useState, useEffect } from 'react';
import { useContractRead } from 'wagmi';
import { EchoCard, EchoInfo } from './EchoCard';
import { ChatInterface } from './ChatInterface';
import { ECHOLNK_NFT_ADDRESS } from '../config/contracts';

const ECHO_NFT_ABI = [
  { "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}], "name": "getEchoData", "outputs": [{"internalType": "string", "name": "knowledgeHash", "type": "string"}, {"internalType": "address", "name": "creator", "type": "address"}], "stateMutability": "view", "type": "function" },
  { "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}], "name": "ownerOf", "outputs": [{"internalType": "address", "name": "", "type": "address"}], "stateMutability": "view", "type": "function" }
];

const hardcodedData: { [key: number]: { name: string; description: string; imageUrl: string } } = {
  1: { name: "Economic Principles", description: "An interactive AI trained on foundational economic theories and models.", imageUrl: "https://images.unsplash.com/photo-1579532537598-459ecdaf39cc?w=800" },
  2: { name: "The Startup Playbook", description: "Insights and strategies from Silicon Valley's most successful founders.", imageUrl: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800" },
  3: { name: "History of Rome", description: "A deep dive into the rise and fall of the Roman Empire, with interactive Q&A.", imageUrl: "https://images.unsplash.com/photo-1589191224392-a9a358a98a83?w=800" },
  4: { name: "Quantum Physics AI", description: "Explore the strange and fascinating world of quantum mechanics.", imageUrl: "https://images.unsplash.com/photo-1593352222493-26a96c6344b9?w=800" },
};

export const EchoGallery: React.FC = () => {
  const [selectedTokenId, setSelectedTokenId] = useState<bigint | null>(null);
  const [availableEchos, setAvailableEchos] = useState<EchoInfo[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(true); // Start scanning immediately
  const [tokenIdToFetch, setTokenIdToFetch] = useState<number | null>(null);

  const { data: ownerAddress } = useContractRead({
    address: ECHOLNK_NFT_ADDRESS as `0x${string}`,
    abi: ECHO_NFT_ABI,
    functionName: 'ownerOf',
    args: tokenIdToFetch ? [BigInt(tokenIdToFetch)] : undefined,
    enabled: !!tokenIdToFetch,
  });

  const { data: echoData } = useContractRead({
    address: ECHOLNK_NFT_ADDRESS as `0x${string}`,
    abi: ECHO_NFT_ABI,
    functionName: 'getEchoData',
    args: tokenIdToFetch ? [BigInt(tokenIdToFetch)] : undefined,
    enabled: !!tokenIdToFetch,
  });

  // This effect runs when data for a token is successfully fetched
  useEffect(() => {
    if (ownerAddress && echoData && tokenIdToFetch) {
      const hardcoded = hardcodedData[tokenIdToFetch] || {
        name: `Creator's Echo #${tokenIdToFetch}`,
        description: "An AI entity containing a unique body of knowledge, ready for you to explore.",
        imageUrl: `https://source.unsplash.com/random/800x600?sig=${tokenIdToFetch}`
      };
      const newEcho: EchoInfo = {
        tokenId: tokenIdToFetch,
        owner: ownerAddress as string,
        creator: (echoData as [string, string])[1],
        ...hardcoded
      };
      setAvailableEchos(prev => prev.find(e => e.tokenId === newEcho.tokenId) ? prev : [...prev, newEcho]);
    }
  }, [ownerAddress, echoData, tokenIdToFetch]);


  useEffect(() => {
    const scanForEchos = async () => {
      for (let i = 1; i <= 10; i++) {
        setTokenIdToFetch(i);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      setTimeout(() => {
        setIsScanning(false);
        setTokenIdToFetch(null);
      }, 500);
    };

    scanForEchos();
  }, []); 

  if (selectedTokenId) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <button
          onClick={() => setSelectedTokenId(null)}
          className="mb-6 px-5 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
        >
          ← Back to Echo Gallery
        </button>
        <ChatInterface tokenId={selectedTokenId} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">
          Knowledge Echo Gallery
        </h1>
        <p className="mt-4 text-md text-gray-500">
          Discover and interact with AI-powered Knowledge Echos stored on-chain.
        </p>

    {isScanning && (
      <div className="text-center">
        <div className="flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>
    )}

    {!isScanning && availableEchos.length === 0 && (
        <div className="text-center text-gray-500 bg-gray-100 p-8 rounded-lg">
          <h3 className="text-xl font-semibold text-gray-700">No Echos Found</h3>
          <p className="mt-2">It looks like there are no Echos minted in the first 10 token IDs. <br /> Be the first to mint one!</p>
        </div>
      )}

      {availableEchos.length > 0 && (
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 py-4">
          {availableEchos.sort((a, b) => a.tokenId - b.tokenId).map((echo) => (
            <EchoCard key={echo.tokenId} echo={echo} onSelect={setSelectedTokenId} />
          ))}
        </div>
      )}
    </div>
  );
};