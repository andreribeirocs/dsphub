# WhatsApp Integration Setup

This document describes how to set up WhatsApp messaging integration using Twilio.

## Prerequisites

1. A Twilio account
2. WhatsApp Business API access (approved by Twilio)
3. A verified WhatsApp Business phone number
4. Approved WhatsApp message templates

## Environment Variables

Add the following environment variables to your `.env` file:

```bash
# Twilio WhatsApp Configuration
TWILIO_ACCOUNT_SID="your_twilio_account_sid"
TWILIO_AUTH_TOKEN="your_twilio_auth_token"
TWILIO_WHATSAPP_NUMBER="whatsapp:+14155238886"  # Sandbox number for testing
TWILIO_WHATSAPP_TEMPLATE_HELLO_THERE="your_template_content_sid"  # Template SID for initiating conversations
```

## ⚠️ Important: Sandbox vs Production

### Sandbox Mode (Testing)

- **Number**: `whatsapp:+14155238886` (default sandbox number)
- **Limitations**:
  - Can only send messages to verified test numbers
  - Recipients must first send `join <your-sandbox-keyword>` to the sandbox number
  - Messages expire after 24 hours if recipient doesn't respond
  - Limited to testing purposes only

### Production Mode

- **Number**: Your own verified WhatsApp Business number (e.g., `whatsapp:+1234567890`)
- **Requirements**:
  - Verified WhatsApp Business account
  - Approved message templates
  - Business verification with Meta
  - Can send to any WhatsApp number

## Twilio Configuration Steps

### 1. Create a Twilio Account

- Go to [Twilio Console](https://console.twilio.com/)
- Sign up or log in to your account
- Get your Account SID and Auth Token from the Dashboard

### 2. Set up WhatsApp Sandbox (for testing)

- Go to [WhatsApp Sandbox](https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn)
- Follow the instructions to activate the sandbox
- Note your unique sandbox keyword (e.g. "join elephant-solar")
- **Important**: Test recipients must send this message to your sandbox number first

#### Testing with Sandbox:

1. Recipients send: `join <your-sandbox-keyword>` to `+1 415 523 8886`
2. They will receive a confirmation message
3. Now you can send messages to their number through the API

### 3. Configure Webhooks

Set up the following webhook URLs in your Twilio Console:

**For incoming messages:**

```
https://yourdomain.com/whatsapp/webhook
```

**For status updates:**

```
https://yourdomain.com/whatsapp/webhook
```

### 4. Production Setup

For production, you'll need:

- A verified WhatsApp Business number from Twilio
- Approved message templates (for marketing messages)
- Business verification with Meta
- Update `TWILIO_WHATSAPP_NUMBER` to your production number

## API Endpoints

### Send Message (Automatic Template Handling)

```http
POST /whatsapp/send
Content-Type: application/json

{
  "to": "+5562992317121",
  "body": "Hello from the dispatch team!"
}
```

**Note**:

- For new conversations, this will automatically send the template message first
- For sandbox testing, ensure the recipient number has joined your sandbox first

### Send Template Message Manually

```http
POST /whatsapp/send-template
Content-Type: application/json

{
  "to": "+5562992317121"
}
```

This endpoint manually sends the "Hello there!" template message to initiate a conversation.

### Get Conversations

```http
GET /whatsapp/conversations
```

### Send Quick Message

```http
POST /whatsapp/quick-message
Content-Type: application/json

{
  "to": "+5562992317121",
  "template": "greeting"
}
```

Available templates:

- `greeting`: Hello! This is a message from the dispatch team.
- `availability`: Please confirm your availability for today.
- `document_reminder`: Your documents are expiring soon. Please update them.
- `thank_you`: Thank you for your service today!

## WebSocket Events

The WhatsApp service uses WebSockets for real-time communication:

### Client Events

- `join_room`: Join a conversation room
- `leave_room`: Leave a conversation room
- `typing_start`: Indicate typing
- `typing_stop`: Stop typing indication

### Server Events

- `new_message`: New message received
- `message_status_update`: Message status changed
- `conversation_update`: Conversation updated
- `connection_status`: Connection status changed

## Testing

The service includes mock data for development and testing. When Twilio credentials are not configured, the service operates in mock mode.

To enable mock conversations, the service automatically initializes sample conversations on startup.

## Security Notes

1. Validate webhook requests from Twilio using request signatures
2. Use HTTPS for all webhook endpoints
3. Store credentials securely
4. Implement rate limiting for message sending
5. Validate phone numbers before sending messages

## Troubleshooting

### Common Issues

1. **"Twilio credentials not configured"**

   - Check that TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are set
   - Verify credentials are correct

2. **"Invalid From and To pair" (Error 21910)**

   - **Most Common Cause**: Using sandbox number but recipient hasn't joined sandbox
   - **Solution for Sandbox**:
     1. Recipient must send `join <your-sandbox-keyword>` to `+1 415 523 8886`
     2. Wait for confirmation message
     3. Then try sending the message again
   - **Solution for Production**: Use your verified WhatsApp Business number
   - **Check**: Ensure both numbers have `whatsapp:` prefix in Twilio format

3. **Webhook not receiving messages**

   - Ensure webhook URL is publicly accessible
   - Check Twilio webhook configuration
   - Verify URL is using HTTPS

4. **Messages not sending**
   - Check phone number format (+country_code_number)
   - Verify WhatsApp number is approved for messaging
   - Check message content against Twilio policies

### Example: Fixing Sandbox Issues

If you're getting "Invalid From and To pair" errors:

1. **Check your Twilio Console**: Go to WhatsApp Sandbox settings
2. **Find your sandbox keyword**: Usually something like "join elephant-solar"
3. **On the recipient's phone**: Send this exact message to `+1 415 523 8886`
4. **Wait for confirmation**: Should receive "You are all set!"
5. **Try sending again**: Now the API call should work

### Logs

The service logs all WhatsApp operations. Check the console for:

- Message sending attempts
- Webhook processing
- Connection status
- Error messages

## ⚠️ Important: Template Messages & Conversation Flow

### WhatsApp Business API Requirements

When using WhatsApp Business API, you must follow these rules:

1. **Template Messages**: To initiate a conversation with a user who hasn't messaged you in the last 24 hours, you must send an approved template message first
2. **24-Hour Window**: After sending a template or receiving a message, you have 24 hours to send free-form messages
3. **Conversation Initiation**: Our service automatically handles this by sending the "Hello there!" template when needed

### How Our Service Works

- **First Message**: Automatically sends the template message, then your actual message
- **Existing Conversations**: Sends messages directly if within the 24-hour window
- **Template Message**: "Hello there!" (configured in your Twilio console)
