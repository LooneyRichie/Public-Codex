const jwt = require('jsonwebtoken');
const User = require('../models/User');
const SimpleUserService = require('../services/SimpleUserService');

// Helper function to get user service (MongoDB or simple store)
const getUserService = () => {
  if (global.simpleStore) {
    return new SimpleUserService();
  }
  return User; // Use Mongoose model
};

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'poets-codex-secret-key');
    
    const userService = getUserService();
    let user;
    
    if (global.simpleStore) {
      user = await userService.findById(decoded.userId);
      // Remove password from response for simple store
      if (user) {
        const { password, ...userWithoutPassword } = user;
        user = userWithoutPassword;
      }
    } else {
      user = await User.findById(decoded.userId).select('-password');
    }
    
    if (!user) {
      return res.status(401).json({ message: 'Token is not valid' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ message: 'Token is not valid' });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'poets-codex-secret-key');
      
      const userService = getUserService();
      let user;
      
      if (global.simpleStore) {
        user = await userService.findById(decoded.userId);
        // Remove password from response for simple store
        if (user) {
          const { password, ...userWithoutPassword } = user;
          user = userWithoutPassword;
        }
      } else {
        user = await User.findById(decoded.userId).select('-password');
      }
      
      if (user) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    // Continue without user if token is invalid
    next();
  }
};

module.exports = { auth, optionalAuth };