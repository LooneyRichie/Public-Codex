const express = require('express');
const { body, validationResult } = require('express-validator');
const Poem = require('../models/Poem');
const User = require('../models/User');
const { auth, optionalAuth } = require('../middleware/auth');
const crypto = require('crypto');

const router = express.Router();

// Helper function to generate content hash
const generateContentHash = (title, body, author) => {
  return crypto.createHash('sha256').update(`${title}${body}${author}`).digest('hex');
};

// Create poem
router.post('/', auth, [
  body('title').isLength({ min: 1, max: 200 }).trim().escape(),
  body('body').isLength({ min: 1, max: 10000 }).trim(),
  body('license').isIn([
    'All Rights Reserved',
    'CC BY 4.0',
    'CC BY-SA 4.0', 
    'CC BY-NC 4.0',
    'CC BY-NC-SA 4.0',
    'CC BY-ND 4.0',
    'CC BY-NC-ND 4.0',
    'CC0 1.0'
  ]),
  body('tags').optional().isArray(),
  body('mood').optional().isIn(['melancholic', 'joyful', 'contemplative', 'passionate', 'dark', 'hopeful', 'nostalgic', 'rebellious', 'peaceful', 'intense']),
  body('style').optional().isIn(['free-verse', 'sonnet', 'haiku', 'limerick', 'ballad', 'epic', 'lyric', 'narrative', 'prose-poetry', 'experimental'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, body, license, tags, mood, style, visibility = 'public' } = req.body;

    // Generate content hash for protection
    const contentHash = generateContentHash(title, body, req.user.id);

    // Create poem
    const poem = new Poem({
      title,
      body,
      author: req.user.id,
      license: license || req.user.defaultLicense,
      tags: tags || [],
      mood: mood || 'contemplative',
      style: style || 'free-verse',
      visibility,
      contentHash
    });

    await poem.save();

    // Update user stats
    await User.findByIdAndUpdate(req.user.id, {
      $inc: { 'stats.poemsPublished': 1 }
    });

    // Publish event and write file ledger
    req.app.locals.eventBus?.publish({ type: 'POEM_CREATED', poemId: poem._id.toString(), authorId: req.user.id });
    req.app.locals.fileLedger?.append(poem._id.toString(), 'POEM_CREATED', { title, license, authorId: req.user.id });

    // Create ledger entry if service is available
    if (req.app.locals.ledgerService) {
      try {
        await req.app.locals.ledgerService.createPoemEntry(poem);
      } catch (ledgerError) {
        console.error('Ledger creation error:', ledgerError);
        // Continue even if ledger fails
      }
    }

    // Index in vector database if available
    if (req.app.locals.vectorService) {
      try {
        const vectorId = await req.app.locals.vectorService.indexPoem(
          poem._id,
          title,
          body,
          {
            author: req.user.displayName || req.user.username,
            license,
            tags,
            mood,
            style,
            createdAt: poem.createdAt
          }
        );
        poem.vectorId = vectorId;
        await poem.save();
      } catch (vectorError) {
        console.error('Vector indexing error:', vectorError);
        // Continue even if vector indexing fails
      }
    }

    const populatedPoem = await Poem.findById(poem._id)
      .populate('author', 'username displayName avatar')
      .exec();

    res.status(201).json({
      message: 'Poem created successfully',
      poem: populatedPoem
    });
  } catch (error) {
    console.error('Poem creation error:', error);
    res.status(500).json({ message: 'Server error creating poem' });
  }
});

// Get all poems (public feed)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      mood, 
      style, 
      author, 
      tag,
      search,
      featured
    } = req.query;

    const query = { 
      isPublished: true, 
      visibility: 'public' 
    };

    // Add filters
    if (mood) query.mood = mood;
    if (style) query.style = style;
    if (author) query.author = author;
    if (tag) query.tags = { $in: [tag] };
    if (featured === 'true') query.isFeatured = true;
    if (search) {
      query.$text = { $search: search };
    }

    const poems = await Poem.find(query)
      .populate('author', 'username displayName avatar')
      .sort(search ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Poem.countDocuments(query);

    res.json({
      poems,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalPoems: total
    });
  } catch (error) {
    console.error('Get poems error:', error);
    res.status(500).json({ message: 'Server error fetching poems' });
  }
});

// Get single poem
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const poem = await Poem.findById(req.params.id)
      .populate('author', 'username displayName avatar bio location')
      .populate('comments.author', 'username displayName avatar')
      .exec();

    if (!poem) {
      return res.status(404).json({ message: 'Poem not found' });
    }

    // Check if user can view this poem
    if (poem.visibility === 'private' && (!req.user || poem.author._id.toString() !== req.user.id)) {
      return res.status(403).json({ message: 'Not authorized to view this poem' });
    }

    // Increment view count
    poem.views += 1;
    await poem.save();

    // Update user total views
    await User.findByIdAndUpdate(poem.author._id, {
      $inc: { 'stats.totalViews': 1 }
    });

    res.json(poem);
  } catch (error) {
    console.error('Get poem error:', error);
    res.status(500).json({ message: 'Server error fetching poem' });
  }
});

// Update poem
router.put('/:id', auth, [
  body('title').optional().isLength({ min: 1, max: 200 }).trim().escape(),
  body('body').optional().isLength({ min: 1, max: 10000 }).trim(),
  body('license').optional().isIn([
    'All Rights Reserved',
    'CC BY 4.0',
    'CC BY-SA 4.0',
    'CC BY-NC 4.0', 
    'CC BY-NC-SA 4.0',
    'CC BY-ND 4.0',
    'CC BY-NC-ND 4.0',
    'CC0 1.0'
  ]),
  body('tags').optional().isArray(),
  body('visibility').optional().isIn(['public', 'unlisted', 'private'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const poem = await Poem.findById(req.params.id);
    if (!poem) {
      return res.status(404).json({ message: 'Poem not found' });
    }

    // Check ownership
    if (poem.author.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to edit this poem' });
    }

    const updates = req.body;
    
    // Update content hash if title or body changed
    if (updates.title || updates.body) {
      const newTitle = updates.title || poem.title;
      const newBody = updates.body || poem.body;
      updates.contentHash = generateContentHash(newTitle, newBody, req.user.id);
    }

    const updatedPoem = await Poem.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('author', 'username displayName avatar');

    // Create ledger entry for update
    if (req.app.locals.ledgerService) {
      try {
        await req.app.locals.ledgerService.updatePoemEntry(updatedPoem);
      } catch (ledgerError) {
        console.error('Ledger update error:', ledgerError);
      }
    }

    // Publish event and write file ledger
    req.app.locals.eventBus?.publish({ type: 'POEM_UPDATED', poemId: updatedPoem._id.toString(), authorId: req.user.id });
    req.app.locals.fileLedger?.append(updatedPoem._id.toString(), 'POEM_UPDATED', { updates });

    // Update vector index if content changed
    if ((updates.title || updates.body) && req.app.locals.vectorService && poem.vectorId) {
      try {
        await req.app.locals.vectorService.indexPoem(
          poem._id,
          updatedPoem.title,
          updatedPoem.body,
          {
            author: req.user.displayName || req.user.username,
            license: updatedPoem.license,
            tags: updatedPoem.tags,
            mood: updatedPoem.mood,
            style: updatedPoem.style,
            createdAt: updatedPoem.createdAt
          }
        );
      } catch (vectorError) {
        console.error('Vector update error:', vectorError);
      }
    }

    res.json({
      message: 'Poem updated successfully',
      poem: updatedPoem
    });
  } catch (error) {
    console.error('Poem update error:', error);
    res.status(500).json({ message: 'Server error updating poem' });
  }
});

// Delete poem
router.delete('/:id', auth, async (req, res) => {
  try {
    const poem = await Poem.findById(req.params.id);
    if (!poem) {
      return res.status(404).json({ message: 'Poem not found' });
    }

    // Check ownership
    if (poem.author.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this poem' });
    }

    // Remove from vector database
    if (req.app.locals.vectorService && poem.vectorId) {
      try {
        await req.app.locals.vectorService.deletePoem(poem._id);
      } catch (vectorError) {
        console.error('Vector deletion error:', vectorError);
      }
    }

    await Poem.findByIdAndDelete(req.params.id);

    // Update user stats
    await User.findByIdAndUpdate(req.user.id, {
      $inc: { 'stats.poemsPublished': -1 }
    });

    // Publish event and write file ledger
    req.app.locals.eventBus?.publish({ type: 'POEM_DELETED', poemId: req.params.id, authorId: req.user.id });
    req.app.locals.fileLedger?.append(req.params.id, 'POEM_DELETED', {});

    res.json({ message: 'Poem deleted successfully' });
  } catch (error) {
    console.error('Poem deletion error:', error);
    res.status(500).json({ message: 'Server error deleting poem' });
  }
});

// Like/Unlike poem
router.post('/:id/like', auth, async (req, res) => {
  try {
    const poem = await Poem.findById(req.params.id);
    if (!poem) {
      return res.status(404).json({ message: 'Poem not found' });
    }

    const existingLike = poem.likes.find(like => like.user.toString() === req.user.id);

    if (existingLike) {
      // Unlike
      poem.likes = poem.likes.filter(like => like.user.toString() !== req.user.id);
      await User.findByIdAndUpdate(poem.author, {
        $inc: { 'stats.totalLikes': -1 }
      });
    } else {
      // Like
      poem.likes.push({ user: req.user.id });
      await User.findByIdAndUpdate(poem.author, {
        $inc: { 'stats.totalLikes': 1 }
      });
    }

    await poem.save();

    res.json({
      message: existingLike ? 'Poem unliked' : 'Poem liked',
      likeCount: poem.likes.length,
      isLiked: !existingLike
    });
  } catch (error) {
    console.error('Like poem error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add comment
router.post('/:id/comments', auth, [
  body('content').isLength({ min: 1, max: 1000 }).trim().escape()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const poem = await Poem.findById(req.params.id);
    if (!poem) {
      return res.status(404).json({ message: 'Poem not found' });
    }

    poem.comments.push({
      author: req.user.id,
      content: req.body.content
    });

    await poem.save();

    const updatedPoem = await Poem.findById(req.params.id)
      .populate('comments.author', 'username displayName avatar')
      .exec();

    res.status(201).json({
      message: 'Comment added successfully',
      comments: updatedPoem.comments
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ message: 'Server error adding comment' });
  }
});

// Get user's poems
router.get('/user/:userId', optionalAuth, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const { userId } = req.params;

    const query = { 
      author: userId,
      isPublished: true
    };

    // If not the author, only show public poems
    if (!req.user || req.user.id !== userId) {
      query.visibility = 'public';
    }

    const poems = await Poem.find(query)
      .populate('author', 'username displayName avatar')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Poem.countDocuments(query);

    res.json({
      poems,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalPoems: total
    });
  } catch (error) {
    console.error('Get user poems error:', error);
    res.status(500).json({ message: 'Server error fetching user poems' });
  }
});

module.exports = router;