const Database = require('better-sqlite3');
const CryptoJS = require('crypto-js');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

class EncryptedPermanentStorage {
  constructor() {
    this.dbPath = path.join(__dirname, '../../data/poets_codex.db');
    this.encryptionKey = process.env.STORAGE_ENCRYPTION_KEY || 'poets-codex-default-key-change-in-production';
    this.db = null;
    this.initialized = false;
  }

  async initialize() {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Initialize SQLite database
      this.db = new Database(this.dbPath);
      
      // Enable WAL mode for better performance
      this.db.pragma('journal_mode = WAL');
      
      // Create tables if they don't exist
      this.createTables();
      
      this.initialized = true;
      console.log('📚 Encrypted permanent storage initialized:', this.dbPath);
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize encrypted storage:', error);
      return false;
    }
  }

  createTables() {
    // Users table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        encrypted_data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Poems table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS poems (
        id TEXT PRIMARY KEY,
        author_id TEXT NOT NULL,
        encrypted_data TEXT NOT NULL,
        title_plain TEXT NOT NULL,
        visibility TEXT DEFAULT 'public',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (author_id) REFERENCES users (id)
      )
    `);

    // Create indexes for performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_poems_author ON poems(author_id);
      CREATE INDEX IF NOT EXISTS idx_poems_visibility ON poems(visibility);
      CREATE INDEX IF NOT EXISTS idx_poems_created ON poems(created_at);
    `);
  }

  encrypt(data) {
    const jsonString = JSON.stringify(data);
    return CryptoJS.AES.encrypt(jsonString, this.encryptionKey).toString();
  }

  decrypt(encryptedData) {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedData, this.encryptionKey);
      const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
      return JSON.parse(decryptedString);
    } catch (error) {
      console.error('Decryption error:', error);
      return null;
    }
  }

  // User methods
  async createUser(userData) {
    if (!this.initialized) await this.initialize();
    
    const userId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    
    // Prepare user data for encryption (exclude sensitive fields from plain storage)
    const sensitiveData = {
      password: userData.password, // Already hashed
      displayName: userData.displayName,
      profile: userData.profile || {},
      preferences: userData.preferences || {},
      metadata: userData.metadata || {}
    };

    // Encrypt sensitive data
    const encryptedData = this.encrypt(sensitiveData);

    // Store in database
    const stmt = this.db.prepare(`
      INSERT INTO users (id, username, email, encrypted_data)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(userId, userData.username, userData.email, encryptedData);

    // Return user object (without sensitive data)
    return {
      id: userId,
      _id: userId,
      username: userData.username,
      email: userData.email,
      displayName: userData.displayName,
      profile: userData.profile || {},
      createdAt: new Date()
    };
  }

  async findUserByEmail(email) {
    if (!this.initialized) await this.initialize();
    
    const stmt = this.db.prepare('SELECT * FROM users WHERE email = ?');
    const row = stmt.get(email);
    
    if (!row) return null;

    // Decrypt sensitive data
    const decryptedData = this.decrypt(row.encrypted_data);
    if (!decryptedData) return null;

    return {
      id: row.id,
      _id: row.id,
      username: row.username,
      email: row.email,
      password: decryptedData.password,
      displayName: decryptedData.displayName,
      profile: decryptedData.profile || {},
      createdAt: new Date(row.created_at)
    };
  }

  async findUserByUsername(username) {
    if (!this.initialized) await this.initialize();
    
    const stmt = this.db.prepare('SELECT * FROM users WHERE username = ?');
    const row = stmt.get(username);
    
    if (!row) return null;

    const decryptedData = this.decrypt(row.encrypted_data);
    if (!decryptedData) return null;

    return {
      id: row.id,
      _id: row.id,
      username: row.username,
      email: row.email,
      password: decryptedData.password,
      displayName: decryptedData.displayName,
      profile: decryptedData.profile || {},
      createdAt: new Date(row.created_at)
    };
  }

  async findUserById(id) {
    if (!this.initialized) await this.initialize();
    
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    const row = stmt.get(id);
    
    if (!row) return null;

    const decryptedData = this.decrypt(row.encrypted_data);
    if (!decryptedData) return null;

    return {
      id: row.id,
      _id: row.id,
      username: row.username,
      email: row.email,
      displayName: decryptedData.displayName,
      profile: decryptedData.profile || {},
      createdAt: new Date(row.created_at)
    };
  }

  // Poem methods
  async createPoem(poemData) {
    if (!this.initialized) await this.initialize();
    
    const poemId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    
    // Encrypt poem content and metadata
    const encryptedData = this.encrypt({
      body: poemData.body,
      license: poemData.license,
      tags: poemData.tags || [],
      mood: poemData.mood,
      style: poemData.style,
      image: poemData.image,
      contentType: poemData.contentType || 'poetry',
      metadata: poemData.metadata || {}
    });

    const stmt = this.db.prepare(`
      INSERT INTO poems (id, author_id, encrypted_data, title_plain, visibility)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(poemId, poemData.author, encryptedData, poemData.title, poemData.visibility || 'public');

    return {
      id: poemId,
      _id: poemId,
      ...poemData,
      createdAt: new Date()
    };
  }

  async findPoemById(id) {
    if (!this.initialized) await this.initialize();
    
    const stmt = this.db.prepare('SELECT * FROM poems WHERE id = ?');
    const row = stmt.get(id);
    
    if (!row) return null;

    const decryptedData = this.decrypt(row.encrypted_data);
    if (!decryptedData) return null;

    return {
      id: row.id,
      _id: row.id,
      title: row.title_plain,
      author: row.author_id,
      visibility: row.visibility,
      createdAt: new Date(row.created_at),
      ...decryptedData
    };
  }

  async findPoemsByAuthor(authorId) {
    if (!this.initialized) await this.initialize();
    
    const stmt = this.db.prepare('SELECT * FROM poems WHERE author_id = ? ORDER BY created_at DESC');
    const rows = stmt.all(authorId);
    
    return rows.map(row => {
      const decryptedData = this.decrypt(row.encrypted_data);
      if (!decryptedData) return null;
      
      return {
        id: row.id,
        _id: row.id,
        title: row.title_plain,
        author: row.author_id,
        visibility: row.visibility,
        createdAt: new Date(row.created_at),
        ...decryptedData
      };
    }).filter(Boolean);
  }

  async searchPoems(query = {}) {
    if (!this.initialized) await this.initialize();
    
    let sql = 'SELECT * FROM poems WHERE visibility = "public"';
    const params = [];

    if (query.author) {
      sql += ' AND author_id = ?';
      params.push(query.author);
    }

    if (query.title) {
      sql += ' AND title_plain LIKE ?';
      params.push(`%${query.title}%`);
    }

    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(query.limit || 50);

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params);
    
    return rows.map(row => {
      const decryptedData = this.decrypt(row.encrypted_data);
      if (!decryptedData) return null;
      
      return {
        id: row.id,
        _id: row.id,
        title: row.title_plain,
        author: row.author_id,
        visibility: row.visibility,
        createdAt: new Date(row.created_at),
        ...decryptedData
      };
    }).filter(Boolean);
  }

  async deletePoem(id, authorId) {
    if (!this.initialized) await this.initialize();
    
    // First, verify the poem exists and belongs to the author
    const poem = await this.findPoemById(id);
    if (!poem) {
      throw new Error('Poem not found');
    }
    
    if (poem.author !== authorId) {
      throw new Error('Unauthorized: You can only delete your own poems');
    }
    
    // Delete the poem
    const stmt = this.db.prepare('DELETE FROM poems WHERE id = ? AND author_id = ?');
    const result = stmt.run(id, authorId);
    
    if (result.changes === 0) {
      throw new Error('Failed to delete poem');
    }
    
    return { success: true, message: 'Poem deleted successfully' };
  }

  // Statistics
  async getStats() {
    if (!this.initialized) await this.initialize();
    
    const userCount = this.db.prepare('SELECT COUNT(*) as count FROM users').get();
    const poemCount = this.db.prepare('SELECT COUNT(*) as count FROM poems').get();
    
    return {
      users: userCount.count,
      poems: poemCount.count,
      storage: 'encrypted_sqlite'
    };
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initialized = false;
    }
  }
}

module.exports = EncryptedPermanentStorage;