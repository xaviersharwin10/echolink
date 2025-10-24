import React, { useState } from 'react';
import { useAccount, useContractWrite, useWaitForTransaction, useContractRead } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { useNotification } from '@blockscout/app-sdk';
import { ECHOLNK_NFT_ADDRESS, ECHO_NFT_ABI } from '../config/contracts';

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

export const CreditManager: React.FC = () => {
  const [purchaseAmount, setPurchaseAmount] = useState('1.0');
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const { address, isConnected } = useAccount();
  const { openTxToast } = useNotification();

  // Read PYUSD balance
  const { data: pyusdBalance, refetch: refetchBalance } = useContractRead({
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

  // Read user credits
  const { data: userCredits, refetch: refetchCredits } = useContractRead({
    address: ECHOLNK_NFT_ADDRESS as `0x${string}`,
    abi: ECHO_NFT_ABI,
    functionName: 'getUserCredits',
    args: address ? [address] : undefined,
    watch: true,
    enabled: !!address,
  });

  // Approve PYUSD
  const { writeAsync: approvePYUSD, data: approveTxData } = useContractWrite({
    address: PYUSD_ADDRESS as `0x${string}`,
    abi: PYUSD_ABI,
    functionName: 'approve',
  });

  const { isLoading: isApprovePending, isSuccess: isApproveSuccess } = useWaitForTransaction({
    hash: approveTxData?.hash,
  });

  // Purchase credits
  const { writeAsync: purchaseCredits, data: purchaseTxData } = useContractWrite({
    address: ECHOLNK_NFT_ADDRESS as `0x${string}`,
    abi: ECHO_NFT_ABI,
    functionName: 'purchaseCredits',
  });

  const { isLoading: isPurchasePending, isSuccess: isPurchaseSuccess } = useWaitForTransaction({
    hash: purchaseTxData?.hash,
  });

  const handlePurchaseCredits = async () => {
    if (!address || !purchaseAmount) return;

    const amount = parseUnits(purchaseAmount, PYUSD_DECIMALS);
    const requiredAllowance = amount;

    // Check PYUSD balance first
    if (!pyusdBalance || (pyusdBalance as bigint) < amount) {
      const balance = formatUnits(pyusdBalance as bigint || BigInt(0), PYUSD_DECIMALS);
      const required = formatUnits(amount, PYUSD_DECIMALS);
      alert(`Insufficient PYUSD balance. You have ${balance} PYUSD but need ${required} PYUSD`);
      return;
    }

    // Check if we need to approve first
    if (!currentAllowance || (currentAllowance as bigint) < requiredAllowance) {
      try {
        console.log('🔐 Approving PYUSD for credit purchase...');
        console.log('💰 Required allowance:', requiredAllowance.toString());
        console.log('💰 Current allowance:', currentAllowance?.toString() || '0');
        
        setIsApproving(true);
        
        const approveTx = await approvePYUSD({
          args: [ECHOLNK_NFT_ADDRESS, requiredAllowance],
        });
        console.log('✅ Approval transaction sent:', approveTx.hash);
        openTxToast("11155111", approveTx.hash);
        
        // Wait for approval confirmation
        console.log('⏳ Waiting for approval confirmation...');
        
        // Wait for the approval transaction to be confirmed
        let approvalConfirmed = false;
        let attempts = 0;
        const maxAttempts = 30; // 30 seconds max wait
        
        while (!approvalConfirmed && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
          attempts++;
          
          // Check if approval was successful
          if (isApproveSuccess) {
            approvalConfirmed = true;
            console.log('✅ Approval transaction confirmed');
            break;
          }
          
          // Refetch allowance to check if it was updated
          await refetchAllowance();
        }
        
        setIsApproving(false);
        
        if (!approvalConfirmed) {
          console.error('❌ Approval confirmation timeout');
          alert('Approval is taking too long. Please check your wallet and try again.');
          return;
        }
        
        console.log('✅ Approval confirmed, proceeding with purchase');
        
        // Now proceed with the purchase transaction immediately
        try {
          console.log('💳 Purchasing credits...');
          console.log('💰 Amount:', amount.toString());
          setIsPurchasing(true);
          
          const purchaseTx = await purchaseCredits({
            args: [amount],
          });
          console.log('✅ Purchase transaction sent:', purchaseTx.hash);
          openTxToast("11155111", purchaseTx.hash);
          
        } catch (error) {
          console.error('❌ Credit purchase failed:', error);
          setIsPurchasing(false);
          
          // Provide more detailed error information
          if (error instanceof Error) {
            if (error.message.includes('insufficient')) {
              alert('Insufficient PYUSD balance. Please check your balance and try again.');
            } else if (error.message.includes('allowance')) {
              alert('Insufficient allowance. Please approve more PYUSD and try again.');
            } else {
              alert(`Credit purchase failed: ${error.message}`);
            }
          } else {
            alert('Credit purchase failed. Please check your wallet and try again.');
          }
          return;
        }
      } catch (error) {
        console.error('❌ Approval failed:', error);
        setIsApproving(false);
        alert('Approval failed. Please check your wallet and try again.');
        return;
      }
    } else {
      // No approval needed, proceed directly with purchase
      try {
        console.log('💳 Purchasing credits...');
        console.log('💰 Amount:', amount.toString());
        setIsPurchasing(true);
        
        const purchaseTx = await purchaseCredits({
          args: [amount],
        });
        console.log('✅ Purchase transaction sent:', purchaseTx.hash);
        openTxToast("11155111", purchaseTx.hash);
        
      } catch (error) {
        console.error('❌ Credit purchase failed:', error);
        setIsPurchasing(false);
        
        // Provide more detailed error information
        if (error instanceof Error) {
          if (error.message.includes('insufficient')) {
            alert('Insufficient PYUSD balance. Please check your balance and try again.');
          } else if (error.message.includes('allowance')) {
            alert('Insufficient allowance. Please approve more PYUSD and try again.');
          } else {
            alert(`Credit purchase failed: ${error.message}`);
          }
        } else {
          alert('Credit purchase failed. Please check your wallet and try again.');
        }
        return;
      }
    }
  };

  // Handle successful purchase
  React.useEffect(() => {
    if (isPurchaseSuccess) {
      console.log('🎉 Credits purchased successfully!');
      setIsPurchasing(false);
      setPurchaseAmount('1.0');
      refetchBalance();
      refetchCredits();
    }
  }, [isPurchaseSuccess, refetchBalance, refetchCredits]);

  const formatBalance = (balance: bigint | undefined) => {
    if (!balance) return '0';
    return formatUnits(balance, PYUSD_DECIMALS);
  };

  const formatCredits = (credits: bigint | undefined) => {
    if (!credits) return '0';
    return credits.toString();
  };

  // Extract credit data with proper typing
  const creditBalance = userCredits && Array.isArray(userCredits) ? userCredits[0] as bigint : undefined;
  const creditLastUpdated = userCredits && Array.isArray(userCredits) ? userCredits[1] as bigint : undefined;

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl max-w-md mx-auto">
            <div className="text-6xl mb-4">🔗</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Connect Your Wallet</h3>
            <p className="text-gray-600">Please connect your wallet to manage credits</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Header Section */}
          <div className="text-center mb-12 animate-fade-in">
            <h2 className="text-5xl lg:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-700 mb-4">
              💳 Credit Manager
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Purchase credits to pay for Echo queries without individual transactions
            </p>
          </div>

          {/* Current Balance */}
          <div className="mb-8 animate-fade-in-delay">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-gray-200/50">
              <div className="flex items-center mb-6">
                <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center text-white font-bold mr-3">
                  💰
                </div>
                <h3 className="text-2xl font-semibold text-gray-800">Current Balance</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200 hover:shadow-lg transition-all duration-300">
                  <div className="flex items-center mb-3">
                    <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm mr-2">💰</div>
                    <div className="text-sm font-medium text-blue-600">PYUSD Balance</div>
                  </div>
                  <div className="text-3xl font-bold text-blue-800 mb-1">
                    {formatBalance(pyusdBalance as bigint)} PYUSD
                  </div>
                  <div className="text-xs text-blue-600">Available for credit purchases</div>
                </div>
                
                <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-xl p-6 border border-green-200 hover:shadow-lg transition-all duration-300">
                  <div className="flex items-center mb-3">
                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-sm mr-2">💳</div>
                    <div className="text-sm font-medium text-green-600">Credits Balance</div>
                  </div>
                  <div className="text-3xl font-bold text-green-800 mb-1">
                    {formatCredits(creditBalance)} Credits
                  </div>
                  <div className="text-xs text-green-600">
                    = {((Number(creditBalance || 0)) * 0.01).toFixed(2)} PYUSD value
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Purchase Credits */}
          <div className="mb-8 animate-fade-in-delay-2">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-gray-200/50">
              <div className="flex items-center mb-6">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold mr-3">
                  💳
                </div>
                <h3 className="text-2xl font-semibold text-gray-800">Purchase Credits</h3>
              </div>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    PYUSD Amount to Purchase
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={purchaseAmount}
                    onChange={(e) => setPurchaseAmount(e.target.value)}
                    className="w-full px-6 py-4 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg shadow-sm"
                    disabled={isPurchasing || isPurchasePending}
                  />
                  <div className="mt-3 bg-blue-50 rounded-xl p-4 border border-blue-200">
                    <p className="text-sm text-blue-700">
                      <span className="font-semibold">You'll receive {Math.floor(parseFloat(purchaseAmount || '0') * 100)} credits</span>
                      <br />
                      <span className="text-xs">Exchange rate: 1 PYUSD = 100 credits</span>
                    </p>
                  </div>
                </div>

                <button
                  onClick={handlePurchaseCredits}
                  disabled={!purchaseAmount || isPurchasing || isPurchasePending || isApproving}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 px-8 rounded-2xl font-semibold 
                             hover:from-blue-700 hover:to-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed
                             transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  {isApproving ? 'Approving...' : 
                   isPurchasing || isPurchasePending ? 'Processing...' : 
                   `Purchase ${purchaseAmount} PYUSD Credits`}
                </button>

                {isPurchaseSuccess && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-6 py-4 rounded-2xl animate-fade-in">
                    <div className="flex items-center">
                      <div className="text-2xl mr-3">✅</div>
                      <div>
                        <div className="font-semibold">Credits purchased successfully!</div>
                        <div className="text-sm opacity-80">Your credits have been added to your account</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Credit System Info */}
          <div className="animate-fade-in-delay-2">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-gray-200/50">
              <div className="flex items-center mb-6">
                <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center text-white font-bold mr-3">
                  ℹ️
                </div>
                <h3 className="text-2xl font-semibold text-gray-800">How Credits Work</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold mr-3">💱</div>
                    <div>
                      <div className="font-semibold text-blue-800">Exchange Rate</div>
                      <div className="text-sm text-blue-600">1 PYUSD = 100 credits</div>
                    </div>
                  </div>
                  <div className="flex items-center p-4 bg-green-50 rounded-xl border border-green-200">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white font-bold mr-3">⚡</div>
                    <div>
                      <div className="font-semibold text-green-800">Instant Usage</div>
                      <div className="text-sm text-green-600">No individual transactions needed</div>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center p-4 bg-purple-50 rounded-xl border border-purple-200">
                    <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold mr-3">🔄</div>
                    <div>
                      <div className="font-semibold text-purple-800">Auto Deduction</div>
                      <div className="text-sm text-purple-600">Credits deducted automatically</div>
                    </div>
                  </div>
                  <div className="flex items-center p-4 bg-orange-50 rounded-xl border border-orange-200">
                    <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold mr-3">♾️</div>
                    <div>
                      <div className="font-semibold text-orange-800">Never Expire</div>
                      <div className="text-sm text-orange-600">Credits last forever</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
