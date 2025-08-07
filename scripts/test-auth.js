#!/usr/bin/env node

/**
 * Authentication Test Script
 * 
 * This script helps test authentication and authorization for different endpoints.
 */

const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3001/api';

async function testLogin(email, password) {
  console.log(`🔐 Testing login for: ${email}`);
  
  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Login successful');
      console.log(`   Response: ${JSON.stringify(data, null, 2)}`);
      if (data.user) {
        console.log(`   User: ${data.user.name} (${data.user.email})`);
        console.log(`   Role: ${data.user.role}`);
      }
      const token = data.data?.token || data.token || data.access_token || data.accessToken;
      if (token) {
        console.log(`   Token: ${token.substring(0, 20)}...`);
        return token;
      }
      return null;
    } else {
      console.log('❌ Login failed:', data.error);
      return null;
    }
  } catch (error) {
    console.log('❌ Login error:', error.message);
    return null;
  }
}

async function testPromoterEndpoint(token) {
  console.log('\n🔍 Testing promoter endpoint access...');
  
  try {
    const response = await fetch(`${API_BASE}/promoter/market-intelligence/brechos/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        location: { lat: -23.5505, lng: -46.6333, radius: 5000 }
      })
    });

    const data = await response.json();
    
    console.log(`   Status: ${response.status}`);
    
    if (response.ok) {
      console.log('✅ Promoter endpoint accessible');
      console.log(`   Response: ${JSON.stringify(data, null, 2).substring(0, 200)}...`);
    } else {
      console.log('❌ Promoter endpoint blocked:', data.error);
      console.log(`   Full response: ${JSON.stringify(data, null, 2)}`);
    }
  } catch (error) {
    console.log('❌ Promoter endpoint error:', error.message);
  }
}

async function testUserProfile(token) {
  console.log('\n👤 Testing user profile endpoint...');
  
  try {
    const response = await fetch(`${API_BASE}/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Profile accessible');
      console.log(`   User: ${data.user.name}`);
      console.log(`   Role: ${data.user.role}`);
      console.log(`   Email Verified: ${data.user.emailVerified ? '✅' : '❌'}`);
      console.log(`   Has Promoter: ${data.user.promoter ? '✅' : '❌'}`);
    } else {
      console.log('❌ Profile not accessible:', data.error);
    }
  } catch (error) {
    console.log('❌ Profile error:', error.message);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const email = args[0] || 'fvcoelho@gmail.com';
  const password = args[1] || 'senha123'; // Assuming this is the password, adjust if needed

  console.log('🧪 Authentication Test');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const token = await testLogin(email, password);
  
  if (token) {
    await testUserProfile(token);
    await testPromoterEndpoint(token);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Test completed');
}

main().catch(console.error);