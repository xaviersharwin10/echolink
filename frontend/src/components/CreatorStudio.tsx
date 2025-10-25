import React, { useState, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { useDropzone } from 'react-dropzone';
import { MintEcho } from './MintEcho';
import { contentStorage } from '../services/contentStorage';

type WizardStep = 'upload' | 'processing' | 'configure' | 'minting';

interface EchoConfig {
  name: string;
  description: string;
  pricePerQuery: string;
  purchasePrice: string;
  isForSale: boolean;
  isFreeEcho: boolean;
}

interface ProcessingResult {
  knowledgeHash: string;
  tokenId: string;
  fileName: string;
  fileSize: number;
}

export const CreatorStudio: React.FC = () => {
  const [step, setStep] = useState<WizardStep>('upload');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null);
  const [originalFileData, setOriginalFileData] = useState<{
    fileName: string;
    fileSize: number;
    contentType: string;
    data: string;
  } | null>(null);
  const [echoConfig, setEchoConfig] = useState<EchoConfig>({
    name: '',
    description: '',
    pricePerQuery: '0.1', // Default price
    purchasePrice: '50.0',
    isForSale: true,
    isFreeEcho: false // Default to paid
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { address, isConnected } = useAccount();

  // File upload handler
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    const file = acceptedFiles[0];
    setUploadedFile(file);
    setError(null);
    setIsProcessing(true);
    setStep('processing');

    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', file);

      console.log('📤 Uploading file:', file.name, 'Size:', file.size);

      const response = await fetch('http://localhost:8000/api/ingest-single-knowledge', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();
      console.log('✅ Processing result:', result);

      setProcessingResult({
        knowledgeHash: result.knowledgeHash,
        tokenId: result.tokenId,
        fileName: file.name,
        fileSize: file.size
      });

      // Auto-fill Echo name from filename
      const nameFromFile = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
      setEchoConfig(prev => ({
        ...prev,
        name: nameFromFile
      }));

      // Convert file to base64 for storage
      const fileReader = new FileReader();
      fileReader.onload = async () => {
        const base64Data = (fileReader.result as string).split(',')[1]; // Remove data:type;base64, prefix
        
        // Store original file data in state for later use
        setOriginalFileData({
          fileName: file.name,
          fileSize: file.size,
          contentType: file.type,
          data: base64Data
        });
        
        // Store content in storage service
        try {
          await contentStorage.storeEchoContent(
            parseInt(result.tokenId),
            nameFromFile,
            '', // Description will be filled in configure step
            result.knowledgeHash, // The processed knowledge base
            {
              fileName: file.name,
              fileSize: file.size,
              contentType: file.type
            },
            address || '',
            {
              fileName: file.name,
              fileSize: file.size,
              contentType: file.type,
              data: base64Data
            }
          );
          console.log('📦 Content and original file stored successfully');
        } catch (error) {
          console.error('Failed to store content:', error);
          // Continue with the flow even if content storage fails
        }
      };
      fileReader.readAsDataURL(file);

      setStep('configure');
    } catch (err: any) {
      console.error('❌ Upload failed:', err);
      setError(err.message || 'Failed to process file');
      setStep('upload');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'video/mp4': ['.mp4'],
      'video/quicktime': ['.mov'],
      'audio/mpeg': ['.mp3'],
      'audio/wav': ['.wav']
    },
    maxFiles: 1,
    disabled: isProcessing
  });

  const handleConfigureSubmit = async () => {
    if (!echoConfig.name.trim() || !echoConfig.description.trim()) {
      setError('Please fill in all required fields');
      return;
    }
    
    // Update the stored content with the final description and name
    if (processingResult) {
      try {
        await contentStorage.storeEchoContent(
          parseInt(processingResult.tokenId),
          echoConfig.name,
          echoConfig.description,
          processingResult.knowledgeHash,
          {
            fileName: processingResult.fileName,
            fileSize: processingResult.fileSize,
            contentType: uploadedFile?.type || 'application/octet-stream'
          },
          address || '',
          // We need to get the original file data again - let's store it in state
          originalFileData || undefined
        );
        console.log('📦 Updated content with final description and name');
      } catch (error) {
        console.error('Failed to update content:', error);
        // Continue with the flow even if content update fails
      }
    }
    
    setStep('minting');
  };

  const handleMintComplete = () => {
    // Reset wizard after successful mint
    setStep('upload');
    setUploadedFile(null);
    setProcessingResult(null);
    setOriginalFileData(null);
    setEchoConfig({ name: '', description: '', pricePerQuery: '0.1', purchasePrice: '50.0', isForSale: true, isFreeEcho: false });
    setError(null);
  };

  const resetWizard = () => {
    setStep('upload');
    setUploadedFile(null);
    setProcessingResult(null);
    setOriginalFileData(null);
    setEchoConfig({ name: '', description: '', pricePerQuery: '0.1', purchasePrice: '50.0', isForSale: true, isFreeEcho: false });
    setError(null);
    setIsProcessing(false);
  };

  if (!isConnected) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <h2 className="text-xl font-semibold text-yellow-800 mb-2">🔗 Connect Your Wallet</h2>
          <p className="text-yellow-700">Please connect your wallet to create an Echo NFT</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12 animate-fade-in">
            <h2 className="text-5xl lg:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-700 mb-4">
              🎨 Creator Studio
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Transform your knowledge into an AI-powered Echo NFT and share it with the world
            </p>
          </div>

          {/* Progress Indicator */}
          <div className="mb-12 animate-fade-in-delay">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
              <div className="flex items-center justify-between">
                {(['upload', 'processing', 'configure', 'minting'] as WizardStep[]).map((stepName, index) => (
                  <div key={stepName} className="flex items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                      step === stepName 
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg scale-110' 
                        : ['upload', 'processing', 'configure', 'minting'].indexOf(step) > index
                          ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg'
                          : 'bg-gray-200 text-gray-600'
                    }`}>
                      {index + 1}
                    </div>
                    <span className={`ml-3 text-sm font-medium transition-colors duration-300 ${
                      step === stepName ? 'text-blue-600 font-semibold' : 'text-gray-500'
                    }`}>
                      {stepName === 'upload' && 'Upload'}
                      {stepName === 'processing' && 'Processing'}
                      {stepName === 'configure' && 'Configure'}
                      {stepName === 'minting' && 'Mint'}
                    </span>
                    {index < 3 && (
                      <div className={`w-16 h-1 mx-4 rounded-full transition-all duration-300 ${
                        ['upload', 'processing', 'configure', 'minting'].indexOf(step) > index
                          ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                          : 'bg-gray-200'
                      }`} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <span className="text-red-500 mr-2">❌</span>
            <span className="text-red-700">{error}</span>
          </div>
        </div>
      )}

          {/* Error Display */}
          {error && (
            <div className="mb-8 bg-red-50 border border-red-200 rounded-xl p-6 animate-fade-in">
              <div className="flex items-center">
                <span className="text-red-500 mr-2">❌</span>
                <span className="text-red-700 font-medium">{error}</span>
              </div>
            </div>
          )}

          {/* Step Content */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 animate-fade-in-delay-2">
        {step === 'upload' && (
          <div>
            <h3 className="text-xl font-semibold mb-4">📁 Upload Your Knowledge Source</h3>
            <p className="text-gray-600 mb-6">
              Upload a single file containing your knowledge. Supported formats: TXT, PDF, DOCX, MP4, MOV, MP3, WAV
            </p>
            
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400'
              } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <input {...getInputProps()} />
              <div className="text-4xl mb-4">📄</div>
              {isDragActive ? (
                <p className="text-blue-600 font-medium">Drop the file here...</p>
              ) : (
                <div>
                  <p className="text-gray-600 mb-2">
                    Drag & drop a file here, or click to select
                  </p>
                  <p className="text-sm text-gray-500">
                    Maximum 1 file per upload
                  </p>
                </div>
              )}
            </div>

            {uploadedFile && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center">
                  <span className="text-green-500 mr-2">✅</span>
                  <span className="text-green-700">
                    Selected: {uploadedFile.name} ({(uploadedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'processing' && (
          <div className="text-center py-12">
            <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <h3 className="text-xl font-semibold mb-2">🔄 Processing Your File</h3>
            <p className="text-gray-600 mb-4">
              {uploadedFile?.type.startsWith('video/') && 'Transcribing video...'}
              {uploadedFile?.type.startsWith('audio/') && 'Transcribing audio...'}
              {uploadedFile?.type === 'application/pdf' && 'Extracting text from PDF...'}
              {uploadedFile?.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' && 'Extracting text from document...'}
              {uploadedFile?.type === 'text/plain' && 'Processing text file...'}
              {!uploadedFile?.type && 'Processing file...'}
            </p>
            <p className="text-sm text-gray-500">
              This may take a few minutes depending on file size...
            </p>
          </div>
        )}

        {step === 'configure' && processingResult && (
          <div>
            <h3 className="text-xl font-semibold mb-4">⚙️ Configure Your Echo</h3>
            
            {/* Processing Results */}
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-semibold text-green-800 mb-2">✅ Processing Complete</h4>
              <div className="text-sm text-green-700 space-y-1">
                <div>📄 File: {processingResult.fileName}</div>
                <div>🆔 Token ID: {processingResult.tokenId}</div>
                <div>🔑 Knowledge Hash: {processingResult.knowledgeHash.slice(0, 20)}...</div>
              </div>
            </div>

            {/* Configuration Form */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Echo Name *
                </label>
                <input
                  type="text"
                  value={echoConfig.name}
                  onChange={(e) => setEchoConfig(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter a name for your Echo"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description *
                </label>
                <textarea
                  value={echoConfig.description}
                  onChange={(e) => setEchoConfig(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what knowledge this Echo contains"
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Make Echo Free Toggle */}
              <div>
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={echoConfig.isFreeEcho}
                    onChange={(e) => {
                      const isFree = e.target.checked;
                      setEchoConfig(prev => ({ 
                        ...prev, 
                        isFreeEcho: isFree,
                        pricePerQuery: isFree ? '0' : '0.1',
                        isForSale: isFree ? false : prev.isForSale // Disable sale for free Echos
                      }));
                    }}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    🆓 Make Echo Free
                  </span>
                </label>
                <p className="text-sm text-gray-500 mt-1 ml-7">
                  {echoConfig.isFreeEcho 
                    ? 'This Echo will be free for all users to query' 
                    : 'Users will pay to query this Echo'}
                </p>
              </div>

              {/* Price Input - Only show when not free */}
              {!echoConfig.isFreeEcho && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price per Query (PYUSD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={echoConfig.pricePerQuery}
                    onChange={(e) => setEchoConfig(prev => ({ ...prev, pricePerQuery: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Users will pay this amount in PYUSD for each query
                  </p>
                </div>
              )}

              {echoConfig.isForSale && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Purchase Price (PYUSD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={echoConfig.purchasePrice}
                    onChange={(e) => setEchoConfig(prev => ({ ...prev, purchasePrice: e.target.value }))}
                    placeholder="50.00"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Price for users to buy and own this Echo
                  </p>
                </div>
              )}

              <div>
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={echoConfig.isForSale}
                    onChange={(e) => setEchoConfig(prev => ({ ...prev, isForSale: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    List Echo for Sale
                  </span>
                </label>
                <p className="text-sm text-gray-500 mt-1 ml-7">
                  Allow users to purchase and own this Echo
                </p>
              </div>
            </div>

            <div className="flex gap-4 mt-6">
              <button
                onClick={resetWizard}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Start Over
              </button>
              <button
                onClick={handleConfigureSubmit}
                disabled={!echoConfig.name.trim() || !echoConfig.description.trim()}
                className="flex-1 bg-blue-600 text-white py-2 px-6 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                Confirm & Proceed to Mint
              </button>
            </div>
          </div>
        )}

        {step === 'minting' && processingResult && (
          <div>
            <h3 className="text-xl font-semibold mb-4">🎨 Mint Your Echo NFT</h3>
            
            {/* Echo Summary */}
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-semibold text-blue-800 mb-2">Echo Summary</h4>
              <div className="text-sm text-blue-700 space-y-1">
                <div><strong>Name:</strong> {echoConfig.name}</div>
                <div><strong>Description:</strong> {echoConfig.description}</div>
                <div><strong>Price per Query:</strong> {echoConfig.pricePerQuery} PYUSD</div>
                <div><strong>Purchase Price:</strong> {echoConfig.purchasePrice} PYUSD</div>
                <div><strong>For Sale:</strong> {echoConfig.isForSale ? 'Yes' : 'No'}</div>
                <div><strong>Token ID:</strong> {processingResult.tokenId}</div>
              </div>
            </div>

            {/* Mint Component */}
            <MintEcho 
              tokenId={processingResult.tokenId}
              echoName={echoConfig.name}
              echoDescription={echoConfig.description}
              pricePerQuery={echoConfig.pricePerQuery}
              purchasePrice={echoConfig.purchasePrice}
              isForSale={echoConfig.isForSale}
              onMintComplete={handleMintComplete}
            />
          </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
};
