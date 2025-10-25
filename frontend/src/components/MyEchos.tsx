import React, { useState, useEffect } from 'react';
import { useAccount, useContractRead } from 'wagmi';
import { readContract } from '@wagmi/core';
import { EchoCard, EchoInfo } from './EchoCard';
import { ChatInterface } from './ChatInterface';
import { EchoContentViewer } from './EchoContentViewer';
import { ECHOLNK_NFT_ADDRESS, ECHO_NFT_ABI } from '../config/contracts';
import { contentStorage } from '../services/contentStorage';

const MyEchos: React.FC = () => {
  const { address } = useAccount();
  const [selectedEcho, setSelectedEcho] = useState<bigint | null>(null);
  const [viewingContentTokenId, setViewingContentTokenId] = useState<bigint | null>(null);
  const [ownedEchos, setOwnedEchos] = useState<EchoInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Get user's owned Echo count
  const { data: userOwnedEchoCount, refetch: refetchOwnedEchos } = useContractRead({
    address: ECHOLNK_NFT_ADDRESS as `0x${string}`,
    abi: ECHO_NFT_ABI,
    functionName: 'getUserOwnedEchoCount',
    args: address ? [address] : undefined,
    watch: true,
    enabled: !!address,
  });

  // Get total number of Echos
  const { data: totalEchos } = useContractRead({
    address: ECHOLNK_NFT_ADDRESS as `0x${string}`,
    abi: ECHO_NFT_ABI,
    functionName: 'getTotalEchoes',
    watch: true,
  });

  // Process owned Echos data
  useEffect(() => {
    const loadOwnedEchos = async () => {
      if (!address || !totalEchos) {
        setOwnedEchos([]);
        setIsLoading(false);
        return;
      }

      const ownedEchoList: EchoInfo[] = [];
      const totalCount = Number(totalEchos);

      // Get all actual token IDs that exist
      const allTokenIds = await readContract({
        address: ECHOLNK_NFT_ADDRESS as `0x${string}`,
        abi: ECHO_NFT_ABI,
        functionName: 'getAllTokenIds',
      }) as bigint[];

      console.log(`🔍 Found ${allTokenIds.length} actual token IDs:`, allTokenIds.map(id => Number(id)));
      
      // Process each actual token ID
      for (const tokenIdBigInt of allTokenIds) {
        const tokenId = Number(tokenIdBigInt);
        try {
          // Check if user owns this Echo using isEchoOwner
          const isOwner = await readContract({
            address: ECHOLNK_NFT_ADDRESS as `0x${string}`,
            abi: ECHO_NFT_ABI,
            functionName: 'isEchoOwner',
            args: [address, BigInt(tokenId)],
          });

          if (isOwner) {
            // Get Echo data
            const echoData = await readContract({
              address: ECHOLNK_NFT_ADDRESS as `0x${string}`,
              abi: ECHO_NFT_ABI,
              functionName: 'getEchoData',
              args: [BigInt(tokenId)],
            }) as unknown as [string, string, `0x${string}`, bigint, boolean, bigint, boolean, `0x${string}`];

            const [name, description, creator, pricePerQuery, isActive, purchasePrice, isForSale, owner] = echoData;
            
            ownedEchoList.push({
              tokenId: tokenId,
              creator: creator,
              owner: address,
              name: name || `Echo #${tokenId}`,
              description: description || 'Your owned Echo with unlimited access',
              imageUrl: `https://source.unsplash.com/random/800x600?sig=${tokenId}`,
              isCreatorActive: true,
              totalQueries: 0,
              pricePerQuery: pricePerQuery,
              purchasePrice: purchasePrice,
              isForSale: isForSale,
              isOwned: true,
            });
          }
        } catch (error) {
          console.warn(`Failed to check ownership for token ${tokenId}`, error);
          // Continue with next token
          continue;
        }
      }

      setOwnedEchos(ownedEchoList);
      setIsLoading(false);
    };

    loadOwnedEchos();
  }, [address, totalEchos]);

  const handleEchoSelect = (tokenId: bigint) => {
    setSelectedEcho(tokenId);
  };

  const handleEchoBuy = (tokenId: bigint) => {
    // This shouldn't be called for owned Echos, but keeping for consistency
    console.log('Cannot buy owned Echo:', tokenId);
  };

  const handleViewContent = (tokenId: bigint) => {
    setViewingContentTokenId(tokenId);
  };

  if (viewingContentTokenId) {
    return (
      <EchoContentViewer 
        tokenId={viewingContentTokenId} 
        onBack={() => setViewingContentTokenId(null)}
      />
    );
  }

  if (selectedEcho) {
    return (
      <ChatInterface
        tokenId={selectedEcho}
        onBack={() => setSelectedEcho(null)}
        isOwned={true} // Pass that this is an owned Echo
      />
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-4 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading your Echos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">👑 My Echos</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Your owned knowledge assets with unlimited access
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">{ownedEchos.length}</div>
              <div className="text-gray-600 font-medium">Owned Echos</div>
            </div>
          </div>
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">∞</div>
              <div className="text-gray-600 font-medium">Unlimited Queries</div>
            </div>
          </div>
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600 mb-2">$0</div>
              <div className="text-gray-600 font-medium">Per Query Cost</div>
            </div>
          </div>
        </div>

        {/* Owned Echos Grid */}
        {ownedEchos.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {ownedEchos.map((echo, index) => (
              <div 
                key={echo.tokenId} 
                className="animate-slide-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <EchoCard
                  echo={echo}
                  onSelect={handleEchoSelect}
                  onBuy={handleEchoBuy}
                  onViewContent={handleViewContent}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-12 shadow-lg max-w-md mx-auto">
              <div className="text-6xl mb-4">🏪</div>
              <h3 className="text-2xl font-semibold text-gray-700 mb-4">No Echos Yet</h3>
              <p className="text-gray-600 mb-6">Start building your knowledge collection by purchasing Echos!</p>
              <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-6 py-3 rounded-lg font-semibold">
                Browse Echos
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyEchos;
