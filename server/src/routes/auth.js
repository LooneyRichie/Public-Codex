const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const SimpleUserService = require('../services/SimpleUserService');

const router = express.Router();

// Helper function to get user service (MongoDB or simple store)
const getUserService = () => {
  if (global.simpleStore) {
    return new SimpleUserService();
  }
  return User; // Use Mongoose model
};

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, displayName } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username, email, and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Check if user already exists
    const userService = getUserService();
    const existingUser = await userService.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email or username already exists'
      });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user using appropriate service
    let user;
    if (global.simpleStore) {
      user = await userService.create({
        username,
        email,
        password: hashedPassword,
        displayName: displayName || username,
        profile: {
          bio: '',
          location: '',
          website: '',
          joinedAt: new Date()
        }
      });
    } else {
      user = new User({
        username,
        email,
        password: hashedPassword,
        displayName: displayName || username,
        profile: {
          bio: '',
          location: '',
          website: '',
          joinedAt: new Date()
        }
      });
      await user.save();
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user._id,
        username: user.username,
        email: user.email
      },
      process.env.JWT_SECRET || 'poets-codex-secret-key',
      { expiresIn: '7d' }
    );

    // Log registration to file ledger
    const fileLedger = req.app.locals.fileLedger;
    if (fileLedger) {
      await fileLedger.appendEntry({
        type: 'USER_REGISTERED',
        userId: user._id?.toString() || user.id?.toString(),
        username: user.username,
        email: user.email,
        timestamp: new Date().toISOString(),
        metadata: {
          userAgent: req.get('User-Agent'),
          ip: req.ip
        }
      });
    }

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        profile: user.profile
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
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find user
    const userService = getUserService();
    const user = await userService.findOne({ 
      $or: [{ email }, { username: email }] 
    });

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

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user._id,
        username: user.username,
        email: user.email
      },
      process.env.JWT_SECRET || 'poets-codex-secret-key',
      { expiresIn: '7d' }
    );

    // Log login to file ledger
    const fileLedger = req.app.locals.fileLedger;
    if (fileLedger) {
      await fileLedger.appendEntry({
        type: 'USER_LOGIN',
        userId: user._id?.toString() || user.id?.toString(),
        username: user.username,
        timestamp: new Date().toISOString(),
        metadata: {
          userAgent: req.get('User-Agent'),
          ip: req.ip
        }
      });
    }

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        profile: user.profile
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
router.get('/me', auth, async (req, res) => {
  try {
    const userService = getUserService();
    let user;
    
    if (global.simpleStore) {
      user = await userService.findById(req.user.userId);
      // Remove password from response for simple store
      if (user) {
        const { password, ...userWithoutPassword } = user;
        user = userWithoutPassword;
      }
    } else {
      user = await User.findById(req.user.userId).select('-password');
    }
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id || user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        profile: user.profile
      }
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Logout (client-side removes token, but we log it)
router.post('/logout', auth, async (req, res) => {
  try {
    // Log logout to file ledger
    const fileLedger = req.app.locals.fileLedger;
    if (fileLedger) {
      await fileLedger.appendEntry({
        type: 'USER_LOGOUT',
        userId: req.user.userId,
        username: req.user.username,
        timestamp: new Date().toISOString(),
        metadata: {
          userAgent: req.get('User-Agent'),
          ip: req.ip
        }
      });
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during logout'
    });
  }
});

module.exports = router;