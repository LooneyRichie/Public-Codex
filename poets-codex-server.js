// Public Codex Server with Permanent Encrypted Storage
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const EncryptedPermanentStorage = require('./server/src/services/EncryptedPermanentStorage');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'public-codex-change-this-in-production';

// Initialize permanent storage
const permanentStorage = new EncryptedPermanentStorage();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'poem-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));

// Initialize storage and start server
async function startServer() {
  try {
    await permanentStorage.initialize();
    console.log('✅ Permanent encrypted storage ready');
  } catch (error) {
    console.error('❌ Failed to initialize storage - falling back to in-memory mode');
  }

  // Health check endpoint
  app.get('/api/health', async (req, res) => {
    try {
      const stats = await permanentStorage.getStats();
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        storage: stats
      });
    } catch (error) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  });

  // User Registration
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { username, email, password, displayName } = req.body;

      // Validation
      if (!username || !email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Username, email, and password are required'
        });
      }

      // Check if user exists
      const existingUser = await permanentStorage.findUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User already exists'
        });
      }

      const existingUsername = await permanentStorage.findUserByUsername(username);
      if (existingUsername) {
        return res.status(400).json({
          success: false,
          message: 'Username already taken'
        });
      }

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Create user
      const user = await permanentStorage.createUser({
        username,
        email,
        password: hashedPassword,
        displayName: displayName || username,
        profile: {}
      });

      // Generate token
      const token = jwt.sign(
        { userId: user.id, username: user.username, email: user.email },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.status(201).json({
        success: true,
        message: 'User created successfully',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          displayName: user.displayName
        },
        token
      });

    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during registration'
      });
    }
  });

  // User Login
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
      }

      // Find user
      const user = await permanentStorage.findUserByEmail(email);
      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Check password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(400).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Generate token
      const token = jwt.sign(
        { userId: user.id, username: user.username, email: user.email },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        success: true,
        message: 'Login successful',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          displayName: user.displayName
        },
        token
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during login'
      });
    }
  });

  // Get current user
  app.get('/api/auth/me', async (req, res) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await permanentStorage.findUserById(decoded.userId);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          displayName: user.displayName
        }
      });
    } catch (error) {
      res.status(401).json({ message: 'Invalid token' });
    }
  });

  // Create poem
  app.post('/api/poems', upload.single('image'), async (req, res) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await permanentStorage.findUserById(decoded.userId);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const { title, body, license, mood, style, visibility, tags, contentType } = req.body;
      
      if (!title || !body) {
        return res.status(400).json({
          success: false,
          message: 'Title and body are required'
        });
      }

      const poem = await permanentStorage.createPoem({
        title,
        body,
        author: user.id,
        license: license || 'All Rights Reserved',
        mood: mood || 'contemplative',
        style: style || 'free-verse',
        visibility: visibility || 'public',
        tags: tags ? JSON.parse(tags) : [],
        image: req.file ? `/uploads/${req.file.filename}` : null,
        contentType: contentType || 'poetry'
      });

      res.status(201).json({
        success: true,
        message: 'Content created successfully',
        poem
      });

    } catch (error) {
      console.error('Create poem error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error creating poem'
      });
    }
  });

  // Get poem by ID
  app.get('/api/poems/:id', async (req, res) => {
    try {
      const poem = await permanentStorage.findPoemById(req.params.id);
      
      if (!poem) {
        return res.status(404).json({
          success: false,
          message: 'Poem not found'
        });
      }

      // Get author info
      const author = await permanentStorage.findUserById(poem.author);
      
      res.json({
        success: true,
        poem: {
          ...poem,
          author: {
            id: author.id,
            username: author.username,
            displayName: author.displayName
          }
        }
      });
    } catch (error) {
      console.error('Get poem error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  // Get user's poems
  app.get('/api/users/:userId/poems', async (req, res) => {
    try {
      const poems = await permanentStorage.findPoemsByAuthor(req.params.userId);
      
      res.json({
        success: true,
        poems
      });
    } catch (error) {
      console.error('Get user poems error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  // Delete poem
  app.delete('/api/poems/:id', async (req, res) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await permanentStorage.findUserById(decoded.userId);
      
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const poemId = req.params.id;
      const userId = user.id;
      
      const result = await permanentStorage.deletePoem(poemId, userId);
      
      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      console.error('Delete poem error:', error);
      if (error.message.includes('not found')) {
        res.status(404).json({ success: false, message: error.message });
      } else if (error.message.includes('Unauthorized')) {
        res.status(403).json({ success: false, message: error.message });
      } else if (error.name === 'JsonWebTokenError') {
        res.status(401).json({ success: false, message: 'Invalid token' });
      } else {
        res.status(500).json({ success: false, message: 'Server error' });
      }
    }
  });

  // Search poems
  app.get('/api/search', async (req, res) => {
    try {
      const { q, tags, mood, style, limit } = req.query;
      
      const poems = await permanentStorage.searchPoems({
        title: q,
        tags: tags ? tags.split(',') : undefined,
        mood,
        style,
        limit: parseInt(limit) || 50
      });

      // Get author info for each poem
      const poemsWithAuthors = await Promise.all(
        poems.map(async (poem) => {
          const author = await permanentStorage.findUserById(poem.author);
          return {
            ...poem,
            author: {
              id: author.id,
              username: author.username,
              displayName: author.displayName
            }
          };
        })
      );

      res.json({
        success: true,
        poems: poemsWithAuthors,
        count: poemsWithAuthors.length
      });
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  app.listen(PORT, () => {
    console.log(`🚀 Public Codex server with permanent storage running on port ${PORT}`);
    console.log(`📚 Using encrypted SQLite storage for permanent data`);
  });
}

startServer();