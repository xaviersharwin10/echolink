import React, { useState, useEffect } from 'react';
import { useContractWrite, useWaitForTransaction, useAccount, useContractRead } from 'wagmi';
import { readContract } from '@wagmi/core';
import { EchoCard, EchoInfo } from './EchoCard';
import { ChatInterface } from './ChatInterface';
import { EchoContentViewer } from './EchoContentViewer';
import { ECHOLNK_NFT_ADDRESS, ECHO_NFT_ABI, QUERY_PAYMENTS_ADDRESS, QUERY_PAID_TOPIC, CREDITS_USED_TOPIC } from '../config/contracts';
import { parseUnits, formatUnits } from 'viem';

const API_BASE_URL = 'https://eth-sepolia.blockscout.com/api';
const ACTIVITY_THRESHOLD = 1;
const PYUSD_ADDRESS = '0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9';
const PYUSD_DECIMALS = 6;

const PYUSD_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
];

interface LogEvent {
    topics: string[];
    data: string;
    timeStamp: string;
}

// --- Reusable Blockscout Helpers ---

const safeParseTokenId = (hexTopic: string): number => {
    try {
        const nonZeroIndex = hexTopic.slice(2).search(/[^0]/);
        if (nonZeroIndex === -1) return 0;
        const cleanHex = '0x' + hexTopic.slice(2 + nonZeroIndex);
        return Number(BigInt(cleanHex));
    } catch (e) {
        return 0;
    }
};

const fetchBlockscoutData = async (params: Record<string, string>): Promise<any> => {
    const query = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}?${query}`);
    const data = await response.json();
    return data.result || [];
};

const fetchEchoQueryStats = async (tokenIdNumber: number) => {
    const [queryPaidLogs, creditsUsedLogs] = await Promise.all([
 // 1. QueryPaid (Direct PYUSD): Logs from the QueryPayments contract
          fetchBlockscoutData({
            module: 'logs',
            action: 'getLogs',
            address: QUERY_PAYMENTS_ADDRESS,
            topic0: QUERY_PAID_TOPIC,
            fromBlock: '0', 
            toBlock: 'latest'
          }),
          // 2. CreditsUsed: Logs from the EchoNFT contract
          fetchBlockscoutData({
            module: 'logs',
            action: 'getLogs',
            address: ECHOLNK_NFT_ADDRESS,
            topic0: CREDITS_USED_TOPIC,
            fromBlock: '0', 
            toBlock: 'latest', 
          }),
    ]);

    let totalQueries = 0;

    const processLogs = (logs: LogEvent[], isCredit: boolean) => {
        logs.forEach(log => {
            // QueryPaid (Topic 3), CreditsUsed (Topic 2)
            const tokenTopicIndex = isCredit ? 2 : 3;
            
            if (log.topics.length > tokenTopicIndex) {
                const logTokenId = safeParseTokenId(log.topics[tokenTopicIndex]);
                
                if (logTokenId === tokenIdNumber) {
                    totalQueries++;
                }
            }
        });
    };

    processLogs(queryPaidLogs, false);
    processLogs(creditsUsedLogs, true);

    return { totalQueries };
};


const hardcodedData: { [key: number]: { name: string; description: string; imageUrl: string } } = {
  1: { name: "Economic Principles", description: "An interactive AI trained on foundational economic theories and models.", imageUrl: "https://images.unsplash.com/photo-1579532537598-459ecdaf39cc?w=800" },
  2: { name: "The Startup Playbook", description: "Insights and strategies from Silicon Valley's most successful founders.", imageUrl: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800" },
  3: { name: "History of Rome", description: "A deep dive into the rise and fall of the Roman Empire, with interactive Q&A.", imageUrl: "https://images.unsplash.com/photo-1589191224392-a9a358a98a83?w=800" },
  4: { name: "Quantum Physics AI", description: "Explore the strange and fascinating world of quantum mechanics.", imageUrl: "https://images.unsplash.com/photo-1593352222493-26a96c6344b9?w=800" },
};

export const EchoGallery: React.FC = () => {
  const [selectedTokenId, setSelectedTokenId] = useState<bigint | null>(null);
  const [viewingContentTokenId, setViewingContentTokenId] = useState<bigint | null>(null);
  const [availableEchos, setAvailableEchos] = useState<EchoInfo[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [isBuying, setIsBuying] = useState<boolean>(false);
  const [buyTxHash, setBuyTxHash] = useState<`0x${string}` | undefined>();
  const [approvalTxHash, setApprovalTxHash] = useState<`0x${string}` | undefined>();
  const [pendingBuyTokenId, setPendingBuyTokenId] = useState<bigint | null>(null);
  const [buyStep, setBuyStep] = useState<'idle' | 'approving' | 'approved' | 'buying' | 'complete'>('idle');
  const [buyingTokenId, setBuyingTokenId] = useState<number | null>(null);

  const { address, isConnected } = useAccount();

  // Contract write for buying Echo
  const { writeAsync: buyEcho, isLoading: isBuyPending } = useContractWrite({
    address: ECHOLNK_NFT_ADDRESS as `0x${string}`,
    abi: ECHO_NFT_ABI,
    functionName: 'buyEcho',
  });

  // Contract write for approving PYUSD
  const { writeAsync: approvePYUSD } = useContractWrite({
    address: PYUSD_ADDRESS as `0x${string}`,
    abi: PYUSD_ABI,
    functionName: 'approve',
  });

  // Wait for approval transaction
  const { isLoading: isApprovalTxPending, isSuccess: isApprovalTxSuccess } = useWaitForTransaction({
    hash: approvalTxHash,
  });

  // Wait for buy transaction
  const { isLoading: isBuyTxPending, isSuccess: isBuyTxSuccess } = useWaitForTransaction({
    hash: buyTxHash,
  });

  // Read PYUSD balance
  const { data: pyusdBalance } = useContractRead({
    address: PYUSD_ADDRESS as `0x${string}`,
    abi: PYUSD_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    watch: true,
    enabled: !!address,
  });

  // Read current allowance
  const { data: currentAllowance, refetch: refetchAllowance } = useContractRead({
    address: PYUSD_ADDRESS as `0x${string}`,
    abi: PYUSD_ABI,
    functionName: 'allowance',
    args: address ? [address, ECHOLNK_NFT_ADDRESS] : undefined,
    watch: true,
    enabled: !!address,
  });

  const handleEchoBuy = async (tokenId: bigint) => {
    if (!isConnected || !address) {
      alert('Please connect your wallet first');
      return;
    }

    // Find the Echo data to get purchase price
    const echo = availableEchos.find(e => e.tokenId === Number(tokenId));
    if (!echo) {
      alert('Echo not found');
      return;
    }

    const purchasePrice = echo.purchasePrice;
    const purchasePriceInWei = purchasePrice;

    console.log('Buying Echo:', tokenId, 'Price:', formatUnits(purchasePrice, 6));

    try {
      setIsBuying(true);

      // Check if user has enough PYUSD
      if (pyusdBalance && (pyusdBalance as bigint) < purchasePriceInWei) {
        const balance = formatUnits(pyusdBalance as bigint, PYUSD_DECIMALS);
        const required = formatUnits(purchasePriceInWei, PYUSD_DECIMALS);
        alert(`Insufficient PYUSD balance. You have ${balance} PYUSD but need ${required} PYUSD`);
        return;
      }

      // Set the token being bought
      setBuyingTokenId(Number(tokenId));

      // Always approve first (like ChatInterface does)
      console.log('🔐 Step 1: Approving PYUSD spend...');
      setBuyStep('approving');
      
      const approveTx = await approvePYUSD({
        args: [ECHOLNK_NFT_ADDRESS, purchasePriceInWei],
      });
      
      console.log('✅ Approval transaction sent:', approveTx.hash);
      setApprovalTxHash(approveTx.hash);
      setPendingBuyTokenId(tokenId);
      
      // Wait for approval to complete - useEffect will handle the buy after approval
      return;

    } catch (error: any) {
      console.error('Buy transaction failed:', error);
      alert(`Buy failed: ${error.message || 'Unknown error'}`);
      setIsBuying(false);
      setBuyStep('idle');
      setPendingBuyTokenId(null);
      setApprovalTxHash(undefined);
      setBuyingTokenId(null);
    }
  };

  // Handle successful approval - proceed with buy
  useEffect(() => {
    const executeBuy = async () => {
      if (isApprovalTxSuccess && buyStep === 'approving' && pendingBuyTokenId) {
        console.log('✅ Approval confirmed on-chain');
        setBuyStep('approved');

        // Refetch allowance to ensure it's updated
        await refetchAllowance();

        try {
          console.log('💸 Step 2: Executing buy transaction...');
          const buyTx = await buyEcho({
            args: [pendingBuyTokenId],
          });

          console.log('✅ Buy transaction sent:', buyTx.hash);
          setBuyTxHash(buyTx.hash);
          setBuyStep('buying');
        } catch (error: any) {
          console.error('❌ Buy transaction failed:', error);
          alert(`Buy failed: ${error.message || 'Unknown error'}`);
          setIsBuying(false);
          setPendingBuyTokenId(null);
          setBuyStep('idle');
          setBuyingTokenId(null);
        }
      }
    };

    executeBuy();
  }, [isApprovalTxSuccess, buyStep, pendingBuyTokenId]);

  // Handle successful purchase
  useEffect(() => {
    if (isBuyTxSuccess && buyStep === 'buying') {
      console.log('🎉 Buy transaction confirmed on-chain');
      setBuyStep('complete');
      alert('🎉 Echo purchased successfully! You now own this Echo and have unlimited access.');
      // Clear pending state
      setPendingBuyTokenId(null);
      setApprovalTxHash(undefined);
      setIsBuying(false);
      setBuyStep('idle');
      setBuyingTokenId(null);
      // Refresh the Echo list to update ownership status
      scanForAllEchos();
    }
  }, [isBuyTxSuccess, buyStep]);

  // Function to refresh Echo data
  const scanForAllEchos = async () => {
    setIsScanning(true);
    const foundEchos: EchoInfo[] = [];

    try {
      // Get total number of Echos first
      const totalEchos = await readContract({
        address: ECHOLNK_NFT_ADDRESS as `0x${string}`,
        abi: ECHO_NFT_ABI,
        functionName: 'getTotalEchoes',
      });

      const totalCount = Number(totalEchos);
      console.log(`Found ${totalCount} total Echos`);

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
          // Get individual Echo data
          const echoData = await readContract({
            address: ECHOLNK_NFT_ADDRESS as `0x${string}`,
            abi: ECHO_NFT_ABI,
            functionName: 'getEchoData',
            args: [BigInt(tokenId)],
          });

          const [name, description, creator, pricePerQuery, purchasePrice, isActive, isForSale, owner] = echoData as unknown as [
            string, string, `0x${string}`, bigint, bigint, boolean, boolean, `0x${string}`
          ];

          // Skip inactive Echos
          if (!isActive) {
            continue;
          }

          const { totalQueries } = await fetchEchoQueryStats(tokenId);
          const isCreatorActive = totalQueries > ACTIVITY_THRESHOLD; 
          const hardcoded = hardcodedData[tokenId] || {
            name: name || `Echo #${tokenId}`,
            description: description || "An AI entity containing a unique body of knowledge, ready for you to explore.",
            imageUrl: `https://source.unsplash.com/random/800x600?sig=${tokenId}`
          };
          
          // Check if current user owns this Echo
          const isOwned = address && (owner as string).toLowerCase() === address.toLowerCase();

          foundEchos.push({
            tokenId: tokenId,
            owner: owner as string,
            creator: creator,
            isCreatorActive: isCreatorActive,
            totalQueries: totalQueries,
            pricePerQuery: pricePerQuery,
            purchasePrice: purchasePrice,
            isForSale: isForSale,
            isOwned: isOwned || false,
            ...hardcoded
          });

        } catch (error) {
          console.warn(`Failed to fetch data for token ${tokenId}. Skipping.`, error);
          // Skip this Echo if we can't fetch its data
          continue;
        }
      }

    } catch (error) {
      console.error('❌ Failed to fetch all Echos:', error);
    }

    setAvailableEchos(foundEchos);
    setIsScanning(false);
  };


  useEffect(() => {
    scanForAllEchos();
  }, []); 


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

  if (selectedTokenId) {
    return (
      <div className="max-w-5xl mx-auto py-8">
        <button
          onClick={() => setSelectedTokenId(null)}
          className="mb-6 px-5 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-semibold shadow-sm"
        >
          ← Back to Echo Gallery
        </button>
        <ChatInterface 
          tokenId={selectedTokenId} 
          isOwned={availableEchos.find(e => e.tokenId === Number(selectedTokenId))?.isOwned || false}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-12">
        {/* Header Section */}
        <div className="text-center mb-12 animate-fade-in">
          <h1 className="text-5xl lg:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-700 mb-4">
            Knowledge Echo Marketplace
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Discover and interact with Blockscout-verified, AI-powered Knowledge Echos from creators worldwide
          </p>
        </div>

        {/* Loading State */}
        {isScanning && (
          <div className="text-center py-20">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-12 shadow-xl max-w-md mx-auto">
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-gradient-to-r from-blue-500 to-purple-600 mx-auto mb-6"></div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Scanning Blockchain</h3>
              <p className="text-gray-600">Discovering Knowledge Echos...</p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isScanning && availableEchos.length === 0 && (
          <div className="text-center py-20">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-12 shadow-xl max-w-md mx-auto">
              <div className="text-6xl mb-6">🔮</div>
              <h3 className="text-2xl font-semibold text-gray-800 mb-4">No Echos Found</h3>
              <p className="text-gray-600 mb-6">Be the first to create a Knowledge Echo NFT!</p>
              <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-6 py-3 rounded-lg font-semibold">
                Create Your First Echo
              </div>
            </div>
          </div>
        )}

        {/* Echo Grid */}
        {availableEchos.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {availableEchos.sort((a, b) => b.tokenId - a.tokenId).map((echo, index) => (
              <div 
                key={echo.tokenId}
                className="animate-slide-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <EchoCard 
                  echo={echo} 
                  onSelect={setSelectedTokenId} 
                  onBuy={handleEchoBuy}
                  onViewContent={handleViewContent}
                  isBuying={buyingTokenId === echo.tokenId && (isBuying || isBuyPending || isBuyTxPending || isApprovalTxPending)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};