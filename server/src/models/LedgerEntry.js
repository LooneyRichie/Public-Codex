const mongoose = require('mongoose');

// Immutable ledger for authorship protection
const ledgerEntrySchema = new mongoose.Schema({
  eventType: {
    type: String,
    enum: ['POEM_CREATED', 'POEM_UPDATED', 'POEM_DELETED', 'POEM_TRANSFERRED'],
    required: true
  },
  poemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Poem',
    required: true
  },
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  contentHash: {
    type: String,
    required: true
  },
  previousHash: {
    type: String,
    default: null
  },
  blockHash: {
    type: String,
    required: true
  },
  metadata: {
    title: String,
    originalTimestamp: Date,
    ipAddress: String,
    userAgent: String,
    license: String,
    wordCount: Number,
    previousVersion: String
  },
  signature: {
    type: String,
    required: true
  },
  witnessNodes: [{
    nodeId: String,
    signature: String,
    timestamp: Date
  }],
  isVerified: {
    type: Boolean,
    default: true
  },
  verificationProofs: [{
    algorithm: String,
    proof: String,
    timestamp: Date
  }]
}, {
  timestamps: { 
    createdAt: true, 
    updatedAt: false // Immutable - no updates allowed
  }
});

// Compound index for efficient queries
ledgerEntrySchema.index({ poemId: 1, createdAt: -1 });
ledgerEntrySchema.index({ authorId: 1, createdAt: -1 });
ledgerEntrySchema.index({ contentHash: 1 });
ledgerEntrySchema.index({ blockHash: 1 }, { unique: true });

// Prevent updates to ledger entries (immutability)
ledgerEntrySchema.pre('save', function(next) {
  if (!this.isNew) {
    const error = new Error('Ledger entries are immutable and cannot be modified');
    error.code = 'IMMUTABLE_LEDGER';
    return next(error);
  }
  next();
});

// Prevent deletions
ledgerEntrySchema.pre('remove', function(next) {
  const error = new Error('Ledger entries cannot be deleted');
  error.code = 'IMMUTABLE_LEDGER';
  next(error);
});

ledgerEntrySchema.pre('deleteOne', function(next) {
  const error = new Error('Ledger entries cannot be deleted');
  error.code = 'IMMUTABLE_LEDGER';
  next(error);
});

// Virtual for chain verification
ledgerEntrySchema.virtual('isChainValid').get(function() {
  // This would contain logic to verify the blockchain integrity
  // For now, we'll just check if required fields are present
  return !!(this.contentHash && this.blockHash && this.signature);
});

// Method to verify authorship
ledgerEntrySchema.methods.verifyAuthorship = function(currentHash) {
  return this.contentHash === currentHash && this.isVerified;
};

// Static method to get authorship chain
ledgerEntrySchema.statics.getAuthorshipChain = function(poemId) {
  return this.find({ poemId })
    .sort({ createdAt: 1 })
    .populate('authorId', 'username displayName')
    .exec();
};

// Static method to verify chain integrity
ledgerEntrySchema.statics.verifyChainIntegrity = function(poemId) {
  return this.find({ poemId })
    .sort({ createdAt: 1 })
    .then(entries => {
      for (let i = 1; i < entries.length; i++) {
        if (entries[i].previousHash !== entries[i - 1].blockHash) {
          return false;
        }
      }
      return true;
    });
};

ledgerEntrySchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('LedgerEntry', ledgerEntrySchema);