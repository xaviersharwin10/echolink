// Content Storage Service for EchoLink
// Handles storage and retrieval of Echo content (knowledge base + metadata)

export interface EchoContent {
  tokenId: number;
  name: string;
  description: string;
  knowledgeBase: string; // The actual knowledge content
  metadata: {
    fileName: string;
    fileSize: number;
    uploadDate: string;
    contentType: string;
  };
  creator: string;
  isOwned: boolean;
  hasOriginalFile?: boolean; // Whether original file is available
}

class ContentStorageService {
  private static instance: ContentStorageService;
  private contentCache: Map<number, EchoContent> = new Map();
  private readonly API_BASE_URL = 'http://localhost:3001';

  private constructor() {}

  public static getInstance(): ContentStorageService {
    if (!ContentStorageService.instance) {
      ContentStorageService.instance = new ContentStorageService();
    }
    return ContentStorageService.instance;
  }

  /**
   * Store Echo content after processing
   */
  public async storeEchoContent(
    tokenId: number,
    name: string,
    description: string,
    knowledgeBase: string,
    metadata: {
      fileName: string;
      fileSize: number;
      contentType: string;
    },
    creator: string,
    originalFile?: {
      fileName: string;
      fileSize: number;
      contentType: string;
      data: string; // Base64 encoded file data
    }
  ): Promise<void> {
    const content: EchoContent = {
      tokenId,
      name,
      description,
      knowledgeBase,
      metadata: {
        ...metadata,
        uploadDate: new Date().toISOString(),
      },
      creator,
      isOwned: false, // Will be updated based on ownership
      hasOriginalFile: !!originalFile,
    };

    // Store in cache
    this.contentCache.set(tokenId, content);

    // Store in backend
    try {
      await fetch(`${this.API_BASE_URL}/store-content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...content,
          originalFile: originalFile,
        }),
      });
    } catch (error) {
      console.error('Failed to store content in backend:', error);
      // Continue with local cache storage
    }
  }

  /**
   * Retrieve Echo content by token ID
   */
  public async getEchoContent(tokenId: number): Promise<EchoContent | null> {
    console.log('🔍 ContentStorage: Getting content for token ID:', tokenId);
    
    // Check cache first
    if (this.contentCache.has(tokenId)) {
      console.log('📦 ContentStorage: Found in cache');
      return this.contentCache.get(tokenId)!;
    }

    console.log('🌐 ContentStorage: Fetching from backend...');
    // Fetch from backend
    try {
      const response = await fetch(`${this.API_BASE_URL}/get-content/${tokenId}`);
      console.log('📡 ContentStorage: Backend response status:', response.status);
      
      if (response.ok) {
        const content: EchoContent = await response.json();
        console.log('📦 ContentStorage: Retrieved content from backend:', content);
        this.contentCache.set(tokenId, content);
        return content;
      } else {
        console.error('❌ ContentStorage: Backend returned error:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('❌ ContentStorage: Failed to fetch content from backend:', error);
    }

    console.log('❌ ContentStorage: No content found');
    return null;
  }

  /**
   * Get all stored Echo content
   */
  public async getAllEchoContent(): Promise<EchoContent[]> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/get-all-content`);
      if (response.ok) {
        const content: EchoContent[] = await response.json();
        // Update cache
        content.forEach(echo => {
          this.contentCache.set(echo.tokenId, echo);
        });
        return content;
      }
    } catch (error) {
      console.error('Failed to fetch all content from backend:', error);
    }

    return Array.from(this.contentCache.values());
  }

  /**
   * Update ownership status for content
   */
  public async updateOwnershipStatus(tokenId: number, isOwned: boolean): Promise<void> {
    const content = this.contentCache.get(tokenId);
    if (content) {
      content.isOwned = isOwned;
      this.contentCache.set(tokenId, content);
    }

    // Update in backend
    try {
      await fetch(`${this.API_BASE_URL}/update-ownership`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tokenId, isOwned }),
      });
    } catch (error) {
      console.error('Failed to update ownership in backend:', error);
    }
  }

  /**
   * Get content for owned Echos
   */
  public async getOwnedEchoContent(userAddress: string): Promise<EchoContent[]> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/get-owned-content/${userAddress}`);
      if (response.ok) {
        const content: EchoContent[] = await response.json();
        // Update cache
        content.forEach(echo => {
          this.contentCache.set(echo.tokenId, echo);
        });
        return content;
      }
    } catch (error) {
      console.error('Failed to fetch owned content from backend:', error);
    }

    // Fallback to local cache
    return Array.from(this.contentCache.values()).filter(echo => echo.isOwned);
  }

  /**
   * Search content by query
   */
  public async searchContent(query: string): Promise<EchoContent[]> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/search-content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });
      if (response.ok) {
        const content: EchoContent[] = await response.json();
        return content;
      }
    } catch (error) {
      console.error('Failed to search content:', error);
    }

    // Fallback to local search
    const allContent = Array.from(this.contentCache.values());
    return allContent.filter(echo => 
      echo.name.toLowerCase().includes(query.toLowerCase()) ||
      echo.description.toLowerCase().includes(query.toLowerCase()) ||
      echo.knowledgeBase.toLowerCase().includes(query.toLowerCase())
    );
  }

  /**
   * Get original file URL for viewing
   */
  public getOriginalFileUrl(tokenId: number): string {
    return `${this.API_BASE_URL}/get-original-file/${tokenId}`;
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this.contentCache.clear();
  }

  /**
   * Get cache size
   */
  public getCacheSize(): number {
    return this.contentCache.size;
  }
}

export const contentStorage = ContentStorageService.getInstance();
