import React, { useState, useEffect } from 'react';
import { useNotification } from '@blockscout/app-sdk';
import { useAccount, useContractWrite, useWaitForTransaction, useContractRead, useChainId } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { QUERY_PAYMENTS_ADDRESS, QUERY_PAYMENTS_ABI, ECHOLNK_NFT_ADDRESS, ECHO_NFT_ABI } from '../config/contracts';
import { EchoAnalytics } from './EchoAnalytics';

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

// ✅ EchoNFT ABI - Add your actual contract address
const ECHO_NFT_ADDRESS = ECHOLNK_NFT_ADDRESS; // TODO: Replace this

const QUERY_PAYMENTS_CONTRACT_ADDRESS = QUERY_PAYMENTS_ADDRESS;

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

type PaymentStep = 'idle' | 'approving' | 'approved' | 'paying' | 'paid' | 'using_credits' | 'credits_used';
type PaymentMethod = 'microtransaction' | 'credits';

interface ChatInterfaceProps {
  tokenId: bigint; // ✅ Accept tokenId as prop
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ tokenId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('credits');
  
  const [paymentStep, setPaymentStep] = useState<PaymentStep>('idle');
  const [approveTxHash, setApproveTxHash] = useState<`0x${string}` | undefined>();
  const [paymentTxHash, setPaymentTxHash] = useState<`0x${string}` | undefined>();
  const [creditTxHash, setCreditTxHash] = useState<`0x${string}` | undefined>();

  const { address, isConnected } = useAccount();
  const chainId = useChainId()
  const { openTxToast } = useNotification();

  // ✅ Fetch Echo data from EchoNFT contract
  const { data: echoData, isError: echoDataError, isLoading: echoDataLoading } = useContractRead({
    address: ECHO_NFT_ADDRESS as `0x${string}`,
    abi: ECHO_NFT_ABI,
    functionName: 'getEchoData',
    args: [tokenId],
    enabled: !!tokenId,
  });

  // ✅ Extract Echo data from the struct
  // echoData returns a tuple: [name: string, description: string, creator: address, pricePerQuery: uint256, isActive: bool]
  const [echoName, echoDescription, creatorAddress, pricePerQuery, isActive] = (echoData as [string, string, string, bigint, boolean]) || [undefined, undefined, undefined, undefined, undefined];
  console.log('🔍 Echo data:', { echoName, echoDescription, creatorAddress, pricePerQuery, isActive });

  // ✅ Read PYUSD balance
  const { data: pyusdBalance, refetch: refetchBalance } = useContractRead({
    address: PYUSD_ADDRESS as `0x${string}`,
    abi: PYUSD_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    watch: true,
    enabled: !!address,
  });

  // ✅ Read current allowance
  const { data: currentAllowance, refetch: refetchAllowance } = useContractRead({
    address: PYUSD_ADDRESS as `0x${string}`,
    abi: PYUSD_ABI,
    functionName: 'allowance',
    args: address ? [address, QUERY_PAYMENTS_CONTRACT_ADDRESS] : undefined,
    watch: true,
    enabled: !!address,
  });

  // ✅ Read user credits
  const { data: userCredits, refetch: refetchCredits } = useContractRead({
    address: ECHOLNK_NFT_ADDRESS as `0x${string}`,
    abi: ECHO_NFT_ABI,
    functionName: 'getUserCredits',
    args: address ? [address] : undefined,
    watch: true,
    enabled: !!address,
  });

  console.log('🧠 ChatInterface mounted.');
  console.log('🎫 Token ID:', tokenId.toString());
  console.log('👤 Creator Address:', creatorAddress);
  console.log('💼 Connected wallet:', address);
  console.log('🔗 QueryPayments contract:', QUERY_PAYMENTS_CONTRACT_ADDRESS);
  console.log('💰 PYUSD contract:', PYUSD_ADDRESS);
  
  if (pyusdBalance) {
    console.log('💵 PYUSD Balance:', formatUnits(pyusdBalance as bigint, PYUSD_DECIMALS), 'PYUSD');
  }
  if (currentAllowance) {
    console.log('✅ Current Allowance:', formatUnits(currentAllowance as bigint, PYUSD_DECIMALS), 'PYUSD');
  }

  // STEP 1: Approve PYUSD
  const { writeAsync: approvePYUSD } = useContractWrite({
    address: PYUSD_ADDRESS as `0x${string}`,
    abi: PYUSD_ABI,
    functionName: 'approve',
  });

  // STEP 2: Process payment
  const { writeAsync: processPayment } = useContractWrite({
    address: QUERY_PAYMENTS_CONTRACT_ADDRESS as `0x${string}`,
    abi: QUERY_PAYMENTS_ABI,
    functionName: 'processQueryPayment',
  });

  // STEP 2B: Use credits for query
  const { writeAsync: executeCreditsForQuery } = useContractWrite({
    address: ECHOLNK_NFT_ADDRESS as `0x${string}`,
    abi: ECHO_NFT_ABI,
    functionName: 'useCreditsForQuery',
  });

  const { isLoading: isApprovePending, isSuccess: isApproveSuccess } = useWaitForTransaction({
    hash: approveTxHash,
  });

  const { isLoading: isPaymentPending, isSuccess: isPaymentSuccess } = useWaitForTransaction({
    hash: paymentTxHash,
  });

  const { isLoading: isCreditPending, isSuccess: isCreditSuccess } = useWaitForTransaction({
    hash: creditTxHash,
  });

  // Handle approval success
  useEffect(() => {
    const executePayment = async () => {
      if (isApproveSuccess && paymentStep === 'approving' && creatorAddress) {  
        console.log('✅ Approval confirmed on-chain');
        setPaymentStep('approved');

        await refetchAllowance();

        try {
          console.log('💸 Step 2: Initiating processQueryPayment...');
          console.log('💸 Paying creator:', creatorAddress);
          const queryCost = pricePerQuery ? Number(pricePerQuery) / 1000000 : 0.1; // Convert from wei to PYUSD
          const amount = parseUnits(queryCost.toString(), PYUSD_DECIMALS);
          
          const paymentTx = await processPayment({
            args: [creatorAddress as `0x${string}`, amount, tokenId], // ✅ Using dynamic creator address
          });
          console.log('✅ Payment transaction sent:', paymentTx.hash);
          openTxToast(chainId.toString(), paymentTx.hash);
          setPaymentTxHash(paymentTx.hash);
          setPaymentStep('paying');
        } catch (error: any) {
          console.error('❌ Payment transaction failed:', error);
          handlePaymentError(error);
        }
      }
    };

    executePayment();
  }, [isApproveSuccess, paymentStep, creatorAddress]);

  // Handle payment success
  useEffect(() => {
    const callAIBackend = async () => {
      if (isPaymentSuccess && paymentStep === 'paying') {
        console.log('🎉 Payment confirmed on-chain');
        setPaymentStep('paid');

        await refetchBalance();

        try {
          console.log('📡 Sending question to backend:', currentQuestion);
          console.log('💰 Payment transaction hash:', paymentTxHash);
          console.log('👤 User address:', address);
          
          const response = await fetch('http://localhost:3001/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              query: currentQuestion,
              token_id: tokenId.toString(),
              payment_tx_hash: paymentTxHash,
              user_address: address,
              use_credits: false,
            }),
          });

          console.log('✅ Backend responded:', response.status);
          const data = await response.json();
          console.log('📦 AI response data:', data);

          setMessages(prev => [
            ...prev,
            {
              role: 'assistant',
              content: data.answer || 'Sorry, I could not process your request.',
            },
          ]);
        } catch (error) {
          console.error('❌ Error querying backend:', error);
          setMessages(prev => [
            ...prev,
            { role: 'assistant', content: 'Error: Could not connect to the backend.' },
          ]);
        } finally {
          resetPaymentFlow();
        }
      }
    };

    callAIBackend();
  }, [isPaymentSuccess, paymentStep, currentQuestion, tokenId]);

  // Handle credit success
  useEffect(() => {
    const callAIBackendWithCredits = async () => {
      if (isCreditSuccess && paymentStep === 'using_credits') {
        console.log('🎉 Credits used successfully');
        setPaymentStep('credits_used');

        await refetchCredits();

        try {
          console.log('📡 Sending question to backend with credits:', currentQuestion);
          console.log('💳 Credit transaction hash:', creditTxHash);
          console.log('👤 User address:', address);
          
          const response = await fetch('http://localhost:3001/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              query: currentQuestion,
              token_id: tokenId.toString(),
              payment_tx_hash: creditTxHash,
              user_address: address,
              use_credits: true,
            }),
          });

          console.log('✅ Backend responded:', response.status);
          const data = await response.json();
          console.log('📦 AI response data:', data);

          setMessages(prev => [
            ...prev,
            {
              role: 'assistant',
              content: data.answer || 'Sorry, I could not process your request.',
            },
          ]);
        } catch (error) {
          console.error('❌ Error querying backend:', error);
          setMessages(prev => [
            ...prev,
            { role: 'assistant', content: 'Error: Could not connect to the backend.' },
          ]);
        } finally {
          resetPaymentFlow();
        }
      }
    };

    callAIBackendWithCredits();
  }, [isCreditSuccess, paymentStep, currentQuestion, tokenId]);

  const resetPaymentFlow = () => {
    setIsLoading(false);
    setPaymentStep('idle');
    setApproveTxHash(undefined);
    setPaymentTxHash(undefined);
    setCreditTxHash(undefined);
    setCurrentQuestion('');
  };

  const handlePaymentError = (error: any) => {
    console.error('❌ Payment flow failed:');
    console.error('   ↳ Error name:', error.name);
    console.error('   ↳ Message:', error.message);
    console.error('   ↳ Full error object:', error);

    let readableError = 'Payment failed. Please check your wallet and try again.';
    if (error?.shortMessage) readableError = error.shortMessage;
    if (error?.cause?.message) readableError = error.cause.message;

    setMessages(prev => [
      ...prev,
      { role: 'assistant', content: `❌ Payment failed: ${readableError}` },
    ]);
    
    resetPaymentFlow();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log('🟢 handleSubmit triggered');
    if (!input.trim()) {
      console.warn('⚠️ Input is empty');
      return;
    }
    if (!isConnected || !address) {
      console.error('❌ No wallet connected');
      alert('Please connect your wallet first.');
      return;
    }

    // ✅ Check if creator address is loaded
    if (!creatorAddress) {
      console.error('❌ Creator address not loaded');
      alert('Echo data is still loading. Please wait...');
      return;
    }

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setCurrentQuestion(input);
    setInput('');
    setIsLoading(true);

    const queryCost = pricePerQuery ? Number(pricePerQuery) / 1000000 : 0.1; // Convert from wei to PYUSD
    const requiredCredits = Math.ceil(queryCost * 100); // 1 PYUSD = 100 credits

    // Extract credit balance
    const creditBalance = userCredits && Array.isArray(userCredits) ? userCredits[0] as bigint : BigInt(0);

    if (paymentMethod === 'credits') {
      // Check if user has enough credits
      if (creditBalance < BigInt(requiredCredits)) {
        alert(`Insufficient credits. You have ${creditBalance.toString()} credits but need ${requiredCredits} credits (${queryCost} PYUSD)`);
        setIsLoading(false);
        return;
      }

      try {
        console.log('💳 Using credits for query...');
        setPaymentStep('using_credits');
        
        const creditTx = await executeCreditsForQuery({
          args: [address, tokenId, BigInt(requiredCredits)],
        });
        
        console.log('✅ Credit transaction sent:', creditTx.hash);
        openTxToast(chainId.toString(), creditTx.hash);
        setCreditTxHash(creditTx.hash);
        
      } catch (error: any) {
        handlePaymentError(error);
      }
    } else {
      // Microtransaction flow
      const requiredAmount = parseUnits(queryCost.toString(), PYUSD_DECIMALS);
      if (pyusdBalance && (pyusdBalance as bigint) < requiredAmount) {
        const balance = formatUnits(pyusdBalance as bigint, PYUSD_DECIMALS);
        alert(`Insufficient PYUSD balance. You have ${balance} PYUSD but need ${queryCost} PYUSD`);
        setIsLoading(false);
        return;
      }

      try {
        console.log('🔐 Step 1: Approving PYUSD spend...');
        setPaymentStep('approving');
        
        const amount = parseUnits(queryCost.toString(), PYUSD_DECIMALS);
        console.log('💰 Approving amount:', amount.toString(), 'raw units');
        
        const approveTx = await approvePYUSD({
          args: [QUERY_PAYMENTS_CONTRACT_ADDRESS, amount],
        });
        
        console.log('✅ Approval transaction sent:', approveTx.hash);
        openTxToast(chainId.toString(), approveTx.hash); // "11155111" is the chain ID for Sepolia
        setApproveTxHash(approveTx.hash);
        
      } catch (error: any) {
        handlePaymentError(error);
      }
    }
  };

  const getStatusMessage = () => {
    if (paymentStep === 'approving' || isApprovePending) {
      return 'Approving PYUSD spend...';
    }
    if (paymentStep === 'approved') {
      return 'Approval confirmed, initiating payment...';
    }
    if (paymentStep === 'paying' || isPaymentPending) {
      return 'Processing payment on-chain...';
    }
    if (paymentStep === 'paid') {
      return 'Querying AI...';
    }
    if (paymentStep === 'using_credits' || isCreditPending) {
      return 'Using credits for query...';
    }
    if (paymentStep === 'credits_used') {
      return 'Querying AI...';
    }
    return 'Processing...';
  };

  const formatBalance = (balance: bigint | undefined) => {
    if (!balance) return '0';
    return formatUnits(balance, PYUSD_DECIMALS);
  };

  // ✅ Show loading state while fetching echo data
  if (echoDataLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-6"></div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">Loading Echo Data</h3>
          <p className="text-gray-600">Fetching information about this Echo...</p>
        </div>
      </div>
    );
  }

  // ✅ Show error state if echo data fetch fails
  if (echoDataError || !creatorAddress) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl max-w-md mx-auto">
            <div className="text-6xl mb-4">❌</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Failed to Load Echo</h3>
            <p className="text-gray-600 mb-4">Token ID: {tokenId.toString()}</p>
            <p className="text-sm text-gray-500">This Echo may not exist or there was an error loading it.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header Section */}
          <div className="text-center mb-8 animate-fade-in">
            <h2 className="text-4xl lg:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-700 mb-4">
              💬 Chat with Echo #{tokenId.toString()}
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Interact with AI-powered knowledge and explore insights from this Echo
            </p>
          </div>

          {/* Echo Analytics */}
          {creatorAddress && (
            <div className="mb-8 animate-fade-in-delay">
              <EchoAnalytics creatorAddress={creatorAddress} tokenId={tokenId} />
            </div>
          )}

          {/* Echo Info Display */}
          <div className="mb-8 animate-fade-in-delay">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-purple-200/50">
              <div className="flex items-center mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold mr-3">
                  🎫
                </div>
                <h3 className="text-xl font-semibold text-gray-800">Echo Information</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center">
                    <span className="text-sm font-medium text-gray-600 w-20">Name:</span>
                    <span className="font-semibold text-gray-800">{echoName || 'Loading...'}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-sm font-medium text-gray-600 w-20">Token ID:</span>
                    <span className="font-mono text-gray-800">{tokenId.toString()}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-sm font-medium text-gray-600 w-20">Price:</span>
                    <span className="font-semibold text-green-600">{pricePerQuery ? `${(Number(pricePerQuery) / 1000000).toFixed(2)} PYUSD` : 'Loading...'}</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start">
                    <span className="text-sm font-medium text-gray-600 w-20">Creator:</span>
                    <span className="font-mono text-xs text-gray-700">{creatorAddress ? `${creatorAddress.slice(0, 6)}...${creatorAddress.slice(-4)}` : 'Loading...'}</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-sm font-medium text-gray-600 w-20">Description:</span>
                    <span className="text-sm text-gray-700">{echoDescription ? `${echoDescription.slice(0, 60)}...` : 'Loading...'}</span>
                  </div>
                  {isActive === false && (
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-gray-600 w-20">Status:</span>
                      <span className="text-red-600 text-sm font-semibold">⚠️ Inactive</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Balance Display */}
          {address && (
            <div className="mb-8 animate-fade-in-delay-2">
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-blue-200/50">
                <div className="flex items-center mb-4">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white font-bold mr-3">
                    💰
                  </div>
                  <h3 className="text-xl font-semibold text-gray-800">Wallet Information</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                    <div className="text-sm text-blue-600 mb-1">PYUSD Balance</div>
                    <div className="text-xl font-bold text-blue-800">
                      {formatBalance(pyusdBalance as bigint)} PYUSD
                    </div>
                  </div>
                  <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                    <div className="text-sm text-green-600 mb-1">Credits</div>
                    <div className="text-xl font-bold text-green-800">
                      {userCredits && Array.isArray(userCredits) ? userCredits[0].toString() : '0'} Credits
                    </div>
                  </div>
                  <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
                    <div className="text-sm text-purple-600 mb-1">Allowance</div>
                    <div className="text-xl font-bold text-purple-800">
                      {formatBalance(currentAllowance as bigint)} PYUSD
                    </div>
                  </div>
                </div>
                <div className="mt-4 text-sm text-gray-600 text-center">
                  📍 {address.slice(0, 6)}...{address.slice(-4)}
                </div>
              </div>
            </div>
          )}

          {/* Payment Method Selector */}
          {address && (
            <div className="mb-8 animate-fade-in-delay-2">
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-purple-200/50">
                <div className="flex items-center mb-4">
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold mr-3">
                    💳
                  </div>
                  <h3 className="text-xl font-semibold text-gray-800">Payment Method</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className={`cursor-pointer p-4 rounded-xl border-2 transition-all duration-300 ${
                    paymentMethod === 'credits' 
                      ? 'border-green-500 bg-green-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="credits"
                      checked={paymentMethod === 'credits'}
                      onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                      className="sr-only"
                    />
                    <div className="flex items-center">
                      <div className={`w-6 h-6 rounded-full border-2 mr-3 flex items-center justify-center ${
                        paymentMethod === 'credits' 
                          ? 'border-green-500 bg-green-500' 
                          : 'border-gray-300'
                      }`}>
                        {paymentMethod === 'credits' && (
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-800">💳 Use Credits</div>
                        <div className="text-sm text-gray-600">
                          {Math.ceil((pricePerQuery ? Number(pricePerQuery) / 1000000 : 0.1) * 100)} credits
                        </div>
                      </div>
                    </div>
                  </label>
                  
                  <label className={`cursor-pointer p-4 rounded-xl border-2 transition-all duration-300 ${
                    paymentMethod === 'microtransaction' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="microtransaction"
                      checked={paymentMethod === 'microtransaction'}
                      onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                      className="sr-only"
                    />
                    <div className="flex items-center">
                      <div className={`w-6 h-6 rounded-full border-2 mr-3 flex items-center justify-center ${
                        paymentMethod === 'microtransaction' 
                          ? 'border-blue-500 bg-blue-500' 
                          : 'border-gray-300'
                      }`}>
                        {paymentMethod === 'microtransaction' && (
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-800">💰 Direct Payment</div>
                        <div className="text-sm text-gray-600">
                          {(pricePerQuery ? Number(pricePerQuery) / 1000000 : 0.1).toFixed(2)} PYUSD
                        </div>
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Chat Area */}
          <div className="mb-8 animate-fade-in-delay-2">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50">
              <div className="p-6 border-b border-gray-200/50">
                <h3 className="text-xl font-semibold text-gray-800 flex items-center">
                  <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center text-white font-bold mr-3">
                    💬
                  </div>
                  Chat with Echo
                </h3>
              </div>
              <div className="p-6 h-96 overflow-y-auto space-y-4">
                {messages.length === 0 && !isLoading && (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">🤖</div>
                    <div className="text-gray-500 text-lg mb-2">Start a conversation with this Echo</div>
                    <div className="text-sm text-gray-400">
                      Each query costs {pricePerQuery ? `${(Number(pricePerQuery) / 1000000).toFixed(2)}` : '0.1'} PYUSD
                    </div>
                  </div>
                )}

                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`animate-slide-up ${
                      msg.role === 'user' 
                        ? 'ml-auto flex justify-end' 
                        : 'mr-auto flex justify-start'
                    }`}
                    style={{ animationDelay: `${idx * 0.1}s` }}
                  >
                    <div
                      className={`max-w-md p-4 rounded-2xl shadow-sm ${
                        msg.role === 'user' 
                          ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white' 
                          : 'bg-white border border-gray-200'
                      }`}
                    >
                      <div className="font-semibold text-sm mb-2 opacity-80">
                        {msg.role === 'user' ? 'You' : 'AI Assistant'}
                      </div>
                      <div className={msg.role === 'user' ? 'text-white' : 'text-gray-800'}>
                        {msg.content}
                      </div>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="mr-auto flex justify-start animate-pulse">
                    <div className="bg-white border border-gray-200 max-w-md p-4 rounded-2xl shadow-sm">
                      <div className="font-semibold text-sm mb-2 text-gray-600">AI Assistant</div>
                      <div className="text-gray-500 flex items-center gap-2">
                        <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                        {getStatusMessage()}
                      </div>
                      {approveTxHash && (
                        <div className="text-xs text-gray-400 mt-2">
                          Approval tx: {approveTxHash.slice(0, 10)}...
                        </div>
                      )}
                      {paymentTxHash && (
                        <div className="text-xs text-gray-400 mt-2">
                          Payment tx: {paymentTxHash.slice(0, 10)}...
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Input Form */}
          <div className="animate-fade-in-delay-2">
            <form onSubmit={handleSubmit} className="flex gap-4">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question..."
                className="flex-1 px-6 py-4 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg shadow-sm"
                disabled={isLoading || !address}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim() || !address}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 px-8 rounded-2xl font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                {isLoading ? 'Processing...' : 
                  paymentMethod === 'credits' 
                    ? `Send (${Math.ceil((pricePerQuery ? Number(pricePerQuery) / 1000000 : 0.1) * 100)} credits)`
                    : `Send (${pricePerQuery ? `${(Number(pricePerQuery) / 1000000).toFixed(2)}` : '0.1'} PYUSD)`
                }
              </button>
            </form>

            {!address && (
              <div className="mt-4 text-center">
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                  <p className="text-yellow-700 font-medium">🔗 Please connect your wallet to start chatting</p>
                </div>
              </div>
            )}
          </div>

          {/* Debug info */}
          {/* {process.env.NODE_ENV === 'development' && (
            <div className="mt-8 p-4 bg-gray-100 rounded-xl text-xs font-mono animate-fade-in-delay-2">
              <div>Token ID: {tokenId.toString()}</div>
              <div>Creator: {creatorAddress}</div>
              <div>Payment Method: {paymentMethod}</div>
              <div>Payment Step: {paymentStep}</div>
              <div>Approve Pending: {isApprovePending ? 'Yes' : 'No'}</div>
              <div>Payment Pending: {isPaymentPending ? 'Yes' : 'No'}</div>
              <div>Credit Pending: {isCreditPending ? 'Yes' : 'No'}</div>
              <div>Balance: {pyusdBalance?.toString() || 'N/A'} (raw units)</div>
              <div>Allowance: {currentAllowance?.toString() || 'N/A'} (raw units)</div>
              <div>Credits: {userCredits && Array.isArray(userCredits) ? userCredits[0].toString() : 'N/A'}</div>
            </div>
          )} */}
        </div>
      </div>
    </div>
  );
};