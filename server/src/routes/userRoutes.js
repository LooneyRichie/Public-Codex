const express = require('express');
const User = require('../models/User');
const Poem = require('../models/Poem');
const { auth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Get user profile
router.get('/:userId', optionalAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('-password -email')
      .populate('followers', 'username displayName avatar')
      .populate('following', 'username displayName avatar');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if profile is private
    if (user.settings.profileVisibility === 'private' && 
        (!req.user || req.user.id !== user.id.toString())) {
      return res.status(403).json({ message: 'Profile is private' });
    }

    // Get recent poems
    const recentPoems = await Poem.find({
      author: user._id,
      isPublished: true,
      visibility: req.user && req.user.id === user.id.toString() ? { $in: ['public', 'unlisted', 'private'] } : 'public'
    })
    .select('title excerpt createdAt views likeCount mood style')
    .sort({ createdAt: -1 })
    .limit(5);

    res.json({
      user,
      recentPoems
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ message: 'Server error fetching user profile' });
  }
});

// Search users
router.get('/', async (req, res) => {
  try {
    const { search, page = 1, limit = 10 } = req.query;

    let query = { 'settings.profileVisibility': 'public' };
    
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { displayName: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('username displayName avatar bio location stats')
      .sort({ 'stats.poemsPublished': -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      users,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalUsers: total
    });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ message: 'Server error searching users' });
  }
});

// Follow/Unfollow user
router.post('/:userId/follow', auth, async (req, res) => {
  try {
    const { userId } = req.params;

    if (userId === req.user.id) {
      return res.status(400).json({ message: 'Cannot follow yourself' });
    }

    const userToFollow = await User.findById(userId);
    const currentUser = await User.findById(req.user.id);

    if (!userToFollow) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isFollowing = currentUser.following.includes(userId);

    if (isFollowing) {
      // Unfollow
      currentUser.following = currentUser.following.filter(id => id.toString() !== userId);
      userToFollow.followers = userToFollow.followers.filter(id => id.toString() !== req.user.id);
    } else {
      // Follow
      currentUser.following.push(userId);
      userToFollow.followers.push(req.user.id);
    }

    await currentUser.save();
    await userToFollow.save();

    res.json({
      message: isFollowing ? 'User unfollowed' : 'User followed',
      isFollowing: !isFollowing,
      followerCount: userToFollow.followers.length
    });
  } catch (error) {
    console.error('Follow user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's followers
router.get('/:userId/followers', optionalAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .populate('followers', 'username displayName avatar bio')
      .select('followers settings');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check privacy
    if (user.settings.profileVisibility === 'private' && 
        (!req.user || req.user.id !== user.id.toString())) {
      return res.status(403).json({ message: 'Profile is private' });
    }

    res.json({
      followers: user.followers,
      count: user.followers.length
    });
  } catch (error) {
    console.error('Get followers error:', error);
    res.status(500).json({ message: 'Server error fetching followers' });
  }
});

// Get user's following
router.get('/:userId/following', optionalAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .populate('following', 'username displayName avatar bio')
      .select('following settings');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check privacy
    if (user.settings.profileVisibility === 'private' && 
        (!req.user || req.user.id !== user.id.toString())) {
      return res.status(403).json({ message: 'Profile is private' });
    }

    res.json({
      following: user.following,
      count: user.following.length
    });
  } catch (error) {
    console.error('Get following error:', error);
    res.status(500).json({ message: 'Server error fetching following' });
  }
});

// Get feed for authenticated user
router.get('/feed/me', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const user = await User.findById(req.user.id).select('following');
    
    // Get poems from followed users
    const poems = await Poem.find({
      author: { $in: user.following },
      isPublished: true,
      visibility: 'public'
    })
    .populate('author', 'username displayName avatar')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

    const total = await Poem.countDocuments({
      author: { $in: user.following },
      isPublished: true,
      visibility: 'public'
    });

    res.json({
      poems,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalPoems: total
    });
  } catch (error) {
    console.error('Get feed error:', error);
    res.status(500).json({ message: 'Server error fetching feed' });
  }
});

module.exports = router;