#!/usr/bin/env node

/**
 * Test script to verify community membership detection behavior
 * This script simulates the bot removal and re-addition scenario
 */

const axios = require('axios');

// Configuration - update these values for your environment
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const BOT_USERNAME = process.env.BOT_USERNAME || 'meriter_bot';
const TEST_CHAT_ID = process.env.TEST_CHAT_ID || '-1001234567890';
const TEST_USER_ID = process.env.TEST_USER_ID || '123456789';

console.log('🧪 Community Membership Detection Test');
console.log('=====================================');
console.log(`API Base URL: ${API_BASE_URL}`);
console.log(`Bot Username: ${BOT_USERNAME}`);
console.log(`Test Chat ID: ${TEST_CHAT_ID}`);
console.log(`Test User ID: ${TEST_USER_ID}`);
console.log('');

async function simulateBotAddedToChat() {
  console.log('🤖 Simulating bot added to chat...');
  
  const webhookPayload = {
    update_id: Date.now(),
    message: {
      message_id: 1001,
      from: {
        id: 123456789,
        is_bot: false,
        first_name: 'Test',
        last_name: 'User',
        username: 'testuser',
        language_code: 'en',
      },
      chat: {
        id: parseInt(TEST_CHAT_ID),
        title: 'Test Community',
        username: 'testcommunity',
        type: 'supergroup',
      },
      date: Math.floor(Date.now() / 1000),
      new_chat_members: [
        {
          id: 987654321,
          is_bot: true,
          first_name: 'Meriter Bot',
          username: BOT_USERNAME,
        },
      ],
    },
  };

  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/telegram/hooks/${BOT_USERNAME}`,
      webhookPayload,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    console.log(`✅ Bot added webhook response: ${response.status}`);
    console.log(`Response: ${response.data}`);
    return true;
  } catch (error) {
    console.error(`❌ Bot added webhook failed:`, error.message);
    if (error.response) {
      console.error(`Response status: ${error.response.status}`);
      console.error(`Response data:`, error.response.data);
    }
    return false;
  }
}

async function simulateBotRemovedFromChat() {
  console.log('🚪 Simulating bot removed from chat...');
  
  const webhookPayload = {
    update_id: Date.now(),
    message: {
      message_id: 1002,
      from: {
        id: 123456789,
        is_bot: false,
        first_name: 'Test',
        last_name: 'User',
        username: 'testuser',
        language_code: 'en',
      },
      chat: {
        id: parseInt(TEST_CHAT_ID),
        title: 'Test Community',
        username: 'testcommunity',
        type: 'supergroup',
      },
      date: Math.floor(Date.now() / 1000),
      left_chat_member: {
        id: 987654321,
        is_bot: true,
        first_name: 'Meriter Bot',
        username: BOT_USERNAME,
      },
    },
  };

  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/telegram/hooks/${BOT_USERNAME}`,
      webhookPayload,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    console.log(`✅ Bot removed webhook response: ${response.status}`);
    console.log(`Response: ${response.data}`);
    return true;
  } catch (error) {
    console.error(`❌ Bot removed webhook failed:`, error.message);
    if (error.response) {
      console.error(`Response status: ${error.response.status}`);
      console.error(`Response data:`, error.response.data);
    }
    return false;
  }
}

async function testUserCommunitiesEndpoint() {
  console.log('📋 Testing user communities endpoint...');
  
  try {
    // Note: This would require authentication in a real scenario
    // For testing purposes, we'll just check if the endpoint exists
    const response = await axios.get(
      `${API_BASE_URL}/api/rest/getusercommunities`,
      {
        timeout: 5000,
      }
    );

    console.log(`✅ Communities endpoint response: ${response.status}`);
    console.log(`Communities found: ${response.data?.communities?.length || 0}`);
    return true;
  } catch (error) {
    if (error.response?.status === 401) {
      console.log(`🔒 Communities endpoint requires authentication (expected)`);
      return true;
    }
    console.error(`❌ Communities endpoint failed:`, error.message);
    return false;
  }
}

async function testSyncCommunitiesEndpoint() {
  console.log('🔄 Testing sync communities endpoint...');
  
  try {
    // Note: This would require authentication in a real scenario
    const response = await axios.post(
      `${API_BASE_URL}/api/rest/sync-communities`,
      {},
      {
        timeout: 10000,
      }
    );

    console.log(`✅ Sync communities endpoint response: ${response.status}`);
    console.log(`Sync result:`, response.data);
    return true;
  } catch (error) {
    if (error.response?.status === 401) {
      console.log(`🔒 Sync communities endpoint requires authentication (expected)`);
      return true;
    }
    console.error(`❌ Sync communities endpoint failed:`, error.message);
    return false;
  }
}

async function runTests() {
  console.log('Starting community membership detection tests...\n');

  const results = {
    botAdded: false,
    botRemoved: false,
    communitiesEndpoint: false,
    syncEndpoint: false,
  };

  // Test 1: Bot added to chat
  results.botAdded = await simulateBotAddedToChat();
  console.log('');

  // Wait a bit between requests
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 2: Bot removed from chat
  results.botRemoved = await simulateBotRemovedFromChat();
  console.log('');

  // Wait a bit between requests
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 3: Bot re-added to chat
  console.log('🔄 Simulating bot re-added to chat...');
  results.botAdded = await simulateBotAddedToChat();
  console.log('');

  // Test 4: Check endpoints
  results.communitiesEndpoint = await testUserCommunitiesEndpoint();
  console.log('');

  results.syncEndpoint = await testSyncCommunitiesEndpoint();
  console.log('');

  // Summary
  console.log('📊 Test Results Summary');
  console.log('======================');
  console.log(`Bot Added Webhook: ${results.botAdded ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Bot Removed Webhook: ${results.botRemoved ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Communities Endpoint: ${results.communitiesEndpoint ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Sync Endpoint: ${results.syncEndpoint ? '✅ PASS' : '❌ FAIL'}`);
  console.log('');

  const allPassed = Object.values(results).every(result => result);
  console.log(`Overall Result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  
  if (!allPassed) {
    console.log('\n💡 Next Steps:');
    console.log('1. Check server logs for detailed error messages');
    console.log('2. Verify bot token and webhook configuration');
    console.log('3. Ensure database is accessible');
    console.log('4. Check if all required environment variables are set');
  }

  return allPassed;
}

// Run the tests
if (require.main === module) {
  runTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = {
  simulateBotAddedToChat,
  simulateBotRemovedFromChat,
  testUserCommunitiesEndpoint,
  testSyncCommunitiesEndpoint,
  runTests,
};
