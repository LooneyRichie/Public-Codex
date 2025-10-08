const mongoose = require('mongoose');

const poemSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  body: {
    type: String,
    required: true,
    maxlength: 10000
  },
  excerpt: {
    type: String,
    maxlength: 300
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  license: {
    type: String,
    enum: [
      'All Rights Reserved',
      'CC BY 4.0',
      'CC BY-SA 4.0',
      'CC BY-NC 4.0',
      'CC BY-NC-SA 4.0',
      'CC BY-ND 4.0',
      'CC BY-NC-ND 4.0',
      'CC0 1.0'
    ],
    required: true
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
    maxlength: 30
  }],
  mood: {
    type: String,
    enum: ['melancholic', 'joyful', 'contemplative', 'passionate', 'dark', 'hopeful', 'nostalgic', 'rebellious', 'peaceful', 'intense'],
    default: 'contemplative'
  },
  style: {
    type: String,
    enum: ['free-verse', 'sonnet', 'haiku', 'limerick', 'ballad', 'epic', 'lyric', 'narrative', 'prose-poetry', 'experimental'],
    default: 'free-verse'
  },
  isPublished: {
    type: Boolean,
    default: true
  },
  isDraft: {
    type: Boolean,
    default: false
  },
  visibility: {
    type: String,
    enum: ['public', 'unlisted', 'private'],
    default: 'public'
  },
  
  // Engagement metrics
  views: {
    type: Number,
    default: 0
  },
  likes: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Protection & Ledger
  contentHash: {
    type: String,
    required: true
  },
  ledgerEntry: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LedgerEntry'
  },
  
  // Vector embeddings (stored reference)
  vectorId: {
    type: String
  },
  
  // Metadata for copyright
  copyrightYear: {
    type: Number,
    required: true
  },
  authorshipProof: {
    originalHash: String,
    timestamp: Date,
    signature: String
  },
  
  // Comments
  comments: [{
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    content: {
      type: String,
      maxlength: 1000
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    isApproved: {
      type: Boolean,
      default: true
    }
  }],
  
  // Featured status
  isFeatured: {
    type: Boolean,
    default: false
  },
  featuredAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for performance
poemSchema.index({ author: 1, createdAt: -1 });
poemSchema.index({ isPublished: 1, visibility: 1, createdAt: -1 });
poemSchema.index({ tags: 1 });
poemSchema.index({ mood: 1, style: 1 });
poemSchema.index({ contentHash: 1 }, { unique: true });
poemSchema.index({ vectorId: 1 });
poemSchema.index({ isFeatured: 1, featuredAt: -1 });

// Text search index
poemSchema.index({
  title: 'text',
  body: 'text',
  tags: 'text'
});

// Virtual for like count
poemSchema.virtual('likeCount').get(function() {
  return this.likes.length;
});

// Virtual for comment count
poemSchema.virtual('commentCount').get(function() {
  return this.comments.filter(comment => comment.isApproved).length;
});

// Virtual for copyright notice
poemSchema.virtual('copyrightNotice').get(function() {
  const year = this.copyrightYear || new Date(this.createdAt).getFullYear();
  const authorName = this.author.displayName || this.author.username;
  
  if (this.license === 'All Rights Reserved') {
    return `© ${year} ${authorName}. All Rights Reserved.`;
  } else if (this.license.startsWith('CC')) {
    return `© ${year} ${authorName}. Licensed under ${this.license}.`;
  }
  
  return `© ${year} ${authorName}.`;
});

// Pre-save middleware to generate excerpt
poemSchema.pre('save', function(next) {
  if (!this.excerpt && this.body) {
    // Generate excerpt from first 150 characters
    this.excerpt = this.body.substring(0, 150).trim();
    if (this.body.length > 150) {
      this.excerpt += '...';
    }
  }
  
  // Set copyright year
  if (!this.copyrightYear) {
    this.copyrightYear = new Date().getFullYear();
  }
  
  next();
});

poemSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Poem', poemSchema);