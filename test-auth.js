// Test authentication endpoints
const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

async function testAuth() {
  try {
    console.log('Testing authentication...');
    
    // Test registration
    const registerData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'testpass123',
      displayName: 'Test User'
    };
    
    console.log('1. Testing registration...');
    try {
      const registerResponse = await axios.post(`${API_BASE}/auth/register`, registerData);
      console.log('✅ Registration successful:', registerResponse.data);
    } catch (regError) {
      console.log('❌ Registration failed:', regError.response?.data || regError.message);
    }
    
    // Test login
    console.log('2. Testing login...');
    try {
      const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
        email: 'test@example.com',
        password: 'testpass123'
      });
      console.log('✅ Login successful:', loginResponse.data);
    } catch (loginError) {
      console.log('❌ Login failed:', loginError.response?.data || loginError.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAuth();