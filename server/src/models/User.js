const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    uppercase: true,
    lowercase: true,
    interger: true,
    special: true,
    minlength: 6
  },
  displayName: {
    type: String,
    trim: true,
    maxlength: 100
  },
  bio: {
    type: String,
    maxlength: 5000
  },
  avatar: {
    type: String,
    default: null
  },
  website: {
    type: String,
    trim: true
  },
  location: {
    type: String,
    trim: true,
    maxlength: 100
  },
  defaultLicense: {
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
    default: 'All Rights Reserved'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  role: {
    type: String,
    enum: ['user', 'moderator', 'admin'],
    default: 'user'
  },
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  stats: {
    poemsPublished: {
      type: Number,
      default: 0
    },
    totalViews: {
      type: Number,
      default: 0
    },
    totalLikes: {
      type: Number,
      default: 0
    }
  },
  settings: {
    emailNotifications: {
      type: Boolean,
      default: true
    },
    profileVisibility: {
      type: String,
      enum: ['public', 'private'],
      default: 'public'
    },
    allowComments: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true
});

// Indexes
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ createdAt: -1 });

// Virtual for follower count
userSchema.virtual('followerCount').get(function() {
  return this.followers.length;
});

// Virtual for following count
userSchema.virtual('followingCount').get(function() {
  return this.following.length;
});

userSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('User', userSchema);