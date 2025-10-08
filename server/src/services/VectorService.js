const { Pinecone } = require('@pinecone-database/pinecone');
const OpenAI = require('openai');
const QdrantVectorService = require('./QdrantVectorService');

// In-memory fallback index for development without API keys
class InMemoryVectorIndex {
  constructor() {
    this.store = new Map(); // id -> { values, metadata }
  }
  async upsert(vectors) {
    vectors.forEach(v => this.store.set(v.id, { values: v.values || [], metadata: v.metadata || {} }));
  }
  async query({ topK = 10, includeMetadata = true }) {
    const items = Array.from(this.store.entries()).slice(-topK).reverse();
    return {
      matches: items.map(([id, data]) => ({ id, score: 0.5, metadata: includeMetadata ? data.metadata : undefined }))
    };
  }
  async fetch(ids) {
    const vectors = {};
    ids.forEach(id => {
      if (this.store.has(id)) {
        const { values, metadata } = this.store.get(id);
        vectors[id] = { id, values, metadata };
      }
    });
    return { vectors };
  }
  async deleteOne(id) { this.store.delete(id); }
  async describeIndexStats() { return { totalVectorCount: this.store.size }; }
}

class VectorService {
  constructor() {
    this.pinecone = null;
    this.index = null;
    this.openai = null;
    this.isReady = false;
  }

  async initialize() {
    try {
      // Check if Qdrant is available first
      if (process.env.QDRANT_URL) {
        console.log('🔍 Attempting to use Qdrant vector service...');
        const qdrantService = new QdrantVectorService();
        await qdrantService.initialize();
        if (qdrantService.isReady) {
          // Delegate to Qdrant service
          Object.setPrototypeOf(this, QdrantVectorService.prototype);
          Object.assign(this, qdrantService);
          return;
        }
      }

      // Check if we have API keys before initializing
      const havePinecone = !!process.env.PINECONE_API_KEY;
      const haveOpenAI = !!process.env.OPENAI_API_KEY;

      if (havePinecone && haveOpenAI) {
        // Initialize Pinecone
        this.pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

        // Initialize OpenAI for embeddings
        this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        // Get or create index
        const indexName = process.env.PINECONE_INDEX_NAME || 'poets-codex';
        try {
          this.index = this.pinecone.index(indexName);
          console.log(`🧠 Connected to existing Pinecone index: ${indexName}`);
        } catch (error) {
          console.log(`🧠 Creating new Pinecone index: ${indexName}`);
          await this.pinecone.createIndex({
            name: indexName,
            dimension: 1536, // embedding dimension
            metric: 'cosine',
            spec: { serverless: { cloud: 'aws', region: 'us-east-1' } }
          });
          await this.waitForIndexReady(indexName);
          this.index = this.pinecone.index(indexName);
        }
        this.isReady = true;
        console.log('🧠 Vector service initialized successfully');
      } else {
        // Fallback
        this.index = new InMemoryVectorIndex();
        this.openai = null;
        this.isReady = false;
        console.warn('🧠 Vector service running in fallback mode (no API keys). Semantic search disabled.');
      }
    } catch (error) {
      console.error('Vector service initialization error, using fallback:', error);
      this.index = new InMemoryVectorIndex();
      this.openai = null;
      this.isReady = false;
    }
  }

  async waitForIndexReady(indexName, maxAttempts = 30) {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const indexStats = await this.pinecone.describeIndex(indexName);
        if (indexStats.status?.ready) {
          return;
        }
      } catch (error) {
        // Index might not exist yet, continue waiting
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    }
    
    throw new Error(`Index ${indexName} did not become ready within expected time`);
  }

  async generateEmbedding(text) {
    if (!this.openai) {
      // Fallback: in-memory index ignores values, so return empty array
      return [];
    }
    const response = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding;
  }

  async indexPoem(poemId, title, body, metadata = {}) {
    try {
      if (!this.isReady) {
        console.log('🧠 Vector service not ready, skipping poem indexing');
        return poemId.toString();
      }

      // Combine title and body for embedding
      const text = `${title}\n\n${body}`;
      const embedding = await this.generateEmbedding(text);

      const vector = {
        id: poemId.toString(),
        values: embedding,
        metadata: {
          title,
          excerpt: body.substring(0, 200) + (body.length > 200 ? '...' : ''),
          author: metadata.author || '',
          license: metadata.license || '',
          tags: metadata.tags || [],
          mood: metadata.mood || '',
          style: metadata.style || '',
          createdAt: metadata.createdAt || new Date().toISOString(),
          wordCount: text.split(' ').length
        }
      };

      await this.index.upsert([vector]);
      console.log(`🧠 Indexed poem: ${poemId}`);
      return poemId.toString();
    } catch (error) {
      console.error('Error indexing poem:', error);
      return poemId.toString(); // Return ID even if indexing fails
    }
  }

  async searchSimilarPoems(query, options = {}) {
    try {
      const { topK = 10, includeMetadata = true } = options;
      if (!this.openai) {
        // Fallback: return most recent items from in-memory index
        const searchResults = await this.index.query({ topK, includeMetadata });
        return (searchResults.matches || []).map(m => ({ id: m.id, score: m.score, metadata: m.metadata }));
      }
      const {
        filter = {},
        threshold = 0.7
      } = options;
      const queryEmbedding = await this.generateEmbedding(query);
      const searchResults = await this.index.query({ vector: queryEmbedding, topK, filter, includeMetadata });
      return (searchResults.matches || [])
        .filter(match => match.score >= threshold)
        .map(match => ({ id: match.id, score: match.score, metadata: match.metadata }));
    } catch (error) {
      console.error('Error searching similar poems:', error);
      throw error;
    }
  }

  async findPoemsByStyle(style, limit = 10) {
    try {
      return await this.index.query({
        vector: new Array(1536).fill(0), // Dummy vector for metadata-only search
        topK: limit,
        filter: {
          style: { "$eq": style }
        },
        includeMetadata: true
      });
    } catch (error) {
      console.error('Error finding poems by style:', error);
      throw error;
    }
  }

  async findPoemsByMood(mood, limit = 10) {
    try {
      return await this.index.query({
        vector: new Array(1536).fill(0), // Dummy vector for metadata-only search
        topK: limit,
        filter: {
          mood: { "$eq": mood }
        },
        includeMetadata: true
      });
    } catch (error) {
      console.error('Error finding poems by mood:', error);
      throw error;
    }
  }

  async deletePoem(poemId) {
    try {
      await this.index.deleteOne(poemId.toString());
      console.log(`🧠 Deleted poem from vector index: ${poemId}`);
    } catch (error) {
      console.error('Error deleting poem from vector index:', error);
      throw error;
    }
  }

  async updatePoemMetadata(poemId, metadata) {
    try {
      // Pinecone doesn't support partial updates, so we need to fetch, update, and re-index
      const fetchResult = await this.index.fetch([poemId.toString()]);
      const existingVector = fetchResult.vectors[poemId.toString()];
      
      if (existingVector) {
        const updatedVector = {
          id: poemId.toString(),
          values: existingVector.values,
          metadata: {
            ...existingVector.metadata,
            ...metadata
          }
        };
        
        await this.index.upsert([updatedVector]);
        console.log(`🧠 Updated poem metadata: ${poemId}`);
      }
    } catch (error) {
      console.error('Error updating poem metadata:', error);
      throw error;
    }
  }

  async getIndexStats() {
    try {
      const stats = await this.index.describeIndexStats();
      return stats;
    } catch (error) {
      console.error('Error getting index stats:', error);
      throw error;
    }
  }
}

module.exports = VectorService;