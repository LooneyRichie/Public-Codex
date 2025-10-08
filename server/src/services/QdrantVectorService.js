const { QdrantClient } = require('@qdrant/js-client-rest');
const OpenAI = require('openai');

class QdrantVectorService {
  constructor() {
    this.client = null;
    this.collection = process.env.QDRANT_COLLECTION || 'poets_codex';
    this.openai = null;
    this.isReady = false;
  }

  async initialize() {
    try {
      if (!process.env.QDRANT_URL) {
        console.warn('🧠 Qdrant URL not configured; QdrantVectorService disabled');
        this.isReady = false;
        return;
      }

      this.client = new QdrantClient({
        url: process.env.QDRANT_URL,
        apiKey: process.env.QDRANT_API_KEY || undefined
      });

      if (process.env.OPENAI_API_KEY) {
        this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      }

      // Ensure collection exists
      const collections = await this.client.getCollections();
      const exists = collections.collections?.some(c => c.name === this.collection);
      if (!exists) {
        await this.client.createCollection(this.collection, {
          vectors: { size: 1536, distance: 'Cosine' }
        });
        // Small delay to ensure collection is ready
        await new Promise(r => setTimeout(r, 500));
      }

      this.isReady = true;
      console.log(`🧠 Qdrant vector service initialized (collection: ${this.collection})`);
    } catch (error) {
      console.error('Qdrant init error:', error);
      this.isReady = false;
    }
  }

  async generateEmbedding(text) {
    if (!this.openai) return [];
    const res = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text
    });
    return res.data[0].embedding;
  }

  async indexPoem(poemId, title, body, metadata = {}) {
    try {
      const text = `${title}\n\n${body}`;
      const vector = await this.generateEmbedding(text);
      await this.client.upsert(this.collection, {
        wait: true,
        points: [
          {
            id: poemId.toString(),
            vector,
            payload: {
              title,
              excerpt: body.substring(0, 200) + (body.length > 200 ? '...' : ''),
              ...metadata
            }
          }
        ]
      });
      return poemId.toString();
    } catch (e) {
      console.error('Qdrant index error:', e);
      return poemId.toString();
    }
  }

  async searchSimilarPoems(query, { topK = 10, threshold = 0.7 } = {}) {
    try {
      const vector = await this.generateEmbedding(query);
      if (!vector.length) return [];
      const res = await this.client.search(this.collection, {
        vector,
        limit: topK,
        with_payload: true,
      });
      return res
        .filter(r => r.score >= threshold)
        .map(r => ({ id: String(r.id), score: r.score, metadata: r.payload }));
    } catch (e) {
      console.error('Qdrant search error:', e);
      return [];
    }
  }

  async updatePoemMetadata(poemId, metadata) {
    try {
      await this.client.setPayload(this.collection, {
        points: [poemId.toString()],
        payload: metadata
      });
    } catch (e) {
      console.error('Qdrant update payload error:', e);
    }
  }

  async deletePoem(poemId) {
    try {
      await this.client.delete(this.collection, { points: [poemId.toString()] });
    } catch (e) {
      console.error('Qdrant delete error:', e);
    }
  }

  async getIndexStats() {
    try {
      const col = await this.client.getCollection(this.collection);
      return col && col.points_count ? { points: col.points_count } : {};
    } catch (e) {
      return {};
    }
  }
}

module.exports = QdrantVectorService;
