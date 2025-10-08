const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class FileBasedLedger {
  constructor() {
    this.ledgerPath = process.env.LEDGER_PATH || './data/ledger.jsonl';
    this.isReady = false;
  }

  async initialize() {
    try {
      // Ensure ledger directory exists
      const ledgerDir = path.dirname(this.ledgerPath);
      await fs.mkdir(ledgerDir, { recursive: true });
      
      // Create ledger file if it doesn't exist
      try {
        await fs.access(this.ledgerPath);
      } catch {
        await fs.writeFile(this.ledgerPath, '');
      }
      
      this.isReady = true;
      console.log(`📄 File-based ledger initialized: ${this.ledgerPath}`);
    } catch (error) {
      console.error('File ledger initialization error:', error);
      this.isReady = false;
    }
  }

  async appendEntry(entry) {
    if (!this.isReady) return null;

    try {
      const timestamp = new Date().toISOString();
      const ledgerEntry = {
        ...entry,
        timestamp,
        entryHash: crypto.createHash('sha256').update(JSON.stringify(entry) + timestamp).digest('hex')
      };

      const line = JSON.stringify(ledgerEntry) + '\n';
      await fs.appendFile(this.ledgerPath, line);
      
      console.log(`📄 Appended ledger entry: ${ledgerEntry.entryHash}`);
      return ledgerEntry;
    } catch (error) {
      console.error('Error appending to ledger:', error);
      return null;
    }
  }

  async getEntries(filter = {}) {
    if (!this.isReady) return [];

    try {
      const content = await fs.readFile(this.ledgerPath, 'utf8');
      const lines = content.trim().split('\n').filter(line => line);
      
      let entries = lines.map(line => JSON.parse(line));
      
      // Apply filters
      if (filter.poemId) {
        entries = entries.filter(entry => entry.poemId === filter.poemId);
      }
      if (filter.authorId) {
        entries = entries.filter(entry => entry.authorId === filter.authorId);
      }
      if (filter.eventType) {
        entries = entries.filter(entry => entry.eventType === filter.eventType);
      }
      
      return entries;
    } catch (error) {
      console.error('Error reading ledger:', error);
      return [];
    }
  }

  async verifyIntegrity() {
    if (!this.isReady) return false;

    try {
      const entries = await this.getEntries();
      
      for (const entry of entries) {
        const { entryHash, timestamp, ...entryData } = entry;
        const expectedHash = crypto.createHash('sha256').update(JSON.stringify(entryData) + timestamp).digest('hex');
        
        if (entryHash !== expectedHash) {
          console.error(`Ledger integrity check failed for entry: ${entryHash}`);
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error verifying ledger integrity:', error);
      return false;
    }
  }

  async getStats() {
    if (!this.isReady) return { totalEntries: 0 };

    try {
      const entries = await this.getEntries();
      const eventTypes = {};
      
      entries.forEach(entry => {
        eventTypes[entry.eventType] = (eventTypes[entry.eventType] || 0) + 1;
      });
      
      return {
        totalEntries: entries.length,
        eventTypes,
        integrityValid: await this.verifyIntegrity()
      };
    } catch (error) {
      console.error('Error getting ledger stats:', error);
      return { totalEntries: 0 };
    }
  }
}

module.exports = FileBasedLedger;