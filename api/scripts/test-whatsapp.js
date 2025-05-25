const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:3000'; // Adjust if your API runs on a different port
const TEST_PHONE_NUMBER = '+5562992317121'; // The number from the error logs

async function testWhatsAppService() {
  console.log('🧪 Testing WhatsApp Service with Template Messages\n');

  try {
    // Test 1: Health check
    console.log('1. Testing API health...');
    const healthResponse = await axios.get(`${API_BASE_URL}/whatsapp/health`);
    console.log('✅ API is running:', healthResponse.data);
  } catch (error) {
    console.log('❌ API health check failed:', error.message);
    return;
  }

  try {
    // Test 2: Send template message manually
    console.log('\n2. Testing manual template message...');
    const templateData = {
      to: TEST_PHONE_NUMBER
    };

    console.log('Sending template message to:', templateData.to);

    const templateResponse = await axios.post(`${API_BASE_URL}/whatsapp/send-template`, templateData);
    console.log('✅ Template message sent successfully:', templateResponse.data);

  } catch (error) {
    console.log('❌ Template message sending failed:');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Error:', error.response.data);
    } else {
      console.log('Network error:', error.message);
    }
  }

  // Wait a bit before sending regular message
  console.log('\n⏳ Waiting 2 seconds before sending regular message...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  try {
    // Test 3: Send a test message (should use existing conversation)
    console.log('\n3. Testing regular message sending (with auto-template if needed)...');
    const messageData = {
      to: TEST_PHONE_NUMBER,
      body: 'Test message from WhatsApp service - ' + new Date().toLocaleTimeString()
    };

    console.log('Sending message to:', messageData.to);
    console.log('Message body:', messageData.body);

    const sendResponse = await axios.post(`${API_BASE_URL}/whatsapp/send`, messageData);
    console.log('✅ Message sent successfully:', sendResponse.data);

  } catch (error) {
    console.log('❌ Message sending failed:');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Error:', error.response.data);
      
      // Check for specific sandbox errors
      if (error.response.data.message && error.response.data.message.includes('Invalid From and To pair')) {
        console.log('\n💡 This looks like a sandbox issue!');
        console.log('📋 To fix this:');
        console.log('1. Go to your Twilio Console > WhatsApp Sandbox');
        console.log('2. Find your sandbox keyword (e.g., "join elephant-solar")');
        console.log(`3. Send that message from ${TEST_PHONE_NUMBER} to +1 415 523 8886`);
        console.log('4. Wait for confirmation, then try again');
      }

      // Check for template configuration errors
      if (error.response.data.message && error.response.data.message.includes('TWILIO_WHATSAPP_TEMPLATE_HELLO_THERE')) {
        console.log('\n💡 This looks like a template configuration issue!');
        console.log('📋 To fix this:');
        console.log('1. Make sure TWILIO_WHATSAPP_TEMPLATE_HELLO_THERE is set in your .env file');
        console.log('2. The value should be your template Content SID from Twilio Console');
        console.log('3. Ensure your template is approved in Twilio');
      }
    } else {
      console.log('Network error:', error.message);
    }
  }

  try {
    // Test 4: Get conversations
    console.log('\n4. Testing conversations retrieval...');
    const conversationsResponse = await axios.get(`${API_BASE_URL}/whatsapp/conversations`);
    console.log('✅ Conversations retrieved:', conversationsResponse.data.conversations.length, 'conversations');
    
    if (conversationsResponse.data.conversations.length > 0) {
      console.log('📱 Recent conversations:');
      conversationsResponse.data.conversations.slice(0, 3).forEach((conv, index) => {
        console.log(`   ${index + 1}. ${conv.driverName} (${conv.driverPhone}) - ${conv.lastMessage}`);
      });
    }

  } catch (error) {
    console.log('❌ Conversations retrieval failed:', error.response?.data || error.message);
  }

  console.log('\n✨ Test completed!');
}

// Run the test
testWhatsAppService().catch(console.error); 