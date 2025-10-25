import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { contentStorage, EchoContent } from '../services/contentStorage';
import { OriginalFileViewer } from './OriginalFileViewer';

interface EchoContentViewerProps {
  tokenId: bigint;
  onBack?: () => void;
}

export const EchoContentViewer: React.FC<EchoContentViewerProps> = ({ tokenId, onBack }) => {
  const [content, setContent] = useState<EchoContent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'content' | 'original' | 'metadata'>('overview');
  const { address } = useAccount();

  useEffect(() => {
    const loadContent = async () => {
      try {
        setIsLoading(true);
        console.log('🔍 Loading content for token ID:', Number(tokenId));
        const echoContent = await contentStorage.getEchoContent(Number(tokenId));
        console.log('📦 Retrieved content:', echoContent);
        
        if (!echoContent) {
          console.error('❌ No content found for token ID:', Number(tokenId));
          setError('Content not found for this Echo');
          return;
        }

        setContent(echoContent);
        console.log('✅ Content loaded successfully');
      } catch (err) {
        console.error('Failed to load Echo content:', err);
        setError('Failed to load content');
      } finally {
        setIsLoading(false);
      }
    };

    loadContent();
  }, [tokenId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-6"></div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">Loading Echo Content</h3>
          <p className="text-gray-600">Fetching the knowledge base...</p>
        </div>
      </div>
    );
  }

  if (error || !content) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl max-w-md mx-auto">
            <div className="text-6xl mb-4">❌</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Content Not Available</h3>
            <p className="text-gray-600 mb-4">Token ID: {tokenId.toString()}</p>
            <p className="text-sm text-gray-500">{error || 'This Echo\'s content could not be loaded.'}</p>
            {onBack && (
              <button
                onClick={onBack}
                className="mt-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors duration-200"
              >
                ← Back
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8 animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-4xl lg:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-700 mb-2">
                  📚 {content.name}
                </h1>
                <p className="text-xl text-gray-600">
                  Your owned knowledge base - Token #{tokenId.toString()}
                </p>
              </div>
              {onBack && (
                <button
                  onClick={onBack}
                  className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors duration-200 flex items-center gap-2 font-semibold shadow-sm"
                >
                  ← Back to Gallery
                </button>
              )}
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="mb-8 animate-fade-in-delay">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-2 shadow-lg border border-gray-200/50">
              <div className="flex space-x-2">
                {[
                  { id: 'overview', label: 'Overview', icon: '📋' },
                  // { id: 'content', label: 'Knowledge Base', icon: '📖' },
                  { id: 'original', label: 'Original File', icon: '📄' },
                  // { id: 'metadata', label: 'ℹDetails', icon: 'ℹ️' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 py-3 px-6 rounded-xl font-semibold transition-all duration-300 ${
                      activeTab === tab.id
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <span className="flex items-center justify-center gap-2">
                      <span>{tab.icon}</span>
                      <span>{tab.label}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="animate-fade-in-delay-2">
            {activeTab === 'overview' && (
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-gray-200/50">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-800 mb-4">📝 Description</h3>
                    <p className="text-gray-700 text-lg leading-relaxed mb-6">
                      {content.description}
                    </p>
                    
                    <h3 className="text-2xl font-bold text-gray-800 mb-4">👤 Creator</h3>
                    <p className="text-gray-700 font-mono text-sm bg-gray-100 p-3 rounded-lg">
                      {content.creator}
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="text-2xl font-bold text-gray-800 mb-4">📊 Content Statistics</h3>
                    <div className="space-y-4">
                      <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                        <div className="text-sm text-blue-600 mb-1">Knowledge Base Size</div>
                        <div className="text-2xl font-bold text-blue-800">
                          {Math.round(content.knowledgeBase.length / 1000)}K characters
                        </div>
                      </div>
                      
                      <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                        <div className="text-sm text-green-600 mb-1">Original File</div>
                        <div className="text-lg font-bold text-green-800">
                          {content.metadata.fileName}
                        </div>
                        <div className="text-sm text-green-600">
                          {(content.metadata.fileSize / 1024).toFixed(1)} KB
                        </div>
                      </div>
                      
                      <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
                        <div className="text-sm text-purple-600 mb-1">Upload Date</div>
                        <div className="text-lg font-bold text-purple-800">
                          {new Date(content.metadata.uploadDate).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'content' && (
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-gray-200/50">
                <h3 className="text-2xl font-bold text-gray-800 mb-6">📖 Knowledge Base Content</h3>
                <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                  <div className="prose prose-lg max-w-none">
                    <pre className="whitespace-pre-wrap text-gray-800 font-mono text-sm leading-relaxed">
                      {content.knowledgeBase}
                    </pre>
                  </div>
                </div>
                <div className="mt-4 text-sm text-gray-500 text-center">
                  This is the complete knowledge base that powers this Echo's AI responses
                </div>
              </div>
            )}

            {activeTab === 'original' && (
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-gray-200/50">
                <h3 className="text-2xl font-bold text-gray-800 mb-6">📄 Original File</h3>
                {content.hasOriginalFile ? (
                  <div className="space-y-6">
                    <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                      <div className="text-sm text-blue-600 mb-1">Original File</div>
                      <div className="text-lg font-bold text-blue-800">{content.metadata.fileName}</div>
                      <div className="text-sm text-blue-600">
                        {(content.metadata.fileSize / 1024).toFixed(1)} KB • {content.metadata.contentType}
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                      <OriginalFileViewer 
                        tokenId={Number(tokenId)} 
                        fileName={content.metadata.fileName}
                        contentType={content.metadata.contentType}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">📄</div>
                    <h4 className="text-xl font-semibold text-gray-800 mb-2">Original File Not Available</h4>
                    <p className="text-gray-600">
                      The original file for this Echo is not available for viewing.
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'metadata' && (
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-gray-200/50">
                <h3 className="text-2xl font-bold text-gray-800 mb-6">ℹ️ Technical Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Token ID</label>
                      <p className="text-lg font-mono text-gray-800">{content.tokenId}</p>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-600">Creator Address</label>
                      <p className="text-sm font-mono text-gray-800 break-all">{content.creator}</p>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-600">Content Type</label>
                      <p className="text-lg text-gray-800">{content.metadata.contentType}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Original File</label>
                      <p className="text-lg text-gray-800">{content.metadata.fileName}</p>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-600">File Size</label>
                      <p className="text-lg text-gray-800">{(content.metadata.fileSize / 1024).toFixed(1)} KB</p>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-600">Upload Date</label>
                      <p className="text-lg text-gray-800">
                        {new Date(content.metadata.uploadDate).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
