import React, { useState, useEffect } from 'react';
import { readContract } from '@wagmi/core';
import { EchoCard, EchoInfo } from './EchoCard';
import { ChatInterface } from './ChatInterface';
import { ECHOLNK_NFT_ADDRESS, ECHO_NFT_ABI } from '../config/contracts';

const API_BASE_URL = 'https://eth-sepolia.blockscout.com/api/v2';
const ACTIVITY_THRESHOLD = 3;
const PYUSD_TOKEN_ADDRESS = '0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9';

const hardcodedData: { [key: number]: { name: string; description: string; imageUrl: string } } = {
  1: { name: "Economic Principles", description: "An interactive AI trained on foundational economic theories and models.", imageUrl: "https://images.unsplash.com/photo-1579532537598-459ecdaf39cc?w=800" },
  2: { name: "The Startup Playbook", description: "Insights and strategies from Silicon Valley's most successful founders.", imageUrl: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800" },
  3: { name: "History of Rome", description: "A deep dive into the rise and fall of the Roman Empire, with interactive Q&A.", imageUrl: "https://images.unsplash.com/photo-1589191224392-a9a358a98a83?w=800" },
  4: { name: "Quantum Physics AI", description: "Explore the strange and fascinating world of quantum mechanics.", imageUrl: "https://images.unsplash.com/photo-1593352222493-26a96c6344b9?w=800" },
};

export const EchoGallery: React.FC = () => {
  const [selectedTokenId, setSelectedTokenId] = useState<bigint | null>(null);
  const [availableEchos, setAvailableEchos] = useState<EchoInfo[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(true);

  useEffect(() => {
    const scanForAllEchos = async () => {
      setIsScanning(true);
      const foundEchos: EchoInfo[] = [];

      try {
        // Get all Echos from the contract in one call
        const allEchoesData = await readContract({
          address: ECHOLNK_NFT_ADDRESS as `0x${string}`,
          abi: ECHO_NFT_ABI,
          functionName: 'getAllEchoes',
        });

        const [tokenIds, names, descriptions, creators, pricesPerQuery, activeStatuses] = allEchoesData as [
bigint[], string[], string[], `0x${string}`[], bigint[], boolean[]];        // Process each Echo
        for (let i = 0; i < tokenIds.length; i++) {
          const tokenId = Number(tokenIds[i]);
          const name = names[i];
          const description = descriptions[i];
          const creator = creators[i];
          const pricePerQuery = pricesPerQuery[i];
          const isActive = activeStatuses[i];

          try {
            // Get the actual owner of the NFT
            const owner = await readContract({
              address: ECHOLNK_NFT_ADDRESS as `0x${string}`,
              abi: ECHO_NFT_ABI,
              functionName: 'ownerOf',
              args: [BigInt(tokenId)],
            });

            const activityRes = await fetch(`${API_BASE_URL}/addresses/${creator}/token-transfers?token=${PYUSD_TOKEN_ADDRESS}`);
            const activityData = await activityRes.json();

            const incomingTransfers = activityData?.items.filter((tx: any) => tx.to.hash.toLowerCase() === creator.toLowerCase());

            const totalQueries = incomingTransfers.length || 0;
            const isCreatorActive = totalQueries > ACTIVITY_THRESHOLD;
            
            // Use hardcoded data if available, otherwise use contract data
            const hardcoded = hardcodedData[tokenId] || {
              name: name || `Echo #${tokenId}`,
              description: description || "An AI entity containing a unique body of knowledge, ready for you to explore.",
              imageUrl: `https://source.unsplash.com/random/800x600?sig=${tokenId}`
            };
            
            foundEchos.push({
              tokenId: tokenId,
              owner: owner as string,
              creator: creator,
              isCreatorActive: isCreatorActive,
              totalQueries: totalQueries,
              pricePerQuery: pricePerQuery, 
              ...hardcoded
            });

          } catch (error) {
            console.warn(`Failed to fetch Blockscout data for token ${tokenId}. Using fallbacks.`, error);
            const hardcoded = hardcodedData[tokenId] || {
              name: name || `Echo #${tokenId}`,
              description: description || "An AI entity containing a unique body of knowledge, ready for you to explore.",
              imageUrl: `https://source.unsplash.com/random/800x600?sig=${tokenId}`
            };
            
            foundEchos.push({
              tokenId: tokenId,
              owner: creator, 
              creator: creator,
              isCreatorActive: false,
              totalQueries: 0, 
              pricePerQuery: pricePerQuery,
              ...hardcoded
            });
          }
        }

      } catch (error) {
        console.error('❌ Failed to fetch all Echos:', error);
      }

      setAvailableEchos(foundEchos);
      setIsScanning(false);
    };

    scanForAllEchos();
  }, []); 


  if (selectedTokenId) {
    return (
      <div className="max-w-5xl mx-auto py-8">
        <button
          onClick={() => setSelectedTokenId(null)}
          className="mb-6 px-5 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-semibold shadow-sm"
        >
          ← Back to Echo Gallery
        </button>
        <ChatInterface tokenId={selectedTokenId} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-2">
          Knowledge Echo Marketplace
        </h1>
        <p className="mt-2 text-lg text-gray-600">
          Discover and interact with Blockscout-verified, AI-powered Knowledge Echos.
        </p>

    {/* Loading and Empty States remain the same */}
    {isScanning && (
      <div className="text-center py-12">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-3 border-purple-500"></div>
          <p className="ml-4 text-gray-600 text-lg">Scanning for Echos on the blockchain..</p>
        </div>
      </div>
    )}

    {!isScanning && availableEchos.length === 0 && (
        <div className="text-center text-gray-500 bg-gray-100 p-10 rounded-xl mt-10 border border-dashed border-gray-300">
          <h3 className="text-2xl font-semibold text-gray-700">No Echos Found</h3>
          <p className="mt-3">It looks like there are no Echos minted yet. <br /> Be the first to mint one!</p>
        </div>
      )}

      {availableEchos.length > 0 && (
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 py-8">
          {availableEchos.sort((a, b) => b.tokenId - a.tokenId).map((echo) => (
            <EchoCard key={echo.tokenId} echo={echo} onSelect={setSelectedTokenId} />
          ))}
        </div>
      )}
    </div>
  );
};