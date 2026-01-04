# WhatsApp New Features Guide

## ✨ Two New Features Added

### 1. 📸 Image Sending
### 2. 🔄 Message Batching (Combine Rapid Messages)

---

## 🚀 Quick Start

### Step 1: Run the SQL Migration

Go to your Supabase SQL Editor:
https://supabase.com/dashboard/project/xatrtqdgghanwdujyhkq/sql/new

Copy and paste this SQL:
```sql
ALTER TABLE avatars
ADD COLUMN IF NOT EXISTS whatsapp_enable_images BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS whatsapp_message_batch_timeout INTEGER DEFAULT 0;
```

Click **RUN** - you should see "Success. No rows returned"

### Step 2: Configure in Your UI

1. Go to: http://localhost:8080/chatbot/whatsapp
2. Scroll down to **WhatsApp Message Settings** section
3. You'll see two new options:
   - **Enable Image Sending** (toggle switch)
   - **Message Batching** (slider: 0-15 seconds)

---

## 📸 Feature 1: Image Sending

### What It Does
Your chatbot can now send product images to customers via WhatsApp!

### How to Use in n8n

Your n8n AI agent should return an `images` array in its response:

**Example 1: Simple image URL**
```json
{
  "reply": "Here's the iPhone 14 you asked about!",
  "images": [
    "https://example.com/products/iphone14.jpg"
  ]
}
```

**Example 2: Image with caption**
```json
{
  "reply": "We have several iPhone models available:",
  "images": [
    {
      "url": "https://example.com/products/iphone14.jpg",
      "caption": "iPhone 14 - RM 3,999"
    },
    {
      "url": "https://example.com/products/iphone14pro.jpg",
      "caption": "iPhone 14 Pro - RM 4,999"
    }
  ]
}
```

**Example 3: Multiple images**
```json
{
  "reply": "Here are all our laptop options:",
  "images": [
    "https://storage.com/laptop1.jpg",
    "https://storage.com/laptop2.jpg",
    "https://storage.com/laptop3.jpg"
  ]
}
```

### How It Works
1. Customer asks: "Show me the iPhone 14"
2. Your n8n AI finds the product and returns the response with image URL
3. Chatbot sends the text message first
4. Then sends each image separately with optional captions
5. Images appear in WhatsApp just like photos you send manually

### Image Format Support
- **URLs**: Any publicly accessible image URL (HTTPS recommended)
- **Formats**: JPG, PNG, GIF, WebP
- **Size**: Keep images under 5MB for best performance

### Settings
- **Enable/Disable**: Toggle in UI (default: enabled)
- When disabled, the `images` array is ignored and only text is sent

---

## 🔄 Feature 2: Message Batching

### What It Does
Prevents multiple rapid chatbot responses when users send multiple messages quickly.

### The Problem It Solves

**Without batching:**
- Customer sends: "hello" → Bot replies immediately
- Customer sends: "do you have iphones?" (2 seconds later) → Bot replies again
- **Result:** Two separate chatbot responses, confusing conversation

**With batching (5-10 seconds):**
- Customer sends: "hello" → Timer starts (e.g., 10 seconds)
- Customer sends: "do you have iphones?" → Added to batch
- Customer sends: "what colors available?" → Added to batch
- **After 10 seconds:** Combined message sent to n8n: "hello\ndo you have iphones?\nwhat colors available?"
- **Result:** One intelligent response considering all questions

### How to Configure

**Option 1: Disabled (Default)**
- Set slider to `0`
- Every message triggers immediate response
- Best for: Quick back-and-forth conversations

**Option 2: 5-10 Seconds (Recommended)**
- Set slider to `5`, `7`, or `10`
- Waits this many seconds to batch messages
- Best for: Most business use cases

**Option 3: 15 Seconds (Max)**
- Set slider to `15`
- Longer wait time for very slow typers
- Best for: Users who type very slowly or send many messages

### How It Works

```
Timeline Example (10-second batching):

00:00 - Customer: "hello" → Buffer starts, 10s timer starts
00:03 - Customer: "how are you" → Added to buffer, timer resets to 10s
00:07 - Customer: "do you sell laptops?" → Added to buffer, timer resets to 10s
00:17 - (10s elapsed) → Send to n8n: "hello\nhow are you\ndo you sell laptops?"
00:20 - n8n returns: "Hi! I'm doing great! Yes, we sell laptops..."
00:20 - Chatbot sends reply via WhatsApp
```

### Technical Details
- Messages are combined with line breaks (`\n`)
- Timer resets with each new message (debouncing)
- Each user has their own separate buffer
- Buffer is cleared after sending to n8n

---

## 🎯 Best Practices

### Image Sending
✅ **Do:**
- Use product images from your Supabase Storage
- Keep images under 2MB for faster delivery
- Add descriptive captions for better context
- Test image URLs before deploying

❌ **Don't:**
- Use very large images (>5MB) - they may fail
- Send more than 3-4 images at once (overwhelming)
- Use broken or private URLs

### Message Batching
✅ **Do:**
- Start with 5-7 seconds for most use cases
- Test with real customers to find ideal timeout
- Inform customers if responses seem delayed
- Use with customers who send multiple questions

❌ **Don't:**
- Set too high (>15s) - customers will think bot is broken
- Use for time-sensitive conversations (set to 0)
- Combine with very slow AI response times

---

## 🔧 Testing Your Setup

### Test Image Sending
1. Enable image sending in UI
2. Send WhatsApp message: "show me a product"
3. Your n8n should return image URL in response
4. Verify image appears in WhatsApp chat

### Test Message Batching
1. Set batching to 5 seconds
2. Send 3 messages rapidly:
   - "hello"
   - "how are you"
   - "do you sell laptops"
3. Wait 5 seconds
4. Check Railway logs: should see "Processing 3 batched messages"
5. Verify single response from chatbot

---

## 📊 Checking Logs

### Railway Logs (WhatsApp Service)
```bash
cd whatsapp-web-service
railway logs --service whatsapp-web-service
```

**Look for:**
- `"n8n response includes X image(s)"` - Images detected
- `"Sending X image(s)..."` - Images being sent
- `"Processing X batched messages"` - Batching working
- `"Started batch buffer (Xs timeout)"` - Batching active

---

## 🆘 Troubleshooting

### Images Not Sending
1. Check if toggle is enabled in UI
2. Verify image URLs are publicly accessible
3. Check Railway logs for errors
4. Test URL in browser first

### Batching Not Working
1. Verify timeout is > 0 in UI
2. Check Railway logs for batch messages
3. Test with messages < 5 seconds apart
4. Ensure messages are from same user

### Database Errors
1. Ensure SQL migration ran successfully
2. Check Supabase table browser for new columns
3. Refresh chatbot settings page

---

## 🎉 Summary

**You now have:**
1. ✅ Image sending capability via n8n
2. ✅ Message batching to reduce duplicate responses
3. ✅ Full UI controls for both features
4. ✅ Deployed to Railway and ready to use!

**Next Steps:**
1. Run the SQL migration (if you haven't already)
2. Configure settings in your UI
3. Update your n8n workflow to return images
4. Test with real WhatsApp messages
5. Adjust batching timeout based on your needs

---

Need help? Check the Railway logs or test in your local environment first!
