// Simple test server with permanent encrypted storage
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const EncryptedPermanentStorage = require('./server/src/services/EncryptedPermanentStorage');

const app = express();
const PORT = 5000;

// Initialize permanent storage
const storage = new EncryptedPermanentStorage();

const app = express();
const PORT = 5000;

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
  storage: storage,
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
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Serve uploaded images
app.use('/uploads', express.static(uploadsDir));

// In-memory stores for testing
const users = new Map();
const poems = new Map();

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, displayName } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username, email, and password are required'
      });
    }

    // Check if user exists
    for (const [id, user] of users) {
      if (user.email === email || user.username === username) {
        return res.status(400).json({
          success: false,
          message: 'User with this email or username already exists'
        });
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Create user
    const userId = Date.now().toString();
    const user = {
      id: userId,
      username,
      email,
      password: hashedPassword,
      displayName: displayName || username,
      createdAt: new Date()
    };
    
    users.set(userId, user);

    // Generate token
    const token = jwt.sign(
      { userId, username, email },
      'poets-codex-secret-key',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: userId,
        username,
        email,
        displayName: user.displayName
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
});

// Login
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
    let user = null;
    for (const [id, u] of users) {
      if (u.email === email || u.username === email) {
        user = u;
        break;
      }
    }

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
      'poets-codex-secret-key',
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName
      }
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
app.get('/api/auth/me', (req, res) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, 'poets-codex-secret-key');
    const user = users.get(decoded.userId);
    
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

// Create poem with optional image
app.post('/api/poems', upload.single('image'), (req, res) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, 'poets-codex-secret-key');
    const user = users.get(decoded.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { title, body, license, mood, style, visibility, tags } = req.body;
    
    if (!title || !body) {
      return res.status(400).json({
        success: false,
        message: 'Title and body are required'
      });
    }

    const poemId = Date.now().toString();
    const poem = {
      id: poemId,
      title,
      body,
      author: {
        id: user.id,
        username: user.username,
        displayName: user.displayName
      },
      license: license || 'All Rights Reserved',
      mood: mood || 'contemplative',
      style: style || 'free-verse',
      visibility: visibility || 'public',
      tags: tags ? JSON.parse(tags) : [],
      image: req.file ? `/uploads/${req.file.filename}` : null,
      createdAt: new Date(),
      likes: 0,
      views: 0
    };

    poems.set(poemId, poem);

    res.status(201).json({
      success: true,
      message: 'Poem created successfully',
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
app.get('/api/poems/:id', (req, res) => {
  const poem = poems.get(req.params.id);
  
  if (!poem) {
    return res.status(404).json({ message: 'Poem not found' });
  }

  res.json({
    success: true,
    poem
  });
});

// Get user's poems
app.get('/api/users/:userId/poems', (req, res) => {
  const userPoems = Array.from(poems.values()).filter(
    poem => poem.author.id === req.params.userId
  );

  res.json({
    success: true,
    poems: userPoems
  });
});

// Search poems
app.get('/api/search', (req, res) => {
  const { q, tags, mood, style } = req.query;
  let results = Array.from(poems.values()).filter(poem => poem.visibility === 'public');

  if (q) {
    const query = q.toLowerCase();
    results = results.filter(poem => 
      poem.title.toLowerCase().includes(query) ||
      poem.body.toLowerCase().includes(query) ||
      poem.author.username.toLowerCase().includes(query)
    );
  }

  if (tags) {
    const tagArray = tags.split(',').map(t => t.trim().toLowerCase());
    results = results.filter(poem => 
      poem.tags.some(tag => tagArray.includes(tag.toLowerCase()))
    );
  }

  if (mood) {
    results = results.filter(poem => poem.mood === mood);
  }

  if (style) {
    results = results.filter(poem => poem.style === style);
  }

  res.json({
    success: true,
    poems: results,
    authors: [] // For now, empty authors array
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Simple test server running on port ${PORT}`);
  console.log(`📚 Ready for authentication testing`);
});