const crypto = require('crypto');
const LedgerEntry = require('../models/LedgerEntry');

class LedgerService {
  constructor() {
    this.isReady = true;
  }

  // Generate a cryptographic hash for content
  generateContentHash(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  // Generate a block hash using previous hash + content + timestamp
  generateBlockHash(contentHash, previousHash, timestamp, authorId) {
    const data = `${previousHash || '0'}${contentHash}${timestamp}${authorId}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  // Generate a digital signature (simplified version)
  generateSignature(data, privateKey = 'poets-codex-secret') {
    return crypto.createHmac('sha256', privateKey).update(data).digest('hex');
  }

  // Create a new ledger entry for poem creation
  async createPoemEntry(poemData) {
    try {
      const { _id: poemId, title, body, author, license } = poemData;
      const timestamp = new Date();
      
      // Generate content hash
      const contentHash = this.generateContentHash(`${title}${body}${author}${timestamp.toISOString()}`);
      
      // Get the previous entry to chain the blocks
      const previousEntry = await LedgerEntry.findOne()
        .sort({ createdAt: -1 })
        .select('blockHash');
      
      const previousHash = previousEntry ? previousEntry.blockHash : null;
      
      // Generate block hash
      const blockHash = this.generateBlockHash(contentHash, previousHash, timestamp.toISOString(), author);
      
      // Generate signature
      const signatureData = `${contentHash}${blockHash}${timestamp.toISOString()}`;
      const signature = this.generateSignature(signatureData);
      
      // Create ledger entry
      const ledgerEntry = new LedgerEntry({
        eventType: 'POEM_CREATED',
        poemId,
        authorId: author,
        contentHash,
        previousHash,
        blockHash,
        metadata: {
          title,
          originalTimestamp: timestamp,
          license,
          wordCount: `${title} ${body}`.split(' ').length
        },
        signature,
        witnessNodes: [
          {
            nodeId: 'primary-node',
            signature: this.generateSignature(`witness-${blockHash}`),
            timestamp
          }
        ]
      });

      await ledgerEntry.save();
      console.log(`🔒 Created ledger entry for poem: ${poemId}`);
      
      return ledgerEntry;
    } catch (error) {
      console.error('Error creating poem ledger entry:', error);
      throw error;
    }
  }

  // Create ledger entry for poem updates
  async updatePoemEntry(poemData, previousVersion) {
    try {
      const { _id: poemId, title, body, author, license } = poemData;
      const timestamp = new Date();
      
      // Generate new content hash
      const contentHash = this.generateContentHash(`${title}${body}${author}${timestamp.toISOString()}`);
      
      // Get the latest entry for this poem
      const previousEntry = await LedgerEntry.findOne({ poemId })
        .sort({ createdAt: -1 })
        .select('blockHash contentHash');
      
      if (!previousEntry) {
        throw new Error('No previous ledger entry found for poem update');
      }
      
      // Generate block hash
      const blockHash = this.generateBlockHash(contentHash, previousEntry.blockHash, timestamp.toISOString(), author);
      
      // Generate signature
      const signatureData = `${contentHash}${blockHash}${timestamp.toISOString()}`;
      const signature = this.generateSignature(signatureData);
      
      // Create update ledger entry
      const ledgerEntry = new LedgerEntry({
        eventType: 'POEM_UPDATED',
        poemId,
        authorId: author,
        contentHash,
        previousHash: previousEntry.blockHash,
        blockHash,
        metadata: {
          title,
          originalTimestamp: timestamp,
          license,
          wordCount: `${title} ${body}`.split(' ').length,
          previousVersion: previousEntry.contentHash
        },
        signature,
        witnessNodes: [
          {
            nodeId: 'primary-node',
            signature: this.generateSignature(`witness-${blockHash}`),
            timestamp
          }
        ]
      });

      await ledgerEntry.save();
      console.log(`🔒 Created update ledger entry for poem: ${poemId}`);
      
      return ledgerEntry;
    } catch (error) {
      console.error('Error creating poem update ledger entry:', error);
      throw error;
    }
  }

  // Verify the authorship of a poem
  async verifyAuthorship(poemId, currentContent) {
    try {
      const currentHash = this.generateContentHash(currentContent);
      
      // Get all ledger entries for this poem
      const entries = await LedgerEntry.getAuthorshipChain(poemId);
      
      if (entries.length === 0) {
        return {
          isValid: false,
          reason: 'No ledger entries found'
        };
      }

      // Verify chain integrity
      const chainValid = await LedgerEntry.verifyChainIntegrity(poemId);
      if (!chainValid) {
        return {
          isValid: false,
          reason: 'Ledger chain integrity compromised'
        };
      }

      // Get the latest entry
      const latestEntry = entries[entries.length - 1];
      
      // Verify current content matches latest hash
      const contentMatches = latestEntry.contentHash === currentHash;
      
      return {
        isValid: contentMatches && chainValid,
        originalAuthor: entries[0].authorId,
        creationDate: entries[0].createdAt,
        lastModified: latestEntry.createdAt,
        totalModifications: entries.length - 1,
        entries: entries.map(entry => ({
          eventType: entry.eventType,
          timestamp: entry.createdAt,
          author: entry.authorId,
          contentHash: entry.contentHash
        }))
      };
    } catch (error) {
      console.error('Error verifying authorship:', error);
      throw error;
    }
  }

  // Get authorship history for a poem
  async getAuthorshipHistory(poemId) {
    try {
      const entries = await LedgerEntry.getAuthorshipChain(poemId);
      
      return entries.map(entry => ({
        eventType: entry.eventType,
        timestamp: entry.createdAt,
        author: {
          id: entry.authorId._id,
          username: entry.authorId.username,
          displayName: entry.authorId.displayName
        },
        metadata: entry.metadata,
        blockHash: entry.blockHash,
        isVerified: entry.isVerified
      }));
    } catch (error) {
      console.error('Error getting authorship history:', error);
      throw error;
    }
  }

  // Generate proof of authorship certificate
  async generateAuthorshipCertificate(poemId) {
    try {
      const verification = await this.verifyAuthorship(poemId);
      
      if (!verification.isValid) {
        throw new Error('Cannot generate certificate for invalid authorship');
      }

      const certificate = {
        poemId,
        certificateId: crypto.randomUUID(),
        issuedAt: new Date().toISOString(),
        originalAuthor: verification.originalAuthor,
        creationDate: verification.creationDate,
        lastVerified: new Date().toISOString(),
        chainLength: verification.entries.length,
        certificateHash: '',
        digitalSignature: ''
      };

      // Generate certificate hash and signature
      const certificateData = JSON.stringify({
        ...certificate,
        certificateHash: undefined,
        digitalSignature: undefined
      });
      
      certificate.certificateHash = this.generateContentHash(certificateData);
      certificate.digitalSignature = this.generateSignature(certificateData);

      return certificate;
    } catch (error) {
      console.error('Error generating authorship certificate:', error);
      throw error;
    }
  }

  // Validate a certificate
  async validateCertificate(certificate) {
    try {
      const certificateData = JSON.stringify({
        ...certificate,
        certificateHash: undefined,
        digitalSignature: undefined
      });
      
      const expectedHash = this.generateContentHash(certificateData);
      const expectedSignature = this.generateSignature(certificateData);
      
      const hashValid = certificate.certificateHash === expectedHash;
      const signatureValid = certificate.digitalSignature === expectedSignature;
      
      // Also verify the poem still exists and matches
      const currentVerification = await this.verifyAuthorship(certificate.poemId);
      
      return {
        isValid: hashValid && signatureValid && currentVerification.isValid,
        certificateIntegrity: hashValid && signatureValid,
        poemIntegrity: currentVerification.isValid,
        details: {
          hashMatch: hashValid,
          signatureMatch: signatureValid,
          poemExists: !!currentVerification,
          chainIntact: currentVerification.isValid
        }
      };
    } catch (error) {
      console.error('Error validating certificate:', error);
      throw error;
    }
  }

  // Get ledger statistics
  async getLedgerStats() {
    try {
      const stats = await LedgerEntry.aggregate([
        {
          $group: {
            _id: '$eventType',
            count: { $sum: 1 }
          }
        }
      ]);

      const totalEntries = await LedgerEntry.countDocuments();
      const uniquePoems = await LedgerEntry.distinct('poemId').then(poems => poems.length);
      const uniqueAuthors = await LedgerEntry.distinct('authorId').then(authors => authors.length);

      return {
        totalEntries,
        uniquePoems,
        uniqueAuthors,
        eventTypes: stats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {})
      };
    } catch (error) {
      console.error('Error getting ledger stats:', error);
      throw error;
    }
  }
}

module.exports = LedgerService;