# 🚀 n8n Integration Setup - Complete Guide

This document provides step-by-step instructions for setting up n8n integration with your WhatsApp chatbot platform.

## 📋 Overview

Your platform now supports **SaaS multi-tenant n8n integration**, meaning:
- Each chatbot can have its own n8n workflow URL
- No global `.env` configuration needed
- Technical users can configure webhooks per chatbot via UI
- All configuration is stored in the database

## ⚙️ What Was Implemented

### 1. Database Schema
- Added `n8n_webhook_url` column to store webhook URL per chatbot
- Added `n8n_enabled` flag to enable/disable n8n per chatbot
- Added `n8n_configured_at` timestamp
- Added `n8n_last_used_at` for monitoring

### 2. WhatsApp Service Integration
- Modified `whatsapp-web-service/index.js` to fetch webhook URL from database
- Calls n8n webhook with full chatbot context (system prompt, products, knowledge base, conversation history)
- Falls back to Supabase edge function if n8n not configured
- Updates usage timestamp on each n8n call

### 3. UI Components
- Created `N8nConfigurationCard` component in chatbot Settings
- Webhook URL input with validation
- Save, Test, and Remove functionality
- Visual status indicators (Active badge)
- Last used timestamp display

### 4. n8n Workflow Template
- Ready-to-import workflow JSON file
- Includes all necessary nodes: Webhook → Data Processing → AI Chat → Response
- Handles products, knowledge base, and conversation history
- Configurable AI provider (OpenAI, Claude, etc.)

## 🔧 Setup Steps

### Step 1: Run Database Migration

**IMPORTANT**: This must be done first!

1. Open Supabase Dashboard
2. Go to SQL Editor
3. Click "New Query"
4. Copy and paste the contents of `supabase/migrations/20260104000000_n8n_integration.sql`
5. Click "Run"

**Expected Output**: "Success. No rows returned"

**Migration SQL**:
```sql
-- Add n8n configuration columns to avatars table
ALTER TABLE avatars
ADD COLUMN IF NOT EXISTS n8n_webhook_url TEXT,
ADD COLUMN IF NOT EXISTS n8n_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS n8n_configured_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS n8n_last_used_at TIMESTAMPTZ;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_avatars_n8n_enabled ON avatars(n8n_enabled) WHERE n8n_enabled = TRUE;
```

### Step 2: Set Up n8n Instance

**Option A: n8n Cloud (Recommended)**

1. Go to https://n8n.io
2. Click "Get Started Free"
3. Create account
4. You'll get a URL like: `https://yourname.app.n8n.cloud`

**Option B: Self-Hosted**

```bash
# Using npx (easiest for testing)
npx n8n

# Using Docker (production)
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n
```

### Step 3: Import Workflow Template

1. **Log in to n8n**
2. **Import Workflow**:
   - Click "Workflows" in sidebar
   - Click "Import from File"
   - Select `n8n-workflow-template.json`
   - Click "Import"

3. **Configure AI Credentials**:
   - Click on "OpenAI Chat" node
   - Click "Create New Credential"
   - Enter your OpenAI API key
   - Click "Save"
   - **Alternative**: Replace with Anthropic Claude, Google Gemini, or other AI providers

4. **Get Webhook URL**:
   - Click on "Webhook - WhatsApp Message" node
   - Copy the **Production URL**
   - Example: `https://yourname.app.n8n.cloud/webhook/whatsapp-chatbot`
   - **Save this URL - you'll need it in Step 4!**

5. **Activate Workflow**:
   - Click "Active" toggle in top right (should turn blue/green)
   - Your workflow is now live!

### Step 4: Configure in Platform UI

1. **Navigate to Chatbot Settings**:
   - Log in to your platform
   - Go to Dashboard
   - Click on a chatbot
   - Go to "Settings" tab

2. **Configure n8n Integration**:
   - Scroll down to "n8n Integration" section
   - Paste your n8n webhook URL from Step 3.4
   - Click "Save Configuration"

3. **Test the Integration**:
   - Click "Test Webhook" button
   - You should see "Test successful" message
   - Check n8n Dashboard → Executions to see the test call

### Step 5: Test End-to-End

1. **Ensure WhatsApp is Connected**:
   - In chatbot Settings, check "WhatsApp Integration" section
   - Status should show "WhatsApp Connected"

2. **Send Test Message**:
   - Send a WhatsApp message to your connected number
   - Message should arrive in platform

3. **Verify n8n Processing**:
   - Go to n8n Dashboard → Executions
   - You should see a new execution with your message
   - Check the execution details to see data flow

4. **Check Auto-Reply**:
   - WhatsApp should receive an AI-generated reply
   - Reply should be contextual based on your chatbot settings

## 🎯 How It Works

### Data Flow

```
WhatsApp Message
    ↓
WhatsApp Service (index.js)
    ↓
Fetch chatbot config from database
    ↓
Check if n8n_enabled = true
    ↓
YES → Call n8n webhook with full context
NO → Call Supabase edge function
    ↓
n8n Workflow Processing
    ↓
    • Extract data (message, chatbot config)
    • Format context (products, KB, history)
    • Call AI (OpenAI/Claude/etc.)
    • Format response
    ↓
Return { "reply": "..." } to WhatsApp Service
    ↓
WhatsApp Service sends reply
    ↓
User receives message on WhatsApp
```

### Data Sent to n8n

Every webhook call includes:

```json
{
  "message": "User's message text",
  "from_number": "60165334085@s.whatsapp.net",

  "chatbot": {
    "id": "uuid",
    "name": "Wendy",
    "company_name": "ABC Electronics",
    "industry": "ecommerce",
    "system_prompt": "You are Wendy, a helpful sales assistant...",
    "business_context": "We sell consumer electronics...",
    "compliance_rules": ["Never promise delivery dates", "..."],
    "response_guidelines": ["Be friendly and professional", "..."]
  },

  "products": [
    {
      "id": "uuid",
      "name": "iPhone 15 Pro",
      "price": 999,
      "description": "Latest iPhone with A17 chip",
      "stock": 50
    }
  ],

  "knowledge_base": [
    {
      "id": "uuid",
      "title": "Shipping Policy",
      "content": "We ship within 24 hours..."
    }
  ],

  "conversation_history": [
    {
      "direction": "inbound",
      "content": "Hi",
      "timestamp": "2026-01-04T06:30:00Z"
    },
    {
      "direction": "outbound",
      "content": "Hello! How can I help?",
      "timestamp": "2026-01-04T06:30:02Z"
    }
  ]
}
```

### Expected Response from n8n

Your workflow MUST return JSON with a `reply` field:

```json
{
  "reply": "Your AI-generated message here"
}
```

Alternative field names (auto-detected):
- `reply`
- `response`
- `message`

## 🔍 Troubleshooting

### Migration Failed

**Error**: Column already exists
**Solution**: Migration was already run. This is safe to ignore.

**Error**: Permission denied
**Solution**: Ensure you're using Supabase service role in SQL Editor, not anon key.

### n8n Workflow Not Executing

**Check 1**: Workflow Active?
- Go to n8n Dashboard
- Check workflow has green/blue "Active" toggle

**Check 2**: Webhook URL Correct?
- In platform, go to chatbot Settings
- Verify webhook URL matches n8n Production URL
- Should be full URL with `https://`

**Check 3**: AI Credentials Configured?
- Click on OpenAI Chat node
- Verify credentials are set and valid

### No Reply Received

**Check WhatsApp Service Logs**:
```bash
cd whatsapp-web-service
npm start
```

Look for:
```
Calling n8n webhook for chatbot <id>...
n8n response received: <reply text>
```

**Check n8n Executions**:
- Go to n8n Dashboard → Executions
- Look for failed executions
- Check error details

**Check Response Format**:
- In n8n execution, verify last node returns:
  ```json
  { "reply": "..." }
  ```

### Test Webhook Fails

**Error**: Network error
**Solution**:
- Verify n8n is accessible from WhatsApp service
- Check firewall/network settings
- Try accessing webhook URL in browser

**Error**: 404 Not Found
**Solution**:
- Verify workflow is Active in n8n
- Check webhook path is correct (`whatsapp-chatbot`)
- Copy Production URL, not Test URL

## 🎨 Customizing Your Workflow

### Change AI Provider

Replace "OpenAI Chat" node with:
- **Anthropic Claude**: Better for complex reasoning
- **Google Gemini**: Cost-effective option
- **Ollama**: Run AI locally for free
- **Mistral**: European alternative

### Add Product Search

Add a "Code" node before AI:

```javascript
const products = $json.products;
const query = $json.message.toLowerCase();

// Search products by name or description
const matches = products.filter(p =>
  p.name.toLowerCase().includes(query) ||
  p.description.toLowerCase().includes(query)
);

// Return top 5 matches
return {
  json: {
    ...$json,
    relevant_products: matches.slice(0, 5)
  }
};
```

Update AI prompt to use `{{ $json.relevant_products }}`

### Add RAG with Knowledge Base

1. Add "Vector Store" node
2. Configure with Pinecone/Qdrant/Weaviate
3. Index knowledge base articles
4. Query vector store with user message
5. Add results to AI context

### Add Order Status Check

Add "HTTP Request" node:

```javascript
// In Code node
const phoneNumber = $json.from_number;

// Call your API
const response = await fetch('https://your-api.com/orders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: phoneNumber })
});

const orders = await response.json();
```

## 📊 Monitoring

### Check n8n Usage

Go to chatbot Settings → n8n Integration section:
- **Last Used**: Shows last webhook call timestamp
- **Status**: Active badge when configured

### Database Query

Check all chatbots with n8n enabled:

```sql
SELECT
  name,
  n8n_webhook_url,
  n8n_enabled,
  n8n_configured_at,
  n8n_last_used_at
FROM avatars
WHERE n8n_enabled = true
ORDER BY n8n_last_used_at DESC;
```

### n8n Executions

Go to n8n Dashboard → Executions:
- See all webhook calls
- Filter by workflow
- View execution details
- Debug errors

## 🔐 Security Notes

1. **Webhook URLs are sensitive**: Don't share publicly
2. **Use HTTPS**: n8n cloud uses HTTPS by default
3. **API Keys**: Store in n8n credentials, not in workflow
4. **Access Control**: Only technical users should configure n8n
5. **Monitor Usage**: Check n8n_last_used_at for unusual activity

## 🎉 Success Criteria

Your n8n integration is working correctly if:

1. ✅ Database migration ran successfully
2. ✅ n8n workflow is Active and executing
3. ✅ Chatbot Settings shows n8n configuration
4. ✅ Test webhook returns success
5. ✅ WhatsApp messages trigger n8n executions
6. ✅ AI replies are sent back to WhatsApp
7. ✅ Last used timestamp updates on each message

## 📚 Next Steps

### For Technical Users

1. **Create Multiple Workflows**: Each chatbot can have unique n8n workflow
2. **Add Custom Tools**: Integrate with your APIs, databases, CRMs
3. **Implement RAG**: Use vector stores for knowledge base search
4. **Multi-Agent Setup**: Route to different AI agents based on intent
5. **Analytics**: Track conversations, sentiment, common queries

### For End Users

Once configured by technical team:
1. Messages automatically use n8n AI
2. No action needed from end users
3. Can update chatbot settings (business context, products, KB)
4. AI automatically uses updated information

## 🆘 Support

If you encounter issues:

1. **Check Logs**: WhatsApp service console + n8n Executions
2. **Test Components**: Test webhook button, manual curl test
3. **Verify Configuration**: Database, webhook URL, workflow Active
4. **Review Guide**: Re-read setup steps carefully
5. **Documentation**: See `N8N_INTEGRATION_GUIDE.md` for detailed info

---

**Your n8n integration is now ready! Each chatbot in your SaaS platform can have its own AI workflow.** 🚀
