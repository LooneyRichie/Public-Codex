const express = require('express');
const Poem = require('../models/Poem');
const User = require('../models/User');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

// General search endpoint
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { 
      q: query, 
      type = 'all', 
      page = 1, 
      limit = 10,
      mood,
      style,
      license
    } = req.query;

    if (!query) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const results = {};

    if (type === 'all' || type === 'poems') {
      // Search poems
      const poemQuery = {
        $and: [
          {
            isPublished: true,
            visibility: 'public'
          },
          {
            $or: [
              { title: { $regex: query, $options: 'i' } },
              { body: { $regex: query, $options: 'i' } },
              { tags: { $in: [new RegExp(query, 'i')] } }
            ]
          }
        ]
      };

      // Add additional filters
      if (mood) poemQuery.$and.push({ mood });
      if (style) poemQuery.$and.push({ style });
      if (license) poemQuery.$and.push({ license });

      const poems = await Poem.find(poemQuery)
        .populate('author', 'username displayName avatar')
        .sort({ createdAt: -1 })
        .limit(type === 'poems' ? limit * 1 : 5)
        .skip(type === 'poems' ? (page - 1) * limit : 0);

      const poemCount = await Poem.countDocuments(poemQuery);

      results.poems = {
        items: poems,
        total: poemCount,
        ...(type === 'poems' && {
          currentPage: page,
          totalPages: Math.ceil(poemCount / limit)
        })
      };
    }

    if (type === 'all' || type === 'users') {
      // Search users
      const userQuery = {
        $and: [
          { 'settings.profileVisibility': 'public' },
          {
            $or: [
              { username: { $regex: query, $options: 'i' } },
              { displayName: { $regex: query, $options: 'i' } },
              { bio: { $regex: query, $options: 'i' } }
            ]
          }
        ]
      };

      const users = await User.find(userQuery)
        .select('username displayName avatar bio location stats')
        .sort({ 'stats.poemsPublished': -1 })
        .limit(type === 'users' ? limit * 1 : 5)
        .skip(type === 'users' ? (page - 1) * limit : 0);

      const userCount = await User.countDocuments(userQuery);

      results.users = {
        items: users,
        total: userCount,
        ...(type === 'users' && {
          currentPage: page,
          totalPages: Math.ceil(userCount / limit)
        })
      };
    }

    res.json({
      query,
      type,
      results
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ message: 'Server error during search' });
  }
});

// Semantic search (using vector database if available)
router.get('/semantic', optionalAuth, async (req, res) => {
  try {
    const { q: query, limit = 10, threshold = 0.7 } = req.query;

    if (!query) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    let semanticResults = [];

    // Use vector search if available
    if (req.app.locals.vectorService && req.app.locals.vectorService.isReady) {
      try {
        const vectorResults = await req.app.locals.vectorService.searchSimilarPoems(query, {
          topK: limit,
          threshold: parseFloat(threshold),
          filter: {} // Could add filters here
        });

        // Get full poem data for the results
        const poemIds = vectorResults.map(result => result.id);
        const poems = await Poem.find({
          _id: { $in: poemIds },
          isPublished: true,
          visibility: 'public'
        })
        .populate('author', 'username displayName avatar');

        // Map poems with their similarity scores
        semanticResults = poems.map(poem => {
          const vectorResult = vectorResults.find(vr => vr.id === poem._id.toString());
          return {
            ...poem.toJSON(),
            similarityScore: vectorResult ? vectorResult.score : 0
          };
        });

        // Sort by similarity score
        semanticResults.sort((a, b) => b.similarityScore - a.similarityScore);

      } catch (vectorError) {
        console.error('Vector search error:', vectorError);
        // Fall back to regular search
      }
    }

    // Fallback to regular text search if vector search isn't available or failed
    if (semanticResults.length === 0) {
      const poems = await Poem.find({
        $and: [
          { isPublished: true, visibility: 'public' },
          {
            $or: [
              { title: { $regex: query, $options: 'i' } },
              { body: { $regex: query, $options: 'i' } },
              { tags: { $in: [new RegExp(query, 'i')] } }
            ]
          }
        ]
      })
      .populate('author', 'username displayName avatar')
      .sort({ createdAt: -1 })
      .limit(limit);

      semanticResults = poems.map(poem => ({
        ...poem.toJSON(),
        similarityScore: 0.5 // Default score for text search
      }));
    }

    res.json({
      query,
      method: req.app.locals.vectorService?.isReady ? 'vector' : 'text',
      results: semanticResults,
      total: semanticResults.length
    });
  } catch (error) {
    console.error('Semantic search error:', error);
    res.status(500).json({ message: 'Server error during semantic search' });
  }
});

// Search suggestions/autocomplete
router.get('/suggestions', async (req, res) => {
  try {
    const { q: query, type = 'all' } = req.query;

    if (!query || query.length < 2) {
      return res.json({ suggestions: [] });
    }

    const suggestions = [];

    if (type === 'all' || type === 'tags') {
      // Get popular tags that match the query
      const tagResults = await Poem.aggregate([
        { $match: { isPublished: true, visibility: 'public' } },
        { $unwind: '$tags' },
        { $match: { tags: { $regex: query, $options: 'i' } } },
        { $group: { _id: '$tags', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ]);

      suggestions.push(...tagResults.map(tag => ({
        type: 'tag',
        value: tag._id,
        count: tag.count
      })));
    }

    if (type === 'all' || type === 'users') {
      // Get users that match the query
      const users = await User.find({
        $and: [
          { 'settings.profileVisibility': 'public' },
          {
            $or: [
              { username: { $regex: query, $options: 'i' } },
              { displayName: { $regex: query, $options: 'i' } }
            ]
          }
        ]
      })
      .select('username displayName avatar')
      .limit(5);

      suggestions.push(...users.map(user => ({
        type: 'user',
        value: user.displayName || user.username,
        id: user._id,
        avatar: user.avatar
      })));
    }

    if (type === 'all' || type === 'titles') {
      // Get poem titles that match the query
      const poems = await Poem.find({
        title: { $regex: query, $options: 'i' },
        isPublished: true,
        visibility: 'public'
      })
      .select('title author')
      .populate('author', 'username displayName')
      .limit(5);

      suggestions.push(...poems.map(poem => ({
        type: 'title',
        value: poem.title,
        id: poem._id,
        author: poem.author.displayName || poem.author.username
      })));
    }

    res.json({
      query,
      suggestions: suggestions.slice(0, 10) // Limit total suggestions
    });
  } catch (error) {
    console.error('Search suggestions error:', error);
    res.status(500).json({ message: 'Server error fetching suggestions' });
  }
});

// Get trending searches/popular content
router.get('/trending', async (req, res) => {
  try {
    const { type = 'all' } = req.query;
    const trending = {};

    if (type === 'all' || type === 'tags') {
      // Get most used tags in the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const trendingTags = await Poem.aggregate([
        {
          $match: {
            isPublished: true,
            visibility: 'public',
            createdAt: { $gte: thirtyDaysAgo }
          }
        },
        { $unwind: '$tags' },
        { $group: { _id: '$tags', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);

      trending.tags = trendingTags.map(tag => ({
        name: tag._id,
        count: tag.count
      }));
    }

    if (type === 'all' || type === 'moods') {
      // Get trending moods
      const trendingMoods = await Poem.aggregate([
        {
          $match: {
            isPublished: true,
            visibility: 'public',
            createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
          }
        },
        { $group: { _id: '$mood', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ]);

      trending.moods = trendingMoods.map(mood => ({
        name: mood._id,
        count: mood.count
      }));
    }

    if (type === 'all' || type === 'poets') {
      // Get most active poets
      const activePoets = await User.find({
        'settings.profileVisibility': 'public'
      })
      .select('username displayName avatar stats')
      .sort({ 'stats.poemsPublished': -1 })
      .limit(5);

      trending.poets = activePoets;
    }

    res.json(trending);
  } catch (error) {
    console.error('Trending search error:', error);
    res.status(500).json({ message: 'Server error fetching trending content' });
  }
});

module.exports = router;