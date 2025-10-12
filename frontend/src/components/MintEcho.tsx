import React, { useState } from 'react';
import { useAccount, useContractWrite, useWaitForTransaction } from 'wagmi';
import { ECHOLNK_NFT_ADDRESS } from '../config/contracts';

export const MintEcho: React.FC = () => {
  const [knowledgeHash, setKnowledgeHash] = useState('');
  const { address } = useAccount();

  const ECHO_NFT_ABI = [
    // --- ERC721 Standard Functions ---
    {
      "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }],
      "name": "ownerOf",
      "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [{ "internalType": "address", "name": "owner", "type": "address" }],
      "name": "balanceOf",
      "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
      "stateMutability": "view",
      "type": "function"
    },
  
    // --- Custom EchoNFT Functions ---
    {
      "inputs": [
        { "internalType": "address", "name": "creator", "type": "address" },
        { "internalType": "string", "name": "knowledgeHash", "type": "string" }
      ],
      "name": "safeMint",
      "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
      "stateMutability": "nonpayable",
      "type": "function"
    },
  
    // ✅ Replaced problematic echoData mapping getter with explicit getter function
    {
      "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }],
      "name": "getEchoData",
      "outputs": [
        { "internalType": "string", "name": "knowledgeHash", "type": "string" },
        { "internalType": "address", "name": "creator", "type": "address" }
      ],
      "stateMutability": "view",
      "type": "function"
    },
  
    // --- Metadata ---
    {
      "inputs": [],
      "name": "name",
      "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "symbol",
      "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
      "stateMutability": "view",
      "type": "function"
    },
  
    // --- Ownership ---
    {
      "inputs": [],
      "name": "owner",
      "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [{ "internalType": "address", "name": "newOwner", "type": "address" }],
      "name": "transferOwnership",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ];

  const { data, write, isLoading: isWriteLoading } = useContractWrite({
    address: ECHOLNK_NFT_ADDRESS,
    abi: ECHO_NFT_ABI,
    functionName: 'safeMint',
  });

  const { isLoading: isTransactionLoading, isSuccess } = useWaitForTransaction({
    hash: data?.hash,
  });

  const handleMint = () => {
    if (!address || !knowledgeHash) return;
    
    write({
      args: [address, knowledgeHash],
    });
  };

  return (
    <div className="mint-echo-container">
      <h2 className="text-2xl font-bold mb-4">Mint Your Echo NFT</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Knowledge Hash
          </label>
          <input
            type="text"
            value={knowledgeHash}
            onChange={(e) => setKnowledgeHash(e.target.value)}
            placeholder="Enter knowledge hash or identifier"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={!address}
          />
          <p className="text-sm text-gray-500 mt-1">
            This can be any text representing your knowledge content
          </p>
        </div>

        <button
          onClick={handleMint}
          disabled={!address || !knowledgeHash || isWriteLoading || isTransactionLoading}
          className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold 
                     hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed
                     transition-colors duration-200"
        >
          {isWriteLoading || isTransactionLoading ? 'Minting...' : 'Mint Echo'}
        </button>

        {isSuccess && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
            ✅ Echo NFT minted successfully!
          </div>
        )}

        {!address && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
            ⚠️ Please connect your wallet to mint an Echo
          </div>
        )}
      </div>
    </div>
  );
};

