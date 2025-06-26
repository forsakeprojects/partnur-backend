// Create test.js in your project root
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const TEST_MOBILE = '+919876543210';

async function testBackend() {
    try {
        // Test 1: Health check
        console.log('🏥 Testing health endpoint...');
        const health = await axios.get(`${BASE_URL}/health`);
        console.log('✅ Health check:', health.data);

        // Test 2: First conversation (profile creation)
        console.log('\n💬 Testing first conversation...');
        const firstChat = await axios.post(`${BASE_URL}/chat`, {
            mobile_number: TEST_MOBILE,
            message: "Hi, I run a small salon in Kanpur and want to increase my sales"
        });
        console.log('✅ First chat response:', firstChat.data);

        // Test 3: Second conversation (more info)
        console.log('\n💬 Testing second conversation...');
        const secondChat = await axios.post(`${BASE_URL}/chat`, {
            mobile_number: TEST_MOBILE,
            message: "I earn around 80,000 rupees per month and get my stock from Meesho. Business is slow on weekdays."
        });
        console.log('✅ Second chat response:', secondChat.data);

        // Test 4: Get profile
        console.log('\n👤 Testing profile fetch...');
        const profile = await axios.get(`${BASE_URL}/profile/${TEST_MOBILE}`);
        console.log('✅ User profile:', JSON.stringify(profile.data, null, 2));

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
    }
}

// Run the test
testBackend();
